"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { employeePortalApi } from "@/lib/api-backend";
import type { LeaveBalanceRow, LeaveTypeDefinition } from "@/types/leave";
import type { Employee } from "@/types/employee";
import {
  balanceForType,
  formatDateDdMmYyyy,
  resolveEntitlementAvailability,
} from "@/components/employee/leave/leave-helpers";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

function employeeDisplayName(employee: Employee | undefined): string {
  if (!employee) return "You";
  const fromParts = [employee.firstName, employee.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();
  return (
    employee.displayName?.trim() ||
    fromParts ||
    employee.workEmail ||
    employee.personalEmail ||
    "You"
  );
}

export default function EmployeeLeaveEntitlementPage() {
  const today = useMemo(() => new Date(), []);
  const currentYear = today.getFullYear();
  const [typeSearch, setTypeSearch] = useState("");
  const [absenceYear, setAbsenceYear] = useState(String(currentYear));

  const yearOptions = useMemo(
    () => [currentYear - 1, currentYear, currentYear + 1].map(String),
    [currentYear]
  );

  const { data: me, isLoading: meLoading } = useQuery({
    queryKey: ["employee-portal-me"],
    queryFn: () => employeePortalApi.getMe() as Promise<Employee>,
    staleTime: 5 * 60_000,
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

  const { data: balances, isLoading: balancesLoading } = useQuery({
    queryKey: ["employee-portal-leave-balances"],
    queryFn: () =>
      employeePortalApi.getLeaveBalances() as Promise<{
        items: LeaveBalanceRow[];
        total: number;
      }>,
    staleTime: 60_000,
  });

  const leaveTypes = types?.items ?? [];
  const balanceRows = balances?.items ?? [];
  const peopleLabel = employeeDisplayName(me);
  const availableAsOf = formatDateDdMmYyyy(today);

  const filteredTypes = useMemo(() => {
    const q = typeSearch.trim().toLowerCase();
    const active = leaveTypes.filter((t) => t.active !== false);
    if (!q) return active;
    return active.filter((t) => t.name.toLowerCase().includes(q));
  }, [leaveTypes, typeSearch]);

  const isLoading = meLoading || typesLoading || balancesLoading;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-36" />
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-36" />
          <Skeleton className="h-10 w-44" />
        </div>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    );
  }

  return (
    <section data-tour="employee-leave-balances" className="space-y-4">
      <h2 className="text-base font-semibold tracking-tight text-[#272156] dark:text-foreground">
        Entitlement
      </h2>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative min-w-[12rem] flex-1 sm:max-w-xs">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={typeSearch}
            onChange={(e) => setTypeSearch(e.target.value)}
            placeholder="Type name"
            aria-label="Search type name"
            className="pl-9"
          />
        </div>

        <Select value={absenceYear} onValueChange={setAbsenceYear}>
          <SelectTrigger
            className="w-full sm:w-[9.5rem]"
            aria-label="Absence year"
          >
            <SelectValue placeholder="Absence year" />
          </SelectTrigger>
          <SelectContent>
            {yearOptions.map((year) => (
              <SelectItem key={year} value={year}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value="self" disabled>
          <SelectTrigger
            className="w-full sm:w-[14rem]"
            aria-label="People"
            title="Employees can only view their own entitlement"
          >
            <SelectValue>{peopleLabel}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="self">{peopleLabel}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
        <div className="flex items-center justify-between gap-3 border-b border-border/60 bg-[#272156]/[0.03] px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <span>Types</span>
          <span className="text-right tabular-nums">
            Available as of {availableAsOf}
          </span>
        </div>

        {filteredTypes.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            {leaveTypes.length === 0
              ? "No leave types on file yet. HR can configure types in the admin leave module."
              : "No leave types match that search."}
          </p>
        ) : (
          <TooltipProvider delayDuration={200}>
            <ul className="divide-y divide-border/50">
              {filteredTypes.map((leaveType) => {
                const balance = balanceForType(balanceRows, leaveType);
                const availability = resolveEntitlementAvailability(
                  leaveType,
                  balance
                );
                const barWidth =
                  availability.fillPercent == null
                    ? availability.kind === "unlimited"
                      ? 100
                      : 0
                    : availability.fillPercent;

                return (
                  <li
                    key={leaveType.id}
                    className="grid grid-cols-[minmax(0,1fr)_minmax(5rem,1.4fr)_auto] items-center gap-3 px-4 py-3.5"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        className="size-3.5 shrink-0 rounded-[3px] ring-1 ring-black/5"
                        style={{ backgroundColor: leaveType.color || "#272156" }}
                        aria-hidden
                      />
                      <span className="truncate text-sm font-medium text-foreground">
                        {leaveType.name}
                      </span>
                    </div>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div
                          className="h-2 w-full cursor-default overflow-hidden rounded-full bg-teal-100/80 dark:bg-teal-950/40"
                          role="progressbar"
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={
                            availability.fillPercent == null
                              ? undefined
                              : Math.round(availability.fillPercent)
                          }
                          aria-label={`${leaveType.name}: ${availability.tooltip}`}
                        >
                          <div
                            className={cn(
                              "h-full rounded-full transition-[width] duration-300",
                              availability.kind === "unlimited"
                                ? "bg-teal-400/70 dark:bg-teal-500/50"
                                : "bg-teal-500 dark:bg-teal-400"
                            )}
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        {availability.tooltip}
                      </TooltipContent>
                    </Tooltip>

                    <span
                      className={cn(
                        "min-w-[2.5rem] text-right text-sm font-semibold tabular-nums text-[#272156] dark:text-foreground",
                        availability.kind !== "days" && "text-lg leading-none"
                      )}
                      title={availability.tooltip}
                    >
                      {availability.label}
                    </span>
                  </li>
                );
              })}
            </ul>
          </TooltipProvider>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Showing balances for absence year {absenceYear}. Remaining days update
        when requests are approved.
      </p>
    </section>
  );
}
