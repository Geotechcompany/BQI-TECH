"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "react-hot-toast";
import { CreateLeaveRequestDialog } from "@/components/admin/leave/CreateLeaveRequestDialog";
import { LeavePageShell } from "@/components/admin/leave/LeavePageShell";
import { LeaveStatusBadge } from "@/components/admin/leave/LeaveStatusBadge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { LeaveTableSkeleton } from "@/components/admin/hr-skeletons";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { leaveApi } from "@/lib/leave";
import type { LeaveRequest, LeaveRequestStatus } from "@/types/leave";

function formatDate(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function LeaveRequestsPage() {
  const [items, setItems] = useState<LeaveRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<LeaveRequestStatus | "all">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await leaveApi.listRequests({ status, limit: 100 });
      setItems(res.items);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load requests");
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  const updateStatus = async (id: string, next: LeaveRequestStatus) => {
    setActingId(id);
    try {
      await leaveApi.updateRequest(id, { status: next });
      toast.success(next === "approved" ? "Request approved" : "Request updated");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setActingId(null);
    }
  };

  return (
    <LeavePageShell
      title="Leave requests"
      description="Review and approve time-off requests from staff."
      tourId="leave-requests"
      actions={
        <Button
          size="sm"
          className="bg-[#272156] text-white hover:bg-[#272156]/90"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="mr-1.5 h-4 w-4" />
          Request leave
        </Button>
      }
    >
      <CreateLeaveRequestDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => void load()}
      />

      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {loading ? (
            <Skeleton className="inline-block h-4 w-24" />
          ) : (
            `${total} request${total === 1 ? "" : "s"}`
          )}
        </p>
        <Select
          value={status}
          onValueChange={(v) => setStatus(v as LeaveRequestStatus | "all")}
        >
          <SelectTrigger className="w-40" data-tour="leave-requests-filter">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <LeaveTableSkeleton columns={7} />
      ) : error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-8 text-center text-sm text-rose-800">
          {error}
          <div className="mt-3">
            <Button size="sm" variant="outline" onClick={() => void load()}>
              Retry
            </Button>
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#272156]/15 px-4 py-16 text-center">
          <p className="text-sm font-medium text-[#272156] dark:text-foreground">
            No leave requests yet
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Requests show here once employees submit time off, or create one
            with Request leave.
          </p>
          <Button
            size="sm"
            className="mt-4 bg-[#272156] text-white hover:bg-[#272156]/90"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Request leave
          </Button>
        </div>
      ) : (
        <div
          className="overflow-hidden rounded-xl border border-[#272156]/10"
          data-tour="leave-requests-table"
        >
          <Table>
            <TableHeader>
              <TableRow className="bg-[#31CDFF]/5">
                <TableHead>Employee</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Days</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Requested</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((req) => (
                <TableRow key={req.id}>
                  <TableCell>
                    <div className="font-medium text-[#272156] dark:text-foreground">
                      {req.employeeName}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {req.departmentName}
                    </div>
                  </TableCell>
                  <TableCell>{req.leaveTypeName}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm">
                    {formatDate(req.startDate)} – {formatDate(req.endDate)}
                  </TableCell>
                  <TableCell>{req.days}</TableCell>
                  <TableCell>
                    <LeaveStatusBadge status={req.status} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(req.requestedAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    {req.status === "pending" ? (
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={actingId === req.id}
                          className="border-[#31CDFF]/40"
                          onClick={() => void updateStatus(req.id, "approved")}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={actingId === req.id}
                          onClick={() => void updateStatus(req.id, "rejected")}
                        >
                          Reject
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {req.approverName ?? "—"}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </LeavePageShell>
  );
}
