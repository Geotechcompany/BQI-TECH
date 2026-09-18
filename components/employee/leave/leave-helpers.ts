import type {
  LeaveBalanceRow,
  LeaveEndPeriod,
  LeaveStartPeriod,
  LeaveTypeDefinition,
} from "@/types/leave";

export function statusClass(status: string) {
  switch (status) {
    case "approved":
      return "bg-emerald-50 text-emerald-800 border-emerald-200";
    case "rejected":
    case "cancelled":
      return "bg-rose-50 text-rose-800 border-rose-200";
    default:
      return "bg-amber-50 text-amber-900 border-amber-200";
  }
}

/** Calamari-style uppercase status pills for My requests. */
export function requestStatusPillClass(status: string) {
  switch (status) {
    case "approved":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "rejected":
    case "cancelled":
      return "border-rose-200 bg-rose-50 text-rose-700";
    default:
      return "border-slate-200 bg-slate-100 text-slate-600";
  }
}

export function formatRequestedShort(days: number): string {
  const rounded = Math.round(days * 100) / 100;
  if (Number.isInteger(rounded)) return `${rounded}d`;
  return `${rounded.toFixed(1)}d`;
}

export function formatAbsencePeriod(startDate: string, endDate: string): string {
  if (!startDate) return "—";
  const start = parseDateKey(startDate);
  const end = parseDateKey(endDate || startDate);
  if (Number.isNaN(start.getTime())) return startDate;
  const opts: Intl.DateTimeFormatOptions = {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  };
  const startLabel = start.toLocaleDateString(undefined, opts);
  if (!endDate || endDate === startDate || Number.isNaN(end.getTime())) {
    return startLabel;
  }
  return `${startLabel} – ${end.toLocaleDateString(undefined, opts)}`;
}

export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseDateKey(key: string): Date {
  return new Date(`${key}T12:00:00`);
}

