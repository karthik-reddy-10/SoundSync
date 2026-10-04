import type { RelayEvent } from "@/lib/types";

type Handler = (event: RelayEvent) => void;

const globalForBus = globalThis as typeof globalThis & {
  __relayBus?: Map<string, Set<Handler>>;
};

const rooms = globalForBus.__relayBus ?? new Map<string, Set<Handler>>();
globalForBus.__relayBus = rooms;

export function publish(roomCode: string, event: RelayEvent): void {
  const handlers = rooms.get(roomCode.toUpperCase());
  if (!handlers) return;
  for (const handler of handlers) {
    try {
      handler(event);
    } catch {
      // Ignore subscriber errors so one bad client cannot stall the room.
    }
  }
}

export function subscribe(roomCode: string, handler: Handler): () => void {
  const key = roomCode.toUpperCase();
  let handlers = rooms.get(key);
  if (!handlers) {
    handlers = new Set();
    rooms.set(key, handlers);
  }
  handlers.add(handler);
  return () => {
    handlers?.delete(handler);
    if (handlers && handlers.size === 0) {
      rooms.delete(key);
    }
  };
}
