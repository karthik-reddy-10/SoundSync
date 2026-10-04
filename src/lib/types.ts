export type RoomStatus = "waiting" | "live" | "ended";
export type DeviceRole = "host" | "listener";
export type AudioSource = "microphone" | "system";
export type SignalType = "offer" | "answer" | "ice" | "control" | "bye";

export type RoomDTO = {
  id: string;
  code: string;
  name: string;
  status: RoomStatus;
  audioSource: AudioSource;
  createdAt: string;
  updatedAt: string;
};

export type DeviceDTO = {
  id: string;
  roomId: string;
  name: string;
  role: DeviceRole;
  volume: number;
  muted: boolean;
  connected: boolean;
  latencyMs: number | null;
  userAgent: string | null;
  lastSeenAt: string;
  createdAt: string;
};

export type SignalDTO = {
  id: string;
  roomId: string;
  fromDeviceId: string;
  toDeviceId: string;
  type: SignalType;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type RelayEvent =
  | { type: "hello"; deviceId: string }
  | { type: "room"; room: RoomDTO }
  | { type: "devices"; devices: DeviceDTO[] }
  | { type: "device-joined"; device: DeviceDTO }
  | { type: "device-left"; deviceId: string }
  | { type: "device-updated"; device: DeviceDTO }
  | { type: "signal"; signal: SignalDTO }
  | { type: "ping"; at: number };

export type SessionInfo = {
  deviceId: string;
  role: DeviceRole;
  name: string;
  code: string;
};
