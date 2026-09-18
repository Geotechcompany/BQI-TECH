"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import { EmployeeProfileShell } from "@/components/admin/employees/EmployeeProfileShell";
import { TourPageHelper } from "@/components/admin/tour/TourPageHelper";
import { adminApi } from "@/lib/api-backend";
import type { Employee } from "@/types/employee";
import { Button } from "@/components/ui/button";
import { EmployeeProfileSkeleton } from "@/components/admin/hr-skeletons";

export default function EmployeeProfilePage() {
  const { id } = useParams<{ id: string }>();

  const { data: employee, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["admin-employee", id],
    queryFn: () => adminApi.getEmployee(id) as Promise<Employee>,
    enabled: Boolean(id),
  });

  if (isLoading) {
    return (
      <AdminPageLayout title="Employee profile" showSearch={false} tourId="employees-profile">
        <TourPageHelper tourId="employees-profile" />
        <div className="mx-auto max-w-screen-2xl px-4 py-6">
          <EmployeeProfileSkeleton />
        </div>
      </AdminPageLayout>
    );
  }

  if (isError || !employee) {
    return (
      <AdminPageLayout title="Employee profile" showSearch={false} tourId="employees-profile">
        <TourPageHelper tourId="employees-profile" />
        <div className="mx-auto max-w-lg px-4 py-16 text-center">
          <h2 className="text-lg font-semibold">Employee not found</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {(error as Error)?.message ||
              "This record is missing or you do not have access."}
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
            <Button asChild className="bg-[#272156] text-white">
              <Link href="/manage/employees">Back to employees</Link>
            </Button>
          </div>
        </div>
      </AdminPageLayout>
    );
  }

  return (
    <AdminPageLayout title="Employee profile" showSearch={false} tourId="employees-profile">
      <TourPageHelper tourId="employees-profile" />
      <div className="mx-auto max-w-screen-2xl px-4 py-6">
        <EmployeeProfileShell employee={employee} />
      </div>
    </AdminPageLayout>
  );
}
