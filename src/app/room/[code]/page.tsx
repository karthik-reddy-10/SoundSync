import { notFound } from "next/navigation";
import { RoomClient } from "@/components/RoomClient";
import { normalizeRoomCode } from "@/lib/codes";
import { findRoomByCode, markStaleDevices } from "@/lib/room-service";
import { serializeRoom } from "@/lib/serialize";

export const dynamic = "force-dynamic";

export default async function RoomPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const room = await findRoomByCode(normalizeRoomCode(code));
  if (!room) notFound();

  const devices = await markStaleDevices(room.id, room.code);

  return (
    <RoomClient
      code={room.code}
      initialRoom={serializeRoom(room)}
      initialDevices={devices}
    />
  );
}
