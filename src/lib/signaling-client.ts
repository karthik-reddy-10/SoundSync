import type { RelayEvent, SignalDTO, SignalType } from "@/lib/types";

type Handler = (event: RelayEvent) => void;

export class SignalingClient {
  private source: EventSource | null = null;
  private pollTimer: number | null = null;
  private heartbeatTimer: number | null = null;
  private after: string = new Date(Date.now() - 1000).toISOString();
  private closed = false;
  private seen = new Set<string>();

  constructor(
    private readonly code: string,
    private readonly deviceId: string,
    private readonly onEvent: Handler,
  ) {}

  start(): void {
    this.closed = false;
    this.openEvents();
    this.pollTimer = window.setInterval(() => {
      void this.poll();
    }, 900);
    this.heartbeatTimer = window.setInterval(() => {
      void this.heartbeat();
    }, 3000);
    void this.heartbeat();
  }

  stop(): void {
    this.closed = true;
    this.source?.close();
    this.source = null;
    if (this.pollTimer != null) window.clearInterval(this.pollTimer);
    if (this.heartbeatTimer != null) window.clearInterval(this.heartbeatTimer);
  }

  async send(
    toDeviceId: string,
    type: SignalType,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await fetch(`/api/rooms/${this.code}/signal`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fromDeviceId: this.deviceId,
        toDeviceId,
        type,
        payload,
      }),
    });
  }

  async heartbeat(latencyMs?: number | null): Promise<void> {
    if (this.closed) return;
    try {
      await fetch(`/api/rooms/${this.code}/heartbeat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId: this.deviceId, latencyMs }),
      });
    } catch {
      // ignore transient network errors
    }
  }

  private openEvents(): void {
    try {
      const source = new EventSource(
        `/api/rooms/${this.code}/events?deviceId=${encodeURIComponent(this.deviceId)}`,
      );
      source.onmessage = (message) => {
        try {
          const event = JSON.parse(message.data) as RelayEvent;
          this.dispatch(event);
        } catch {
          // ignore malformed chunks
        }
      };
      source.onerror = () => {
        source.close();
        if (this.source === source) this.source = null;
        if (!this.closed) {
          window.setTimeout(() => {
            if (!this.closed && !this.source) this.openEvents();
          }, 1500);
        }
      };
      this.source = source;
    } catch {
      this.source = null;
    }
  }

  private async poll(): Promise<void> {
    if (this.closed) return;
    try {
      const res = await fetch(
        `/api/rooms/${this.code}/signal?deviceId=${encodeURIComponent(this.deviceId)}&after=${encodeURIComponent(this.after)}`,
      );
      if (!res.ok) return;
      const data = (await res.json()) as { signals: SignalDTO[]; now: string };
      this.after = data.now;
      for (const signal of data.signals) {
        this.dispatch({ type: "signal", signal });
      }
    } catch {
      // ignore
    }
  }

  private dispatch(event: RelayEvent): void {
    if (event.type === "signal") {
      if (this.seen.has(event.signal.id)) return;
      this.seen.add(event.signal.id);
      if (this.seen.size > 400) {
        const keep = Array.from(this.seen).slice(-200);
        this.seen = new Set(keep);
      }
    }
    this.onEvent(event);
  }
}
