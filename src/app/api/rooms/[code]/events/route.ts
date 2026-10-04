import { subscribe } from "@/lib/bus";
import { serializeRoom } from "@/lib/serialize";
import { findRoomByCode, markStaleDevices } from "@/lib/room-service";
import type { RelayEvent } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ code: string }> },
) {
  const { code } = await context.params;
  const room = await findRoomByCode(code);
  if (!room) {
    return new Response(JSON.stringify({ error: "Room not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url = new URL(request.url);
  const deviceId = url.searchParams.get("deviceId") ?? "";
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: RelayEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // stream already closed
        }
      };

      send({ type: "hello", deviceId });
      send({ type: "room", room: serializeRoom(room) });
      send({ type: "devices", devices: await markStaleDevices(room.id, room.code) });

      const unsubscribe = subscribe(room.code, send);
      const ping = setInterval(() => {
        send({ type: "ping", at: Date.now() });
      }, 8000);

      const close = () => {
        clearInterval(ping);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // ignore
        }
      };

      request.signal.addEventListener("abort", close);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
