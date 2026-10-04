import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — Relay",
  description: "Privacy policy for Relay audio relay.",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-2xl px-6 py-12">
      <Link href="/" className="text-sm text-[#d4ff3a] hover:underline">
        ← Back to Relay
      </Link>
      <h1 className="mt-8 font-[family-name:var(--font-display)] text-3xl tracking-tight">
        Privacy Policy
      </h1>
      <p className="mt-2 text-sm text-[#8b8b84]">Last updated: October 2026</p>

      <div className="mt-8 space-y-6 text-[15px] leading-7 text-[#c8c8c0]">
        <section>
          <h2 className="font-[family-name:var(--font-display)] text-xl text-[#f3f3ee]">
            Overview
          </h2>
          <p className="mt-2">
            Relay (&quot;we&quot;, &quot;our&quot;) provides a free low-latency audio relay
            service. This policy describes what information we collect and how we use it.
          </p>
        </section>

        <section>
          <h2 className="font-[family-name:var(--font-display)] text-xl text-[#f3f3ee]">
            Information we collect
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              <strong>Room data:</strong> room name, room code, device display names, and
              connection status while a session is active.
            </li>
            <li>
              <strong>Technical data:</strong> browser user-agent and approximate latency
              metrics used to keep the connection working.
            </li>
            <li>
              <strong>No account required:</strong> we do not ask for email, password, or
              personal identity to use the service.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-[family-name:var(--font-display)] text-xl text-[#f3f3ee]">
            Audio
          </h2>
          <p className="mt-2">
            Audio is streamed peer-to-peer between your devices using WebRTC. We do not
            record, store, or listen to your audio content on our servers.
          </p>
        </section>

        <section>
          <h2 className="font-[family-name:var(--font-display)] text-xl text-[#f3f3ee]">
            Cookies and advertising
          </h2>
          <p className="mt-2">
            We may use Google AdSense to show ads. AdSense and its partners may use cookies
            or similar technologies to serve relevant ads. You can manage ad personalization
            through Google&apos;s ad settings. See{" "}
            <a
              href="https://policies.google.com/technologies/ads"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#d4ff3a] hover:underline"
            >
              Google&apos;s advertising policy
            </a>{" "}
            for details.
          </p>
        </section>

        <section>
          <h2 className="font-[family-name:var(--font-display)] text-xl text-[#f3f3ee]">
            Data retention
          </h2>
          <p className="mt-2">
            Room and device records are temporary and are cleaned up after sessions end or
            become inactive. We do not keep long-term profiles of users.
          </p>
        </section>

        <section>
          <h2 className="font-[family-name:var(--font-display)] text-xl text-[#f3f3ee]">
            Contact
          </h2>
          <p className="mt-2">
            For privacy questions, contact the operator of this instance of Relay using the
            contact method published on the site.
          </p>
        </section>
      </div>
    </main>
  );
}
