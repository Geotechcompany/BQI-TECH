import {
  addDays,
  addMonths,
  addWeeks,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from "date-fns";
import { Application } from "@/types/application";
import { getNameDisplay, getPositionDisplay } from "@/components/admin/utils/table-utils";

export type CalendarView = "month" | "week" | "day";

export type CalendarEventType =
  | "interview"
  | "assessment"
  | "start"
  | "hire"
  | "reminder"
  | "microsoft";

export type CalendarEventSource = "recruitment" | "microsoft";

export interface CalendarEvent {
  id: string;
  applicationId?: string;
  date: Date;
  type: CalendarEventType;
  title: string;
  subtitle: string;
  status: string;
  source?: CalendarEventSource;
  webLink?: string;
  joinUrl?: string;
}

export const CALENDAR_EVENT_LABELS: Record<CalendarEventType, string> = {
  interview: "Interview",
  assessment: "Technical assessment",
  start: "Start date",
  hire: "Hired",
  reminder: "Reminder",
  microsoft: "Outlook meeting",
};

export const CALENDAR_EVENT_COLORS: Record<
  CalendarEventType,
  { bg: string; text: string; dot: string }
> = {
  interview: {
    bg: "bg-[#31CDFF]/15 hover:bg-[#31CDFF]/25",
    text: "text-[#1a4d66]",
    dot: "bg-[#31CDFF]",
  },
  assessment: {
    bg: "bg-violet-100 hover:bg-violet-200/80",
    text: "text-violet-900",
    dot: "bg-violet-500",
  },
  start: {
    bg: "bg-emerald-100 hover:bg-emerald-200/80",
    text: "text-emerald-900",
    dot: "bg-emerald-500",
  },
  hire: {
    bg: "bg-[#272055]/10 hover:bg-[#272055]/15",
    text: "text-[#272055]",
    dot: "bg-[#272055]",
  },
  reminder: {
    bg: "bg-amber-100 hover:bg-amber-200/80",
    text: "text-amber-900",
    dot: "bg-amber-500",
  },
  microsoft: {
    bg: "bg-sky-100 hover:bg-sky-200/80",
    text: "text-sky-950",
    dot: "bg-[#0078D4]",
  },
};

export const WEEKDAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

function parseEventDate(value?: string | Date | null): Date | null {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function pushEvent(
  events: CalendarEvent[],
  app: Application,
  date: Date,
  type: CalendarEventType,
  jobTitles: Record<string, string>
) {
  events.push({
    id: `${app.id}-${type}`,
    applicationId: app.id,
    date,
    type,
    title: getNameDisplay(app),
    subtitle: getPositionDisplay(app, jobTitles),
    status: app.status,
    source: "recruitment",
  });
}

export function applicationsToCalendarEvents(
  applications: Application[],
  jobTitles: Record<string, string>
): CalendarEvent[] {
  const events: CalendarEvent[] = [];

  for (const app of applications) {
    const interviewDate = parseEventDate(app.interviewDate);
    if (interviewDate) {
      pushEvent(events, app, interviewDate, "interview", jobTitles);
    }

    const assessmentDate = parseEventDate(app.assessmentDate);
    if (assessmentDate) {
      pushEvent(events, app, assessmentDate, "assessment", jobTitles);
    }

    const startDate = parseEventDate(app.startDate);
    if (startDate) {
      pushEvent(events, app, startDate, "start", jobTitles);
    } else {
      const hireDate = parseEventDate(app.hireDate);
      if (hireDate) {
        pushEvent(events, app, hireDate, "hire", jobTitles);
      }
    }

    const reminderDate = parseEventDate(app.reminderAt);
    if (reminderDate) {
      pushEvent(events, app, reminderDate, "reminder", jobTitles);
    }
  }

  return events.sort((a, b) => a.date.getTime() - b.date.getTime());
}

export interface MicrosoftCalendarEventPayload {
  id: string;
  subject?: string;
  bodyPreview?: string;
  start?: string;
  end?: string;
  location?: string;
  organizer?: string;
  webLink?: string;
  joinUrl?: string;
}

export function microsoftEventsToCalendarEvents(
  items: MicrosoftCalendarEventPayload[]
): CalendarEvent[] {
  const events: CalendarEvent[] = [];

  for (const item of items) {
    const date = parseEventDate(item.start);
    if (!date) continue;

    const subtitleParts = [item.location, item.organizer].filter(Boolean);
    events.push({
      id: `ms-${item.id}`,
      date,
      type: "microsoft",
      title: item.subject || "(No title)",
      subtitle: subtitleParts.join(" · ") || "Outlook",
      status: "Outlook",
      source: "microsoft",
      webLink: item.webLink,
      joinUrl: item.joinUrl,
    });
  }

  return events.sort((a, b) => a.date.getTime() - b.date.getTime());
}

export function getEventsForDay(
  events: CalendarEvent[],
  day: Date
): CalendarEvent[] {
  return events.filter((event) => isSameDay(event.date, day));
}

export function filterCalendarEvents(
  events: CalendarEvent[],
  types: Set<CalendarEventType>,
  position?: string
): CalendarEvent[] {
  return events.filter((event) => {
    if (!types.has(event.type)) return false;
    if (position && position !== "all" && event.subtitle !== position) {
      return false;
    }
    return true;
  });
}

export function getMonthGridDays(activeMonth: Date): Date[] {
  const monthStart = startOfMonth(activeMonth);
  const monthEnd = endOfMonth(activeMonth);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const days: Date[] = [];
  let cursor = gridStart;
  while (cursor <= gridEnd) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return days;
}

export function getWeekDays(activeWeek: Date): Date[] {
  const weekStart = startOfWeek(activeWeek, { weekStartsOn: 0 });
  return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
}

export function formatCalendarTitle(view: CalendarView, anchor: Date): string {
  if (view === "month") return format(anchor, "MMMM yyyy");
  if (view === "week") {
    const days = getWeekDays(anchor);
    const start = days[0];
    const end = days[6];
    if (start.getMonth() === end.getMonth()) {
      return `${format(start, "MMM d")} – ${format(end, "d, yyyy")}`;
    }
    return `${format(start, "MMM d")} – ${format(end, "MMM d, yyyy")}`;
  }
  return format(anchor, "EEEE, MMMM d, yyyy");
}

export function shiftCalendarAnchor(
  view: CalendarView,
  anchor: Date,
  direction: -1 | 1
): Date {
  if (view === "month") {
    return direction === 1 ? addMonths(anchor, 1) : subMonths(anchor, 1);
  }
  if (view === "week") {
    return direction === 1 ? addWeeks(anchor, 1) : subWeeks(anchor, 1);
  }
  return addDays(anchor, direction);
}

export function isInActiveMonth(day: Date, activeMonth: Date): boolean {
  return isSameMonth(day, activeMonth);
}

export { isToday, isSameDay };
