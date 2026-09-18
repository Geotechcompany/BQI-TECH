"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { employeePortalApi } from "@/lib/api-backend";
import type { LeaveTypeDefinition, OnLeaveEntry } from "@/types/leave";
import {
  buildMonthWeeks,
  placeWeekBars,
  toDateKey,
} from "@/components/employee/leave/leave-helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type RosterFilters = {
  users: Array<{
    id: string;
    name: string;
    departmentName: string;
    jobTitle: string;
  }>;
  teams: string[];
  positions: string[];
};

type RosterTag =
  | { kind: "user"; value: string; label: string }
  | { kind: "team"; value: string; label: string }
  | { kind: "position"; value: string; label: string };

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const BAR_HEIGHT = 18;
const BAR_GAP = 2;
const DAY_HEADER = 22;
const MAX_VISIBLE_LANES = 4;

function tagKey(tag: RosterTag) {
  return `${tag.kind}:${tag.value}`;
}

function firstName(full: string) {
  const part = full.trim().split(/\s+/)[0];
  return part || full;
}

export default function EmployeeLeaveCalendarPage() {
  const today = useMemo(() => new Date(), []);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [goToDate, setGoToDate] = useState("");
  const [rosterQuery, setRosterQuery] = useState("");
  const [rosterTags, setRosterTags] = useState<RosterTag[]>([]);
  const [absenceTypeId, setAbsenceTypeId] = useState<string>("all");
  const [absenceCategory, setAbsenceCategory] = useState<
    "all" | "paid" | "unpaid"
  >("all");

  const { data: calendarData, isLoading: calendarLoading } = useQuery({
    queryKey: ["employee-portal-leave-calendar", viewYear, viewMonth + 1],
    queryFn: () =>
      employeePortalApi.getLeaveCalendar(viewYear, viewMonth + 1) as Promise<{
        year: number;
        month: number;
        events: OnLeaveEntry[];
      }>,
    staleTime: 60_000,
  });

  const { data: typesData, isLoading: typesLoading } = useQuery({
    queryKey: ["employee-portal-leave-types"],
    queryFn: () =>
      employeePortalApi.getLeaveTypes() as Promise<{
        items: LeaveTypeDefinition[];
        total: number;
      }>,
    staleTime: 5 * 60_000,
  });

  const { data: filtersData, isLoading: filtersLoading } = useQuery({
    queryKey: ["employee-portal-leave-calendar-filters"],
    queryFn: () =>
      employeePortalApi.getLeaveCalendarFilters() as Promise<RosterFilters>,
    staleTime: 5 * 60_000,
  });

  const leaveTypes = typesData?.items ?? [];
  const events = calendarData?.events ?? [];
  const isLoading = calendarLoading || typesLoading || filtersLoading;

  const monthLabel = useMemo(
    () =>
      new Date(viewYear, viewMonth, 1).toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      }),
    [viewYear, viewMonth]
  );

  const todayKey = toDateKey(new Date());
  const weeks = useMemo(
    () => buildMonthWeeks(viewYear, viewMonth, todayKey),
    [viewYear, viewMonth, todayKey]
  );

  const typeById = useMemo(() => {
    const map = new Map<string, LeaveTypeDefinition>();
    for (const t of leaveTypes) map.set(t.id, t);
    return map;
  }, [leaveTypes]);

  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      if (absenceTypeId !== "all") {
        const selected = typeById.get(absenceTypeId);
        const idMatch =
          ev.leaveTypeId && ev.leaveTypeId === absenceTypeId;
        const nameMatch =
          selected &&
          ev.leaveTypeName.toLowerCase() === selected.name.toLowerCase();
        if (!idMatch && !nameMatch) return false;
      }

      if (absenceCategory !== "all") {
        const type =
          (ev.leaveTypeId && typeById.get(ev.leaveTypeId)) ||
          leaveTypes.find(
            (t) =>
              t.name.toLowerCase() === ev.leaveTypeName.toLowerCase()
          );
        const paid = ev.paid ?? type?.paid ?? true;
        if (absenceCategory === "paid" && !paid) return false;
        if (absenceCategory === "unpaid" && paid) return false;
      }

      if (rosterTags.length > 0) {
        const matches = rosterTags.some((tag) => {
          if (tag.kind === "user") return ev.employeeId === tag.value;
          if (tag.kind === "team")
            return (
              ev.departmentName.toLowerCase() === tag.value.toLowerCase()
            );
          return (
            (ev.jobTitle || "").toLowerCase() === tag.value.toLowerCase()
          );
        });
        if (!matches) return false;
      }

      return true;
    });
  }, [
    events,
    absenceTypeId,
    absenceCategory,
    rosterTags,
    typeById,
    leaveTypes,
  ]);

  const eventById = useMemo(() => {
    const map = new Map<string, OnLeaveEntry>();
    for (const ev of filteredEvents) map.set(ev.id, ev);
    return map;
  }, [filteredEvents]);

  const rosterSuggestions = useMemo(() => {
    const q = rosterQuery.trim().toLowerCase();
    if (!q || !filtersData) return [] as RosterTag[];
    const selected = new Set(rosterTags.map(tagKey));
    const out: RosterTag[] = [];

    for (const team of filtersData.teams) {
      if (team.toLowerCase().includes(q)) {
        const tag: RosterTag = {
          kind: "team",
          value: team,
          label: team,
        };
        if (!selected.has(tagKey(tag))) out.push(tag);
      }
    }
    for (const pos of filtersData.positions) {
      if (pos.toLowerCase().includes(q)) {
        const tag: RosterTag = {
          kind: "position",
          value: pos,
          label: pos,
        };
        if (!selected.has(tagKey(tag))) out.push(tag);
      }
    }
    for (const user of filtersData.users) {
      const hay = `${user.name} ${user.departmentName} ${user.jobTitle}`.toLowerCase();
      if (hay.includes(q)) {
        const tag: RosterTag = {
          kind: "user",
          value: user.id,
          label: user.name,
        };
        if (!selected.has(tagKey(tag))) out.push(tag);
      }
    }
    return out.slice(0, 12);
  }, [rosterQuery, filtersData, rosterTags]);

  const shiftMonth = (delta: number) => {
    const next = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  };

  const goToday = () => {
    const now = new Date();
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
  };

  const applyGoToDate = () => {
    if (!goToDate) return;
    const d = new Date(`${goToDate}T12:00:00`);
    if (Number.isNaN(d.getTime())) return;
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  };

  const addRosterTag = (tag: RosterTag) => {
    setRosterTags((prev) =>
      prev.some((t) => tagKey(t) === tagKey(tag)) ? prev : [...prev, tag]
    );
    setRosterQuery("");
  };

  const removeRosterTag = (key: string) => {
    setRosterTags((prev) => prev.filter((t) => tagKey(t) !== key));
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_17rem]">
          <Skeleton className="h-[32rem] w-full rounded-xl" />
          <Skeleton className="h-[28rem] w-full rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <section
      className="space-y-4"
      data-tour="employee-leave-calendar"
    >
      <h2 className="text-base font-semibold tracking-tight text-[#272156]">
        Calendar
      </h2>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-start">
        {/* Month calendar */}
        <div
          className="overflow-hidden rounded-xl border border-[#272156]/12 bg-card shadow-[0_12px_40px_-28px_rgba(39,33,86,0.28)]"
          data-tour="employee-leave-calendar-grid"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-3 py-2.5 sm:px-4">
            <div className="flex items-center gap-1">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={() => shiftMonth(-1)}
                aria-label="Previous month"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="min-w-[9.5rem] text-center text-sm font-semibold text-[#272156]">
                {monthLabel}
              </span>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={() => shiftMonth(1)}
                aria-label="Next month"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={goToday}
              className="h-8 border-[#272156]/20"
            >
              Today
            </Button>
          </div>

          <div className="grid grid-cols-7 border-b border-border/50 bg-muted/20 text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {WEEKDAYS.map((d) => (
              <div key={d} className="border-r border-border/40 py-1.5 last:border-r-0">
                {d}
              </div>
            ))}
          </div>

          <div className="divide-y divide-border/50">
            {weeks.map((week) => {
              const { placements, laneCount } = placeWeekBars(
                week,
                filteredEvents
              );
              const visibleLanes = Math.min(laneCount, MAX_VISIBLE_LANES);
              const hiddenExtra = Math.max(0, laneCount - MAX_VISIBLE_LANES);
              const bodyHeight =
                DAY_HEADER +
                Math.max(visibleLanes, 1) * (BAR_HEIGHT + BAR_GAP) +
                (hiddenExtra > 0 ? 14 : 4);

              return (
                <div
                  key={week[0].dateKey}
                  className="relative grid grid-cols-7"
                  style={{ minHeight: bodyHeight }}
                >
                  {week.map((cell) => (
                    <div
                      key={cell.dateKey}
                      className={cn(
                        "border-r border-border/40 last:border-r-0",
                        !cell.inMonth && "bg-muted/25",
                        cell.isWeekend && cell.inMonth && "bg-muted/15",
                        cell.isToday && "bg-[#31CDFF]/8"
                      )}
                    >
                      <div
                        className={cn(
                          "px-1.5 pt-1 text-xs font-medium",
                          cell.isToday
                            ? "text-[#272156]"
                            : cell.inMonth
                              ? "text-foreground/80"
                              : "text-muted-foreground/50"
                        )}
                      >
                        {cell.isToday ? (
                          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#272156] px-1 text-[11px] font-semibold text-white">
                            {cell.dayNum}
                          </span>
                        ) : (
                          cell.dayNum
                        )}
                      </div>
                    </div>
                  ))}

                  <div
                    className="pointer-events-none absolute inset-x-0"
                    style={{ top: DAY_HEADER, bottom: 2 }}
                  >
                    {placements
                      .filter((p) => p.lane < MAX_VISIBLE_LANES)
                      .map((p) => {
                        const ev = eventById.get(p.eventId);
                        if (!ev) return null;
                        const leftPct = (p.startCol / 7) * 100;
                        const widthPct = (p.span / 7) * 100;
                        return (
                          <div
                            key={`${p.eventId}-${week[0].dateKey}`}
                            title={`${ev.employeeName} · ${ev.leaveTypeName} (${ev.startDate} → ${ev.endDate})`}
                            className={cn(
                              "pointer-events-auto absolute overflow-hidden px-0.5 text-[10px] font-medium leading-[18px] text-white shadow-sm",
                              p.continuesBefore
                                ? "rounded-l-none"
                                : "rounded-l-md",
                              p.continuesAfter
                                ? "rounded-r-none"
                                : "rounded-r-md"
                            )}
                            style={{
                              left: `calc(${leftPct}% + 2px)`,
                              width: `calc(${widthPct}% - 4px)`,
                              top: p.lane * (BAR_HEIGHT + BAR_GAP),
                              height: BAR_HEIGHT,
                              backgroundColor:
                                ev.leaveTypeColor || "#272156",
                            }}
                          >
                            <span className="block truncate px-1.5">
                              {firstName(ev.employeeName)}
                            </span>
                          </div>
                        );
                      })}
                    {hiddenExtra > 0 ? (
                      <div
                        className="absolute left-1 text-[10px] font-medium text-muted-foreground"
                        style={{
                          top: visibleLanes * (BAR_HEIGHT + BAR_GAP),
                        }}
                      >
                        +{hiddenExtra} more
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          {filteredEvents.length === 0 ? (
            <p className="border-t border-border/50 px-4 py-6 text-center text-sm text-muted-foreground">
              No approved absences match the current filters for {monthLabel}.
            </p>
          ) : null}

          {leaveTypes.length > 0 ? (
            <div
              className="flex flex-wrap gap-3 border-t border-border/50 px-3 py-2.5 sm:px-4"
              data-tour="employee-leave-calendar-legend"
            >
              {leaveTypes.map((t) => (
                <div
                  key={`legend-${t.id}`}
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
                >
                  <span
                    className="h-2.5 w-2.5 rounded-sm"
                    style={{ backgroundColor: t.color }}
                    aria-hidden
                  />
                  {t.name}
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {/* Search sidebar */}
        <aside
          className="rounded-xl border border-[#272156]/12 bg-card p-4 shadow-[0_12px_40px_-28px_rgba(39,33,86,0.22)]"
          data-tour="employee-leave-calendar-search"
        >
          <div className="mb-4 flex items-center gap-2">
            <Search className="h-4 w-4 text-[#272156]" aria-hidden />
            <h3 className="text-sm font-semibold text-[#272156]">Search</h3>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label
                htmlFor="leave-calendar-goto"
                className="text-xs text-muted-foreground"
              >
                Go to date
              </Label>
              <div className="flex gap-2">
                <Input
                  id="leave-calendar-goto"
                  type="date"
                  value={goToDate}
                  onChange={(e) => setGoToDate(e.target.value)}
                  className="h-9"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-9 shrink-0 border-[#272156]/20"
                  onClick={applyGoToDate}
                  disabled={!goToDate}
                >
                  Go
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="leave-calendar-roster"
                className="text-xs text-muted-foreground"
              >
                Users, Teams, Positions
              </Label>
              {rosterTags.length > 0 ? (
                <div className="mb-1.5 flex flex-wrap gap-1.5">
                  {rosterTags.map((tag) => (
                    <button
                      key={tagKey(tag)}
                      type="button"
                      onClick={() => removeRosterTag(tagKey(tag))}
                      className="inline-flex items-center gap-1 rounded-md border border-[#272156]/20 bg-[#272156]/5 px-2 py-0.5 text-[11px] font-medium text-[#272156] hover:bg-[#272156]/10"
                    >
                      <span className="text-[9px] uppercase tracking-wide text-muted-foreground">
                        {tag.kind === "user"
                          ? "User"
                          : tag.kind === "team"
                            ? "Team"
                            : "Pos"}
                      </span>
                      {tag.label}
                      <X className="h-3 w-3 opacity-60" aria-hidden />
                    </button>
                  ))}
                </div>
              ) : null}
              <Input
                id="leave-calendar-roster"
                value={rosterQuery}
                onChange={(e) => setRosterQuery(e.target.value)}
                placeholder="Search people, teams…"
                className="h-9"
                autoComplete="off"
              />
              {rosterSuggestions.length > 0 ? (
                <ul className="max-h-40 overflow-auto rounded-md border border-border bg-popover py-1 text-sm shadow-md">
                  {rosterSuggestions.map((sug) => (
                    <li key={tagKey(sug)}>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left hover:bg-muted/70"
                        onClick={() => addRosterTag(sug)}
                      >
                        <span className="w-12 shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          {sug.kind}
                        </span>
                        <span className="truncate">{sug.label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Absence type
              </Label>
              <Select
                value={absenceTypeId}
                onValueChange={setAbsenceTypeId}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {leaveTypes.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Absence category
              </Label>
              <Select
                value={absenceCategory}
                onValueChange={(v) =>
                  setAbsenceCategory(v as "all" | "paid" | "unpaid")
                }
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="unpaid">Unpaid</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
