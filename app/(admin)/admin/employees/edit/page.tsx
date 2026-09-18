"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import { adminApi } from "@/lib/api-backend";
import { fullName, initials } from "@/lib/employees";
import { EmployeeStatusBadge } from "@/components/admin/employees/EmployeeStatusBadge";
import type { Employee } from "@/types/employee";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";
import { EmployeePickerSkeleton } from "@/components/admin/hr-skeletons";

export default function EditEmployeePickerPage() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["admin-employees-edit-picker", debouncedSearch],
    queryFn: () =>
      adminApi.getEmployees({
        search: debouncedSearch || undefined,
        limit: 100,
      }) as Promise<{ employees: Employee[] }>,
  });

  const people = data?.employees ?? [];

  return (
    <AdminPageLayout
      title="Edit Employee"
      searchPlaceholder="Find who to edit…"
      searchValue={search}
      onSearch={setSearch}
    >
      <div className="mx-auto max-w-screen-lg space-y-4 px-4 py-6">
        <p className="text-sm text-muted-foreground">
          Choose a person to open their edit form.
        </p>

        {isLoading ? (
          <EmployeePickerSkeleton />
        ) : isError ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
            <p className="text-sm text-destructive">
              {(error as Error)?.message || "Failed to load employees"}
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
        ) : people.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No employees match that search.
          </p>
        ) : (
          <ul className="divide-y rounded-xl border bg-card">
            {people.map((e) => (
              <li
                key={e.id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40"
              >
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-[#272156] text-xs text-white">
                    {initials(e)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{fullName(e)}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {e.jobTitle} · {e.departmentName}
                  </p>
                </div>
                <EmployeeStatusBadge status={e.status} />
                <Button asChild size="sm" variant="outline">
                  <Link href={`/manage/employees/${e.id}/edit`}>
                    <Pencil className="mr-1.5 h-3.5 w-3.5" />
                    Edit
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AdminPageLayout>
  );
}
