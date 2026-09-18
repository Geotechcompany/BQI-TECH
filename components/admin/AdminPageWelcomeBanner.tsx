"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  getAdminPageBanner,
  type AdminBannerKey,
} from "@/lib/admin-page-banners";
import { TourHelpButton } from "@/components/admin/tour/TourHelpButton";

/** Critically damped enter — Apple response ~0.4s, no overshoot */
const SPRING_ENTER = { type: "spring" as const, bounce: 0, duration: 0.4 };

interface AdminPageWelcomeBannerProps {
  bannerKey: AdminBannerKey;
  className?: string;
  /** Slimmer strip for board / fill-viewport layouts */
  compact?: boolean;
  actions?: React.ReactNode;
  /** Override config title */
  title?: string;
  /** Override config subtitle */
  subtitle?: string;
  /** When set, Guide control sits top-right on the banner */
  tourId?: string;
}

export function AdminPageWelcomeBanner({
  bannerKey,
  className,
  compact = false,
  actions,
  title,
  subtitle,
  tourId,
}: AdminPageWelcomeBannerProps) {
  const config = getAdminPageBanner(bannerKey);
  const heading = title ?? config.title;
  const body = subtitle ?? config.subtitle;
  const reduceMotion = useReducedMotion();

  return (
    <motion.section
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduceMotion ? { duration: 0.2 } : SPRING_ENTER}
      data-tour={`${bannerKey}-welcome`}
      className={cn(
        "relative isolate overflow-hidden rounded-xl border border-white/10 shadow-lg shadow-[#272156]/10",
        "bg-gradient-to-br from-[#272156] via-[#1e1844] to-[#272156]",
        className
      )}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-[#272156]/40 via-transparent to-[#31CDFF]/20" />
      <div
        className="absolute inset-0 opacity-[0.12] mix-blend-overlay"
        style={{
          backgroundImage: "url('/mesh-pattern.svg')",
          backgroundSize: "cover",
        }}
      />

      {tourId ? (
        <div className="absolute right-2.5 top-2.5 z-20 sm:right-3 sm:top-3">
          <TourHelpButton tourId={tourId} tone="on-dark" />
        </div>
      ) : null}

      <div
        className={cn(
          "relative z-10 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between",
          compact ? "p-3 sm:p-3.5" : "p-4 sm:p-5",
          tourId && (compact ? "pr-20 sm:pr-24" : "pr-24 sm:pr-28")
        )}
      >
        <div className={cn("max-w-2xl", compact ? "space-y-0.5" : "space-y-1")}>
          <h2
            className={cn(
              "font-semibold tracking-[-0.02em] text-white",
              compact ? "text-base sm:text-lg" : "text-xl sm:text-2xl"
            )}
          >
            {heading}
          </h2>
          <p
            className={cn(
              "text-white/75",
              compact ? "text-xs leading-snug" : "text-sm leading-relaxed"
            )}
          >
            {body}
          </p>
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>
        ) : null}
      </div>
    </motion.section>
  );
}
