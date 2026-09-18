"use client";

import { useCallback, useEffect, useState } from "react";
import { LeavePageShell } from "@/components/admin/leave/LeavePageShell";
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
import type { LeaveBalanceRow } from "@/types/leave";
import { Progress } from "@/components/ui/progress";

export default function LeaveBalancesPage() {
  const [items, setItems] = useState<LeaveBalanceRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await leaveApi.listBalances({ limit: 200 });
      setItems(res.items);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load balances");
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <LeavePageShell
      title="Leave balances"
      description="Entitled, used, pending, and remaining days by employee and leave type."
      tourId="leave-balances"
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
            No balances recorded
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Balances appear after you assign leave policies to employees.
          </p>
        </div>
      ) : (
        <>
          <p className="mb-3 text-sm text-muted-foreground">
            {total} balance row{total === 1 ? "" : "s"}
          </p>
          <div
            className="overflow-hidden rounded-xl border border-[#272156]/10"
            data-tour="leave-balances-table"
          >
            <Table>
              <TableHeader>
                <TableRow className="bg-[#31CDFF]/5">
                  <TableHead>Employee</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Entitled</TableHead>
                  <TableHead>Used</TableHead>
                  <TableHead>Pending</TableHead>
                  <TableHead>Remaining</TableHead>
                  <TableHead className="w-40">Usage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((row) => {
                  const pct =
                    row.entitled > 0
                      ? Math.min(
                          100,
                          Math.round(((row.used + row.pending) / row.entitled) * 100)
                        )
                      : 0;
                  return (
                    <TableRow key={row.id}>
                      <TableCell>
                        <div className="font-medium text-[#272156] dark:text-foreground">
                          {row.employeeName}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {row.departmentName}
                        </div>
                      </TableCell>
                      <TableCell>{row.leaveTypeName}</TableCell>
                      <TableCell>{row.entitled}</TableCell>
                      <TableCell>{row.used}</TableCell>
                      <TableCell>{row.pending}</TableCell>
                      <TableCell className="font-semibold text-[#272156] dark:text-[#31CDFF]">
                        {row.remaining}
                      </TableCell>
                      <TableCell>
                        <Progress value={pct} className="h-2" />
                        <span className="mt-1 text-xs text-muted-foreground">
                          {pct}% used / pending
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </LeavePageShell>
  );
}
