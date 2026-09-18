"use client";

import { cn } from "@/lib/utils";
import {
  LEAVE_STATUS_LABELS,
  type LeaveRequestStatus,
} from "@/types/leave";

const statusStyles: Record<LeaveRequestStatus, string> = {
  pending:
    "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800/40 dark:bg-amber-950/40 dark:text-amber-200",
  approved:
    "border-[#31CDFF]/30 bg-[#31CDFF]/10 text-[#272156] dark:text-[#31CDFF]",
  rejected:
    "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800/40 dark:bg-rose-950/40 dark:text-rose-200",
  cancelled:
    "border-border bg-muted text-muted-foreground",
};

export function LeaveStatusBadge({
  status,
  className,
}: {
  status: LeaveRequestStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
        statusStyles[status],
        className
      )}
    >
      {LEAVE_STATUS_LABELS[status]}
    </span>
  );
}

export function LeaveTypeTag({
  name,
  color,
  className,
}: {
  name: string;
  color: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-[#272156]/10 bg-white px-2 py-0.5 text-xs font-medium text-[#272156] dark:bg-card dark:text-foreground",
        className
      )}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: color }}
        aria-hidden
      />
      {name}
    </span>
  );
}
