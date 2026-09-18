import Image from "next/image";
import Link from "next/link";

export const metadata = {
  title: "Offline | BQI Tech",
  description: "You are offline. Reconnect to continue using BQI Tech Platform.",
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#272156] px-6 text-center text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(49,205,255,0.18),_transparent_55%)]"
      />
      <div className="relative z-10 flex max-w-md flex-col items-center gap-6">
        <Image
          src="/icons/icon-192.png"
          alt="BQI Tech"
          width={96}
          height={96}
          priority
          className="rounded-2xl shadow-lg shadow-black/30"
        />
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#31CDFF]">
            BQI Tech
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            You&apos;re offline
          </h1>
          <p className="text-sm leading-relaxed text-white/75 sm:text-base">
            Check your connection, then try again. Cached pages may still open
            while you&apos;re offline.
          </p>
        </div>
        <Link
          href="/"
          className="inline-flex h-11 items-center justify-center rounded-full bg-[#31CDFF] px-8 text-sm font-semibold text-[#272156] transition hover:bg-[#5ad7ff]"
        >
          Try again
        </Link>
      </div>
    </main>
  );
}
