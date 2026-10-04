import { NextResponse } from "next/server";
import { heartbeat } from "@/lib/room-service";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ code: string }> },
) {
  const { code } = await context.params;
  const body = (await request.json()) as { deviceId?: string; latencyMs?: number | null };
  if (!body.deviceId) {
    return NextResponse.json({ error: "deviceId required" }, { status: 400 });
  }

  const device = await heartbeat({
    code,
    deviceId: body.deviceId,
    latencyMs: body.latencyMs,
  });

  if (!device) {
    return NextResponse.json({ error: "Device not found" }, { status: 404 });
  }

  return NextResponse.json({ device });
}
