"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type EmployeeMetricCardProps = {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  className?: string;
  accent?: "navy" | "cyan" | "neutral";
};

const accentMap = {
  navy: "from-[#272156]/8 to-transparent border-[#272156]/15",
  cyan: "from-[#31CDFF]/12 to-transparent border-[#31CDFF]/25",
  neutral: "from-muted/60 to-transparent border-border",
};

export function EmployeeMetricCard({
  label,
  value,
  hint,
  icon: Icon,
  className,
  accent = "neutral",
}: EmployeeMetricCardProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border bg-gradient-to-br p-4",
        accentMap[accent],
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            {value}
          </p>
          {hint ? (
            <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
          ) : null}
        </div>
        {Icon ? (
          <div className="rounded-lg bg-[#272156] p-2 text-white dark:bg-[#31CDFF] dark:text-[#272156]">
            <Icon className="h-4 w-4" strokeWidth={1.75} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
