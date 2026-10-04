import { and, desc, eq, gt, lt } from "drizzle-orm";
import { db } from "@/db";
import { devices, rooms, signals } from "@/db/schema";
import { publish } from "@/lib/bus";
import { generateRoomCode, normalizeRoomCode } from "@/lib/codes";
import { serializeDevice, serializeRoom, serializeSignal } from "@/lib/serialize";
import type { DeviceDTO, RoomDTO, SignalDTO, SignalType } from "@/lib/types";

const STALE_MS = 12_000;

export async function findRoomByCode(code: string) {
  const normalized = normalizeRoomCode(code);
  const [room] = await db.select().from(rooms).where(eq(rooms.code, normalized)).limit(1);
  return room ?? null;
}

export async function listDevices(roomId: string) {
  return db.select().from(devices).where(eq(devices.roomId, roomId)).orderBy(devices.createdAt);
}

export async function markStaleDevices(roomId: string, roomCode: string): Promise<DeviceDTO[]> {
  const now = Date.now();
  const current = await listDevices(roomId);
  const stale = current.filter(
    (device) => device.connected && now - device.lastSeenAt.getTime() > STALE_MS,
  );

  for (const device of stale) {
    const [updated] = await db
      .update(devices)
      .set({ connected: false })
      .where(eq(devices.id, device.id))
      .returning();
    if (updated) {
      publish(roomCode, { type: "device-updated", device: serializeDevice(updated) });
    }
  }

  return (await listDevices(roomId)).map(serializeDevice);
}

export async function createRoom(input: {
  name: string;
  hostName: string;
  userAgent?: string | null;
}): Promise<{ room: RoomDTO; device: DeviceDTO }> {
  let room = null;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = generateRoomCode();
    try {
      const [created] = await db
        .insert(rooms)
        .values({
          code,
          name: input.name.trim() || "Relay",
          status: "waiting",
        })
        .returning();
      room = created;
      break;
    } catch {
      room = null;
    }
  }

  if (!room) {
    throw new Error("Could not allocate a room code");
  }

  const [host] = await db
    .insert(devices)
    .values({
      roomId: room.id,
      name: input.hostName.trim() || "Host",
      role: "host",
      userAgent: input.userAgent ?? null,
      connected: true,
    })
    .returning();

  return { room: serializeRoom(room), device: serializeDevice(host) };
}

export async function joinRoom(input: {
  code: string;
  name: string;
  userAgent?: string | null;
}): Promise<{ room: RoomDTO; device: DeviceDTO; devices: DeviceDTO[] } | null> {
  const room = await findRoomByCode(input.code);
  if (!room || room.status === "ended") return null;

  const [device] = await db
    .insert(devices)
    .values({
      roomId: room.id,
      name: input.name.trim() || "Listener",
      role: "listener",
      userAgent: input.userAgent ?? null,
      connected: true,
    })
    .returning();

  const dto = serializeDevice(device);
  publish(room.code, { type: "device-joined", device: dto });

  const all = await markStaleDevices(room.id, room.code);
  return { room: serializeRoom(room), device: dto, devices: all };
}

export async function leaveRoom(code: string, deviceId: string): Promise<void> {
  const room = await findRoomByCode(code);
  if (!room) return;

  const [device] = await db.select().from(devices).where(eq(devices.id, deviceId)).limit(1);
  if (!device || device.roomId !== room.id) return;

  await db.delete(devices).where(eq(devices.id, deviceId));
  publish(room.code, { type: "device-left", deviceId });

  if (device.role === "host") {
    const [updated] = await db
      .update(rooms)
      .set({ status: "ended", updatedAt: new Date() })
      .where(eq(rooms.id, room.id))
      .returning();
    if (updated) {
      publish(room.code, { type: "room", room: serializeRoom(updated) });
    }
  }
}

