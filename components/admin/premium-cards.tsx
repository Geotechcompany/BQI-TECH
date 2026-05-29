"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowDown, ArrowUp, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type PremiumCardVariant =
  | "blue"
  | "green"
  | "purple"
  | "orange"
  | "emerald"
  | "yellow"
  | "red"
  | "brand";

const variantStyles: Record<
  PremiumCardVariant,
  {
    surface: string;
    orb: string;
    iconGradient: string;
    accent: string;
    borderGlow: string;
    progress: string;
    shimmer: string;
  }
> = {
  blue: {
    surface:
      "from-blue-50/90 via-white to-white dark:from-blue-950/40 dark:via-card dark:to-card",
    orb: "bg-blue-400/25 dark:bg-blue-500/15",
    iconGradient: "from-blue-500 to-blue-600 shadow-blue-500/30",
    accent: "text-blue-600 dark:text-blue-400",
    borderGlow: "group-hover:shadow-blue-500/10",
    progress: "from-blue-500 to-sky-400",
    shimmer: "from-transparent via-blue-400/10 to-transparent",
  },
  green: {
    surface:
      "from-emerald-50/90 via-white to-white dark:from-emerald-950/40 dark:via-card dark:to-card",
    orb: "bg-emerald-400/25 dark:bg-emerald-500/15",
    iconGradient: "from-emerald-500 to-green-600 shadow-emerald-500/30",
    accent: "text-emerald-600 dark:text-emerald-400",
    borderGlow: "group-hover:shadow-emerald-500/10",
    progress: "from-emerald-500 to-green-400",
    shimmer: "from-transparent via-emerald-400/10 to-transparent",
  },
  purple: {
    surface:
      "from-violet-50/90 via-white to-white dark:from-violet-950/40 dark:via-card dark:to-card",
    orb: "bg-violet-400/25 dark:bg-violet-500/15",
    iconGradient: "from-violet-500 to-purple-600 shadow-violet-500/30",
    accent: "text-violet-600 dark:text-violet-400",
    borderGlow: "group-hover:shadow-violet-500/10",
    progress: "from-violet-500 to-purple-400",
    shimmer: "from-transparent via-violet-400/10 to-transparent",
  },
  orange: {
    surface:
      "from-orange-50/90 via-white to-white dark:from-orange-950/40 dark:via-card dark:to-card",
    orb: "bg-orange-400/25 dark:bg-orange-500/15",
    iconGradient: "from-orange-500 to-amber-600 shadow-orange-500/30",
    accent: "text-orange-600 dark:text-orange-400",
    borderGlow: "group-hover:shadow-orange-500/10",
    progress: "from-orange-500 to-amber-400",
    shimmer: "from-transparent via-orange-400/10 to-transparent",
  },
  emerald: {
    surface:
      "from-teal-50/90 via-white to-white dark:from-teal-950/40 dark:via-card dark:to-card",
    orb: "bg-teal-400/25 dark:bg-teal-500/15",
    iconGradient: "from-teal-500 to-emerald-600 shadow-teal-500/30",
    accent: "text-teal-600 dark:text-teal-400",
    borderGlow: "group-hover:shadow-teal-500/10",
    progress: "from-teal-500 to-emerald-400",
    shimmer: "from-transparent via-teal-400/10 to-transparent",
  },
  yellow: {
    surface:
      "from-amber-50/90 via-white to-white dark:from-amber-950/40 dark:via-card dark:to-card",
    orb: "bg-amber-400/25 dark:bg-amber-500/15",
    iconGradient: "from-amber-500 to-yellow-600 shadow-amber-500/30",
    accent: "text-amber-600 dark:text-amber-400",
    borderGlow: "group-hover:shadow-amber-500/10",
    progress: "from-amber-500 to-yellow-400",
    shimmer: "from-transparent via-amber-400/10 to-transparent",
  },
  red: {
    surface:
      "from-rose-50/90 via-white to-white dark:from-rose-950/40 dark:via-card dark:to-card",
    orb: "bg-rose-400/25 dark:bg-rose-500/15",
    iconGradient: "from-rose-500 to-red-600 shadow-rose-500/30",
    accent: "text-rose-600 dark:text-rose-400",
    borderGlow: "group-hover:shadow-rose-500/10",
    progress: "from-rose-500 to-red-400",
    shimmer: "from-transparent via-rose-400/10 to-transparent",
  },
  brand: {
    surface:
      "from-[#31CDFF]/10 via-white to-white dark:from-[#272055]/30 dark:via-card dark:to-card",
    orb: "bg-[#31CDFF]/20 dark:bg-[#31CDFF]/10",
    iconGradient: "from-[#272055] to-[#31CDFF] shadow-[#272055]/30",
    accent: "text-[#272055] dark:text-[#31CDFF]",
    borderGlow: "group-hover:shadow-[#31CDFF]/15",
    progress: "from-[#272055] to-[#31CDFF]",
    shimmer: "from-transparent via-[#31CDFF]/15 to-transparent",
  },
};

