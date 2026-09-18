"use client";

import Link from "next/link";
import type { OnLeaveEntry } from "@/types/leave";
import { LeaveTypeTag } from "@/components/admin/leave/LeaveStatusBadge";
import { cn } from "@/lib/utils";

function formatRange(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  const opts: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
  };
  if (start === end) return s.toLocaleDateString(undefined, opts);
  return `${s.toLocaleDateString(undefined, opts)} – ${e.toLocaleDateString(undefined, opts)}`;
}

type OnLeaveThisWeekProps = {
  entries: OnLeaveEntry[];
  className?: string;
};

export function OnLeaveThisWeek({ entries, className }: OnLeaveThisWeekProps) {
  return (
    <div
      className={cn(
        "flex h-full flex-col rounded-xl border border-[#272156]/10 bg-card p-4 shadow-sm",
        className
      )}
    >
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-[#272156] dark:text-foreground">
          On leave this week
        </h3>
        <p className="text-xs text-muted-foreground">
          {entries.length} employee{entries.length === 1 ? "" : "s"} out
        </p>
      </div>
      <ul className="flex-1 space-y-2 overflow-y-auto">
        {entries.map((entry) => (
          <li
            key={entry.id}
            className="flex items-start justify-between gap-3 rounded-lg border border-[#272156]/08 px-3 py-2.5"
          >
            <div className="min-w-0">
              <Link
                href={`/manage/employees/${entry.employeeId}`}
                className="truncate text-sm font-medium text-[#272156] hover:underline dark:text-foreground"
              >
                {entry.employeeName}
              </Link>
              <p className="truncate text-xs text-muted-foreground">
                {entry.jobTitle || entry.departmentName}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatRange(entry.startDate, entry.endDate)} · {entry.days}d
              </p>
            </div>
            <LeaveTypeTag
              name={entry.leaveTypeName}
              color={entry.leaveTypeColor}
              className="shrink-0"
            />
          </li>
        ))}
        {entries.length === 0 ? (
          <li className="py-8 text-center text-sm text-muted-foreground">
            Nobody is on leave this week.
          </li>
        ) : null}
      </ul>
    </div>
  );
}
