"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";

const COVER_SRC = "/images/admin-login-cover.png";

interface HelpCenterHeaderProps {
  initialQuery?: string;
  onSearchChange?: (query: string) => void;
}

export function HelpCenterHeader({
  initialQuery = "",
  onSearchChange,
}: HelpCenterHeaderProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = query.trim();
    if (trimmed) {
      router.push(`/admin/help?q=${encodeURIComponent(trimmed)}`);
    } else {
      router.push("/admin/help");
    }
  };

  return (
    <header className="relative isolate overflow-hidden rounded-2xl px-5 py-8 text-white sm:px-8 sm:py-10">
      <Image
        src={COVER_SRC}
        alt=""
        fill
        priority
        sizes="(max-width: 768px) 100vw, 960px"
        className="object-cover object-center"
      />
      {/* Navy scrim keeps title + white search bar readable over the cover photo */}
      <div
        className="absolute inset-0 bg-[#272055]/88"
        aria-hidden
      />
      <div
        className="absolute inset-0 bg-gradient-to-br from-[#272055]/75 via-transparent to-[#231E54]/55"
        aria-hidden
      />

      <div className="relative z-10 mx-auto flex max-w-3xl flex-col items-center gap-5 text-center">
        <Link
          href="/admin/help"
          className="text-2xl font-semibold tracking-tight text-white hover:text-[#31CDFF]"
        >
          BQI HR
          <span className="ml-2 text-base font-normal text-white/70">
            Help Center
          </span>
        </Link>

        <form onSubmit={handleSubmit} className="relative w-full max-w-xl">
          <label htmlFor="help-search" className="sr-only">
            Search for articles
          </label>
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#272055]/45"
            aria-hidden
          />
          <input
            id="help-search"
            type="search"
            value={query}
            onChange={(event) => {
              const next = event.target.value;
              setQuery(next);
              onSearchChange?.(next);
            }}
            placeholder="Search for articles..."
            className="w-full rounded-lg border-0 bg-white py-3 pl-10 pr-4 text-sm text-[#272055] shadow-sm placeholder:text-[#272055]/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#31CDFF]"
          />
        </form>
      </div>
    </header>
  );
}
