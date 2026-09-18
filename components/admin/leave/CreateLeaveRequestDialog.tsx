"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { adminApi } from "@/lib/api-backend";
import { leaveApi } from "@/lib/leave";
import { fullName } from "@/lib/employees";
import type { Employee } from "@/types/employee";
import type { LeaveTypeDefinition } from "@/types/leave";

function inclusiveDays(start: string, end: string): number {
  if (!start || !end || end < start) return 0;
  const a = new Date(`${start}T00:00:00Z`);
  const b = new Date(`${end}T00:00:00Z`);
  return Math.floor((b.getTime() - a.getTime()) / 86_400_000) + 1;
}

export type CreateLeaveRequestPayload = {
  employeeId: string;
  employeeName: string;
  departmentName: string;
  jobTitle: string;
  leaveTypeId: string;
  leaveTypeName: string;
  startDate: string;
  endDate: string;
  days: number;
  reason?: string;
  status: "pending" | "approved";
};

interface CreateLeaveRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

export function CreateLeaveRequestDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateLeaveRequestDialogProps) {
  const [employeeId, setEmployeeId] = useState("");
  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [submitAsApproved, setSubmitAsApproved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { data: employeesData, isLoading: employeesLoading } = useQuery({
    queryKey: ["admin-employees-leave-picker"],
    queryFn: () =>
      adminApi.getEmployees({
        status: "active",
        limit: 500,
      }) as Promise<{ employees: Employee[]; total: number }>,
    enabled: open,
    staleTime: 60_000,
  });

  const { data: typesData, isLoading: typesLoading } = useQuery({
    queryKey: ["admin-leave-types"],
    queryFn: () => leaveApi.listTypes(),
    enabled: open,
    staleTime: 5 * 60_000,
  });

  const employees = employeesData?.employees ?? [];
  const leaveTypes = (typesData?.items ?? []).filter((t) => t.active !== false);

  const selectedEmployee = useMemo(
    () => employees.find((e) => e.id === employeeId) ?? null,
    [employees, employeeId]
  );
  const selectedType = useMemo(
    () => leaveTypes.find((t: LeaveTypeDefinition) => t.id === leaveTypeId) ?? null,
    [leaveTypes, leaveTypeId]
  );

  const days = inclusiveDays(startDate, endDate);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (!leaveTypeId && leaveTypes.length > 0) {
      const annual =
        leaveTypes.find((t) => t.code === "annual") || leaveTypes[0];
      setLeaveTypeId(annual.id);
    }
  }, [open, leaveTypeId, leaveTypes]);

  const reset = () => {
    setEmployeeId("");
    setLeaveTypeId("");
    setStartDate("");
    setEndDate("");
    setReason("");
    setSubmitAsApproved(false);
    setError(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedEmployee) {
      setError("Select an employee.");
      return;
    }
    if (!selectedType) {
      setError("Select a leave type.");
      return;
    }
    if (!startDate || !endDate) {
      setError("Start and end dates are required.");
      return;
    }
    if (endDate < startDate) {
      setError("End date must be on or after start date.");
      return;
    }
    if (days <= 0) {
      setError("Leave must cover at least one day.");
      return;
    }

    const payload: CreateLeaveRequestPayload = {
      employeeId: selectedEmployee.id,
      employeeName: fullName(selectedEmployee),
      departmentName: selectedEmployee.departmentName || "",
      jobTitle: selectedEmployee.jobTitle || "",
      leaveTypeId: selectedType.id,
      leaveTypeName: selectedType.name,
      startDate,
      endDate,
      days,
      reason: reason.trim() || undefined,
      status: submitAsApproved ? "approved" : "pending",
    };

    setSubmitting(true);
    try {
      await leaveApi.createRequest(payload);
      toast.success(
        submitAsApproved
          ? "Leave request created and approved"
          : "Leave request submitted"
      );
      reset();
      onOpenChange(false);
      onCreated?.();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not create leave request";
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Request leave</DialogTitle>
          <DialogDescription>
            Create a leave request for an employee. It is saved to the database
            and appears in this list for review.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="leave-employee">Employee</Label>
            <Select
              value={employeeId || undefined}
              onValueChange={setEmployeeId}
              disabled={employeesLoading || submitting}
            >
              <SelectTrigger id="leave-employee">
                <SelectValue
                  placeholder={
                    employeesLoading ? "Loading employees…" : "Select employee"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {employees.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {fullName(emp)}
                    {emp.departmentName ? ` · ${emp.departmentName}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!employeesLoading && employees.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No active employees found. Add employees first.
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="leave-type">Leave type</Label>
            <Select
              value={leaveTypeId || undefined}
              onValueChange={setLeaveTypeId}
              disabled={typesLoading || submitting}
            >
              <SelectTrigger id="leave-type">
                <SelectValue
                  placeholder={
                    typesLoading ? "Loading types…" : "Select leave type"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {leaveTypes.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="leave-start">Start date</Label>
              <Input
                id="leave-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={submitting}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="leave-end">End date</Label>
              <Input
                id="leave-end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={submitting}
                required
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            {days > 0
              ? `${days} calendar day${days === 1 ? "" : "s"}`
              : "Select dates to calculate days"}
          </p>

          <div className="space-y-2">
            <Label htmlFor="leave-reason">Reason (optional)</Label>
            <Textarea
              id="leave-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Notes for approvers"
              rows={3}
              disabled={submitting}
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border"
              checked={submitAsApproved}
              onChange={(e) => setSubmitAsApproved(e.target.checked)}
              disabled={submitting}
            />
            Create as already approved
          </label>

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-[#272156] text-white hover:bg-[#272156]/90"
              disabled={submitting || employeesLoading || typesLoading}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Submit request"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
