"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import { AdminPageWelcomeBanner } from "@/components/admin/AdminPageWelcomeBanner";
import { TourPageHelper } from "@/components/admin/tour/TourPageHelper";
import { adminApi } from "@/lib/api-backend";
import { fullName, initials } from "@/lib/employees";
import { EmployeeStatusBadge } from "@/components/admin/employees/EmployeeStatusBadge";
import {
  EMPLOYEE_STATUS_LABELS,
  EMPLOYMENT_TYPE_LABELS,
  type Department,
  type Employee,
  type EmployeeStatus,
  type EmploymentType,
} from "@/types/employee";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, MoreHorizontal, Trash2, UserPlus } from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";
import { EmployeeListSkeleton } from "@/components/admin/hr-skeletons";

export default function AllEmployeesPage() {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [departmentId, setDepartmentId] = useState("all");
  const [status, setStatus] = useState("all");
  const [employmentType, setEmploymentType] = useState("all");
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);
  const debouncedSearch = useDebounce(search, 300);

  useEffect(() => {
    const dept = searchParams.get("department");
    if (dept) setDepartmentId(dept);
  }, [searchParams]);

  const { data: deptData } = useQuery({
    queryKey: ["admin-departments"],
    queryFn: () => adminApi.getDepartments() as Promise<{ departments: Department[] }>,
  });
  const departments = deptData?.departments ?? [];

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: [
      "admin-employees",
      debouncedSearch,
      departmentId,
      status,
      employmentType,
    ],
    queryFn: () =>
      adminApi.getEmployees({
        search: debouncedSearch || undefined,
        departmentId: departmentId === "all" ? undefined : departmentId,
        status: status === "all" ? undefined : status,
        employmentType: employmentType === "all" ? undefined : employmentType,
        limit: 200,
      }) as Promise<{ employees: Employee[]; total: number }>,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminApi.deleteEmployee(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-employees"] });
      queryClient.invalidateQueries({ queryKey: ["admin-departments"] });
      toast.success("Employee deleted");
      setDeleteTarget(null);
    },
    onError: (err: Error) =>
      toast.error(err.message || "Could not delete employee"),
  });

  const rows = data?.employees ?? [];

  const filters = useMemo(
    () => (
      <div className="flex flex-wrap gap-2" data-tour="employees-filters">
        <Select value={departmentId} onValueChange={setDepartmentId}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Department" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All departments</SelectItem>
            {departments.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {(Object.keys(EMPLOYEE_STATUS_LABELS) as EmployeeStatus[]).map(
              (s) => (
                <SelectItem key={s} value={s}>
                  {EMPLOYEE_STATUS_LABELS[s]}
                </SelectItem>
              )
            )}
          </SelectContent>
        </Select>
        <Select value={employmentType} onValueChange={setEmploymentType}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {(Object.keys(EMPLOYMENT_TYPE_LABELS) as EmploymentType[]).map(
              (t) => (
                <SelectItem key={t} value={t}>
                  {EMPLOYMENT_TYPE_LABELS[t]}
                </SelectItem>
              )
            )}
          </SelectContent>
        </Select>
      </div>
    ),
    [departmentId, departments, employmentType, status]
  );

  return (
    <AdminPageLayout
      title="All Employees"
      searchPlaceholder="Search name, email, title, ID…"
      searchValue={search}
      onSearch={setSearch}
      searchDataTour="employees-search"
      tourId="employees"
      guideInBanner
      headerActions={
        <Button
          asChild
          size="sm"
          className="bg-[#272156] hover:bg-[#272156]/90 text-white"
          data-tour="employees-add"
        >
          <Link href="/manage/employees/new">
            <UserPlus className="mr-1.5 h-4 w-4" />
            Add employee
          </Link>
        </Button>
      }
      filters={filters}
    >
      <TourPageHelper tourId="employees" />
      <div className="mx-auto max-w-screen-2xl space-y-4 px-4 py-6">
        <AdminPageWelcomeBanner bannerKey="employees" tourId="employees" />

        {isLoading ? (
          <EmployeeListSkeleton />
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
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              {data?.total ?? 0} employees
              {isFetching ? " · refreshing…" : ""}
            </p>
            <div
              className="overflow-hidden rounded-xl border bg-card"
              data-tour="employees-table"
            >
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-left text-muted-foreground">
                      <th className="px-4 py-3 font-medium">Employee</th>
                      <th className="px-4 py-3 font-medium">Title</th>
                      <th className="px-4 py-3 font-medium">Department</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Location</th>
                      <th className="px-4 py-3 font-medium">Start</th>
                      <th className="px-4 py-3 text-right font-medium">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((e) => (
                      <tr
                        key={e.id}
                        className="border-b border-border/60 last:border-0 hover:bg-muted/30"
                      >
                        <td className="px-4 py-3">
                          <Link
                            href={`/manage/employees/${e.id}`}
                            className="flex items-center gap-3"
                          >
                            <Avatar className="h-9 w-9">
                              <AvatarFallback className="bg-[#272156] text-xs text-white">
                                {initials(e)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-foreground hover:text-[#31CDFF]">
                                {fullName(e)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {e.employeeNumber} · {e.email}
                              </p>
                            </div>
                          </Link>
                        </td>
                        <td className="px-4 py-3">{e.jobTitle}</td>
                        <td className="px-4 py-3">{e.departmentName}</td>
                        <td className="px-4 py-3">
                          <EmployeeStatusBadge status={e.status} />
                        </td>
                        <td className="px-4 py-3">{e.location}</td>
                        <td className="px-4 py-3">{e.startDate}</td>
                        <td className="px-4 py-3 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground active:scale-[0.97]"
                                aria-label={`Actions for ${fullName(e)}`}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onSelect={() => setDeleteTarget(e)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete employee
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))}
                    {rows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-4 py-10 text-center text-muted-foreground"
                        >
                          No employees match these filters.
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

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(next) => {
          if (!next && !deleteMutation.isPending) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete employee?</AlertDialogTitle>
            <AlertDialogDescription>
              Permanently remove{" "}
              <strong>{deleteTarget ? fullName(deleteTarget) : ""}</strong>
              {deleteTarget?.employeeNumber
                ? ` (${deleteTarget.employeeNumber})`
                : ""}
              . This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 active:scale-[0.97]"
              disabled={deleteMutation.isPending || !deleteTarget}
              onClick={(e) => {
                e.preventDefault();
                if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
              }}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminPageLayout>
  );
}
