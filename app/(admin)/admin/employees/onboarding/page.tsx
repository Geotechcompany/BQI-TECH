"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
  type ChartOptions,
} from "chart.js";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import { EmployeeMetricCard } from "@/components/admin/employees/EmployeeMetricCard";
import { EmployeeStatusBadge } from "@/components/admin/employees/EmployeeStatusBadge";
import { TourPageHelper } from "@/components/admin/tour/TourPageHelper";
import { adminApi } from "@/lib/api-backend";
import {
  ONBOARDING_STAGE_LABELS,
  ONBOARDING_STAGE_ORDER,
  PLAN_BUCKET_LABELS,
  canResendEmployeeInvite,
  daysSinceStart,
  formatShortDate,
  fullName,
  onboardingChecklistProgress,
  planBucketForDays,
  type PlanBucket,
} from "@/lib/employees";
import type { Employee, OnboardingStage } from "@/types/employee";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  ClipboardList,
  Loader2,
  Send,
  Timer,
  UserPlus,
  Users,
} from "lucide-react";
import { OnboardingSkeleton } from "@/components/admin/hr-skeletons";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler
);

const STAGE_MILESTONES: { stage: OnboardingStage; label: string }[] = [
  { stage: "paperwork", label: "Contracts & forms signed" },
  { stage: "it_setup", label: "Accounts & equipment ready" },
  { stage: "orientation", label: "Orientation complete" },
  { stage: "buddy_assigned", label: "Buddy paired" },
  { stage: "complete", label: "Onboarding finished" },
];

function stageReached(
  current: OnboardingStage | undefined,
  target: OnboardingStage
): boolean {
  const cur = current || "paperwork";
  return (
    ONBOARDING_STAGE_ORDER.indexOf(cur) >=
    ONBOARDING_STAGE_ORDER.indexOf(target)
  );
}

