import { NextResponse } from "next/server";
import { leaveRoom } from "@/lib/room-service";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ code: string }> },
) {
  const { code } = await context.params;
  const body = (await request.json()) as { deviceId?: string };
  if (!body.deviceId) {
    return NextResponse.json({ error: "deviceId required" }, { status: 400 });
  }
  await leaveRoom(code, body.deviceId);
  return NextResponse.json({ ok: true });
}