export interface PremiumMetricCardProps {
  title: string;
  value: number;
  icon: LucideIcon;
  variant?: PremiumCardVariant;
  path: string;
  subtitle?: string;
  trend?: number;
  className?: string;
}

export function PremiumMetricCard({
  title,
  value,
  icon: Icon,
  variant = "brand",
  path,
  subtitle,
  trend,
  className,
}: PremiumMetricCardProps) {
  const styles = variantStyles[variant];

  return (
    <Link href={path} className={cn("block group", className)}>
      <motion.div
        whileHover={{ y: -4 }}
        transition={{ type: "spring", stiffness: 400, damping: 28 }}
        className={cn(
          "relative overflow-hidden rounded-2xl border border-border/60",
          "bg-gradient-to-br shadow-sm",
          "backdrop-blur-xl",
          "transition-shadow duration-500",
          "group-hover:shadow-xl",
          styles.surface,
          styles.borderGlow
        )}
      >
        {/* Top shine */}
        <div
          className={cn(
            "pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r",
            styles.shimmer
          )}
        />
        {/* Ambient orb */}
        <div
          className={cn(
            "pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full blur-3xl",
            styles.orb
          )}
        />
        <div
          className={cn(
            "pointer-events-none absolute -bottom-12 -left-8 h-24 w-24 rounded-full blur-2xl opacity-60",
            styles.orb
          )}
        />

        <div className="relative p-6">
          <div className="flex items-start justify-between gap-4">
            <div
              className={cn(
                "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br shadow-lg",
                styles.iconGradient
              )}
            >
              <Icon className="h-6 w-6 text-white" strokeWidth={2} />
            </div>
            <div className="min-w-0 flex-1 text-right sm:text-left">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">
                {title}
              </p>
              {subtitle && (
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          <div className="mt-5">
            <p
              className={cn(
                "text-4xl font-bold tracking-tight tabular-nums",
                "bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent",
                "dark:from-white dark:to-white/80"
              )}
            >
              {value.toLocaleString()}
            </p>

            {trend !== undefined && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset",
                    trend > 0 &&
                      "bg-emerald-500/10 text-emerald-600 ring-emerald-500/20 dark:text-emerald-400",
                    trend < 0 &&
                      "bg-rose-500/10 text-rose-600 ring-rose-500/20 dark:text-rose-400",
                    trend === 0 && "bg-muted text-muted-foreground ring-border"
                  )}
                >
                  {trend > 0 && <ArrowUp className="mr-1 h-3 w-3" />}
                  {trend < 0 && <ArrowDown className="mr-1 h-3 w-3" />}
                  {trend === 0 ? "No change" : `${Math.abs(trend)}%`}
                </span>
                <span className="text-xs text-muted-foreground">vs last month</span>
              </div>
            )}
          </div>

          <div
            className={cn(
              "mt-4 flex items-center text-xs font-medium opacity-0 transition-opacity group-hover:opacity-100",
              styles.accent
            )}
          >
            View details →
          </div>
        </div>
      </motion.div>
    </Link>
  );
}

export interface PremiumStatusCardProps {
  title: string;
  count: number;
  percentage: number;
  icon: LucideIcon;
  variant?: PremiumCardVariant;
  path: string;
  className?: string;
}

export function PremiumStatusCard({
  title,
  count,
  percentage,
  icon: Icon,
  variant = "blue",
  path,
  className,
}: PremiumStatusCardProps) {
  const styles = variantStyles[variant];
  const safePercent = Math.min(100, Math.max(0, percentage));

  return (
    <Link href={path} className={cn("block group", className)}>
      <motion.div
        whileHover={{ y: -3, scale: 1.01 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        className={cn(
          "relative overflow-hidden rounded-xl border border-border/50",
          "bg-gradient-to-br shadow-sm backdrop-blur-md",
          "transition-all duration-300 group-hover:shadow-lg",
          styles.surface,
          styles.borderGlow
        )}
      >
        <div
          className={cn(
            "pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full blur-2xl",
            styles.orb
          )}
        />

        <div className="relative p-4">
          <div className="flex items-center justify-between gap-2">
            <div
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br shadow-md",
                styles.iconGradient
              )}
            >
              <Icon className="h-5 w-5 text-white" strokeWidth={2} />
            </div>
            <span className="text-2xl font-bold tabular-nums tracking-tight">
              {count.toLocaleString()}
            </span>
          </div>

          <h4 className="mt-3 text-sm font-semibold text-foreground">{title}</h4>

          <div className="mt-3 space-y-1.5">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/80">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${safePercent}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className={cn("h-full rounded-full bg-gradient-to-r", styles.progress)}
              />
            </div>
            <p className="text-[11px] font-medium text-muted-foreground">
              {safePercent.toFixed(1)}% of total
            </p>
          </div>
        </div>
      </motion.div>
    </Link>
  );
}
