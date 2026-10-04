import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center px-6">
      <div className="text-center">
        <p className="font-[family-name:var(--font-mono)] text-xs uppercase tracking-[0.2em] text-[#8b8b84]">
          404
        </p>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-4xl">Room not found</h1>
        <p className="mt-3 text-sm text-[#8b8b84]">That code is not live anymore.</p>
        <Link href="/" className="mt-6 inline-block text-sm text-[#d4ff3a]">
          Back to Relay
        </Link>
      </div>
    </main>
  );
}
