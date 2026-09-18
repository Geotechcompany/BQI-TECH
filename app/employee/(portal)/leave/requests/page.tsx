"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { RequestDetailDrawer } from "@/components/employee/leave/RequestDetailDrawer";
import {
  formatAbsencePeriod,
  formatRequestedShort,
  requestStatusPillClass,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { employeePortalApi } from "@/lib/api-backend";
import { cn } from "@/lib/utils";
import type { LeaveRequest, LeaveRequestStatus } from "@/types/leave";
import { LEAVE_STATUS_LABELS } from "@/types/leave";

function StatusPill({ status }: { status: LeaveRequestStatus | string }) {
  const key = (status in LEAVE_STATUS_LABELS
    ? status
    : "pending") as LeaveRequestStatus;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
        requestStatusPillClass(key)
      )}
    >
      {LEAVE_STATUS_LABELS[key]}
    </span>
  );
}

export default function EmployeeLeaveRequestsPage() {
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("any");
  const [statusFilter, setStatusFilter] = useState("any");
  const [typeFilter, setTypeFilter] = useState("any");
  const [selected, setSelected] = useState<LeaveRequest | null>(null);

  const { data: requests, isLoading } = useQuery({
    queryKey: ["employee-portal-leave-requests"],
    queryFn: () =>
      employeePortalApi.getLeaveRequests() as Promise<{
        items: LeaveRequest[];
        total: number;
      }>,
    staleTime: 60_000,
  });

  const requestRows = requests?.items ?? [];

  const absenceTypes = useMemo(() => {
    const names = new Set<string>();
    for (const row of requestRows) {
      if (row.leaveTypeName) names.add(row.leaveTypeName);
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [requestRows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const now = new Date();
    const year = now.getFullYear();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyKey = thirtyDaysAgo.toISOString().slice(0, 10);

    return requestRows.filter((row) => {
      if (statusFilter !== "any" && row.status !== statusFilter) return false;
      if (typeFilter !== "any" && row.leaveTypeName !== typeFilter) return false;

      if (dateFilter === "this-year") {
        const y = (row.startDate || "").slice(0, 4);
        if (y !== String(year)) return false;
      } else if (dateFilter === "last-30") {
        if ((row.endDate || row.startDate) < thirtyKey) return false;
      }

      if (!q) return true;
      const hay = [
        row.leaveTypeName,
        row.status,
        row.reason,
        row.startDate,
        row.endDate,
        row.approverName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [requestRows, search, dateFilter, statusFilter, typeFilter]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <section data-tour="employee-leave-requests">
      <h2 className="text-base font-semibold tracking-tight text-[#272156] dark:text-foreground">
        My requests
      </h2>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search absence"
            className="h-9 pl-8"
            aria-label="Search absence"
          />
        </div>
        <Select value={dateFilter} onValueChange={setDateFilter}>
          <SelectTrigger className="h-9 w-full sm:w-[140px]">
            <SelectValue placeholder="Date" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Date: Any</SelectItem>
            <SelectItem value="this-year">This year</SelectItem>
            <SelectItem value="last-30">Last 30 days</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-full sm:w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Status: Any</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="h-9 w-full sm:w-[180px]">
            <SelectValue placeholder="Absence type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Absence type: Any</SelectItem>
            {absenceTypes.map((name) => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-dashed border-border bg-card/60 px-4 py-10 text-center text-sm text-muted-foreground">
          {requestRows.length === 0
            ? "You have no leave requests yet."
            : "No requests match these filters."}
        </p>
      ) : (
        <div className="mt-4 overflow-hidden rounded-xl border border-[#272156]/10 bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#31CDFF]/5 hover:bg-[#31CDFF]/5">
                <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-[#272156]/70">
                  Absence type
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-[#272156]/70">
                  Status
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-[#272156]/70">
                  Absence period
                </TableHead>
                <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wide text-[#272156]/70">
                  Requested
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((req) => (
                <TableRow
                  key={req.id}
                  className={cn(
                    "cursor-pointer transition-colors",
                    selected?.id === req.id
                      ? "bg-[#31CDFF]/10"
                      : "hover:bg-[#272156]/[0.03]"
                  )}
                  onClick={() => setSelected(req)}
                >
                  <TableCell className="font-medium text-[#272156] dark:text-foreground">
                    {req.leaveTypeName}
                  </TableCell>
                  <TableCell>
                    <StatusPill status={req.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatAbsencePeriod(req.startDate, req.endDate)}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums text-[#272156] dark:text-foreground">
                    {formatRequestedShort(req.days)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <RequestDetailDrawer
        request={selected}
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
      />
    </section>
  );
}
