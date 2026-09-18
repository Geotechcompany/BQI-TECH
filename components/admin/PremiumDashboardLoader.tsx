"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Image from "next/image";

const LOGO_SRC = "/bqilogo.png";

export const ADMIN_LOADING_PHRASES = [
  "Loading...",
  "Preparing your workspace...",
  "Almost ready...",
  "Securing your session...",
] as const;

export const USER_LOADING_PHRASES = [
  "Loading...",
  "Loading your applications...",
  "Preparing your dashboard...",
  "Almost ready...",
] as const;

const PHRASE_INTERVAL_MS = 2200;

/** Soft ease — continuous idle motion, no bounce (no gesture momentum). */
const BREATH_EASE = [0.45, 0, 0.55, 1] as const;

type PremiumDashboardLoaderProps = {
  /** Optional override for the first / static phrase */
  label?: string;
  /** Status lines to cycle; defaults to admin workspace phrases */
  phrases?: readonly string[];
  /** Fill the viewport (default) or only the parent container */
  fill?: "viewport" | "parent";
  className?: string;
};

/**
 * Calm, centered dashboard loading moment:
 * white field, enlarged card with soft cool shadow, BQI mark, cycling status.
 */
export function PremiumDashboardLoader({
  label,
  phrases: phrasesProp,
  fill = "viewport",
  className = "",
}: PremiumDashboardLoaderProps) {
  const prefersReducedMotion = Boolean(useReducedMotion());
  const basePhrases = phrasesProp ?? ADMIN_LOADING_PHRASES;
  const phrases = label
    ? [label, ...basePhrases.filter((p) => p !== label)]
    : [...basePhrases];
  const [phraseIndex, setPhraseIndex] = useState(0);

  useEffect(() => {
    if (prefersReducedMotion) return;
    const timer = window.setInterval(() => {
      setPhraseIndex((current) => (current + 1) % phrases.length);
    }, PHRASE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [prefersReducedMotion, phrases.length]);

  const activePhrase = prefersReducedMotion ? phrases[0] : phrases[phraseIndex];

  const shellClass =
    fill === "viewport"
      ? "fixed inset-0 z-[10050] h-dvh w-screen"
      : "absolute inset-0 z-[10050] h-full w-full";

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={activePhrase}
      data-premium-dashboard-loader="true"
      className={`${shellClass} flex items-center justify-center bg-white ${className}`}
    >
      <div className="flex flex-col items-center gap-6 px-6">
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={
            prefersReducedMotion
              ? { duration: 0 }
              : { type: "spring", stiffness: 420, damping: 36, mass: 0.8 }
          }
          className="relative flex h-[168px] w-[168px] items-center justify-center overflow-hidden rounded-[24px] bg-white sm:h-[176px] sm:w-[176px]"
          style={{
            boxShadow:
              "0 1px 2px rgba(15, 23, 42, 0.04), 0 12px 32px rgba(59, 130, 246, 0.1), 0 28px 64px rgba(15, 23, 42, 0.07)",
          }}
        >
          <motion.div
            className="relative flex items-center justify-center will-change-transform"
            animate={
              prefersReducedMotion
                ? undefined
                : {
                    scale: [1, 1.04, 1],
                    y: [0, -4, 0],
                    rotate: [0, 0.5, 0],
                  }
            }
            transition={
              prefersReducedMotion
                ? undefined
                : {
                    duration: 3.6,
                    ease: BREATH_EASE,
                    repeat: Infinity,
                  }
            }
          >
            <Image
              src={LOGO_SRC}
              alt=""
              width={112}
              height={112}
              className="h-24 w-24 object-contain sm:h-[104px] sm:w-[104px]"
              priority
              unoptimized
            />
          </motion.div>

          {!prefersReducedMotion && (
            <motion.div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "linear-gradient(105deg, transparent 36%, rgba(255,255,255,0.55) 50%, transparent 64%)",
              }}
              initial={{ x: "-120%", opacity: 0 }}
              animate={{ x: ["-120%", "120%"], opacity: [0, 0.7, 0] }}
              transition={{
                duration: 2.8,
                ease: BREATH_EASE,
                repeat: Infinity,
                repeatDelay: 1.4,
              }}
            />
          )}
        </motion.div>

        <div className="relative flex h-6 min-w-[220px] items-center justify-center">
          {prefersReducedMotion ? (
            <p className="text-[15px] font-medium tracking-[-0.01em] text-neutral-500">
              {phrases[0]}
            </p>
          ) : (
            <AnimatePresence mode="wait" initial={false}>
              <motion.p
                key={activePhrase}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 0.78, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{
                  type: "spring",
                  stiffness: 380,
                  damping: 32,
                  mass: 0.7,
                }}
                className="absolute inset-x-0 text-center text-[15px] font-medium tracking-[-0.01em] text-neutral-500"
              >
                {activePhrase}
              </motion.p>
            </AnimatePresence>
          )}
        </div>
      </div>
      <span className="sr-only">{activePhrase}</span>
    </div>
  );
}

export default PremiumDashboardLoader;
