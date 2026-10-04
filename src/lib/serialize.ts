import type { Device, Room, Signal } from "@/db/schema";
import type { DeviceDTO, RoomDTO, SignalDTO } from "@/lib/types";

export function serializeRoom(room: Room): RoomDTO {
  return {
    id: room.id,
    code: room.code,
    name: room.name,
    status: room.status as RoomDTO["status"],
    audioSource: room.audioSource as RoomDTO["audioSource"],
    createdAt: room.createdAt.toISOString(),
    updatedAt: room.updatedAt.toISOString(),
  };
}

export function serializeDevice(device: Device): DeviceDTO {
  return {
    id: device.id,
    roomId: device.roomId,
    name: device.name,
    role: device.role as DeviceDTO["role"],
    volume: device.volume,
    muted: device.muted,
    connected: device.connected,
    latencyMs: device.latencyMs,
    userAgent: device.userAgent,
    lastSeenAt: device.lastSeenAt.toISOString(),
    createdAt: device.createdAt.toISOString(),
  };
}

export function serializeSignal(signal: Signal): SignalDTO {
  return {
    id: signal.id,
    roomId: signal.roomId,
    fromDeviceId: signal.fromDeviceId,
    toDeviceId: signal.toDeviceId,
    type: signal.type as SignalDTO["type"],
    payload: signal.payload ?? {},
    createdAt: signal.createdAt.toISOString(),
  };
}
