import { NextResponse } from "next/server";
import { guessDeviceName } from "@/lib/device-name";
import { countLiveRooms, createRoom, recentRooms } from "@/lib/room-service";

export const dynamic = "force-dynamic";

export async function GET() {
  const [liveCount, live] = await Promise.all([countLiveRooms(), recentRooms()]);
  return NextResponse.json({ liveCount, rooms: live });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      name?: string;
      hostName?: string;
    };
    const userAgent = request.headers.get("user-agent");
    const result = await createRoom({
      name: body.name?.trim() || "Relay",
      hostName: body.hostName?.trim() || guessDeviceName(userAgent),
      userAgent,
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create room";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