export function inclusiveDayCount(startDate: string, endDate: string): number {
  if (!startDate || !endDate) return 0;
  const start = parseDateKey(startDate);
  const end = parseDateKey(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  if (end < start) return 0;
  return Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
}

/** Inclusive calendar days with morning/afternoon / end-of-day adjustments. */
export function leaveDaysWithPeriods(
  startDate: string,
  endDate: string,
  startPeriod: LeaveStartPeriod = "morning",
  endPeriod: LeaveEndPeriod = "end_of_day"
): number {
  const base = inclusiveDayCount(startDate, endDate);
  if (base <= 0) return 0;

  if (startDate === endDate) {
    if (startPeriod === "afternoon") return 0.5;
    if (endPeriod === "morning") return 0.5;
    return 1;
  }

  let days = base;
  if (startPeriod === "afternoon") days -= 0.5;
  if (endPeriod === "morning") days -= 0.5;
  return Math.max(days, 0.5);
}

export function formatDayAmount(days: number): string {
  const rounded = Math.round(days * 100) / 100;
  const label = rounded === 1 ? "day" : "days";
  const text =
    Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${text} ${label}`;
}

export function balanceForType(
  balances: LeaveBalanceRow[],
  leaveType: LeaveTypeDefinition | undefined
): LeaveBalanceRow | null {
  if (!leaveType) return null;
  const match =
    balances.find((row) => row.leaveTypeId && row.leaveTypeId === leaveType.id) ||
    balances.find(
      (row) =>
        row.leaveTypeName.toLowerCase() === leaveType.name.toLowerCase()
    );
  if (match) return match;
  if (leaveType.code === "annual") {
    return (
      balances.find((row) =>
        row.leaveTypeName.toLowerCase().includes("annual")
      ) ?? null
    );
  }
  return null;
}

export function entitlementBarLabel(
  leaveType: LeaveTypeDefinition | undefined,
  balance: LeaveBalanceRow | null
): string {
  if (!leaveType) return "—";
  if (leaveType.unlimited) return "— / —";
  if (leaveType.code === "toil" && !balance) return "? / Flexible";

  const entitled =
    balance?.entitled ??
    (leaveType.defaultAllowanceDays > 0
      ? leaveType.defaultAllowanceDays
      : null);
  if (entitled == null) return "—";

  const remaining = balance?.remaining ?? entitled;
  return `${formatDayAmount(remaining)} / ${formatDayAmount(entitled)}`;
}

/** Compact remaining label for entitlement list rows, e.g. "21d". */
export function formatCompactDays(days: number): string {
  const rounded = Math.round(days * 100) / 100;
  const text =
    Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${text}d`;
}

export function formatDateDdMmYyyy(d: Date): string {
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${d.getFullYear()}`;
}

export type EntitlementAvailability =
  | {
      kind: "unlimited";
      label: "∞";
      tooltip: string;
      /** null = indeterminate / full soft bar */
      fillPercent: null;
    }
  | {
      kind: "flexible";
      label: "?";
      tooltip: string;
      fillPercent: null;
    }
  | {
      kind: "days";
      label: string;
      remaining: number;
      entitled: number;
      tooltip: string;
      fillPercent: number;
    };

/**
 * Resolve how a leave type shows on Entitlement.
 * ∞ when leaveType.unlimited; ? when entitled is unknown/0 (e.g. TOIL flexible).
 */
export function resolveEntitlementAvailability(
  leaveType: LeaveTypeDefinition,
  balance: LeaveBalanceRow | null
): EntitlementAvailability {
  if (leaveType.unlimited) {
    return {
      kind: "unlimited",
      label: "∞",
      tooltip: "Available as of today: unlimited",
      fillPercent: null,
    };
  }

  const entitledFromBalance =
    balance != null && Number.isFinite(balance.entitled)
      ? balance.entitled
      : null;
  const entitled =
    entitledFromBalance ??
    (leaveType.defaultAllowanceDays > 0
      ? leaveType.defaultAllowanceDays
      : null);

  // TOIL (and any type with no known allowance) → ? when flexible / unknown
  if (entitled == null || entitled <= 0) {
    return {
      kind: "flexible",
      label: "?",
      tooltip: "Available as of today: flexible / unknown",
      fillPercent: null,
    };
  }

  const remaining = balance?.remaining ?? entitled;
  const fillPercent = Math.max(
    0,
    Math.min(100, (remaining / entitled) * 100)
  );

  return {
    kind: "days",
    label: formatCompactDays(remaining),
    remaining,
    entitled,
    tooltip: `Available as of today: ${formatDayAmount(remaining)}`,
    fillPercent,
  };
}

/** Inclusive: dateKey falls within [startDate, endDate]. */
export function dateInLeaveRange(
  dateKey: string,
  startDate: string,
  endDate: string
): boolean {
  return dateKey >= startDate && dateKey <= endDate;
}

export type CalendarCell = {
  dateKey: string;
  dayNum: number;
  /** Preferred: day belongs to the viewed month */
  inMonth: boolean;
  /** Alias of inMonth for older call sites (Apply picker) */
  inCurrentMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
};

/** Monday-start month grid including adjacent-month days (5–6 weeks). */
export function buildMonthWeeks(
  year: number,
  monthIndex: number,
  todayKey = toDateKey(new Date())
): CalendarCell[][] {
  const first = new Date(year, monthIndex, 1);
  const mondayOffset = first.getDay() === 0 ? 6 : first.getDay() - 1;
  const gridStart = new Date(year, monthIndex, 1 - mondayOffset);
  const weeks: CalendarCell[][] = [];

  for (let w = 0; w < 6; w++) {
    const week: CalendarCell[] = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(
        gridStart.getFullYear(),
        gridStart.getMonth(),
        gridStart.getDate() + w * 7 + d
      );
      const dateKey = toDateKey(date);
      const weekday = date.getDay();
      const inMonth = date.getMonth() === monthIndex;
      week.push({
        dateKey,
        dayNum: date.getDate(),
        inMonth,
        inCurrentMonth: inMonth,
        isToday: dateKey === todayKey,
        isWeekend: weekday === 0 || weekday === 6,
      });
    }
    weeks.push(week);
    const allNextMonth = week.every((c) => !c.inMonth && c.dateKey > toDateKey(first));
    if (w >= 3 && allNextMonth) break;
  }

  // Drop trailing week if entirely outside the current month
  while (
    weeks.length > 4 &&
    weeks[weeks.length - 1].every((c) => !c.inMonth)
  ) {
    weeks.pop();
  }

  return weeks;
}

export type WeekBarPlacement = {
  eventId: string;
  lane: number;
  startCol: number;
  span: number;
  continuesBefore: boolean;
  continuesAfter: boolean;
};

/** Pack overlapping multi-day bars into lanes for one week row. */
export function placeWeekBars(
  week: CalendarCell[],
  events: Array<{
    id: string;
    startDate: string;
    endDate: string;
  }>
): { placements: WeekBarPlacement[]; laneCount: number } {
  const weekStart = week[0]?.dateKey;
  const weekEnd = week[6]?.dateKey;
  if (!weekStart || !weekEnd) return { placements: [], laneCount: 0 };

  const segments = events
    .filter((e) => e.startDate <= weekEnd && e.endDate >= weekStart)
    .map((e) => {
      const segStart = e.startDate < weekStart ? weekStart : e.startDate;
      const segEnd = e.endDate > weekEnd ? weekEnd : e.endDate;
      const startCol = week.findIndex((c) => c.dateKey === segStart);
      const endCol = week.findIndex((c) => c.dateKey === segEnd);
      return {
        eventId: e.id,
        startCol: startCol < 0 ? 0 : startCol,
        endCol: endCol < 0 ? 6 : endCol,
        continuesBefore: e.startDate < weekStart,
        continuesAfter: e.endDate > weekEnd,
        startDate: e.startDate,
      };
    })
    .sort(
      (a, b) =>
        a.startCol - b.startCol ||
        b.endCol - a.endCol ||
        a.startDate.localeCompare(b.startDate)
    );

  const laneEnds: number[] = [];
  const placements: WeekBarPlacement[] = [];

  for (const seg of segments) {
    let lane = laneEnds.findIndex((end) => end < seg.startCol);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(seg.endCol);
    } else {
      laneEnds[lane] = seg.endCol;
    }
    placements.push({
      eventId: seg.eventId,
      lane,
      startCol: seg.startCol,
      span: seg.endCol - seg.startCol + 1,
      continuesBefore: seg.continuesBefore,
      continuesAfter: seg.continuesAfter,
    });
  }

  return { placements, laneCount: laneEnds.length };
}

/** Mon-start 6-week grid including faded adjacent-month days. */
export function buildMonthGrid(viewYear: number, viewMonth: number): CalendarCell[] {
  const first = new Date(viewYear, viewMonth, 1);
  const mondayOffset = (first.getDay() + 6) % 7;
  const gridStart = new Date(viewYear, viewMonth, 1 - mondayOffset);
  const todayKey = toDateKey(new Date());
  const cells: CalendarCell[] = [];

  for (let i = 0; i < 42; i++) {
    const d = new Date(
      gridStart.getFullYear(),
      gridStart.getMonth(),
      gridStart.getDate() + i
    );
    const weekday = d.getDay();
    const dateKey = toDateKey(d);
    const inMonth = d.getMonth() === viewMonth;
    cells.push({
      dateKey,
      dayNum: d.getDate(),
      inMonth,
      inCurrentMonth: inMonth,
      isToday: dateKey === todayKey,
      isWeekend: weekday === 0 || weekday === 6,
    });
  }
  return cells;
}
