import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { IBM_Plex_Mono, Syne } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const display = Syne({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700"],
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Relay — Play audio on every device",
  description:
    "Free low-latency audio relay. Broadcast from one device and play on every speaker over Wi-Fi.",
  applicationName: "Relay",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Relay",
    statusBarStyle: "black-translucent",
  },
  other: {
    "google-adsense-account": "ca-pub-1434761684241032",
  },
};
export const viewport: Viewport = {
  themeColor: "#080809",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const adsenseClient =
    process.env.NEXT_PUBLIC_ADSENSE_CLIENT || "ca-pub-XXXXXXXXXXXXXXXX";

  return (
    <html lang="en">
      <body className={`${display.variable} ${mono.variable} antialiased`}>
        {/* Google AdSense — set NEXT_PUBLIC_ADSENSE_CLIENT to your real publisher ID */}
        {!adsenseClient.includes("XXXXXXXX") ? (
          <Script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseClient}`}
            crossOrigin="anonymous"
            strategy="afterInteractive"
          />
        ) : null}
        {children}
      </body>
    </html>
  );
}
