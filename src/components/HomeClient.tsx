"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { CodeInput } from "@/components/CodeInput";
import { AdBanner } from "@/components/AdBanner";
import { guessDeviceName } from "@/lib/device-name";
import { normalizeRoomCode } from "@/lib/codes";
import { writeSession } from "@/lib/session";

type Props = {
  liveCount: number;
};

export function HomeClient({ liveCount }: Props) {
  const router = useRouter();
  const [roomName, setRoomName] = useState("Living room");
  const [hostName, setHostName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<"host" | "join" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const broadcast = async () => {
    setBusy("host");
    setError(null);
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: roomName,
          hostName: hostName.trim() || guessDeviceName(),
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        room?: { code: string };
        device?: { id: string; name: string; role: "host" | "listener" };
      };
      if (!res.ok || !data.room || !data.device) {
        throw new Error(data.error || "Could not create room");
      }
      writeSession({
        deviceId: data.device.id,
        role: "host",
        name: data.device.name,
        code: data.room.code,
      });
      router.push(`/room/${data.room.code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start");
      setBusy(null);
    }
  };

  const join = async () => {
    const normalized = normalizeRoomCode(code);
    if (normalized.length < 6) {
      setError("Enter the 6-character room code.");
      return;
    }
    setBusy("join");
    router.push(`/room/${normalized}`);
  };

  return (
    <main className="relative mx-auto min-h-screen w-full max-w-5xl px-6 py-8">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/images/mark.png" alt="Relay" className="h-9 w-9 rounded-md" />
          <span className="font-[family-name:var(--font-display)] text-xl tracking-tight">
            RELAY
          </span>
        </div>
        <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.2em] text-[#8b8b84]">
          {liveCount} live
        </p>
      </header>

      <section className="mt-16 grid gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
        <div>
          <p className="font-[family-name:var(--font-mono)] text-xs uppercase tracking-[0.24em] text-[#d4ff3a]">
            Free · Wi-Fi · Low latency
          </p>
          <h1 className="mt-4 max-w-xl font-[family-name:var(--font-display)] text-5xl leading-[0.95] tracking-tight sm:text-6xl">
            One source.
            <br />
            Every speaker.
          </h1>
          <p className="mt-5 max-w-md text-[15px] leading-6 text-[#8b8b84]">
            Broadcast from this device and play the same audio on phones, tablets, and
            laptops at the same time. Peer-to-peer WebRTC keeps delay tight on a local
            network.
          </p>
        </div>

        <div className="rounded-2xl border border-[#1d1d20] bg-[#0e0e10] p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-[#8b8b84]">Host</p>
          <label className="mt-4 block text-[11px] uppercase tracking-[0.16em] text-[#6f6f6a]">
            Room name
          </label>
          <input
            value={roomName}
            onChange={(event) => setRoomName(event.target.value)}
            className="mt-2 h-11 w-full rounded-md border border-[#2a2a2e] bg-[#101012] px-3 text-sm outline-none focus:border-[#d4ff3a]"
          />
          <label className="mt-3 block text-[11px] uppercase tracking-[0.16em] text-[#6f6f6a]">
            This device
          </label>
          <input
            value={hostName}
            placeholder="This device"
            onChange={(event) => setHostName(event.target.value)}
            className="mt-2 h-11 w-full rounded-md border border-[#2a2a2e] bg-[#101012] px-3 text-sm outline-none focus:border-[#d4ff3a]"
          />
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void broadcast()}
            className="mt-4 h-12 w-full rounded-md bg-[#d4ff3a] text-sm font-medium uppercase tracking-[0.16em] text-[#111] disabled:opacity-40"
          >
            {busy === "host" ? "Opening…" : "Start broadcast"}
          </button>
        </div>
      </section>

      <section className="mt-8 rounded-2xl border border-[#1d1d20] bg-[#0e0e10] p-5">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-[#8b8b84]">Join</p>
            <p className="mt-2 text-sm text-[#8b8b84]">
              Enter the host code. Keep both devices on the same Wi-Fi for the shortest path.
            </p>
            <div className="mt-4">
              <CodeInput value={code} onChange={setCode} onSubmit={() => void join()} />
            </div>
          </div>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void join()}
            className="h-12 rounded-md border border-[#2a2a2e] px-6 text-sm uppercase tracking-[0.16em] disabled:opacity-40"
          >
            {busy === "join" ? "Opening…" : "Connect"}
          </button>
        </div>
        {error ? <p className="mt-4 text-sm text-[#ff5c4d]">{error}</p> : null}
      </section>

      {/* Ad slot — replace slot ID after AdSense approval */}
      <section className="mt-10">
        <AdBanner slot="0000000000" format="auto" className="mx-auto max-w-2xl" />
      </section>

      <section className="mt-16 grid gap-6 border-t border-[#1d1d20] pt-8 sm:grid-cols-3">
        <Step n="01" title="Host" body="Start a room and share mic or system audio." />
        <Step n="02" title="Join" body="Open the code on every speaker you want." />
        <Step n="03" title="Play" body="WebRTC streams audio directly between devices." />
      </section>

      <footer className="mt-16 border-t border-[#1d1d20] pt-6 pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-[#6f6f6a]">
            Relay — free low-latency audio for every speaker.
          </p>
          <nav className="flex flex-wrap gap-4 text-xs text-[#8b8b84]">
            <Link href="/privacy" className="hover:text-[#d4ff3a]">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-[#d4ff3a]">
              Terms
            </Link>
            <a
              href="https://www.buymeacoffee.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#d4ff3a]"
            >
              Support
            </a>
          </nav>
        </div>
      </footer>
    </main>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div>
      <p className="font-[family-name:var(--font-mono)] text-[11px] tracking-[0.2em] text-[#d4ff3a]">
        {n}
      </p>
      <h2 className="mt-2 font-[family-name:var(--font-display)] text-xl tracking-tight">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-[#8b8b84]">{body}</p>
    </div>
  );
}
