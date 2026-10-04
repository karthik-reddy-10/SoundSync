"use client";

import { useEffect } from "react";

type Props = {
  /** Ad unit slot ID from AdSense (e.g. "1234567890") */
  slot: string;
  format?: string;
  className?: string;
};

/**
 * Google AdSense banner.
 * Replace NEXT_PUBLIC_ADSENSE_CLIENT in env (or the fallback below)
 * and the `slot` prop with your real AdSense values.
 */
export function AdBanner({ slot, format = "auto", className = "" }: Props) {
  const client =
    process.env.NEXT_PUBLIC_ADSENSE_CLIENT || "ca-pub-XXXXXXXXXXXXXXXX";

  useEffect(() => {
    try {
      // @ts-expect-error adsbygoogle is injected by the layout script
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // Ignore when AdSense script is blocked or not yet loaded
    }
  }, []);

  // Don't render placeholder client in production builds by accident —
  // still show the container so layout stays stable while testing.
  if (client.includes("XXXXXXXX")) {
    return (
      <div
        className={`flex min-h-[90px] items-center justify-center rounded-lg border border-dashed border-[#2a2a2e] bg-[#0e0e10] text-center text-xs text-[#6f6f6a] ${className}`}
      >
        Ad placeholder — set NEXT_PUBLIC_ADSENSE_CLIENT &amp; slot
      </div>
    );
  }

  return (
    <div className={`overflow-hidden ${className}`}>
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={client}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </div>
  );
}
