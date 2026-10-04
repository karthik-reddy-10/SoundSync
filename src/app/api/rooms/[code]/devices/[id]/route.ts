import { NextResponse } from "next/server";
import { postSignal, updateDevice } from "@/lib/room-service";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ code: string; id: string }> },
) {
  const { code, id } = await context.params;
  const body = (await request.json()) as {
    volume?: number;
    muted?: boolean;
    name?: string;
    fromDeviceId?: string;
  };

  const device = await updateDevice(code, id, {
    volume: body.volume,
    muted: body.muted,
    name: body.name,
  });

  if (!device) {
    return NextResponse.json({ error: "Device not found" }, { status: 404 });
  }

  if (body.fromDeviceId && body.fromDeviceId !== id) {
    await postSignal({
      code,
      fromDeviceId: body.fromDeviceId,
      toDeviceId: id,
      type: "control",
      payload: {
        volume: device.volume,
        muted: device.muted,
      },
    });
  }

  return NextResponse.json({ device });
}
