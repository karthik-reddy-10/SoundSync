import { NextResponse } from "next/server";
import { serializeRoom } from "@/lib/serialize";
import { findRoomByCode, markStaleDevices, updateRoom } from "@/lib/room-service";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ code: string }> },
) {
  const { code } = await context.params;
  const room = await findRoomByCode(code);
  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }
  const devices = await markStaleDevices(room.id, room.code);
  return NextResponse.json({ room: serializeRoom(room), devices });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ code: string }> },
) {
  const { code } = await context.params;
  const body = (await request.json()) as {
    hostDeviceId?: string;
    status?: string;
    audioSource?: string;
    name?: string;
  };

  if (!body.hostDeviceId) {
    return NextResponse.json({ error: "hostDeviceId required" }, { status: 400 });
  }

  const room = await updateRoom(code, body.hostDeviceId, {
    status: body.status,
    audioSource: body.audioSource,
    name: body.name,
  });

  if (!room) {
    return NextResponse.json({ error: "Unable to update room" }, { status: 403 });
  }

  return NextResponse.json({ room });
}
