"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import { TourPageHelper } from "@/components/admin/tour/TourPageHelper";
import { adminApi } from "@/lib/api-backend";
import { fullName, initials } from "@/lib/employees";
import { EmployeeStatusBadge } from "@/components/admin/employees/EmployeeStatusBadge";
import type { Employee } from "@/types/employee";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Mail, MapPin, Phone } from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";
import { EmployeeDirectorySkeleton } from "@/components/admin/hr-skeletons";

export default function EmployeeDirectoryPage() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["admin-employees-directory", debouncedSearch],
    queryFn: () =>
      adminApi.getEmployees({
        search: debouncedSearch || undefined,
        limit: 200,
      }) as Promise<{ employees: Employee[] }>,
  });

  const people = (data?.employees ?? []).filter(
    (e) => e.status !== "terminated"
  );

  return (
    <AdminPageLayout
      title="Directory"
      searchPlaceholder="Find a teammate…"
      searchValue={search}
      onSearch={setSearch}
      searchDataTour="employees-directory-search"
      tourId="employees-directory"
    >
      <TourPageHelper tourId="employees-directory" />
      <div className="mx-auto max-w-screen-2xl space-y-4 px-4 py-6">
        <p className="text-sm text-muted-foreground">
          Contact cards for staff (live roster).
        </p>

        {isLoading ? (
          <EmployeeDirectorySkeleton />
        ) : isError ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
            <p className="text-sm text-destructive">
              {(error as Error)?.message || "Failed to load directory"}
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
            No people in the directory yet.
          </p>
        ) : (
          <div
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            data-tour="employees-directory-grid"
          >
            {people.map((e) => (
              <Link
                key={e.id}
                href={`/manage/employees/${e.id}`}
                className="group rounded-xl border bg-card p-5 transition hover:border-[#31CDFF]/50 hover:shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-[#272156] text-white">
                      {initials(e)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold group-hover:text-[#272156] dark:group-hover:text-[#31CDFF]">
                      {fullName(e)}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      {e.jobTitle}
                    </p>
                    <div className="mt-1.5">
                      <EmployeeStatusBadge status={e.status} />
                    </div>
                  </div>
                </div>
                <ul className="mt-4 space-y-1.5 text-xs text-muted-foreground">
                  <li className="flex items-center gap-1.5 truncate">
                    <Mail className="h-3.5 w-3.5 shrink-0 text-[#31CDFF]" />
                    {e.workEmail}
                  </li>
                  <li className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 shrink-0 text-[#31CDFF]" />
                    {e.phone || "—"}
                  </li>
                  <li className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-[#31CDFF]" />
                    {e.location} · {e.departmentName}
                  </li>
                </ul>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AdminPageLayout>
  );
}
