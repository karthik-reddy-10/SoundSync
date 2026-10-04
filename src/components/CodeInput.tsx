"use client";

import { useRef } from "react";

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
};

export function CodeInput({ value, onChange, onSubmit }: Props) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const chars = Array.from({ length: 6 }, (_, i) => value[i] ?? "");

  const write = (next: string) => {
    onChange(next.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 6));
  };

  return (
    <div className="flex gap-2">
      {chars.map((char, index) => (
        <input
          key={index}
          ref={(node) => {
            refs.current[index] = node;
          }}
          value={char}
          maxLength={1}
          inputMode="text"
          autoCapitalize="characters"
          aria-label={`Room code character ${index + 1}`}
          className="h-14 w-11 rounded-md border border-[#2a2a2e] bg-[#101012] text-center font-[family-name:var(--font-mono)] text-xl tracking-wide text-[#f4f4ef] outline-none transition focus:border-[#d4ff3a] focus:shadow-[0_0_0_3px_rgba(212,255,58,0.15)]"
          onChange={(event) => {
            const nextChar = event.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
            const next = value.slice(0, index) + nextChar + value.slice(index + 1);
            write(next.replace(/ /g, ""));
            if (nextChar && index < 5) refs.current[index + 1]?.focus();
          }}
          onKeyDown={(event) => {
            if (event.key === "Backspace" && !chars[index] && index > 0) {
              refs.current[index - 1]?.focus();
            }
            if (event.key === "Enter") onSubmit?.();
          }}
          onPaste={(event) => {
            event.preventDefault();
            write(event.clipboardData.getData("text"));
          }}
        />
      ))}
    </div>
  );
}
