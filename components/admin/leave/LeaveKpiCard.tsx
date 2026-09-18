"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type LeaveKpiCardProps = {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  sparkline?: number[];
  className?: string;
};

function MiniSparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 64;
  const h = 24;
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((v - min) / range) * (h - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className="shrink-0 text-[#31CDFF]"
      aria-hidden
    >
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

export function LeaveKpiCard({
  label,
  value,
  hint,
  icon: Icon,
  sparkline,
  className,
}: LeaveKpiCardProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-[#272156]/12 bg-gradient-to-br from-[#31CDFF]/8 via-white to-white p-4 dark:from-[#272156]/40 dark:via-card dark:to-card",
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="mt-1 truncate text-2xl font-semibold tracking-tight text-[#272156] dark:text-foreground">
            {value}
          </p>
          {hint ? (
            <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
          ) : null}
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="rounded-lg bg-[#272156] p-2 text-white dark:bg-[#31CDFF] dark:text-[#272156]">
            <Icon className="h-4 w-4" strokeWidth={1.75} />
          </div>
          {sparkline ? <MiniSparkline values={sparkline} /> : null}
        </div>
      </div>
    </div>
  );
}
