"use client";

import { useEffect, useRef } from "react";

type Props = {
  stream: MediaStream | null;
  active: boolean;
};

export function Visualizer({ stream, active }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let analyser: AnalyserNode | null = null;
    let audioCtx: AudioContext | null = null;
    let source: MediaStreamAudioSourceNode | null = null;
    const bins = new Uint8Array(64);
    let idlePhase = 0;

    if (stream && stream.getAudioTracks().some((track) => track.readyState === "live")) {
      audioCtx = new AudioContext();
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.72;
      source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);
      void audioCtx.resume();
    }

    const draw = () => {
      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);

      const barCount = 36;
      const gap = 4;
      const barWidth = (width - gap * (barCount - 1)) / barCount;

      if (analyser && active) {
        analyser.getByteFrequencyData(bins);
      } else {
        idlePhase += 0.04;
      }

      for (let i = 0; i < barCount; i += 1) {
        const t = i / barCount;
        let amp: number;
        if (analyser && active) {
          const index = Math.min(bins.length - 1, Math.floor(t * bins.length));
          amp = bins[index] / 255;
        } else {
          amp = 0.12 + 0.08 * Math.sin(idlePhase + i * 0.35) + 0.05 * Math.sin(idlePhase * 0.6 + i);
        }

        const barHeight = Math.max(4, amp * height * 0.92);
        const x = i * (barWidth + gap);
        const y = (height - barHeight) / 2;

        ctx.fillStyle = active ? "#d4ff3a" : "rgba(212,255,58,0.22)";
        const radius = Math.min(3, barWidth / 2);
        ctx.beginPath();
        if (typeof ctx.roundRect === "function") {
          ctx.roundRect(x, y, barWidth, barHeight, radius);
        } else {
          ctx.rect(x, y, barWidth, barHeight);
        }
        ctx.fill();
      }

      rafRef.current = window.requestAnimationFrame(draw);
    };

    const resize = () => {
      const parent = canvas.parentElement;
      const w = parent?.clientWidth ?? 640;
      const h = parent?.clientHeight ?? 160;
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.floor(w * ratio);
      canvas.height = Math.floor(h * ratio);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    resize();
    window.addEventListener("resize", resize);
    draw();

    return () => {
      window.removeEventListener("resize", resize);
      window.cancelAnimationFrame(rafRef.current);
      source?.disconnect();
      void audioCtx?.close();
    };
  }, [stream, active]);

  return <canvas ref={canvasRef} className="h-full w-full" />;
}
