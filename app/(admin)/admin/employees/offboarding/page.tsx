"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import { EmployeeMetricCard } from "@/components/admin/employees/EmployeeMetricCard";
import { EmployeeStatusBadge } from "@/components/admin/employees/EmployeeStatusBadge";
import { TourPageHelper } from "@/components/admin/tour/TourPageHelper";
import { adminApi } from "@/lib/api-backend";
import {
  OFFBOARDING_STAGE_LABELS,
  OFFBOARDING_STAGE_ORDER,
  daysSinceStart,
  formatShortDate,
  fullName,
} from "@/lib/employees";
import type { Employee, OffboardingStage } from "@/types/employee";
import { Button } from "@/components/ui/button";
import {
  ClipboardList,
  DoorOpen,
  Package,
  Timer,
  Users,
} from "lucide-react";
import { OffboardingSkeleton } from "@/components/admin/hr-skeletons";

const EXIT_MILESTONES: { stage: OffboardingStage; label: string }[] = [
  { stage: "notice", label: "Notice acknowledged" },
  { stage: "knowledge_transfer", label: "Knowledge transfer started" },
  { stage: "asset_return", label: "Assets returned" },
  { stage: "exit_interview", label: "Exit interview done" },
  { stage: "complete", label: "Offboarding finished" },
];

function stageReached(
  current: OffboardingStage | undefined,
  target: OffboardingStage
): boolean {
  const cur = current || "notice";
  return (
    OFFBOARDING_STAGE_ORDER.indexOf(cur) >=
    OFFBOARDING_STAGE_ORDER.indexOf(target)
  );
}

