export const ICE_SERVERS: RTCIceServer[] = [
  {
    urls: [
      "stun:stun.l.google.com:19302",
      "stun:stun1.l.google.com:19302",
      "stun:stun2.l.google.com:19302",
    ],
  },
  // Public TURN helps when devices are on different networks / strict NATs.
  // Replace with your own TURN credentials for production reliability.
  {
    urls: [
      "turn:openrelay.metered.ca:80",
      "turn:openrelay.metered.ca:443",
      "turns:openrelay.metered.ca:443",
    ],
    username: "openrelayproject",
    credential: "openrelayproject",
  },
];

export function rtcConfig(): RTCConfiguration {
  return {
    iceServers: ICE_SERVERS,
    iceCandidatePoolSize: 8,
    bundlePolicy: "max-bundle",
    rtcpMuxPolicy: "require",
  };
}

export function tweakSdpForLowLatency(sdp: string): string {
  return sdp.replace(
    /useinbandfec=1/g,
    "useinbandfec=1;stereo=1;sprop-stereo=1;maxaveragebitrate=128000;maxplaybackrate=48000;ptime=10;minptime=10;usedtx=0",
  );
}

export async function captureMicrophone(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    video: false,
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      channelCount: 2,
    },
  });
}

export async function captureSystemAudio(): Promise<MediaStream> {
  const display = navigator.mediaDevices as MediaDevices & {
    getDisplayMedia: (constraints?: DisplayMediaStreamOptions) => Promise<MediaStream>;
  };

  const stream = await display.getDisplayMedia({
    video: true,
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    },
  });

  if (stream.getAudioTracks().length === 0) {
    stream.getTracks().forEach((track) => track.stop());
    throw new Error(
      "No audio track found. When sharing, pick a tab or window and enable “Share audio”.",
    );
  }

  return stream;
}

export function stopStream(stream: MediaStream | null | undefined): void {
  stream?.getTracks().forEach((track) => {
    try {
      track.stop();
    } catch {
      // ignore
    }
  });
}

export async function readRoundTripMs(pc: RTCPeerConnection): Promise<number | null> {
  try {
    const stats = await pc.getStats();
    let rtt: number | null = null;
    stats.forEach((report) => {
      if (
        report.type === "candidate-pair" &&
        "currentRoundTripTime" in report &&
        report.currentRoundTripTime != null
      ) {
        const value = Number(report.currentRoundTripTime) * 1000;
        if (Number.isFinite(value)) rtt = Math.round(value);
      }
    });
    return rtt;
  } catch {
    return null;
  }
}

export function createPeer(onIce: (candidate: RTCIceCandidate) => void): RTCPeerConnection {
  const pc = new RTCPeerConnection(rtcConfig());
  pc.onicecandidate = (event) => {
    if (event.candidate) onIce(event.candidate);
  };
  return pc;
}