export default function OnboardingPage() {
  const queryClient = useQueryClient();
  const [resendingId, setResendingId] = useState<string | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["admin-employees-onboarding"],
    queryFn: () =>
      adminApi.getEmployees({ status: "onboarding", limit: 200 }) as Promise<{
        employees: Employee[];
      }>,
  });

  const resendInviteMutation = useMutation({
    mutationFn: (employeeId: string) =>
      adminApi.resendEmployeeInvite(employeeId),
    onMutate: (employeeId) => {
      setResendingId(employeeId);
    },
    onSuccess: (result) => {
      toast.success(result.message || `Invite sent to ${result.toEmail}`);
    },
    onError: (err: Error) => {
      toast.error(err.message || "Could not resend invite");
    },
    onSettled: () => {
      setResendingId(null);
      queryClient.invalidateQueries({
        queryKey: ["admin-employees-onboarding"],
      });
    },
  });

  const people = data?.employees ?? [];

  const stats = useMemo(() => {
    const dayList = people
      .map((e) => daysSinceStart(e.startDate))
      .filter((d): d is number => d !== null);
    const avgDays =
      dayList.length > 0
        ? Math.round(dayList.reduce((a, b) => a + b, 0) / dayList.length)
        : 0;

    const thisMonth = new Date();
    const ym = `${thisMonth.getUTCFullYear()}-${String(thisMonth.getUTCMonth() + 1).padStart(2, "0")}`;
    const startingThisMonth = people.filter((e) =>
      (e.startDate || "").startsWith(ym)
    ).length;

    const completeCount = people.filter(
      (e) => e.onboardingStage === "complete"
    ).length;

    const plan: Record<PlanBucket, Employee[]> = {
      day0_30: [],
      day31_60: [],
      day61_90: [],
      beyond: [],
    };
    for (const e of people) {
      plan[planBucketForDays(daysSinceStart(e.startDate))].push(e);
    }

    const cohortMap = new Map<string, number>();
    for (const e of people) {
      const key = (e.startDate || "").slice(0, 7) || "Unknown";
      cohortMap.set(key, (cohortMap.get(key) || 0) + 1);
    }
    const cohortLabels = Array.from(cohortMap.keys()).sort();
    const cohortValues = cohortLabels.map((k) => cohortMap.get(k) || 0);

    const milestonePct = STAGE_MILESTONES.map((m) => {
      if (people.length === 0) return { ...m, pct: 0, count: 0 };
      const count = people.filter((e) =>
        stageReached(e.onboardingStage, m.stage)
      ).length;
      return {
        ...m,
        count,
        pct: Math.round((count / people.length) * 100),
      };
    });

    return {
      avgDays,
      startingThisMonth,
      completeCount,
      plan,
      cohortLabels,
      cohortValues,
      milestonePct,
    };
  }, [people]);

  const chartData = useMemo(
    () => ({
      labels: stats.cohortLabels.map((ym) => {
        if (ym === "Unknown") return ym;
        const [y, m] = ym.split("-");
        const d = new Date(Date.UTC(Number(y), Number(m) - 1, 1));
        return d.toLocaleDateString(undefined, {
          month: "short",
          year: "2-digit",
          timeZone: "UTC",
        });
      }),
      datasets: [
        {
          label: "New hires",
          data: stats.cohortValues,
          borderColor: "#272156",
          backgroundColor: "rgba(49, 205, 255, 0.25)",
          fill: true,
          tension: 0.35,
          pointBackgroundColor: "#31CDFF",
          pointBorderColor: "#fff",
          pointBorderWidth: 2,
          pointRadius: 3,
        },
      ],
    }),
    [stats.cohortLabels, stats.cohortValues]
  );

  const chartOptions: ChartOptions<"line"> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: "hsl(var(--muted-foreground))", font: { size: 11 } },
          border: { display: false },
        },
        y: {
          beginAtZero: true,
          ticks: {
            precision: 0,
            color: "hsl(var(--muted-foreground))",
            font: { size: 11 },
          },
          grid: { color: "hsl(var(--border) / 0.6)" },
          border: { display: false },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: { displayColors: false },
      },
    }),
    []
  );

  return (
    <AdminPageLayout title="Onboarding" showSearch={false} tourId="employees-onboarding">
      <TourPageHelper tourId="employees-onboarding" />
      <div className="mx-auto max-w-screen-2xl space-y-6 px-4 py-6">
        <p className="text-sm text-muted-foreground">
          Track new hires by stage, start cohort, and 30/60/90 plan.
        </p>

        {isLoading ? (
          <OnboardingSkeleton />
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
              data-tour="employees-onboarding-metrics"
            >
              <EmployeeMetricCard
                label="Active onboardings"
                value={people.length}
                icon={Users}
                accent="navy"
              />
              <EmployeeMetricCard
                label="Avg days in program"
                value={stats.avgDays}
                hint="From start date"
                icon={Timer}
                accent="cyan"
              />
              <EmployeeMetricCard
                label="Starting this month"
                value={stats.startingThisMonth}
                icon={UserPlus}
                accent="neutral"
              />
              <EmployeeMetricCard
                label="Stage complete"
                value={stats.completeCount}
                hint="Ready to activate"
                icon={CheckCircle2}
                accent="navy"
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-5">
              <div
                className="rounded-xl border bg-card p-4 lg:col-span-3"
                data-tour="employees-onboarding-cohort"
              >
                <h3 className="text-sm font-semibold text-[#272156] dark:text-foreground">
                  Hire cohort
                </h3>
                <p className="text-xs text-muted-foreground">
                  People currently onboarding, by start month
                </p>
                <div className="mt-3 h-56">
                  {stats.cohortLabels.length === 0 ? (
                    <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
                      No cohort data yet.
                    </p>
                  ) : (
                    <Line data={chartData} options={chartOptions} />
                  )}
                </div>
              </div>

              <div
                className="rounded-xl border bg-card p-4 lg:col-span-2"
                data-tour="employees-onboarding-milestones"
              >
                <h3 className="text-sm font-semibold text-[#272156] dark:text-foreground">
                  Milestone checklist
                </h3>
                <p className="text-xs text-muted-foreground">
                  Share of active onboardings past each gate
                </p>
                <ul className="mt-4 space-y-3">
                  {stats.milestonePct.map((m) => (
                    <li key={m.stage}>
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium">{m.label}</span>
                        <span className="text-muted-foreground">
                          {m.count}/{people.length} · {m.pct}%
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-[#31CDFF]"
                          style={{ width: `${m.pct}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div>
              <h3 className="mb-3 text-sm font-semibold text-[#272156] dark:text-foreground">
                30 / 60 / 90 plan
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {(
                  Object.keys(PLAN_BUCKET_LABELS) as PlanBucket[]
                ).map((bucket) => (
                  <div
                    key={bucket}
                    className="rounded-xl border bg-card p-3"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {PLAN_BUCKET_LABELS[bucket]}
                    </p>
                    <p className="mt-1 text-2xl font-semibold">
                      {stats.plan[bucket].length}
                    </p>
                    <ul className="mt-2 max-h-28 space-y-1 overflow-y-auto text-xs text-muted-foreground">
                      {stats.plan[bucket].slice(0, 5).map((e) => (
                        <li key={e.id}>
                          <Link
                            href={`/admin/employees/${e.id}`}
                            className="hover:text-[#272156] hover:underline dark:hover:text-[#31CDFF]"
                          >
                            {fullName(e)}
                          </Link>
                        </li>
                      ))}
                      {stats.plan[bucket].length === 0 ? (
                        <li>None in this window</li>
                      ) : null}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-[#272156] dark:text-foreground">
                  Active onboardings
                </h3>
                <Button asChild size="sm" variant="outline">
                  <Link href="/admin/employees/new">
                    <UserPlus className="mr-1.5 h-3.5 w-3.5" />
                    Add employee
                  </Link>
                </Button>
              </div>

              {people.length === 0 ? (
                <p className="rounded-xl border bg-muted/20 py-12 text-center text-sm text-muted-foreground">
                  Nobody is in onboarding right now.
                </p>
              ) : (
                <>
                  <div
                    className="mb-4 overflow-x-auto rounded-xl border"
                    data-tour="employees-onboarding-list"
                  >
                    <table className="w-full min-w-[720px] text-left text-sm">
                      <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 font-medium">Name</th>
                          <th className="px-3 py-2 font-medium">Role</th>
                          <th className="px-3 py-2 font-medium">Start</th>
                          <th className="px-3 py-2 font-medium">Days</th>
                          <th className="px-3 py-2 font-medium">Stage</th>
                          <th className="px-3 py-2 font-medium">Checklist</th>
                          <th className="px-3 py-2 font-medium" />
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {people.map((e) => {
                          const days = daysSinceStart(e.startDate);
                          const stage =
                            (e.onboardingStage ||
                              "paperwork") as OnboardingStage;
                          const checklist = onboardingChecklistProgress(
                            e.onboardingChecklist
                          );
                          return (
                            <tr key={e.id} className="hover:bg-muted/30">
                              <td className="px-3 py-2.5 font-medium">
                                {fullName(e)}
                              </td>
                              <td className="px-3 py-2.5 text-muted-foreground">
                                {e.jobTitle}
                              </td>
                              <td className="px-3 py-2.5 text-muted-foreground">
                                {formatShortDate(e.startDate)}
                              </td>
                              <td className="px-3 py-2.5">{days ?? "—"}</td>
                              <td className="px-3 py-2.5">
                                {ONBOARDING_STAGE_LABELS[stage]}
                              </td>
                              <td className="px-3 py-2.5 text-muted-foreground">
                                {checklist.done}/{checklist.total}
                              </td>
                              <td className="px-3 py-2.5 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  {canResendEmployeeInvite(e) ? (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      className="text-[#272156] hover:bg-[#272156]/5 dark:text-[#31CDFF] dark:hover:bg-[#31CDFF]/10"
                                      disabled={resendingId === e.id}
                                      onClick={() =>
                                        resendInviteMutation.mutate(e.id)
                                      }
                                    >
                                      {resendingId === e.id ? (
                                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                      ) : (
                                        <Send className="mr-1.5 h-3.5 w-3.5" />
                                      )}
                                      Resend invite
                                    </Button>
                                  ) : null}
                                  <Button asChild size="sm" variant="ghost">
                                    <Link href={`/admin/employees/${e.id}`}>
                                      View
                                    </Link>
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="grid gap-3 lg:grid-cols-5">
                    {ONBOARDING_STAGE_ORDER.map((stage) => {
                      const column = people.filter(
                        (e) => (e.onboardingStage || "paperwork") === stage
                      );
                      return (
                        <div
                          key={stage}
                          className="rounded-xl border bg-card p-3"
                        >
                          <div className="mb-2 flex items-center gap-1.5">
                            <ClipboardList className="h-3.5 w-3.5 text-[#31CDFF]" />
                            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              {ONBOARDING_STAGE_LABELS[stage]} ({column.length})
                            </h4>
                          </div>
                          <ul className="space-y-2">
                            {column.map((e) => {
                              const checklist = onboardingChecklistProgress(
                                e.onboardingChecklist
                              );
                              return (
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
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    Checklist {checklist.done}/{checklist.total}
                                  </p>
                                  <div className="mt-1">
                                    <EmployeeStatusBadge status={e.status} />
                                  </div>
                                </Link>
                              </li>
                              );
                            })}
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
                </>
              )}
            </div>
          </>
        )}
      </div>
    </AdminPageLayout>
  );
}