export async function heartbeat(input: {
  code: string;
  deviceId: string;
  latencyMs?: number | null;
}): Promise<DeviceDTO | null> {
  const room = await findRoomByCode(input.code);
  if (!room) return null;

  const patch: Partial<typeof devices.$inferInsert> = {
    connected: true,
    lastSeenAt: new Date(),
  };
  if (typeof input.latencyMs === "number" && Number.isFinite(input.latencyMs)) {
    patch.latencyMs = Math.max(0, Math.round(input.latencyMs));
  }

  const [updated] = await db
    .update(devices)
    .set(patch)
    .where(and(eq(devices.id, input.deviceId), eq(devices.roomId, room.id)))
    .returning();

  if (!updated) return null;

  const dto = serializeDevice(updated);
  publish(room.code, { type: "device-updated", device: dto });
  return dto;
}

export async function updateRoom(
  code: string,
  hostDeviceId: string,
  patch: { status?: string; audioSource?: string; name?: string },
): Promise<RoomDTO | null> {
  const room = await findRoomByCode(code);
  if (!room) return null;

  const [host] = await db
    .select()
    .from(devices)
    .where(and(eq(devices.id, hostDeviceId), eq(devices.roomId, room.id), eq(devices.role, "host")))
    .limit(1);
  if (!host) return null;

  const next: Partial<typeof rooms.$inferInsert> = { updatedAt: new Date() };
  if (patch.status) next.status = patch.status;
  if (patch.audioSource) next.audioSource = patch.audioSource;
  if (patch.name) next.name = patch.name;

  const [updated] = await db.update(rooms).set(next).where(eq(rooms.id, room.id)).returning();
  if (!updated) return null;

  const dto = serializeRoom(updated);
  publish(room.code, { type: "room", room: dto });
  return dto;
}

export async function updateDevice(
  code: string,
  deviceId: string,
  patch: { volume?: number; muted?: boolean; name?: string },
): Promise<DeviceDTO | null> {
  const room = await findRoomByCode(code);
  if (!room) return null;

  const next: Partial<typeof devices.$inferInsert> = {};
  if (typeof patch.volume === "number") {
    next.volume = Math.min(150, Math.max(0, Math.round(patch.volume)));
  }
  if (typeof patch.muted === "boolean") next.muted = patch.muted;
  if (patch.name) next.name = patch.name;

  const [updated] = await db
    .update(devices)
    .set(next)
    .where(and(eq(devices.id, deviceId), eq(devices.roomId, room.id)))
    .returning();
  if (!updated) return null;

  const dto = serializeDevice(updated);
  publish(room.code, { type: "device-updated", device: dto });
  return dto;
}

export async function postSignal(input: {
  code: string;
  fromDeviceId: string;
  toDeviceId: string;
  type: SignalType;
  payload: Record<string, unknown>;
}): Promise<SignalDTO | null> {
  const room = await findRoomByCode(input.code);
  if (!room) return null;

  const [signal] = await db
    .insert(signals)
    .values({
      roomId: room.id,
      fromDeviceId: input.fromDeviceId,
      toDeviceId: input.toDeviceId,
      type: input.type,
      payload: input.payload,
    })
    .returning();

  const dto = serializeSignal(signal);
  publish(room.code, { type: "signal", signal: dto });
  return dto;
}

export async function fetchSignals(input: {
  code: string;
  deviceId: string;
  after?: string | null;
}): Promise<SignalDTO[]> {
  const room = await findRoomByCode(input.code);
  if (!room) return [];

  const afterDate = input.after ? new Date(input.after) : new Date(Date.now() - 15_000);
  const rows = await db
    .select()
    .from(signals)
    .where(
      and(
        eq(signals.roomId, room.id),
        eq(signals.toDeviceId, input.deviceId),
        gt(signals.createdAt, afterDate),
      ),
    )
    .orderBy(signals.createdAt)
    .limit(100);

  return rows.map(serializeSignal);
}

export async function pruneOldSignals(): Promise<void> {
  const cutoff = new Date(Date.now() - 2 * 60 * 1000);
  await db.delete(signals).where(lt(signals.createdAt, cutoff));
}

export async function countLiveRooms(): Promise<number> {
  const rows = await db.select({ id: rooms.id }).from(rooms).where(eq(rooms.status, "live"));
  return rows.length;
}

export async function recentRooms(): Promise<RoomDTO[]> {
  const rows = await db
    .select()
    .from(rooms)
    .where(eq(rooms.status, "live"))
    .orderBy(desc(rooms.updatedAt))
    .limit(6);
  return rows.map(serializeRoom);
}
