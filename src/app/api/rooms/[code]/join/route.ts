import { NextResponse } from "next/server";
import { guessDeviceName } from "@/lib/device-name";
import { joinRoom } from "@/lib/room-service";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ code: string }> },
) {
  const { code } = await context.params;
  const body = (await request.json()) as { name?: string };
  const userAgent = request.headers.get("user-agent");

  const result = await joinRoom({
    code,
    name: body.name?.trim() || guessDeviceName(userAgent),
    userAgent,
  });

  if (!result) {
    return NextResponse.json({ error: "Room not found or already ended" }, { status: 404 });
  }

  return NextResponse.json(result);
}
