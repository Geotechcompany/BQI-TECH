"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "react-hot-toast";
import { LeavePageShell } from "@/components/admin/leave/LeavePageShell";
import { LeavePolicyCard } from "@/components/admin/leave/LeavePolicyCard";
import { Button } from "@/components/ui/button";
import { LeavePoliciesSkeleton } from "@/components/admin/hr-skeletons";
import { leaveApi } from "@/lib/leave";
import type { LeavePolicy } from "@/types/leave";

export default function LeavePoliciesPage() {
  const [items, setItems] = useState<LeavePolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await leaveApi.listPolicies();
      setItems(res.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load policies");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <LeavePageShell
      title="Leave policies"
      description="Region-specific policies, accrual rules, and approval flows."
      tourId="leave-policies"
      actions={
        <Button
          size="sm"
          className="bg-[#272156] text-white hover:bg-[#272156]/90"
          data-tour="leave-policies-add"
          onClick={() =>
            toast("Policy editor ships next. Create via POST /api/admin/leave/policies for now.")
          }
        >
          <Plus className="mr-1.5 h-4 w-4" />
          New policy
        </Button>
      }
    >
      {loading ? (
        <LeavePoliciesSkeleton />
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
            No leave policies yet
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add a policy to define accrual and approval rules.
          </p>
        </div>
      ) : (
        <div
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
          data-tour="leave-policies-grid"
        >
          {items.map((policy) => (
            <LeavePolicyCard key={policy.id} policy={policy} />
          ))}
        </div>
      )}
    </LeavePageShell>
  );
}
