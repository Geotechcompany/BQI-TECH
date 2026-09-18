"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import { TourPageHelper } from "@/components/admin/tour/TourPageHelper";
import { adminApi } from "@/lib/api-backend";
import { fullName, initials } from "@/lib/employees";
import type { Employee } from "@/types/employee";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { OrgChartSkeleton } from "@/components/admin/hr-skeletons";

type OrgNode = Employee & { reports: OrgNode[] };

function buildTree(people: Employee[]): OrgNode[] {
  const byId = new Map<string, OrgNode>();
  people.forEach((p) => byId.set(p.id, { ...p, reports: [] }));
  const roots: OrgNode[] = [];
  byId.forEach((node) => {
    if (node.managerId && byId.has(node.managerId)) {
      byId.get(node.managerId)!.reports.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

function OrgCard({ node }: { node: OrgNode }) {
  return (
    <div className="flex flex-col items-center">
      <Link
        href={`/admin/employees/${node.id}`}
        className="w-52 rounded-xl border bg-card p-3 text-center shadow-sm transition hover:border-[#31CDFF]/50"
      >
        <Avatar className="mx-auto h-12 w-12">
          <AvatarFallback className="bg-[#272156] text-white">
            {initials(node)}
          </AvatarFallback>
        </Avatar>
        <p className="mt-2 truncate text-sm font-semibold">{fullName(node)}</p>
        <p className="truncate text-xs text-muted-foreground">{node.jobTitle}</p>
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
          {node.departmentName}
        </p>
      </Link>
      {node.reports.length > 0 ? (
        <div className="mt-4 flex flex-wrap justify-center gap-4 border-t border-dashed pt-4">
          {node.reports.map((child) => (
            <OrgCard key={child.id} node={child} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function OrgChartPage() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["admin-employees-org"],
    queryFn: () =>
      adminApi.getEmployeeOrgChart() as Promise<{ nodes: Employee[] }>,
  });

  const roots = useMemo(
    () => buildTree(data?.nodes ?? []),
    [data?.nodes]
  );

  return (
    <AdminPageLayout title="Org Chart" showSearch={false} tourId="employees-org-chart">
      <TourPageHelper tourId="employees-org-chart" />
      <div className="mx-auto max-w-screen-2xl space-y-4 px-4 py-6">
        <p className="text-sm text-muted-foreground">
          Reporting lines from manager assignments on employee records.
        </p>
        {isLoading ? (
          <OrgChartSkeleton />
        ) : isError ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
            <p className="text-sm text-destructive">
              {(error as Error)?.message || "Failed to load org chart"}
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
        ) : roots.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No employees to chart.
          </p>
        ) : (
          <div
            className="overflow-x-auto rounded-xl border bg-muted/20 p-8"
            data-tour="employees-org-chart-tree"
          >
            <div className="flex min-w-max flex-wrap justify-center gap-8">
              {roots.map((root) => (
                <OrgCard key={root.id} node={root} />
              ))}
            </div>
          </div>
        )}
      </div>
    </AdminPageLayout>
  );
}
