"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  Download,
  Plus,
  Users,
  Clock,
  CheckCircle2,
  Wallet,
  Tag,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { LeavePageShell } from "@/components/admin/leave/LeavePageShell";
import { LeaveKpiCard } from "@/components/admin/leave/LeaveKpiCard";
import { LeaveUsageTrend } from "@/components/admin/leave/LeaveUsageTrend";
import { OnLeaveThisWeek } from "@/components/admin/leave/OnLeaveThisWeek";
import { Button } from "@/components/ui/button";
import { LeaveOverviewSkeleton } from "@/components/admin/hr-skeletons";
import { leaveApi, type LeaveOverviewResponse } from "@/lib/leave";

export default function LeaveOverviewPage() {
  const [data, setData] = useState<LeaveOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const overview = await leaveApi.overview();
      setData(overview);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load leave overview";
      setError(message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const kpis = data?.kpis;

  return (
    <LeavePageShell
      title="Leave overview"
      description="Track leave usage, balances, and approvals across the company."
      tourId="leave-overview"
      actions={
        <>
          <Button
            variant="outline"
            size="sm"
            className="border-[#272156]/20"
            onClick={() =>
              toast("Export uses live request data once CSV export ships.")
            }
          >
            <Download className="mr-1.5 h-4 w-4" />
            Export
          </Button>
          <Button asChild variant="outline" size="sm" className="border-[#272156]/20">
            <Link href="/manage/leave/calendar">
              <CalendarDays className="mr-1.5 h-4 w-4" />
              Calendar
            </Link>
          </Button>
          <Button
            asChild
            size="sm"
            className="bg-[#272156] text-white hover:bg-[#272156]/90"
          >
            <Link href="/manage/leave/requests">
              <Plus className="mr-1.5 h-4 w-4" />
              Request leave
            </Link>
          </Button>
        </>
      }
    >
      {loading ? (
        <LeaveOverviewSkeleton />
      ) : error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-8 text-center dark:border-rose-900/40 dark:bg-rose-950/30">
          <p className="text-sm text-rose-800 dark:text-rose-200">{error}</p>
          <Button
            size="sm"
            variant="outline"
            className="mt-3"
            onClick={() => void load()}
          >
            Retry
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
            data-tour="leave-overview-kpis"
          >
            <LeaveKpiCard
              label="On leave today"
              value={kpis?.onLeaveToday ?? 0}
              icon={Users}
              sparkline={kpis?.sparklines.onLeaveToday}
            />
            <LeaveKpiCard
              label="Pending requests"
              value={kpis?.pendingRequests ?? 0}
              icon={Clock}
              sparkline={kpis?.sparklines.pendingRequests}
            />
            <LeaveKpiCard
              label="Approved this month"
              value={kpis?.approvedThisMonth ?? 0}
              icon={CheckCircle2}
              sparkline={kpis?.sparklines.approvedThisMonth}
            />
            <LeaveKpiCard
              label="Avg balance"
              value={kpis?.avgBalanceDays ?? 0}
              hint="days remaining"
              icon={Wallet}
              sparkline={kpis?.sparklines.avgBalanceDays}
            />
            <LeaveKpiCard
              label="Top usage type"
              value={kpis?.topUsageType ?? "—"}
              icon={Tag}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-5">
            <div className="lg:col-span-3" data-tour="leave-overview-trend">
              <LeaveUsageTrend months={data?.usageTrend ?? []} />
            </div>
            <div className="lg:col-span-2" data-tour="leave-overview-this-week">
              <OnLeaveThisWeek entries={data?.onLeaveThisWeek ?? []} />
            </div>
          </div>
        </div>
      )}
    </LeavePageShell>
  );
}
