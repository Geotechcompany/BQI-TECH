"use client";

import Lottie from "lottie-react";
import { Briefcase, FileText, SearchX } from "lucide-react";
import { useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Closest applications/jobs-adjacent empty animation in the repo. */
const EMPTY_APPLICATIONS_LOTTIE_SRC = "/lottie/empty-documents.json";

let emptyApplicationsLottieCache: object | null | undefined;
let emptyApplicationsLottiePromise: Promise<object | null> | null = null;

function loadEmptyApplicationsLottie(): Promise<object | null> {
  if (emptyApplicationsLottieCache !== undefined) {
    return Promise.resolve(emptyApplicationsLottieCache);
  }
  if (!emptyApplicationsLottiePromise) {
    emptyApplicationsLottiePromise = fetch(EMPTY_APPLICATIONS_LOTTIE_SRC)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: object | null) => {
        emptyApplicationsLottieCache = data;
        return data;
      })
      .catch(() => {
        emptyApplicationsLottieCache = null;
        return null;
      });
  }
  return emptyApplicationsLottiePromise;
}

type ApplicationsEmptyStateProps = {
  hasSearch: boolean;
  onClearSearch?: () => void;
  className?: string;
};

export function ApplicationsEmptyState({
  hasSearch,
  onClearSearch,
  className,
}: ApplicationsEmptyStateProps) {
  const prefersReducedMotion = useReducedMotion();
  const [animationData, setAnimationData] = useState<object | null>(
    () => emptyApplicationsLottieCache ?? null
  );

  useEffect(() => {
    if (prefersReducedMotion) return;
    let cancelled = false;
    loadEmptyApplicationsLottie().then((data) => {
      if (!cancelled && data) setAnimationData(data);
    });
    return () => {
      cancelled = true;
    };
  }, [prefersReducedMotion]);

  return (
    <div
      className={cn(
        "relative flex min-h-[320px] flex-col items-center justify-center overflow-hidden px-6 py-12 text-center sm:py-16",
        className
      )}
    >
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{
          background:
            "radial-gradient(ellipse 70% 55% at 50% 42%, rgba(49,205,255,0.10) 0%, rgba(39,33,86,0.05) 45%, transparent 72%)",
        }}
      />
      <div
        className="pointer-events-none absolute left-1/2 top-[38%] h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#272156]/[0.04] blur-2xl"
        aria-hidden
      />

      <div className="relative z-[1] flex flex-col items-center">
        <div className="mb-1 h-[140px] w-[140px]" aria-hidden>
          {animationData && !prefersReducedMotion ? (
            <Lottie
              animationData={animationData}
              loop
              className="h-full w-full"
            />
          ) : (
            <StaticApplicationsMark hasSearch={hasSearch} />
          )}
        </div>

        <h2 className="text-base font-semibold tracking-tight text-[#272156] dark:text-gray-100">
          {hasSearch ? "No matching applications" : "No applications yet"}
        </h2>
        <p className="mt-1.5 max-w-[280px] text-sm leading-relaxed text-muted-foreground">
          {hasSearch
            ? "Try a different search or clear it to see all applications."
            : "Apply to an open position to track it here."}
        </p>

        {hasSearch ? (
          onClearSearch ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-5 border-[#272156]/20 text-[#272156] hover:bg-[#272156]/5"
              onClick={onClearSearch}
            >
              Clear search
            </Button>
          ) : null
        ) : (
          <Button
            type="button"
            size="sm"
            className="mt-5 bg-[#31CDFF] text-white hover:bg-[#31CDFF]/90"
            asChild
          >
            <Link href="/dashboard/jobs">
              <Briefcase className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              Browse jobs
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}

function StaticApplicationsMark({ hasSearch }: { hasSearch: boolean }) {
  const Icon = hasSearch ? SearchX : FileText;
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-[#272156]/10 ring-1 ring-[#272156]/10">
        <Icon className="h-9 w-9 text-[#272156]/70" strokeWidth={1.5} />
      </div>
    </div>
  );
}