export default function OffboardingPage() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["admin-employees-offboarding"],
    queryFn: () =>
      adminApi.getEmployees({ status: "offboarding", limit: 200 }) as Promise<{
        employees: Employee[];
      }>,
  });

  const people = data?.employees ?? [];

  const stats = useMemo(() => {
    const withEnd = people.filter((e) => e.endDate);
    const endingSoon = withEnd.filter((e) => {
      const days = daysSinceStart(e.endDate);
      // endDate in the future: daysSinceStart would be 0 if we used it wrong.
      // Compare end date to today instead.
      if (!e.endDate) return false;
      const end = new Date(e.endDate.slice(0, 10) + "T00:00:00Z");
      const now = new Date();
      const utcToday = Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate()
      );
      const diff = Math.floor((end.getTime() - utcToday) / 86_400_000);
      return diff >= 0 && diff <= 14;
    }).length;

    const completeCount = people.filter(
      (e) => e.offboardingStage === "complete"
    ).length;
    const assetsPending = people.filter(
      (e) =>
        !e.offboardingStage ||
        OFFBOARDING_STAGE_ORDER.indexOf(e.offboardingStage) <
          OFFBOARDING_STAGE_ORDER.indexOf("asset_return")
    ).length;

    const milestonePct = EXIT_MILESTONES.map((m) => {
      if (people.length === 0) return { ...m, pct: 0, count: 0 };
      const count = people.filter((e) =>
        stageReached(e.offboardingStage, m.stage)
      ).length;
      return {
        ...m,
        count,
        pct: Math.round((count / people.length) * 100),
      };
    });

    return { endingSoon, completeCount, assetsPending, milestonePct };
  }, [people]);

  return (
    <AdminPageLayout title="Offboarding" showSearch={false} tourId="employees-offboarding">
      <TourPageHelper tourId="employees-offboarding" />
      <div className="mx-auto max-w-screen-2xl space-y-6 px-4 py-6">
        <p className="text-sm text-muted-foreground">
          Exit pipeline for people leaving BQI — notice through final handoff.
        </p>

        {isLoading ? (
          <OffboardingSkeleton />
        ) : isError ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
            <p className="text-sm text-destructive">
              {(error as Error)?.message}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => refetch()}
            >
              Retry
            </Button>
          </div>
        ) : (
          <>
            <div
              className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
              data-tour="employees-offboarding-metrics"
            >
              <EmployeeMetricCard
                label="Active exits"
                value={people.length}
                icon={Users}
                accent="navy"
              />
              <EmployeeMetricCard
                label="Leaving in 14 days"
                value={stats.endingSoon}
                hint="By end date"
                icon={Timer}
                accent="cyan"
              />
              <EmployeeMetricCard
                label="Assets still out"
                value={stats.assetsPending}
                icon={Package}
                accent="neutral"
              />
              <EmployeeMetricCard
                label="Exit complete"
                value={stats.completeCount}
                icon={DoorOpen}
                accent="navy"
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-5">
              <div
                className="rounded-xl border bg-card p-4 lg:col-span-3"
                data-tour="employees-offboarding-list"
              >
                <h3 className="mb-3 text-sm font-semibold text-[#272156] dark:text-foreground">
                  Active offboardings
                </h3>
                {people.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    Nobody is in offboarding right now.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[560px] text-left text-sm">
                      <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 font-medium">Name</th>
                          <th className="px-3 py-2 font-medium">Role</th>
                          <th className="px-3 py-2 font-medium">Last day</th>
                          <th className="px-3 py-2 font-medium">Stage</th>
                          <th className="px-3 py-2 font-medium" />
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {people.map((e) => {
                          const stage =
                            (e.offboardingStage || "notice") as OffboardingStage;
                          return (
                            <tr key={e.id} className="hover:bg-muted/30">
                              <td className="px-3 py-2.5 font-medium">
                                {fullName(e)}
                              </td>
                              <td className="px-3 py-2.5 text-muted-foreground">
                                {e.jobTitle}
                              </td>
                              <td className="px-3 py-2.5 text-muted-foreground">
                                {formatShortDate(e.endDate)}
                              </td>
                              <td className="px-3 py-2.5">
                                {OFFBOARDING_STAGE_LABELS[stage]}
                              </td>
                              <td className="px-3 py-2.5 text-right">
                                <Button asChild size="sm" variant="ghost">
                                  <Link href={`/admin/employees/${e.id}`}>
                                    View
                                  </Link>
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div
                className="rounded-xl border bg-card p-4 lg:col-span-2"
                data-tour="employees-offboarding-milestones"
              >
                <h3 className="text-sm font-semibold text-[#272156] dark:text-foreground">
                  Exit checklist
                </h3>
                <p className="text-xs text-muted-foreground">
                  Share of active exits past each gate
                </p>
                <ul className="mt-4 space-y-3">
                  {stats.milestonePct.map((m) => (
                    <li key={m.stage}>
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium">{m.label}</span>
                        <span className="text-muted-foreground">
                          {m.count}/{people.length || 0} · {m.pct}%
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-[#272156]"
                          style={{ width: `${m.pct}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {people.length > 0 ? (
              <div className="grid gap-3 lg:grid-cols-5">
                {OFFBOARDING_STAGE_ORDER.map((stage) => {
                  const column = people.filter(
                    (e) => (e.offboardingStage || "notice") === stage
                  );
                  return (
                    <div key={stage} className="rounded-xl border bg-card p-3">
                      <div className="mb-2 flex items-center gap-1.5">
                        <ClipboardList className="h-3.5 w-3.5 text-[#31CDFF]" />
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {OFFBOARDING_STAGE_LABELS[stage]} ({column.length})
                        </h4>
                      </div>
                      <ul className="space-y-2">
                        {column.map((e) => (
                          <li key={e.id}>
                            <Link
                              href={`/admin/employees/${e.id}`}
                              className="block rounded-lg border border-border/60 p-2 hover:border-[#31CDFF]/40"
                            >
                              <p className="text-sm font-medium">
                                {fullName(e)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {e.jobTitle}
                              </p>
                              <div className="mt-1">
                                <EmployeeStatusBadge status={e.status} />
                              </div>
                            </Link>
                          </li>
                        ))}
                        {column.length === 0 ? (
                          <li className="py-4 text-center text-xs text-muted-foreground">
                            Empty
                          </li>
                        ) : null}
                      </ul>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </>
        )}
      </div>
    </AdminPageLayout>
  );
}
