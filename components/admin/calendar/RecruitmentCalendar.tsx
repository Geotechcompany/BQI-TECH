"use client";

import { useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  CALENDAR_EVENT_COLORS,
  CALENDAR_EVENT_LABELS,
  CalendarEvent,
  CalendarEventType,
  CalendarView,
  WEEKDAY_LABELS,
  filterCalendarEvents,
  formatCalendarTitle,
  getEventsForDay,
  getMonthGridDays,
  getWeekDays,
  isInActiveMonth,
  isToday,
  shiftCalendarAnchor,
} from "./calendar-utils";

interface RecruitmentCalendarProps {
  events: CalendarEvent[];
  positions: string[];
  onEventClick?: (event: CalendarEvent) => void;
}

const ALL_EVENT_TYPES: CalendarEventType[] = [
  "interview",
  "assessment",
  "start",
  "hire",
  "reminder",
  "microsoft",
];

export function RecruitmentCalendar({
  events,
  positions,
  onEventClick,
}: RecruitmentCalendarProps) {
  const [view, setView] = useState<CalendarView>("month");
  const [anchor, setAnchor] = useState(() => new Date());
  const [showFilters, setShowFilters] = useState(false);
  const [activeTypes, setActiveTypes] = useState<Set<CalendarEventType>>(
    () => new Set(ALL_EVENT_TYPES)
  );
  const [positionFilter, setPositionFilter] = useState("all");

  const filteredEvents = useMemo(
    () => filterCalendarEvents(events, activeTypes, positionFilter),
    [events, activeTypes, positionFilter]
  );

  const title = formatCalendarTitle(view, anchor);

  const toggleType = (type: CalendarEventType) => {
    setActiveTypes((current) => {
      const next = new Set(current);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowFilters((open) => !open)}
            className="h-9 gap-2 border-[#272055]/15 bg-white text-[#272055] hover:bg-[#31CDFF]/10"
            data-tour="calendar-filters"
          >
            <SlidersHorizontal className="h-4 w-4" />
            {showFilters ? "Hide filters" : "Show filters"}
          </Button>
        </div>

        <div
          className="flex flex-wrap items-center justify-center gap-2"
          data-tour="calendar-nav"
        >
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 border-[#272055]/15"
            onClick={() =>
              setAnchor((current) => shiftCalendarAnchor(view, current, -1))
            }
            aria-label="Previous period"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="min-w-[180px] text-center text-lg font-semibold text-[#272055] sm:min-w-[220px]">
            {title}
          </h2>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 border-[#272055]/15"
            onClick={() =>
              setAnchor((current) => shiftCalendarAnchor(view, current, 1))
            }
            aria-label="Next period"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="inline-flex rounded-lg border border-[#272055]/15 bg-white p-0.5">
            {(["month", "week", "day"] as CalendarView[]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setView(option)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors",
                  view === option
                    ? "bg-[#272055] text-white"
                    : "text-[#272055]/70 hover:bg-[#31CDFF]/10 hover:text-[#272055]"
                )}
              >
                {option}
              </button>
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 border-[#272055]/15"
            onClick={() => setAnchor(new Date())}
          >
            Today
          </Button>
        </div>
      </div>

      {showFilters && (
        <div className="rounded-xl border border-[#272055]/10 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="mb-2 text-sm font-medium text-[#272055]">
                Event types
              </p>
              <div className="flex flex-wrap gap-2">
                {ALL_EVENT_TYPES.map((type) => {
                  const colors = CALENDAR_EVENT_COLORS[type];
                  const active = activeTypes.has(type);
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => toggleType(type)}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors",
                        active
                          ? "border-[#272055]/20 bg-white text-[#272055]"
                          : "border-transparent bg-muted/60 text-muted-foreground"
                      )}
                    >
                      <span
                        className={cn("h-2 w-2 rounded-full", colors.dot)}
                      />
                      {CALENDAR_EVENT_LABELS[type]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="min-w-[220px]">
              <label
                htmlFor="calendar-position-filter"
                className="mb-2 block text-sm font-medium text-[#272055]"
              >
                Position
              </label>
              <select
                id="calendar-position-filter"
                value={positionFilter}
                onChange={(event) => setPositionFilter(event.target.value)}
                className="h-10 w-full rounded-lg border border-[#272055]/15 bg-white px-3 text-sm text-[#272055] outline-none focus:border-[#31CDFF] focus:ring-2 focus:ring-[#31CDFF]/20"
              >
                <option value="all">All positions</option>
                {positions.map((position) => (
                  <option key={position} value={position}>
                    {position}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {view === "month" && (
        <div data-tour="calendar-grid">
          <MonthView
            anchor={anchor}
            events={filteredEvents}
            onEventClick={onEventClick}
          />
        </div>
      )}
      {view === "week" && (
        <div data-tour="calendar-grid">
          <WeekView
            anchor={anchor}
            events={filteredEvents}
            onEventClick={onEventClick}
          />
        </div>
      )}
      {view === "day" && (
        <div data-tour="calendar-grid">
          <DayView
            anchor={anchor}
            events={filteredEvents}
            onEventClick={onEventClick}
          />
        </div>
      )}
    </div>
  );
}

function EventChip({
  event,
  onClick,
  compact = false,
}: {
  event: CalendarEvent;
  onClick?: (event: CalendarEvent) => void;
  compact?: boolean;
}) {
  const colors = CALENDAR_EVENT_COLORS[event.type];
  const showSourceBadge = event.source === "microsoft";
  return (
    <button
      type="button"
      onClick={() => onClick?.(event)}
      className={cn(
        "w-full rounded-md px-2 py-1 text-left transition-colors",
        colors.bg,
        colors.text,
        compact ? "text-[11px] leading-tight" : "text-xs"
      )}
    >
      <span className="flex items-start justify-between gap-1">
        <span className="block min-w-0 truncate font-medium">{event.title}</span>
        {showSourceBadge ? (
          <span
            className={cn(
              "shrink-0 rounded px-1 py-px font-semibold uppercase tracking-wide text-[#0078D4]",
              compact ? "text-[9px]" : "text-[10px]"
            )}
          >
            Outlook
          </span>
        ) : null}
      </span>
      {!compact && (
        <span className="block truncate opacity-80">{event.subtitle}</span>
      )}
    </button>
  );
}

function MonthView({
  anchor,
  events,
  onEventClick,
}: {
  anchor: Date;
  events: CalendarEvent[];
  onEventClick?: (event: CalendarEvent) => void;
}) {
  const days = getMonthGridDays(anchor);

  return (
    <div className="overflow-hidden rounded-xl border border-[#272055]/10 bg-white shadow-sm">
      <div className="grid grid-cols-7 border-b border-[#272055]/10 bg-[#fafbfd]">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="px-2 py-3 text-center text-xs font-medium uppercase tracking-wide text-[#272055]/55"
          >
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {days.map((day) => {
          const dayEvents = getEventsForDay(events, day);
          const inMonth = isInActiveMonth(day, anchor);
          const today = isToday(day);

          return (
            <div
              key={day.toISOString()}
              className={cn(
                "min-h-[110px] border-b border-r border-[#272055]/8 p-2 last:border-r-0",
                !inMonth && "bg-muted/20"
              )}
            >
              <div className="mb-2 flex justify-end">
                <span
                  className={cn(
                    "inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-medium",
                    today
                      ? "bg-[#31CDFF] text-white"
                      : inMonth
                        ? "text-[#272055]"
                        : "text-[#272055]/35"
                  )}
                >
                  {day.getDate()}
                </span>
              </div>
              <div className="space-y-1">
                {dayEvents.slice(0, 3).map((event) => (
                  <EventChip
                    key={event.id}
                    event={event}
                    onClick={onEventClick}
                    compact
                  />
                ))}
                {dayEvents.length > 3 && (
                  <p className="px-1 text-[11px] font-medium text-[#272055]/60">
                    +{dayEvents.length - 3} more
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekView({
  anchor,
  events,
  onEventClick,
}: {
  anchor: Date;
  events: CalendarEvent[];
  onEventClick?: (event: CalendarEvent) => void;
}) {
  const days = getWeekDays(anchor);

  return (
    <div className="overflow-hidden rounded-xl border border-[#272055]/10 bg-white shadow-sm">
      <div className="grid grid-cols-7 border-b border-[#272055]/10 bg-[#fafbfd]">
        {days.map((day) => (
          <div
            key={day.toISOString()}
            className="border-r border-[#272055]/8 px-2 py-3 text-center last:border-r-0"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-[#272055]/55">
              {WEEKDAY_LABELS[day.getDay()]}
            </p>
            <p
              className={cn(
                "mx-auto mt-1 inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold",
                isToday(day)
                  ? "bg-[#31CDFF] text-white"
                  : "text-[#272055]"
              )}
            >
              {day.getDate()}
            </p>
          </div>
        ))}
      </div>

      <div className="grid min-h-[420px] grid-cols-7">
        {days.map((day) => {
          const dayEvents = getEventsForDay(events, day);
          return (
            <div
              key={day.toISOString()}
              className="space-y-2 border-r border-[#272055]/8 p-2 last:border-r-0"
            >
              {dayEvents.length === 0 ? (
                <p className="pt-4 text-center text-xs text-muted-foreground">
                  No events
                </p>
              ) : (
                dayEvents.map((event) => (
                  <EventChip
                    key={event.id}
                    event={event}
                    onClick={onEventClick}
                  />
                ))
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DayView({
  anchor,
  events,
  onEventClick,
}: {
  anchor: Date;
  events: CalendarEvent[];
  onEventClick?: (event: CalendarEvent) => void;
}) {
  const dayEvents = getEventsForDay(events, anchor);

  return (
    <div className="overflow-hidden rounded-xl border border-[#272055]/10 bg-white shadow-sm">
      <div className="border-b border-[#272055]/10 bg-[#fafbfd] px-4 py-3">
        <p className="text-sm font-medium text-[#272055]/70">
          {WEEKDAY_LABELS[anchor.getDay()]}
        </p>
        <p className="text-2xl font-semibold text-[#272055]">
          {anchor.getDate()}
        </p>
      </div>

      <div className="min-h-[360px] space-y-2 p-4">
        {dayEvents.length === 0 ? (
          <div className="flex h-full min-h-[280px] flex-col items-center justify-center rounded-lg border border-dashed border-[#272055]/15 text-center">
            <p className="text-sm font-medium text-[#272055]">No events</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Scheduled interviews and milestones appear here.
            </p>
          </div>
        ) : (
          dayEvents.map((event) => (
            <div
              key={event.id}
              className="rounded-lg border border-[#272055]/10 p-3"
            >
              <div className="mb-2 flex items-center gap-2">
                <span
                  className={cn(
                    "h-2.5 w-2.5 rounded-full",
                    CALENDAR_EVENT_COLORS[event.type].dot
                  )}
                />
                <span className="text-sm font-medium text-[#272055]">
                  {CALENDAR_EVENT_LABELS[event.type]}
                </span>
              </div>
              <EventChip event={event} onClick={onEventClick} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
