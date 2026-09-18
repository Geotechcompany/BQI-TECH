"use client";

import Link from "next/link";
import Lottie from "lottie-react";
import { ExternalLink } from "lucide-react";
import { useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { getCareersJobLivePath } from "@/components/admin/job-wizard/job-preview-urls";
import { cn } from "@/lib/utils";

type ApplicantsEmptyStateProps = {
  title: string;
  description: string;
  /** When set, shows a light CTA to the public careers listing for this job. */
  jobId?: string | null;
  className?: string;
  /** Prefer Lottie for the primary “No applicants” empty; siblings can skip it. */
  showAnimation?: boolean;
};

export function ApplicantsEmptyState({
  title,
  description,
  jobId,
  className,
  showAnimation = false,
}: ApplicantsEmptyStateProps) {
  const prefersReducedMotion = useReducedMotion();
  const [animationData, setAnimationData] = useState<object | null>(null);

  useEffect(() => {
    if (!showAnimation || prefersReducedMotion) return;
    let cancelled = false;
    fetch("/lottie/empty-applicants.json")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) setAnimationData(data);
      })
      .catch(() => {
        /* keep static wash fallback */
      });
    return () => {
      cancelled = true;
    };
  }, [showAnimation, prefersReducedMotion]);

  const careersHref = jobId ? getCareersJobLivePath(jobId) : null;

  return (
    <div
      className={cn(
        "relative flex flex-1 flex-col items-center justify-center overflow-hidden px-6 py-16 text-center",
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
        {showAnimation ? (
          <div className="mb-1 h-[140px] w-[140px]" aria-hidden>
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

        <h2 className="text-base font-semibold tracking-tight text-[#272156]">
          {title}
        </h2>
        <p className="mt-1.5 max-w-[280px] text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>

        {careersHref ? (
          <Link
            href={careersHref}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex items-center gap-1.5 text-xs font-medium text-[#272156] underline-offset-4 transition-colors hover:text-[#272156]/80 hover:underline"
          >
            View job posting
            <ExternalLink className="h-3 w-3" aria-hidden />
          </Link>
        ) : null}
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
