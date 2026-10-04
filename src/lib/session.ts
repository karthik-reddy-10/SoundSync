import type { SessionInfo } from "@/lib/types";

const KEY = "relay-session";

export function readSession(code: string): SessionInfo | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SessionInfo;
    if (parsed.code !== code) return null;
    if (!parsed.deviceId || !parsed.role) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeSession(session: SessionInfo): void {
  sessionStorage.setItem(KEY, JSON.stringify(session));
}

export function clearSession(): void {
  sessionStorage.removeItem(KEY);
}
