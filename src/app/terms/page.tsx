import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — Relay",
  description: "Terms of service for Relay audio relay.",
};

export default function TermsPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-2xl px-6 py-12">
      <Link href="/" className="text-sm text-[#d4ff3a] hover:underline">
        ← Back to Relay
      </Link>
      <h1 className="mt-8 font-[family-name:var(--font-display)] text-3xl tracking-tight">
        Terms of Service
      </h1>
      <p className="mt-2 text-sm text-[#8b8b84]">Last updated: October 2026</p>

      <div className="mt-8 space-y-6 text-[15px] leading-7 text-[#c8c8c0]">
        <section>
          <h2 className="font-[family-name:var(--font-display)] text-xl text-[#f3f3ee]">
            Acceptance
          </h2>
          <p className="mt-2">
            By using Relay you agree to these terms. If you do not agree, do not use the
            service.
          </p>
        </section>

        <section>
          <h2 className="font-[family-name:var(--font-display)] text-xl text-[#f3f3ee]">
            Service description
          </h2>
          <p className="mt-2">
            Relay lets you broadcast audio from one device to others over a network using
            WebRTC. The service is provided free of charge and may display advertising.
          </p>
        </section>

        <section>
          <h2 className="font-[family-name:var(--font-display)] text-xl text-[#f3f3ee]">
            Acceptable use
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Do not use Relay for illegal activity or to harass others.</li>
            <li>
              Do not attempt to disrupt the service, overload servers, or reverse-engineer
              systems beyond normal use.
            </li>
            <li>
              You are responsible for the content you broadcast and for obtaining any rights
              needed to share that audio.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-[family-name:var(--font-display)] text-xl text-[#f3f3ee]">
            Availability
          </h2>
          <p className="mt-2">
            We aim to keep Relay available but do not guarantee uptime. Rooms and sessions
            may end automatically after inactivity. Features may change without notice.
          </p>
        </section>

        <section>
          <h2 className="font-[family-name:var(--font-display)] text-xl text-[#f3f3ee]">
            Disclaimer
          </h2>
          <p className="mt-2">
            The service is provided &quot;as is&quot; without warranties of any kind. We are
            not liable for lost data, interrupted streams, or any damages arising from use
            of Relay.
          </p>
        </section>

        <section>
          <h2 className="font-[family-name:var(--font-display)] text-xl text-[#f3f3ee]">
            Changes
          </h2>
          <p className="mt-2">
            We may update these terms from time to time. Continued use after changes means
            you accept the updated terms.
          </p>
        </section>
      </div>
    </main>
  );
}
