import { NextResponse } from "next/server";
import { fetchSignals, postSignal, pruneOldSignals } from "@/lib/room-service";
import type { SignalType } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ code: string }> },
) {
  const { code } = await context.params;
  const body = (await request.json()) as {
    fromDeviceId?: string;
    toDeviceId?: string;
    type?: SignalType;
    payload?: Record<string, unknown>;
  };

  if (!body.fromDeviceId || !body.toDeviceId || !body.type) {
    return NextResponse.json({ error: "Invalid signal" }, { status: 400 });
  }

  const signal = await postSignal({
    code,
    fromDeviceId: body.fromDeviceId,
    toDeviceId: body.toDeviceId,
    type: body.type,
    payload: body.payload ?? {},
  });

  if (!signal) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  void pruneOldSignals();
  return NextResponse.json({ signal });
}

export async function GET(
  request: Request,
  context: { params: Promise<{ code: string }> },
) {
  const { code } = await context.params;
  const url = new URL(request.url);
  const deviceId = url.searchParams.get("deviceId");
  const after = url.searchParams.get("after");

  if (!deviceId) {
    return NextResponse.json({ error: "deviceId required" }, { status: 400 });
  }

  const signals = await fetchSignals({ code, deviceId, after });
  return NextResponse.json({ signals, now: new Date().toISOString() });
}
