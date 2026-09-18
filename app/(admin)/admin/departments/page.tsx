"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { AdminPageWelcomeBanner } from "@/components/admin/AdminPageWelcomeBanner";
import { TourPageHelper } from "@/components/admin/tour/TourPageHelper";
import { adminApi } from "@/lib/api-backend";
import type { Department, Employee } from "@/types/employee";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "react-hot-toast";
import { fullName } from "@/lib/employees";
import { DepartmentsSkeleton } from "@/components/admin/hr-skeletons";
import { publicAdminHref } from "@/lib/admin-path";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler
);

export default function DepartmentsPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [headEmployeeId, setHeadEmployeeId] = useState<string>("none");
  const [deleteTarget, setDeleteTarget] = useState<Department | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["admin-departments"],
    queryFn: () =>
      adminApi.getDepartments() as Promise<{
        departments: Department[];
        total: number;
      }>,
  });

  const { data: empData } = useQuery({
    queryKey: ["admin-employees-dept-heads"],
    queryFn: () =>
      adminApi.getEmployees({ limit: 200 }) as Promise<{
        employees: Employee[];
      }>,
  });

  const departments = data?.departments ?? [];
  const employees = empData?.employees ?? [];
  const totalHeadcount = departments.reduce(
    (sum, d) => sum + (d.employeeCount || 0),
    0
  );

  const growth = useMemo(() => {
    const byMonth = new Map<string, number>();
    for (const d of departments) {
      const ym = d.createdAt?.slice(0, 7);
      if (!ym) continue;
      byMonth.set(ym, (byMonth.get(ym) || 0) + (d.employeeCount || 0));
    }
    if (byMonth.size === 0) {
      const labels = departments.map((d) => d.code || d.name.slice(0, 6));
      const values = departments.map((d) => d.employeeCount || 0);
      return { labels, values, mode: "distribution" as const };
    }
    const labels = Array.from(byMonth.keys()).sort();
    let running = 0;
    const values = labels.map((k) => {
      running += byMonth.get(k) || 0;
      return running;
    });
    return { labels, values, mode: "cumulative" as const };
  }, [departments]);

  const chartData = useMemo(
    () => ({
      labels:
        growth.mode === "cumulative"
          ? growth.labels.map((ym) => {
              const [y, m] = ym.split("-");
              const d = new Date(Date.UTC(Number(y), Number(m) - 1, 1));
              return d.toLocaleDateString(undefined, {
                month: "short",
                year: "2-digit",
                timeZone: "UTC",
              });
            })
          : growth.labels,
      datasets: [
        {
          label: growth.mode === "cumulative" ? "Headcount" : "Employees",
          data: growth.values,
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
    [growth]
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

  const createMutation = useMutation({
    mutationFn: () =>
      adminApi.createDepartment({
        name: name.trim(),
        code: code.trim().toUpperCase(),
        description: description.trim() || undefined,
        headEmployeeId:
          headEmployeeId === "none" ? undefined : headEmployeeId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-departments"] });
      toast.success("Department created");
      setOpen(false);
      setName("");
      setCode("");
      setDescription("");
      setHeadEmployeeId("none");
    },
    onError: (err: Error) => toast.error(err.message || "Could not create"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminApi.deleteDepartment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-departments"] });
      toast.success("Department deleted");
      setDeleteTarget(null);
    },
    onError: (err: Error) =>
      toast.error(err.message || "Could not delete department"),
  });

  const canSubmit =
    name.trim().length > 0 &&
    code.trim().length > 0 &&
    !createMutation.isPending;
  const deleteBlockedByEmployees =
    (deleteTarget?.employeeCount ?? 0) > 0;

  return (
    <AdminPageLayout
      title="Departments"
      showSearch={false}
      tourId="departments"
      guideInBanner
    >
      <TourPageHelper tourId="departments" />
      <div className="mx-auto max-w-screen-2xl space-y-4 px-4 py-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <AdminPageWelcomeBanner bannerKey="departments" tourId="departments" />
          <Button
            className="bg-[#272156] text-white hover:bg-[#272156]/90"
            onClick={() => setOpen(true)}
            data-tour="departments-add"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Add Department
          </Button>
        </div>

        {isLoading ? (
          <DepartmentsSkeleton />
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
        ) : departments.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No departments yet. Add the first team structure.
          </p>
        ) : (
          <>
            <div
              className="rounded-xl border bg-card p-4"
              data-tour="departments-chart"
            >
              <h3 className="text-sm font-semibold text-[#272156] dark:text-foreground">
                {growth.mode === "cumulative"
                  ? "Headcount growth"
                  : "Headcount by department"}
              </h3>
              <p className="text-xs text-muted-foreground">
                Live roster · {totalHeadcount} people across {departments.length}{" "}
                departments
              </p>
              <div className="mt-3 h-56">
                <Line data={chartData} options={chartOptions} />
              </div>
            </div>

            <div
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
              data-tour="departments-grid"
            >
              {departments.map((d) => {
                const pct =
                  totalHeadcount > 0
                    ? Math.round((d.employeeCount / totalHeadcount) * 100)
                    : 0;
                return (
                  <div key={d.id} className="rounded-xl border bg-card p-5">
                    <div className="flex items-start gap-3">
                      <div className="rounded-lg bg-[#272156] p-2 text-white">
                        <Building2 className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold">{d.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {d.code}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                            aria-label={`Delete ${d.name}`}
                            onClick={() => setDeleteTarget(d)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        {d.description ? (
                          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                            {d.description}
                          </p>
                        ) : null}
                        <div className="mt-3 flex items-baseline gap-2">
                          <span className="text-lg font-semibold">
                            {d.employeeCount}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            people · {pct}%
                          </span>
                        </div>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-[#31CDFF]"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        {d.headName ? (
                          <p className="mt-2 text-sm text-muted-foreground">
                            Head:{" "}
                            {d.headEmployeeId ? (
                              <Link
                                href={publicAdminHref(`/manage/employees/${d.headEmployeeId}`)}
                                className="text-[#272156] hover:underline dark:text-[#31CDFF]"
                              >
                                {d.headName}
                              </Link>
                            ) : (
                              d.headName
                            )}
                          </p>
                        ) : (
                          <p className="mt-2 text-sm text-muted-foreground">
                            No head assigned
                          </p>
                        )}
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                          className="mt-3"
                        >
                          <Link href={publicAdminHref(`/manage/employees?department=${d.id}`)}>
                            View employees
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Department</DialogTitle>
            <DialogDescription>
              Create a team with a short code and optional head.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label htmlFor="dept-name">Name</Label>
              <Input
                id="dept-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Engineering"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="dept-code">Code</Label>
              <Input
                id="dept-code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="ENG"
                className="mt-1"
                maxLength={12}
              />
            </div>
            <div>
              <Label htmlFor="dept-desc">Description</Label>
              <Input
                id="dept-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Department head</Label>
              <Select value={headEmployeeId} onValueChange={setHeadEmployeeId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {fullName(e)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-[#272156] text-white hover:bg-[#272156]/90"
              disabled={!canSubmit}
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : null}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(next) => {
          if (!next && !deleteMutation.isPending) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteBlockedByEmployees
                ? "Reassign employees first"
                : "Delete department?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteBlockedByEmployees ? (
                <>
                  <strong>{deleteTarget?.name}</strong> still has{" "}
                  {deleteTarget?.employeeCount}{" "}
                  {deleteTarget?.employeeCount === 1 ? "employee" : "employees"}
                  . Move them to another department before deleting.
                </>
              ) : (
                <>
                  Permanently remove <strong>{deleteTarget?.name}</strong> (
                  {deleteTarget?.code}). This cannot be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            {deleteBlockedByEmployees ? (
              <AlertDialogAction asChild>
                <Link
                  href={publicAdminHref(`/manage/employees?department=${deleteTarget?.id ?? ""}`)}
                >
                  View employees
                </Link>
              </AlertDialogAction>
            ) : (
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminPageLayout>
  );
}
