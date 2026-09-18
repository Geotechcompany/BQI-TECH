"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { employeePortalApi } from "@/lib/api-backend";
import type {
  LeaveBalanceRow,
  LeaveEndPeriod,
  LeaveStartPeriod,
  LeaveTypeDefinition,
} from "@/types/leave";
import {
  balanceForType,
  buildMonthGrid,
  entitlementBarLabel,
  formatDayAmount,
  leaveDaysWithPeriods,
  parseDateKey,
  toDateKey,
} from "@/components/employee/leave/leave-helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const START_PERIOD_OPTIONS: { value: LeaveStartPeriod; label: string }[] = [
  { value: "morning", label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
];

const END_PERIOD_OPTIONS: { value: LeaveEndPeriod; label: string }[] = [
  { value: "end_of_day", label: "End of day" },
  { value: "morning", label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
];

export default function EmployeeLeaveApplyPage() {
  const queryClient = useQueryClient();
  const today = useMemo(() => new Date(), []);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startPeriod, setStartPeriod] = useState<LeaveStartPeriod>("morning");
  const [endPeriod, setEndPeriod] = useState<LeaveEndPeriod>("end_of_day");
  const [pickingEnd, setPickingEnd] = useState(false);
  const [substituteId, setSubstituteId] = useState("none");
  const [reason, setReason] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const { data: balances, isLoading: balancesLoading } = useQuery({
    queryKey: ["employee-portal-leave-balances"],
    queryFn: () =>
      employeePortalApi.getLeaveBalances() as Promise<{
        items: LeaveBalanceRow[];
        total: number;
      }>,
    staleTime: 60_000,
  });

  const { data: types, isLoading: typesLoading } = useQuery({
    queryKey: ["employee-portal-leave-types"],
    queryFn: () =>
      employeePortalApi.getLeaveTypes() as Promise<{
        items: LeaveTypeDefinition[];
        total: number;
      }>,
    staleTime: 5 * 60_000,
  });

  const leaveTypes = types?.items ?? [];
  const balanceRows = balances?.items ?? [];

  const selectedType = useMemo(
    () => leaveTypes.find((t) => t.id === leaveTypeId),
    [leaveTypes, leaveTypeId]
  );

  const selectedBalance = useMemo(
    () => balanceForType(balanceRows, selectedType),
    [balanceRows, selectedType]
  );

  const dayCount = leaveDaysWithPeriods(
    startDate,
    endDate,
    startPeriod,
    endPeriod
  );
  const remaining = selectedType?.unlimited
    ? null
    : (selectedBalance?.remaining ??
      (selectedType && selectedType.defaultAllowanceDays > 0
        ? selectedType.defaultAllowanceDays
        : null));

  const entitlementYear = useMemo(() => {
    if (startDate) return parseDateKey(startDate).getFullYear();
    return viewYear;
  }, [startDate, viewYear]);

  useEffect(() => {
    if (!leaveTypeId && leaveTypes.length > 0) {
      const annual =
        leaveTypes.find((t) => t.code === "annual") || leaveTypes[0];
      setLeaveTypeId(annual.id);
    }
  }, [leaveTypeId, leaveTypes]);

  const createMutation = useMutation({
    mutationFn: () =>
      employeePortalApi.createLeaveRequest({
        leaveTypeId,
        startDate,
        endDate,
        startPeriod,
        endPeriod,
        reason: reason.trim() || undefined,
        substituteEmployeeId:
          substituteId !== "none" ? substituteId : undefined,
      }),
    onSuccess: () => {
      toast.success("Leave request submitted — pending approval");
      setStartDate("");
      setEndDate("");
      setStartPeriod("morning");
      setEndPeriod("end_of_day");
      setPickingEnd(false);
      setSubstituteId("none");
      setReason("");
      setFormError(null);
      void queryClient.invalidateQueries({
        queryKey: ["employee-portal-leave-requests"],
      });
      void queryClient.invalidateQueries({
        queryKey: ["employee-portal-leave-balances"],
      });
    },
    onError: (err: unknown) => {
      const message =
        err instanceof Error ? err.message : "Could not submit leave request";
      setFormError(message);
      toast.error(message);
    },
  });

  const validateAndSubmit = (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!leaveTypeId) {
      setFormError("Choose an absence type.");
      return;
    }
    if (!startDate || !endDate) {
      setFormError("From and To dates are required.");
      return;
    }
    if (endDate < startDate) {
      setFormError("To date must be on or after From date.");
      return;
    }
    if (dayCount <= 0) {
      setFormError("Leave must cover at least half a day.");
      return;
    }
    if (!selectedType?.unlimited && remaining != null && dayCount > remaining) {
      setFormError(
        `Insufficient balance: ${formatDayAmount(remaining)} remaining for ${selectedType?.name ?? "this type"}, but this request needs ${formatDayAmount(dayCount)}.`
      );
      return;
    }

    createMutation.mutate();
  };

  const monthLabel = useMemo(
    () =>
      new Date(viewYear, viewMonth, 1).toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      }),
    [viewYear, viewMonth]
  );

  const calendarCells = useMemo(
    () => buildMonthGrid(viewYear, viewMonth),
    [viewYear, viewMonth]
  );

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

  const onPickDate = (dateKey: string) => {
    if (!startDate || (startDate && endDate) || !pickingEnd) {
      setStartDate(dateKey);
      setEndDate(dateKey);
      setPickingEnd(true);
      return;
    }
    if (dateKey < startDate) {
      setEndDate(startDate);
      setStartDate(dateKey);
    } else {
      setEndDate(dateKey);
    }
    setPickingEnd(false);
  };

  const isInRange = (dateKey: string) => {
    if (!startDate || !endDate) return false;
    return dateKey >= startDate && dateKey <= endDate;
  };

  const todayKey = toDateKey(new Date());
  const loading = balancesLoading || typesLoading;

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-[28rem] w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <section data-tour="employee-leave-request">
      <div>
        <h2 className="text-base font-semibold tracking-tight text-[#272156]">
          Absence request
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Select dates on the calendar, set part of day, then submit.
        </p>
      </div>

      {leaveTypes.length === 0 ? (
        <p className="mt-3 rounded-2xl border border-dashed border-border bg-card/60 px-4 py-8 text-center text-sm text-muted-foreground">
          No leave types are configured yet. Ask HR to set them up in the admin
          leave module.
        </p>
      ) : (
        <form
          onSubmit={validateAndSubmit}
          className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]"
        >
          <div className="space-y-3">
            <div
              className="rounded-2xl border border-border/60 bg-card p-2.5 shadow-[0_12px_40px_-28px_rgba(39,33,86,0.3)] sm:p-3"
              data-tour="leave-apply-calendar"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-0.5">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => shiftMonth(-1)}
                    aria-label="Previous month"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => shiftMonth(1)}
                    aria-label="Next month"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <span className="text-xs font-semibold text-[#272156]">
                  {monthLabel}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={goToday}
                  className="h-7 border-[#272156]/20 px-2.5 text-[11px]"
                >
                  Today
                </Button>
              </div>

              <div className="mb-0.5 grid grid-cols-7 gap-0.5 text-center text-[10px] font-medium uppercase tracking-wide">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
                  (d, i) => (
                    <div
                      key={d}
                      className={cn(
                        "py-0.5",
                        i >= 5
                          ? "text-rose-500/80"
                          : "text-muted-foreground"
                      )}
                    >
                      {d}
                    </div>
                  )
                )}
              </div>

              <div className="grid grid-cols-7 gap-0.5">
                {calendarCells.map((cell) => {
                  const selected = isInRange(cell.dateKey);
                  const isStart = cell.dateKey === startDate;
                  const isEnd = cell.dateKey === endDate;
                  const isToday = cell.dateKey === todayKey;

                  return (
                    <button
                      key={cell.dateKey}
                      type="button"
                      onClick={() => onPickDate(cell.dateKey)}
                      className={cn(
                        "flex h-8 items-center justify-center rounded-md text-xs transition-colors sm:h-9",
                        !cell.inCurrentMonth && "opacity-35",
                        cell.isWeekend &&
                          !selected &&
                          "bg-rose-50 text-rose-600/90 dark:bg-rose-950/30 dark:text-rose-300",
                        !cell.isWeekend &&
                          !selected &&
                          cell.inCurrentMonth &&
                          "hover:bg-[#31CDFF]/15",
                        selected && "bg-[#272156] text-white",
                        (isStart || isEnd) &&
                          "ring-2 ring-[#31CDFF] ring-offset-1",
                        isToday &&
                          !selected &&
                          "font-semibold text-[#272156] ring-1 ring-[#31CDFF]/50"
                      )}
                      aria-label={cell.dateKey}
                      aria-pressed={selected}
                    >
                      {cell.dayNum}
                    </button>
                  );
                })}
              </div>
            </div>

            <div
              className="flex h-7 items-center justify-between gap-2 rounded-lg border border-[#272156]/10 bg-[#272156]/5 px-3"
              data-tour="leave-entitlement-bar"
            >
              <div className="flex min-w-0 items-baseline gap-2 truncate">
                <p className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Entitlement
                  {selectedType ? ` · ${selectedType.name}` : ""}
                </p>
                <p className="truncate text-sm font-semibold tabular-nums text-[#272156]">
                  {entitlementBarLabel(selectedType, selectedBalance)}
                  {dayCount > 0 ? (
                    <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">
                      · requesting {formatDayAmount(dayCount)}
                    </span>
                  ) : null}
                </p>
              </div>
              <p className="shrink-0 text-xs font-medium tabular-nums text-[#272156]/70">
                {entitlementYear}
              </p>
            </div>
          </div>

          <div
            className="space-y-4 rounded-2xl border border-border/60 bg-card p-4 shadow-[0_12px_40px_-28px_rgba(39,33,86,0.3)] sm:p-5"
            data-tour="leave-apply-form"
          >
            <div className="space-y-2">
              <Label htmlFor="leave-from">From</Label>
              <div className="grid gap-2 sm:grid-cols-[1fr_minmax(0,7.5rem)]">
                <Input
                  id="leave-from"
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    const v = e.target.value;
                    setStartDate(v);
                    setPickingEnd(Boolean(v));
                    if (endDate && v && endDate < v) setEndDate(v);
                    if (v) {
                      const d = parseDateKey(v);
                      setViewYear(d.getFullYear());
                      setViewMonth(d.getMonth());
                    }
                  }}
                  required
                  data-tour="leave-start-date"
                />
                <Select
                  value={startPeriod}
                  onValueChange={(v) =>
                    setStartPeriod(v as LeaveStartPeriod)
                  }
                >
                  <SelectTrigger
                    aria-label="From part of day"
                    data-tour="leave-start-period"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {START_PERIOD_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="leave-to">To</Label>
              <div className="grid gap-2 sm:grid-cols-[1fr_minmax(0,7.5rem)]">
                <Input
                  id="leave-to"
                  type="date"
                  value={endDate}
                  min={startDate || undefined}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setPickingEnd(false);
                  }}
                  required
                  data-tour="leave-end-date"
                />
                <Select
                  value={endPeriod}
                  onValueChange={(v) => setEndPeriod(v as LeaveEndPeriod)}
                >
                  <SelectTrigger
                    aria-label="To part of day"
                    data-tour="leave-end-period"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {END_PERIOD_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="leave-type">Absence type</Label>
              <Select value={leaveTypeId} onValueChange={setLeaveTypeId}>
                <SelectTrigger id="leave-type" data-tour="leave-type-select">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {leaveTypes.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: t.color }}
                          aria-hidden
                        />
                        {t.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="leave-substitute">Substitute</Label>
              <Select value={substituteId} onValueChange={setSubstituteId}>
                <SelectTrigger
                  id="leave-substitute"
                  data-tour="leave-substitute"
                >
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="leave-reason">Comment</Label>
              <Textarea
                id="leave-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                maxLength={1000}
                placeholder="Optional note for your manager…"
                data-tour="leave-reason"
              />
            </div>

            {formError ? (
              <p
                className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800"
                role="alert"
              >
                {formError}
              </p>
            ) : null}

            <Button
              type="submit"
              disabled={createMutation.isPending}
              className="w-full bg-[#31CDFF] font-semibold text-[#272156] hover:bg-[#31CDFF]/90"
              data-tour="leave-submit"
            >
              {createMutation.isPending ? "Submitting…" : "OK"}
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
