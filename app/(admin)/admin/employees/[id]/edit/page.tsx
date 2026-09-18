"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import { EmployeeForm } from "@/components/admin/employees/EmployeeForm";
import { adminApi } from "@/lib/api-backend";
import { fullName } from "@/lib/employees";
import type { Employee } from "@/types/employee";
import { Button } from "@/components/ui/button";
import { EmployeeFormSkeleton } from "@/components/admin/hr-skeletons";

export default function EditEmployeePage() {
  const { id } = useParams<{ id: string }>();

  const { data: employee, isLoading, isError, error } = useQuery({
    queryKey: ["admin-employee", id],
    queryFn: () => adminApi.getEmployee(id) as Promise<Employee>,
    enabled: Boolean(id),
  });

  if (isLoading) {
    return (
      <AdminPageLayout title="Edit Employee" showSearch={false}>
        <div className="mx-auto max-w-screen-2xl px-4 py-6">
          <EmployeeFormSkeleton />
        </div>
      </AdminPageLayout>
    );
  }

  if (isError || !employee) {
    return (
      <AdminPageLayout title="Edit Employee" showSearch={false}>
        <div className="mx-auto max-w-lg px-4 py-16 text-center">
          <h2 className="text-lg font-semibold">Employee not found</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {(error as Error)?.message}
          </p>
          <Button asChild className="mt-6 bg-[#272156] text-white">
            <Link href="/admin/employees">Back to employees</Link>
          </Button>
        </div>
      </AdminPageLayout>
    );
  }

  return (
    <AdminPageLayout title="Edit Employee" showSearch={false}>
      <div className="mx-auto max-w-screen-2xl space-y-4 px-4 py-6">
        <div>
          <h2 className="text-lg font-semibold text-[#272156] dark:text-foreground">
            Edit {fullName(employee)}
          </h2>
          <p className="text-sm text-muted-foreground">
            Updates apply when you save.
          </p>
        </div>
        <div className="rounded-xl border bg-card p-6">
          <EmployeeForm mode="edit" initial={employee} />
        </div>
      </div>
    </AdminPageLayout>
  );
}
