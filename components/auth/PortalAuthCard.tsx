"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { criticallyDampedSpring } from "@/components/auth/portal-auth-styles";

type PortalAuthCardProps = {
  children: React.ReactNode;
  className?: string;
  backHref?: string;
  backLabel?: string;
};

export function PortalAuthCard({
  children,
  className,
  backHref = "/",
  backLabel = "Back to Home",
}: PortalAuthCardProps) {
  const reduceMotion = useReducedMotion();
  const showBack = Boolean(backHref);

  const cardMotion = reduceMotion
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        transition: { duration: 0.3 },
      }
    : {
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0 },
        transition: criticallyDampedSpring,
      };

  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center overflow-y-auto px-6 py-10 sm:px-10">
      {/* Soft atmosphere behind the glass card */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(80% 60% at 100% 0%, rgba(49,205,255,0.08), transparent 55%), radial-gradient(70% 50% at 0% 100%, rgba(39,33,86,0.06), transparent 50%), linear-gradient(180deg, #f7f7f9 0%, #eef0f4 100%)",
        }}
      />

      <motion.div
        {...cardMotion}
        className={cn("relative z-10 w-full max-w-md", className)}
      >
        <div
          className={cn(
            "rounded-[28px] border border-white/70 bg-white/90 p-8 sm:p-10",
            "shadow-[0_24px_64px_-28px_rgba(39,33,86,0.28),0_1px_0_rgba(255,255,255,0.8)_inset]",
            "backdrop-blur-2xl backdrop-saturate-150",
            "supports-[backdrop-filter]:bg-white/70",
            "motion-reduce:backdrop-blur-none motion-reduce:bg-white"
          )}
        >
          {showBack ? (
            <div className="mb-6">
              <Link
                href={backHref}
                className="inline-flex items-center gap-0.5 text-[13px] font-medium text-[#6e6e73] transition-colors hover:text-[#1d1d1f]"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden />
                {backLabel}
              </Link>
            </div>
          ) : null}
          {children}
        </div>
      </motion.div>
    </div>
  );
}
