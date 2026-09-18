"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import { LeavePageShell } from "@/components/admin/leave/LeavePageShell";
import { LeaveTypeTag } from "@/components/admin/leave/LeaveStatusBadge";
import {
  EditLeaveTypeDialog,
  type LeaveTypeEditPayload,
} from "@/components/admin/leave/EditLeaveTypeDialog";
import { Button } from "@/components/ui/button";
import { LeaveTableSkeleton } from "@/components/admin/hr-skeletons";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { leaveApi } from "@/lib/leave";
import type { LeaveTypeDefinition } from "@/types/leave";

const MONGO_OBJECT_ID_RE = /^[a-fA-F0-9]{24}$/;

function allowanceLabel(t: LeaveTypeDefinition): string {
  if (t.unlimited) return "—";
  if (t.code === "toil") return "Flexible";
  return `${t.defaultAllowanceDays} days`;
}

function withValidDbId(t: LeaveTypeDefinition): boolean {
  return typeof t.id === "string" && MONGO_OBJECT_ID_RE.test(t.id);
}

export default function LeaveTypesPage() {
  const [items, setItems] = useState<LeaveTypeDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<LeaveTypeDefinition | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await leaveApi.listTypes();
      const rows = Array.isArray(res?.items) ? res.items : [];
      // Only rows persisted in Mongo (seed constants without _id must not appear).
      setItems(rows.filter(withValidDbId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load leave types");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = async (payload: LeaveTypeEditPayload) => {
    if (!editing) return;
    if (!withValidDbId(editing)) {
      throw new Error(
        "This leave type has no MongoDB id. Refresh the page so types are loaded from the database."
      );
    }
    setSaving(true);
    try {
      await leaveApi.updateType(editing.id, payload);
      setEditing(null);
      await load();
    } finally {
      setSaving(false);
    }
  };

  return (
    <LeavePageShell
      title="Leave types"
      description="Paid and unpaid categories used on requests, balances, and policies."
      tourId="leave-types"
    >
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
            No leave types configured
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a leave type so employees can request time off.
          </p>
        </div>
      ) : (
        <div
          className="overflow-hidden rounded-xl border border-[#272156]/10"
          data-tour="leave-types-table"
        >
          <Table>
            <TableHeader>
              <TableRow className="bg-[#31CDFF]/5">
                <TableHead>Type</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Allowance</TableHead>
                <TableHead>Paid</TableHead>
                <TableHead>Approval</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[72px] text-right">Edit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <LeaveTypeTag name={t.name} color={t.color} />
                    </div>
                    <p className="mt-1 max-w-md text-xs text-muted-foreground">
                      {t.description}
                    </p>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{t.code}</TableCell>
                  <TableCell>{allowanceLabel(t)}</TableCell>
                  <TableCell>{t.paid ? "Paid" : "Unpaid"}</TableCell>
                  <TableCell>
                    {t.requiresApproval ? "Required" : "Auto"}
                  </TableCell>
                  <TableCell>
                    <span
                      className={
                        t.active
                          ? "text-xs font-medium text-[#272156] dark:text-[#31CDFF]"
                          : "text-xs text-muted-foreground"
                      }
                    >
                      {t.active ? "Active" : "Inactive"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label={`Edit ${t.name}`}
                      onClick={() => setEditing(t)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <EditLeaveTypeDialog
        open={Boolean(editing)}
        leaveType={editing}
        isSubmitting={saving}
        onOpenChange={(open) => {
          if (!open && !saving) setEditing(null);
        }}
        onSubmit={handleSave}
      />
    </LeavePageShell>
  );
}
