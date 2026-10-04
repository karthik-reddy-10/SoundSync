import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Relay",
    short_name: "Relay",
    description: "Play audio on every device on your Wi-Fi",
    start_url: "/",
    display: "standalone",
    background_color: "#080809",
    theme_color: "#080809",
    icons: [
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
