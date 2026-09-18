"use client";

import Link from "next/link";
import Lottie from "lottie-react";
import { Columns3, Plus } from "lucide-react";
import { useReducedMotion } from "framer-motion";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const EMPTY_APPLICANTS_LOTTIE_SRC = "/lottie/empty-applicants.json";

/** Shared across board-level + per-stage empties so columns don't re-fetch. */
let emptyApplicantsLottieCache: object | null | undefined;
let emptyApplicantsLottiePromise: Promise<object | null> | null = null;

function loadEmptyApplicantsLottie(): Promise<object | null> {
  if (emptyApplicantsLottieCache !== undefined) {
    return Promise.resolve(emptyApplicantsLottieCache);
  }
  if (!emptyApplicantsLottiePromise) {
    emptyApplicantsLottiePromise = fetch(EMPTY_APPLICANTS_LOTTIE_SRC)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: object | null) => {
        emptyApplicantsLottieCache = data;
        return data;
      })
      .catch(() => {
        emptyApplicantsLottieCache = null;
        return null;
      });
  }
  return emptyApplicantsLottiePromise;
}

type CandidatesEmptyStateProps = {
  title?: string;
  description?: string;
  className?: string;
  showAnimation?: boolean;
  /**
   * Compact mark for pipeline stage drop zones (~96px Lottie + label).
   * Skips wash/CTAs so the parent dashed drop target stays the interaction surface.
   */
  compact?: boolean;
  /** Opens the add-candidate flow when provided. */
  onAddCandidate?: () => void;
  /** Clears active filters / search when the empty state is filter-driven. */
  onClearFilters?: () => void;
  /** Link to a job pipeline when a concrete job context exists. */
  pipelineHref?: string | null;
  /** Escape hatch for custom actions (overrides built-in CTAs). */
  actions?: ReactNode;
};

export function CandidatesEmptyState({
  title = "No candidates",
  description,
  className,
  showAnimation = true,
  compact = false,
  onAddCandidate,
  onClearFilters,
  pipelineHref,
  actions,
}: CandidatesEmptyStateProps) {
  const prefersReducedMotion = useReducedMotion();
  const [animationData, setAnimationData] = useState<object | null>(
    () => emptyApplicantsLottieCache ?? null
  );

  useEffect(() => {
    if (!showAnimation || prefersReducedMotion) return;
    let cancelled = false;
    loadEmptyApplicantsLottie().then((data) => {
      if (!cancelled && data) setAnimationData(data);
    });
    return () => {
      cancelled = true;
    };
  }, [showAnimation, prefersReducedMotion]);

  const builtInActions =
    compact || actions === null
      ? null
      : actions !== undefined
        ? actions
        : onClearFilters
          ? (
              <Button
                variant="outline"
                size="sm"
                className="mt-5"
                onClick={onClearFilters}
              >
                Clear filters
              </Button>
            )
          : onAddCandidate || pipelineHref
            ? (
                <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                  {onAddCandidate ? (
                    <Button
                      size="sm"
                      className="bg-[#31CDFF] text-white hover:bg-[#31CDFF]/90"
                      onClick={onAddCandidate}
                    >
                      <Plus className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                      Add candidate
                    </Button>
                  ) : null}
                  {pipelineHref ? (
                    <Button variant="outline" size="sm" asChild>
                      <Link href={pipelineHref}>
                        <Columns3 className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                        Open pipeline
                      </Link>
                    </Button>
                  ) : null}
                </div>
              )
            : null;

  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center overflow-hidden text-center",
        compact
          ? "pointer-events-none px-2 py-2"
          : "flex-1 px-6 py-16",
        className
      )}
    >
      {!compact ? (
        <>
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
        </>
      ) : null}

      <div className="relative z-[1] flex flex-col items-center">
        {showAnimation ? (
          <div
            className={cn(
              "mb-1",
              compact ? "h-[96px] w-[96px]" : "h-[140px] w-[140px]"
            )}
            aria-hidden
          >
            {animationData && !prefersReducedMotion ? (
              <Lottie
                animationData={animationData}
                loop
                className="h-full w-full"
              />
            ) : (
              <StaticEmptyFolderMark />
            )}
          </div>
        ) : (
          <div
            className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#272156]/[0.07] ring-1 ring-[#272156]/10"
            aria-hidden
          >
            <span className="h-2.5 w-2.5 rounded-full bg-[#31CDFF]/80" />
          </div>
        )}

        <h2
          className={cn(
            compact
              ? "text-xs font-normal text-muted-foreground"
              : "text-base font-semibold tracking-tight text-[#272156]"
          )}
        >
          {title}
        </h2>
        {description ? (
          <p
            className={cn(
              "mt-1.5 max-w-[280px] leading-relaxed text-muted-foreground",
              compact ? "text-xs" : "text-sm"
            )}
          >
            {description}
          </p>
        ) : null}

        {builtInActions}
      </div>
    </div>
  );
}

function StaticEmptyFolderMark() {
  return (
    <svg
      viewBox="0 0 120 120"
      className="h-full w-full"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="60" cy="62" r="42" fill="#272156" fillOpacity="0.06" />
      <path
        d="M34 48h16l6-7h14l6 7h16v36H34V48z"
        fill="#272156"
        fillOpacity="0.55"
      />
      <path d="M30 54h60l-4 34H34L30 54z" fill="#272156" />
      <path d="M34 58h52l-1.5 6H35.5L34 58z" fill="#31CDFF" />
      <rect
        x="48"
        y="36"
        width="24"
        height="30"
        rx="2"
        fill="#F8F8FA"
        stroke="#272156"
        strokeOpacity="0.35"
      />
    </svg>
  );
}
