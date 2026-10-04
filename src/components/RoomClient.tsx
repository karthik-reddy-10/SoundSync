"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Visualizer } from "@/components/Visualizer";
import { guessDeviceName } from "@/lib/device-name";
import {
  captureMicrophone,
  captureSystemAudio,
  createPeer,
  readRoundTripMs,
  stopStream,
  tweakSdpForLowLatency,
} from "@/lib/webrtc";
import { clearSession, readSession, writeSession } from "@/lib/session";
import { SignalingClient } from "@/lib/signaling-client";
import type { AudioSource, DeviceDTO, RelayEvent, RoomDTO, SessionInfo } from "@/lib/types";

type Props = {
  code: string;
  initialRoom: RoomDTO;
  initialDevices: DeviceDTO[];
};

type GateMode = "loading" | "gate" | "active";

function descriptionInit(
  desc: RTCSessionDescription | RTCSessionDescriptionInit | null,
): RTCSessionDescriptionInit | null {
  if (!desc) return null;
  return { type: desc.type, sdp: desc.sdp };
}

export function RoomClient({ code, initialRoom, initialDevices }: Props) {
  const [room, setRoom] = useState(initialRoom);
  const [devices, setDevices] = useState(initialDevices);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [mode, setMode] = useState<GateMode>("loading");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [needsGesture, setNeedsGesture] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [source, setSource] = useState<AudioSource>(initialRoom.audioSource);
  const [volume, setVolume] = useState(100);
  const [muted, setMuted] = useState(false);
  const [linkState, setLinkState] = useState("idle");

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef(new Map<string, RTCPeerConnection>());
  const listenerPcRef = useRef<RTCPeerConnection | null>(null);
  const pendingIceRef = useRef(new Map<string, RTCIceCandidateInit[]>());
  const signalingRef = useRef<SignalingClient | null>(null);
  const sessionRef = useRef<SessionInfo | null>(null);
  const devicesRef = useRef(initialDevices);
  const roomRef = useRef(initialRoom);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);
  useEffect(() => {
    devicesRef.current = devices;
  }, [devices]);
  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  const host = devices.find((device) => device.role === "host") ?? null;
  const listeners = devices.filter((device) => device.role === "listener");
  const connectedListeners = listeners.filter((device) => device.connected);
  const self = session ? devices.find((device) => device.id === session.deviceId) : null;
  const isHost = session?.role === "host";
  const isLive = room.status === "live";
  const visStream = isHost ? localStream : remoteStream;

  const avgLatency = useMemo(() => {
    const values = connectedListeners
      .map((device) => device.latencyMs)
      .filter((value): value is number => typeof value === "number");
    if (values.length === 0) return null;
    return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
  }, [connectedListeners]);

  const flushIce = useCallback(async (peerId: string, pc: RTCPeerConnection) => {
    const queued = pendingIceRef.current.get(peerId) ?? [];
    pendingIceRef.current.delete(peerId);
    for (const candidate of queued) {
      try {
        await pc.addIceCandidate(candidate);
      } catch {
        // stale
      }
    }
  }, []);

  const sendSignal = useCallback(
    async (toDeviceId: string, type: "offer" | "answer" | "ice" | "control" | "bye", payload: Record<string, unknown>) => {
      await signalingRef.current?.send(toDeviceId, type, payload);
    },
    [],
  );

  const closePeer = useCallback((deviceId: string) => {
    const pc = peersRef.current.get(deviceId);
    if (pc) {
      pc.close();
      peersRef.current.delete(deviceId);
    }
  }, []);

  const closeAllPeers = useCallback(() => {
    for (const [id, pc] of peersRef.current) {
      pc.close();
      peersRef.current.delete(id);
    }
    listenerPcRef.current?.close();
    listenerPcRef.current = null;
  }, []);

  const offerToListener = useCallback(
    async (listenerId: string) => {
      const stream = streamRef.current;
      const current = sessionRef.current;
      if (!stream || !current || current.role !== "host") return;

      closePeer(listenerId);
      const pc = createPeer((candidate) => {
        void sendSignal(listenerId, "ice", { candidate: candidate.toJSON() });
      });

      stream.getAudioTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed" || pc.connectionState === "closed") {
          closePeer(listenerId);
        }
      };

      peersRef.current.set(listenerId, pc);

      const offer = await pc.createOffer({
        offerToReceiveAudio: false,
        offerToReceiveVideo: false,
      });
      if (offer.sdp) offer.sdp = tweakSdpForLowLatency(offer.sdp);
      await pc.setLocalDescription(offer);
      await sendSignal(listenerId, "offer", {
        sdp: descriptionInit(pc.localDescription) ?? offer,
      });
      await flushIce(listenerId, pc);
    },
    [closePeer, flushIce, sendSignal],
  );

  const handleOfferAsListener = useCallback(
    async (fromDeviceId: string, sdp: RTCSessionDescriptionInit) => {
      listenerPcRef.current?.close();
      const pc = createPeer((candidate) => {
        void sendSignal(fromDeviceId, "ice", { candidate: candidate.toJSON() });
      });
      listenerPcRef.current = pc;

      pc.ontrack = (event) => {
        const stream = event.streams[0] ?? new MediaStream([event.track]);
        setRemoteStream(stream);
        const audio = audioRef.current;
        if (audio) {
          audio.srcObject = stream;
          const play = audio.play();
          if (play) {
            play.then(() => setNeedsGesture(false)).catch(() => setNeedsGesture(true));
          }
        }
        setLinkState("connected");
      };

      pc.onconnectionstatechange = () => {
        setLinkState(pc.connectionState);
        if (pc.connectionState === "failed") setError("Peer link dropped. Stay on the same Wi-Fi and rejoin.");
      };

      await pc.setRemoteDescription(sdp);
      await flushIce("host", pc);
      const answer = await pc.createAnswer();
      if (answer.sdp) answer.sdp = tweakSdpForLowLatency(answer.sdp);
      await pc.setLocalDescription(answer);
      await sendSignal(fromDeviceId, "answer", {
        sdp: descriptionInit(pc.localDescription) ?? answer,
      });
    },
    [flushIce, sendSignal],
  );

  const handleSignal = useCallback(
    async (event: RelayEvent) => {
      if (event.type === "room") {
        setRoom(event.room);
        if (event.room.status === "ended") {
          setError("The host ended this room.");
        }
        return;
      }
      if (event.type === "devices") {
        setDevices(event.devices);
        return;
      }
      if (event.type === "device-joined") {
        setDevices((current) => {
          if (current.some((device) => device.id === event.device.id)) {
            return current.map((device) => (device.id === event.device.id ? event.device : device));
          }
          return [...current, event.device];
        });
        if (
          sessionRef.current?.role === "host" &&
          event.device.role === "listener" &&
          streamRef.current
        ) {
          void offerToListener(event.device.id);
        }
        return;
      }
      if (event.type === "device-left") {
        setDevices((current) => current.filter((device) => device.id !== event.deviceId));
        closePeer(event.deviceId);
        return;
      }
      if (event.type === "device-updated") {
        setDevices((current) =>
          current.map((device) => (device.id === event.device.id ? event.device : device)),
        );
        return;
      }
      if (event.type !== "signal") return;

      const signal = event.signal;
      const me = sessionRef.current;
      if (!me || signal.toDeviceId !== me.deviceId) return;

      if (signal.type === "offer") {
        const sdp = signal.payload.sdp as RTCSessionDescriptionInit | undefined;
        if (sdp) await handleOfferAsListener(signal.fromDeviceId, sdp);
        return;
      }

      if (signal.type === "answer") {
        const pc = peersRef.current.get(signal.fromDeviceId);
        const sdp = signal.payload.sdp as RTCSessionDescriptionInit | undefined;
        if (pc && sdp) {
          await pc.setRemoteDescription(sdp);
          await flushIce(signal.fromDeviceId, pc);
        }
        return;
      }

      if (signal.type === "ice") {
        const candidate = signal.payload.candidate as RTCIceCandidateInit | undefined;
        if (!candidate) return;
        const pc =
          me.role === "host"
            ? peersRef.current.get(signal.fromDeviceId)
            : listenerPcRef.current;
        const key = me.role === "host" ? signal.fromDeviceId : "host";
        if (!pc || !pc.remoteDescription) {
          const queued = pendingIceRef.current.get(key) ?? [];
          queued.push(candidate);
          pendingIceRef.current.set(key, queued);
          return;
        }
        try {
          await pc.addIceCandidate(candidate);
        } catch {
          // ignore
        }
        return;
      }

      if (signal.type === "control") {
        // Listener asks host for a WebRTC offer (DB-polled; works on Vercel serverless)
        if (signal.payload.action === "request-offer" && me.role === "host") {
          if (streamRef.current) {
            void offerToListener(signal.fromDeviceId);
          }
          return;
        }
        if (typeof signal.payload.volume === "number") setVolume(signal.payload.volume);
        if (typeof signal.payload.muted === "boolean") setMuted(signal.payload.muted);
      }
    },
    [closePeer, flushIce, handleOfferAsListener, offerToListener],
  );

  const attachSignaling = useCallback(
    (info: SessionInfo) => {
      signalingRef.current?.stop();
      const client = new SignalingClient(code, info.deviceId, (event) => {
        void handleSignal(event);
      });
      signalingRef.current = client;
      client.start();
    },
    [code, handleSignal],
  );

  useEffect(() => {
    const existing = readSession(code);
    const boot = async () => {
      setName(guessDeviceName());
      if (!existing) {
        setMode("gate");
        return;
      }
      const res = await fetch(`/api/rooms/${code}`);
      if (!res.ok) {
        setMode("gate");
        return;
      }
      const data = (await res.json()) as { room: RoomDTO; devices: DeviceDTO[] };
      setRoom(data.room);
      setDevices(data.devices);
      const mine = data.devices.find((device) => device.id === existing.deviceId);
      if (!mine) {
        clearSession();
        setMode("gate");
        return;
      }
      setSession(existing);
      setVolume(mine.volume);
      setMuted(mine.muted);
      setMode("active");
      attachSignaling(existing);
      if (existing.role === "host" && data.room.status === "live") {
        await fetch(`/api/rooms/${code}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            hostDeviceId: existing.deviceId,
            status: "waiting",
          }),
        });
      }
    };
    void boot();
    return () => {
      signalingRef.current?.stop();
      closeAllPeers();
      stopStream(streamRef.current);
      wakeLockRef.current?.release().catch(() => undefined);
    };
    // mount-only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = Math.min(1, Math.max(0, volume / 100));
    audio.muted = muted;
  }, [volume, muted]);

  useEffect(() => {
    if (mode !== "active") return;
    const timer = window.setInterval(async () => {
      const pc =
        sessionRef.current?.role === "listener"
          ? listenerPcRef.current
          : Array.from(peersRef.current.values())[0];
      const rtt = pc ? await readRoundTripMs(pc) : null;
      await signalingRef.current?.heartbeat(rtt);
    }, 2500);
    return () => window.clearInterval(timer);
  }, [mode]);

  // Host: keep a peer for every connected listener (multi-device on serverless)
  useEffect(() => {
    if (mode !== "active") return;
    const timer = window.setInterval(() => {
      const me = sessionRef.current;
      if (!me || me.role !== "host" || !streamRef.current) return;
      const listeners = devicesRef.current.filter(
        (d) => d.role === "listener" && d.connected,
      );
      for (const listener of listeners) {
        const pc = peersRef.current.get(listener.id);
        const state = pc?.connectionState;
        if (!pc || state === "failed" || state === "closed" || state === "disconnected") {
          void offerToListener(listener.id);
        }
      }
    }, 4000);
    return () => window.clearInterval(timer);
  }, [mode, offerToListener]);

  useEffect(() => {
    if (mode !== "active") return;
    const requestLock = async () => {
      try {
        if ("wakeLock" in navigator) {
          wakeLockRef.current = await navigator.wakeLock.request("screen");
        }
      } catch {
        // unsupported or denied
      }
    };
    void requestLock();
    const onVis = () => {
      if (document.visibilityState === "visible") void requestLock();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [mode]);

  const joinAsListener = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/rooms/${code}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = (await res.json()) as {
        error?: string;
        device?: DeviceDTO;
        room?: RoomDTO;
        devices?: DeviceDTO[];
      };
      if (!res.ok || !data.device || !data.room) {
        throw new Error(data.error || "Could not join room");
      }
      const info: SessionInfo = {
        deviceId: data.device.id,
        role: "listener",
        name: data.device.name,
        code,
      };
      writeSession(info);
      setSession(info);
      setRoom(data.room);
      if (data.devices) setDevices(data.devices);
      setMode("active");
      attachSignaling(info);

      // If host is already live, request an offer via DB-backed signaling.
      // SSE "device-joined" often never reaches the host on Vercel serverless.
      if (data.room.status === "live") {
        const hostDevice = (data.devices ?? []).find((d) => d.role === "host");
        if (hostDevice) {
          const ask = () => {
            void signalingRef.current?.send(hostDevice.id, "control", {
              action: "request-offer",
            });
          };
          window.setTimeout(ask, 400);
          window.setTimeout(ask, 2000);
          window.setTimeout(ask, 5000);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Join failed");
    } finally {
      setBusy(false);
    }
  };

  const goLive = async () => {
    setBusy(true);
    setError(null);
    try {
      stopStream(streamRef.current);
      const stream = source === "system" ? await captureSystemAudio() : await captureMicrophone();
      streamRef.current = stream;
      setLocalStream(stream);
      stream.getAudioTracks().forEach((track) => {
        track.onended = () => {
          void stopLive();
        };
      });

      const me = sessionRef.current;
      if (!me) return;
      await fetch(`/api/rooms/${code}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hostDeviceId: me.deviceId,
          status: "live",
          audioSource: source,
        }),
      });

      const targets = devicesRef.current.filter(
        (device) => device.role === "listener" && device.connected,
      );
      for (const listener of targets) {
        await offerToListener(listener.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not capture audio");
    } finally {
      setBusy(false);
    }
  };

  const stopLive = async () => {
    stopStream(streamRef.current);
    streamRef.current = null;
    setLocalStream(null);
    closeAllPeers();
    const me = sessionRef.current;
    if (!me || me.role !== "host") return;
    await fetch(`/api/rooms/${code}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hostDeviceId: me.deviceId, status: "waiting" }),
    });
  };

  const leave = async () => {
    const me = sessionRef.current;
    signalingRef.current?.stop();
    closeAllPeers();
    stopStream(streamRef.current);
    if (me) {
      await fetch(`/api/rooms/${code}/leave`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId: me.deviceId }),
      });
    }
    clearSession();
    window.location.href = "/";
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  };

  const shareRoom = async () => {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({
        title: "Join this Relay",
        text: `Play audio with room code ${code}`,
        url,
      });
      return;
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  const patchDevice = async (deviceId: string, patch: { volume?: number; muted?: boolean }) => {
    const me = sessionRef.current;
    await fetch(`/api/rooms/${code}/devices/${deviceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...patch, fromDeviceId: me?.deviceId }),
    });
  };

  const unlockAudio = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    try {
      await audio.play();
      setNeedsGesture(false);
    } catch {
      setNeedsGesture(true);
    }
  };

  if (mode === "loading") {
    return (
      <main className="grid min-h-screen place-items-center">
        <p className="font-[family-name:var(--font-mono)] text-xs uppercase tracking-[0.2em] text-[#8b8b84]">
          Linking…
        </p>
      </main>
    );
  }

  if (mode === "gate") {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center px-6">
        <Link href="/" className="mb-10 flex items-center gap-3 text-sm text-[#8b8b84]">
          <img src="/images/mark.png" alt="" className="h-8 w-8 rounded-md" />
          <span className="font-[family-name:var(--font-display)] text-lg tracking-tight text-[#f4f4ef]">
            RELAY
          </span>
        </Link>
        <p className="font-[family-name:var(--font-mono)] text-xs uppercase tracking-[0.22em] text-[#8b8b84]">
          Join room
        </p>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-4xl tracking-tight">
          {room.name}
        </h1>
        <p className="mt-2 text-[#8b8b84]">
          Code{" "}
          <span className="font-[family-name:var(--font-mono)] text-[#d4ff3a]">{code}</span>
          . This device will play the host audio with a low-latency WebRTC link.
        </p>
        <label className="mt-8 text-xs uppercase tracking-[0.18em] text-[#8b8b84]">
          Device name
        </label>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="mt-2 h-12 rounded-md border border-[#2a2a2e] bg-[#101012] px-3 text-[#f4f4ef] outline-none focus:border-[#d4ff3a]"
        />
        {error ? <p className="mt-3 text-sm text-[#ff5c4d]">{error}</p> : null}
        <button
          type="button"
          disabled={busy || room.status === "ended"}
          onClick={() => void joinAsListener()}
          className="mt-6 h-12 rounded-md bg-[#d4ff3a] px-5 font-medium text-[#111] disabled:opacity-40"
        >
          {busy ? "Joining…" : "Connect speaker"}
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-5 pb-16 pt-6">
      <audio ref={audioRef} autoPlay playsInline />
      <header className="flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-3">
          <img src="/images/mark.png" alt="" className="h-8 w-8 rounded-md" />
          <span className="font-[family-name:var(--font-display)] text-lg tracking-tight">RELAY</span>
        </Link>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void copyCode()}
            className="rounded-md border border-[#2a2a2e] px-3 py-1.5 font-[family-name:var(--font-mono)] text-sm tracking-[0.18em] text-[#d4ff3a]"
          >
            {copied ? "COPIED" : code}
          </button>
          <button
            type="button"
            onClick={() => void shareRoom()}
            className="rounded-md border border-[#2a2a2e] px-3 py-1.5 text-xs uppercase tracking-[0.16em] text-[#8b8b84]"
          >
            Share
          </button>
        </div>
      </header>

      <section className="mt-8 flex items-end justify-between gap-4">
        <div>
          <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.22em] text-[#8b8b84]">
            {isHost ? "Host" : "Listener"} · {self?.name}
          </p>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-4xl tracking-tight">
            {room.name}
          </h1>
        </div>
        <StatusPill live={isLive} ended={room.status === "ended"} listeners={connectedListeners.length} />
      </section>

      <section className="mt-8 h-36 overflow-hidden rounded-xl border border-[#1d1d20] bg-[#0e0e10] px-4 py-3">
        <Visualizer stream={visStream} active={isLive && Boolean(visStream)} />
      </section>

      <section className="mt-4 flex flex-wrap items-center gap-4 text-sm text-[#8b8b84]">
        <span className="font-[family-name:var(--font-mono)] text-[#d4ff3a]">
          {avgLatency != null ? `${avgLatency} ms` : isLive ? "syncing" : "idle"}
        </span>
        <span>{connectedListeners.length} speaker{connectedListeners.length === 1 ? "" : "s"}</span>
        <span className="capitalize">{isHost ? source : linkState}</span>
      </section>

      {error ? <p className="mt-4 text-sm text-[#ff5c4d]">{error}</p> : null}

      {needsGesture ? (
        <button
          type="button"
          onClick={() => void unlockAudio()}
          className="mt-6 h-12 w-full rounded-md bg-[#d4ff3a] font-medium text-[#111]"
        >
          Tap to play audio
        </button>
      ) : null}

      {isHost ? (
        <section className="mt-8 rounded-xl border border-[#1d1d20] bg-[#0e0e10] p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-[#8b8b84]">Source</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <SourceButton
              label="Microphone"
              hint="Voice or jack input"
              selected={source === "microphone"}
              onClick={() => setSource("microphone")}
            />
            <SourceButton
              label="System / tab"
              hint="Enable share audio"
              selected={source === "system"}
              onClick={() => setSource("system")}
            />
          </div>
          <div className="mt-4 flex gap-2">
            {isLive ? (
              <button
                type="button"
                onClick={() => void stopLive()}
                className="h-11 flex-1 rounded-md border border-[#2a2a2e] text-sm uppercase tracking-[0.16em]"
              >
                Stop
              </button>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => void goLive()}
                className="h-11 flex-1 rounded-md bg-[#d4ff3a] text-sm font-medium uppercase tracking-[0.16em] text-[#111] disabled:opacity-40"
              >
                {busy ? "Starting…" : "Go live"}
              </button>
            )}
            <button
              type="button"
              onClick={() => void leave()}
              className="h-11 rounded-md border border-[#2a2a2e] px-4 text-sm uppercase tracking-[0.16em] text-[#8b8b84]"
            >
              End
            </button>
          </div>
          <p className="mt-3 text-xs leading-5 text-[#6f6f6a]">
            Same Wi-Fi gives the lowest latency. System audio works in Chromium when “Share audio” is checked.
          </p>
        </section>
      ) : (
        <section className="mt-8 rounded-xl border border-[#1d1d20] bg-[#0e0e10] p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.18em] text-[#8b8b84]">Output</p>
            <button
              type="button"
              onClick={() => {
                const next = !muted;
                setMuted(next);
                if (self) void patchDevice(self.id, { muted: next });
              }}
              className="text-xs uppercase tracking-[0.16em] text-[#d4ff3a]"
            >
              {muted ? "Unmute" : "Mute"}
            </button>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={volume}
            onChange={(event) => {
              const next = Number(event.target.value);
              setVolume(next);
              if (self) void patchDevice(self.id, { volume: next });
            }}
            className="mt-4 w-full accent-[#d4ff3a]"
          />
          <p className="mt-3 text-sm text-[#8b8b84]">
            {isLive ? "Receiving live audio from the host." : "Waiting for the host to go live."}
          </p>
          <button
            type="button"
            onClick={() => void leave()}
            className="mt-4 h-11 w-full rounded-md border border-[#2a2a2e] text-sm uppercase tracking-[0.16em] text-[#8b8b84]"
          >
            Leave
          </button>
        </section>
      )}

      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-xs uppercase tracking-[0.18em] text-[#8b8b84]">Devices</h2>
          <span className="font-[family-name:var(--font-mono)] text-xs text-[#6f6f6a]">
            {devices.filter((device) => device.connected).length} online
          </span>
        </div>
        <ul className="mt-3 divide-y divide-[#1d1d20] rounded-xl border border-[#1d1d20]">
          {devices.map((device) => (
            <li key={device.id} className="flex items-center gap-3 px-4 py-3">
              <span
                className={`h-2 w-2 rounded-full ${
                  device.connected ? "bg-[#d4ff3a]" : "bg-[#3a3a3e]"
                }`}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">
                  {device.name}
                  {session?.deviceId === device.id ? " · you" : ""}
                </p>
                <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.16em] text-[#6f6f6a]">
                  {device.role}
                  {device.latencyMs != null ? ` · ${device.latencyMs} ms` : ""}
                  {device.muted ? " · muted" : ""}
                </p>
              </div>
              {isHost && device.role === "listener" ? (
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={device.volume}
                  onChange={(event) => {
                    const next = Number(event.target.value);
                    setDevices((current) =>
                      current.map((item) =>
                        item.id === device.id ? { ...item, volume: next } : item,
                      ),
                    );
                    void patchDevice(device.id, { volume: next });
                  }}
                  className="w-24 accent-[#d4ff3a]"
                />
              ) : (
                <span className="font-[family-name:var(--font-mono)] text-xs text-[#6f6f6a]">
                  {device.volume}%
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

function StatusPill({
  live,
  ended,
  listeners,
}: {
  live: boolean;
  ended: boolean;
  listeners: number;
}) {
  const label = ended ? "Ended" : live ? "Live" : "Waiting";
  return (
    <div className="flex items-center gap-2 rounded-full border border-[#2a2a2e] px-3 py-1.5 text-xs uppercase tracking-[0.16em]">
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          live ? "bg-[#d4ff3a] shadow-[0_0_12px_#d4ff3a]" : "bg-[#6f6f6a]"
        }`}
      />
      {label}
      {live ? ` · ${listeners}` : null}
    </div>
  );
}

function SourceButton({
  label,
  hint,
  selected,
  onClick,
}: {
  label: string;
  hint: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border px-3 py-3 text-left ${
        selected ? "border-[#d4ff3a] bg-[#14160d]" : "border-[#2a2a2e] bg-transparent"
      }`}
    >
      <span className="block text-sm">{label}</span>
      <span className="mt-1 block text-xs text-[#6f6f6a]">{hint}</span>
    </button>
  );
}
