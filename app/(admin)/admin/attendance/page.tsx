"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import { AdminPageWelcomeBanner } from "@/components/admin/AdminPageWelcomeBanner";
import { EmployeeMetricCard } from "@/components/admin/employees/EmployeeMetricCard";
import { TourPageHelper } from "@/components/admin/tour/TourPageHelper";
import { adminApi } from "@/lib/api-backend";
import { Button } from "@/components/ui/button";
import { CalendarCheck, Clock, Plane, Timer } from "lucide-react";
import { AttendanceSkeleton } from "@/components/admin/hr-skeletons";

type AttendanceOverview = {
  totals: {
    presentDays: number;
    leaveDays: number;
    lateDays: number;
    overtimeHours: number;
    employeeCount: number;
  };
  employees: Array<{
    id: string;
    name: string;
    departmentName: string;
    presentDays: number;
    leaveDays: number;
    lateDays: number;
    overtimeHours: number;
    status: string;
  }>;
};

export default function AttendanceOverviewPage() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["admin-attendance-overview"],
    queryFn: () =>
      adminApi.getAttendanceOverview() as Promise<AttendanceOverview>,
  });

  const totals = data?.totals;

  return (
    <AdminPageLayout
      title="Attendance"
      showSearch={false}
      tourId="attendance"
      guideInBanner
    >
      <TourPageHelper tourId="attendance" />
      <div className="mx-auto max-w-screen-2xl space-y-4 px-4 py-6">
        <AdminPageWelcomeBanner bannerKey="attendance" tourId="attendance" />

        {isLoading ? (
          <AttendanceSkeleton />
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
              data-tour="attendance-metrics"
            >
              <EmployeeMetricCard
                label="Present (sum)"
                value={totals?.presentDays ?? 0}
                hint={`${totals?.employeeCount ?? 0} people`}
                icon={CalendarCheck}
                accent="navy"
              />
              <EmployeeMetricCard
                label="Leave (sum)"
                value={totals?.leaveDays ?? 0}
                icon={Plane}
                accent="cyan"
              />
              <EmployeeMetricCard
                label="Late (sum)"
                value={totals?.lateDays ?? 0}
                icon={Clock}
                accent="neutral"
              />
              <EmployeeMetricCard
                label="Overtime (sum)"
                value={`${totals?.overtimeHours ?? 0}h`}
                icon={Timer}
                accent="neutral"
              />
            </div>

            <div
              className="overflow-hidden rounded-xl border bg-card"
              data-tour="attendance-table"
            >
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-left text-muted-foreground">
                      <th className="px-4 py-3 font-medium">Employee</th>
                      <th className="px-4 py-3 font-medium">Department</th>
                      <th className="px-4 py-3 font-medium">Present</th>
                      <th className="px-4 py-3 font-medium">Leave</th>
                      <th className="px-4 py-3 font-medium">Late</th>
                      <th className="px-4 py-3 font-medium">OT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.employees ?? []).map((row) => (
                      <tr
                        key={row.id}
                        className="border-b border-border/60 last:border-0"
                      >
                        <td className="px-4 py-3">
                          <Link
                            href={`/manage/employees/${row.id}`}
                            className="font-medium hover:text-[#31CDFF]"
                          >
                            {row.name}
                          </Link>
                        </td>
                        <td className="px-4 py-3">{row.departmentName}</td>
                        <td className="px-4 py-3">{row.presentDays}</td>
                        <td className="px-4 py-3">{row.leaveDays}</td>
                        <td className="px-4 py-3">{row.lateDays}</td>
                        <td className="px-4 py-3">{row.overtimeHours}h</td>
                      </tr>
                    ))}
                    {(data?.employees ?? []).length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-4 py-10 text-center text-muted-foreground"
                        >
                          No attendance summaries yet.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </AdminPageLayout>
  );
}
