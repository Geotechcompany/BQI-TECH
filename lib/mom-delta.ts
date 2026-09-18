/**
 * Month-over-month delta helpers for overview metric badges.
 * Formula: ((thisMonth - lastMonth) / lastMonth) * 100
 */

export type MomBadge =
  | { kind: "percent"; value: number }
  | { kind: "new" }
  | { kind: "hidden" };

export type CalendarMonthBounds = {
  thisMonthStart: Date;
  lastMonthStart: Date;
  lastMonthEnd: Date;
};

/** UTC calendar-month boundaries relative to `now`. */
export function getCalendarMonthBounds(now: Date = new Date()): CalendarMonthBounds {
  const thisMonthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
  );
  const lastMonthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)
  );
  const lastMonthEnd = new Date(thisMonthStart.getTime() - 1);
  return { thisMonthStart, lastMonthStart, lastMonthEnd };
}

/** Days to request from trends so the series covers the start of last month. */
export function daysNeededForMom(now: Date = new Date()): number {
  const { lastMonthStart } = getCalendarMonthBounds(now);
  const ms = now.getTime() - lastMonthStart.getTime();
  return Math.min(365, Math.max(1, Math.ceil(ms / (24 * 60 * 60 * 1000)) + 1));
}

export function computeMomBadge(thisMonth: number, lastMonth: number): MomBadge {
  const current = Math.max(0, Number(thisMonth) || 0);
  const previous = Math.max(0, Number(lastMonth) || 0);

  if (previous === 0) {
    return current > 0 ? { kind: "new" } : { kind: "hidden" };
  }

  const raw = ((current - previous) / previous) * 100;
  return { kind: "percent", value: Math.round(raw) };
}

function parseDate(value: unknown): Date | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function toUtcDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function countDatesInMonth(
  dates: Array<Date | string | null | undefined>,
  monthStart: Date,
  monthEndExclusive: Date
): number {
  let count = 0;
  for (const value of dates) {
    const date = parseDate(value);
    if (!date) continue;
    if (date >= monthStart && date < monthEndExclusive) count += 1;
  }
  return count;
}

export function countInCalendarMonths(dates: Array<Date | string | null | undefined>): {
  thisMonth: number;
  lastMonth: number;
} {
  const now = new Date();
  const { thisMonthStart, lastMonthStart } = getCalendarMonthBounds(now);
  const nextMonthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)
  );

  return {
    thisMonth: countDatesInMonth(dates, thisMonthStart, nextMonthStart),
    lastMonth: countDatesInMonth(dates, lastMonthStart, thisMonthStart),
  };
}

export type TrendDay = { date?: string; count?: number };

/** Sum trend counts for UTC calendar this month vs last month. */
export function sumTrendCountsByCalendarMonth(
  trends: TrendDay[] | undefined,
  now: Date = new Date()
): { thisMonth: number; lastMonth: number } {
  const { thisMonthStart, lastMonthStart } = getCalendarMonthBounds(now);
  const thisMonthKey = toUtcDayKey(thisMonthStart);
  const lastMonthKey = toUtcDayKey(lastMonthStart);
  const nextMonthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)
  );
  const nextMonthKey = toUtcDayKey(nextMonthStart);

  let thisMonth = 0;
  let lastMonth = 0;

  for (const point of trends ?? []) {
    const key = String(point.date ?? "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) continue;
    const count = Number(point.count) || 0;
    if (key >= thisMonthKey && key < nextMonthKey) thisMonth += count;
    else if (key >= lastMonthKey && key < thisMonthKey) lastMonth += count;
  }

  return { thisMonth, lastMonth };
}

/**
 * Rolling 7-day window vs the same 7 days one month earlier (≈30 days).
 * Matches a "Recent (last 7 days)" card with a "vs last month" label.
 */
export function sumTrendCountsLast7VsPriorMonth(
  trends: TrendDay[] | undefined,
  now: Date = new Date()
): { thisMonth: number; lastMonth: number } {
  const end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  const dayMs = 24 * 60 * 60 * 1000;
  const thisStart = new Date(end.getTime() - 6 * dayMs);
  const priorEnd = new Date(end.getTime() - 30 * dayMs);
  const priorStart = new Date(priorEnd.getTime() - 6 * dayMs);

  const thisStartKey = toUtcDayKey(thisStart);
  const thisEndKey = toUtcDayKey(end);
  const priorStartKey = toUtcDayKey(priorStart);
  const priorEndKey = toUtcDayKey(priorEnd);

  let thisMonth = 0;
  let lastMonth = 0;

  for (const point of trends ?? []) {
    const key = String(point.date ?? "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) continue;
    const count = Number(point.count) || 0;
    if (key >= thisStartKey && key <= thisEndKey) thisMonth += count;
    else if (key >= priorStartKey && key <= priorEndKey) lastMonth += count;
  }

  return { thisMonth, lastMonth };
}

export function countDatesInLast7VsPriorMonth(
  dates: Array<Date | string | null | undefined>,
  now: Date = new Date()
): { thisMonth: number; lastMonth: number } {
  const dayMs = 24 * 60 * 60 * 1000;
  const todayUtc = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  );
  const thisStart = new Date(todayUtc - 6 * dayMs);
  const thisEnd = new Date(todayUtc + dayMs - 1);
  const priorEndDay = todayUtc - 30 * dayMs;
  const priorStart = new Date(priorEndDay - 6 * dayMs);
  const priorEnd = new Date(priorEndDay + dayMs - 1);

  let thisMonth = 0;
  let lastMonth = 0;

  for (const value of dates) {
    const date = parseDate(value);
    if (!date) continue;
    if (date >= thisStart && date <= thisEnd) thisMonth += 1;
    else if (date >= priorStart && date <= priorEnd) lastMonth += 1;
  }

  return { thisMonth, lastMonth };
}
