"use client";

import Lottie from "lottie-react";
import { ChartColumnIncreasing } from "lucide-react";
import { useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const EMPTY_TRENDS_LOTTIE_SRC = "/lottie/empty-trends.json";

let emptyTrendsLottieCache: object | null | undefined;
let emptyTrendsLottiePromise: Promise<object | null> | null = null;

function loadEmptyTrendsLottie(): Promise<object | null> {
  if (emptyTrendsLottieCache !== undefined) {
    return Promise.resolve(emptyTrendsLottieCache);
  }
  if (!emptyTrendsLottiePromise) {
    emptyTrendsLottiePromise = fetch(EMPTY_TRENDS_LOTTIE_SRC)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: object | null) => {
        emptyTrendsLottieCache = data;
        return data;
      })
      .catch(() => {
        emptyTrendsLottieCache = null;
        return null;
      });
  }
  return emptyTrendsLottiePromise;
}

type TrendsEmptyStateProps = {
  /** Appended after “start applying” when a single position is selected. */
  scopedToPosition?: boolean;
  className?: string;
};

export function TrendsEmptyState({
  scopedToPosition = false,
  className,
}: TrendsEmptyStateProps) {
  const prefersReducedMotion = useReducedMotion();
  const [animationData, setAnimationData] = useState<object | null>(
    () => emptyTrendsLottieCache ?? null
  );

  useEffect(() => {
    if (prefersReducedMotion) return;
    let cancelled = false;
    loadEmptyTrendsLottie().then((data) => {
      if (!cancelled && data) setAnimationData(data);
    });
    return () => {
      cancelled = true;
    };
  }, [prefersReducedMotion]);

  return (
    <div
      className={cn(
        "relative flex h-80 flex-col items-center justify-center overflow-hidden px-4 text-center",
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
        className="pointer-events-none absolute left-1/2 top-[38%] h-36 w-36 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#272156]/[0.04] blur-2xl"
        aria-hidden
      />

      <div className="relative z-[1] flex flex-col items-center">
        <div className="mb-1 h-[120px] w-[120px]" aria-hidden>
          {animationData && !prefersReducedMotion ? (
            <Lottie
              animationData={animationData}
              loop
              className="h-full w-full"
            />
          ) : (
            <StaticTrendsMark />
          )}
        </div>

        <h2 className="text-base font-semibold tracking-tight text-[#272156]">
          No applications in the last 30 days
        </h2>
        <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground">
          Trends appear once candidates start applying
          {scopedToPosition ? " to this position" : ""}.
        </p>
      </div>
    </div>
  );
}

function StaticTrendsMark() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-[#272156]/10 ring-1 ring-[#272156]/10">
        <ChartColumnIncreasing
          className="h-9 w-9 text-[#272156]/70"
          strokeWidth={1.5}
        />
      </div>
    </div>
  );
}
