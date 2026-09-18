"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { LeavePageShell } from "@/components/admin/leave/LeavePageShell";
import { LeaveTypeTag } from "@/components/admin/leave/LeaveStatusBadge";
import { Button } from "@/components/ui/button";
import { LeaveCalendarSkeleton } from "@/components/admin/hr-skeletons";
import { leaveApi, type LeaveCalendarResponse } from "@/lib/leave";
import { cn } from "@/lib/utils";
import type { LeaveTypeDefinition, OnLeaveEntry } from "@/types/leave";

export default function LeaveCalendarPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState<LeaveCalendarResponse | null>(null);
  const [types, setTypes] = useState<LeaveTypeDefinition[]>([]);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [res, typesRes] = await Promise.all([
        leaveApi.calendar(year, month),
        leaveApi.listTypes(),
      ]);
      setData(res);
      setTypes(typesRes.items.filter((t) => t.active));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load calendar");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    void load();
  }, [load]);

  const label = useMemo(
    () =>
      new Date(year, month - 1, 1).toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      }),
    [year, month]
  );

  const firstWeekday = useMemo(() => {
    const d = new Date(year, month - 1, 1).getDay();
    return d === 0 ? 6 : d - 1;
  }, [year, month]);

  const filterEntry = useCallback(
    (entry: OnLeaveEntry) => {
      if (typeFilter === "all") return true;
      const selected = types.find((t) => t.id === typeFilter);
      if (!selected) return true;
      return (
        entry.leaveTypeName.toLowerCase() === selected.name.toLowerCase() ||
        entry.leaveTypeColor.toLowerCase() === selected.color.toLowerCase()
      );
    },
    [typeFilter, types]
  );

  const filteredDays = useMemo(() => {
    if (!data) return [];
    return data.days.map((day) => ({
      ...day,
      entries: day.entries.filter(filterEntry),
    }));
  }, [data, filterEntry]);

  const filteredEventCount = useMemo(
    () => filteredDays.reduce((sum, d) => sum + d.entries.length, 0),
    [filteredDays]
  );

  const shiftMonth = (delta: number) => {
    let m = month + delta;
    let y = year;
    if (m < 1) {
      m = 12;
      y -= 1;
    } else if (m > 12) {
      m = 1;
      y += 1;
    }
    setMonth(m);
    setYear(y);
  };

  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <LeavePageShell
      title="Leave calendar"
      description="Approved time off by day. Navigate months to plan coverage."
      tourId="leave-calendar"
      actions={
        <div className="flex flex-wrap items-center gap-2" data-tour="leave-calendar-nav">
          <Button
            size="icon"
            variant="outline"
            className="h-8 w-8"
            onClick={() => shiftMonth(-1)}
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[9rem] text-center text-sm font-medium text-[#272156] dark:text-foreground">
            {label}
          </span>
          <Button
            size="icon"
            variant="outline"
            className="h-8 w-8"
            onClick={() => shiftMonth(1)}
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      }
    >
      {loading ? (
        <LeaveCalendarSkeleton />
      ) : error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-8 text-center text-sm text-rose-800">
          {error}
          <div className="mt-3">
            <Button size="sm" variant="outline" onClick={() => void load()}>
              Retry
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div
            className="flex flex-wrap items-center gap-2"
            data-tour="leave-calendar-type-filter"
          >
            <span className="text-xs font-medium text-muted-foreground">
              Absence type
            </span>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setTypeFilter("all")}
                className={cn(
                  "rounded-md border px-2.5 py-1 text-xs transition-colors",
                  typeFilter === "all"
                    ? "border-[#272156] bg-[#272156] text-white"
                    : "border-[#272156]/15 bg-card text-muted-foreground hover:border-[#272156]/30"
                )}
              >
                All
              </button>
              {types.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTypeFilter(t.id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors",
                    typeFilter === t.id
                      ? "border-[#272156] bg-[#272156]/5 text-[#272156]"
                      : "border-[#272156]/15 bg-card text-muted-foreground hover:border-[#272156]/30"
                  )}
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: t.color }}
                    aria-hidden
                  />
                  {t.name}
                </button>
              ))}
            </div>
          </div>

          <div
            className="rounded-xl border border-[#272156]/10 bg-card p-3 sm:p-4"
            data-tour="leave-calendar-grid"
          >
            <div className="mb-2 grid grid-cols-7 gap-1 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                <div key={d} className="py-1">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: firstWeekday }).map((_, i) => (
                <div key={`pad-${i}`} className="min-h-[5.5rem] rounded-lg bg-muted/30" />
              ))}
              {filteredDays.map((day) => {
                const dayNum = Number(day.date.slice(-2));
                const isToday = day.date === todayStr;
                return (
                  <div
                    key={day.date}
                    className={cn(
                      "min-h-[5.5rem] rounded-lg border border-[#272156]/08 p-1.5",
                      isToday && "border-[#31CDFF] bg-[#31CDFF]/5"
                    )}
                  >
                    <div
                      className={cn(
                        "text-xs font-semibold",
                        isToday
                          ? "text-[#272156] dark:text-[#31CDFF]"
                          : "text-muted-foreground"
                      )}
                    >
                      {dayNum}
                    </div>
                    <ul className="mt-1 space-y-0.5">
                      {day.entries.slice(0, 3).map((entry) => (
                        <li key={`${day.date}-${entry.id}`} className="truncate">
                          <LeaveTypeTag
                            name={
                              entry.employeeName.split(" ")[0] ?? entry.employeeName
                            }
                            color={entry.leaveTypeColor}
                            className="max-w-full truncate px-1 py-0 text-[10px]"
                          />
                        </li>
                      ))}
                      {day.entries.length > 3 ? (
                        <li className="text-[10px] text-muted-foreground">
                          +{day.entries.length - 3} more
                        </li>
                      ) : null}
                    </ul>
                  </div>
                );
              })}
            </div>
            {filteredEventCount === 0 ? (
              <p className="mt-4 text-center text-sm text-muted-foreground">
                {typeFilter === "all"
                  ? "No approved leave in this month."
                  : "No approved leave for this absence type in this month."}
              </p>
            ) : null}
          </div>

          {types.length > 0 ? (
            <div
              className="flex flex-wrap gap-3 px-1"
              data-tour="leave-calendar-legend"
            >
              {types.map((t) => (
                <div
                  key={`legend-${t.id}`}
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: t.color }}
                    aria-hidden
                  />
                  {t.name}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </LeavePageShell>
  );
}
