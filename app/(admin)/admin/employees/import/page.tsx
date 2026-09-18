"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import { TourPageHelper } from "@/components/admin/tour/TourPageHelper";
import { Button } from "@/components/ui/button";
import { Download, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { toast } from "react-hot-toast";
import { adminApi } from "@/lib/api-backend";
import type { Employee } from "@/types/employee";
import { fullName } from "@/lib/employees";
import {
  EMPLOYEE_CSV_TEMPLATE,
  parseEmployeeCsv,
} from "@/lib/employees/csv";
import { Skeleton } from "@/components/ui/skeleton";

export default function ImportExportPage() {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [lastFileName, setLastFileName] = useState<string | null>(null);

  const { data, isLoading: exportLoading } = useQuery({
    queryKey: ["admin-employees-export"],
    queryFn: () =>
      adminApi.getEmployees({ limit: 500 }) as Promise<{
        employees: Employee[];
        total: number;
      }>,
  });

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const text = await file.text();
      const rows = parseEmployeeCsv(text);
      setPreviewCount(rows.length);
      setLastFileName(file.name);
      return adminApi.importEmployees({ rows }) as Promise<{
        created: number;
        skipped: number;
        errors: Array<{ row: number; message: string }>;
      }>;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["admin-employees"] });
      queryClient.invalidateQueries({ queryKey: ["admin-employees-export"] });
      queryClient.invalidateQueries({ queryKey: ["admin-employees-directory"] });
      const errHint =
        result.errors?.length > 0
          ? ` · ${result.errors.length} row error${result.errors.length === 1 ? "" : "s"}`
          : "";
      toast.success(
        `Imported ${result.created} · skipped ${result.skipped}${errHint}`
      );
      if (result.errors?.length) {
        toast.error(result.errors[0].message);
      }
    },
    onError: (err: Error) => {
      toast.error(err.message || "Import failed");
    },
  });

  const exportCsv = () => {
    const rows = data?.employees ?? [];
    if (!rows.length) {
      toast.error("No employees to export");
      return;
    }
    const header = [
      "employeeNumber",
      "firstName",
      "lastName",
      "email",
      "jobTitle",
      "departmentName",
      "status",
      "employmentType",
      "startDate",
      "phone",
      "location",
    ];
    const lines = [
      header.join(","),
      ...rows.map((e) =>
        [
          e.employeeNumber,
          e.firstName,
          e.lastName,
          e.email,
          e.jobTitle,
          e.departmentName,
          e.status,
          e.employmentType,
          e.startDate,
          e.phone,
          e.location,
        ]
          .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
          .join(",")
      ),
    ];
    const blob = new Blob([lines.join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bqi-employees-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} employees`);
  };

  const downloadTemplate = () => {
    const blob = new Blob([EMPLOYEE_CSV_TEMPLATE], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bqi-employees-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const onFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      toast.error("Choose a .csv file");
      return;
    }
    importMutation.mutate(file);
  };

  return (
    <AdminPageLayout title="Import / Export" showSearch={false} tourId="employees-import">
      <TourPageHelper tourId="employees-import" />
      <div className="mx-auto max-w-screen-lg space-y-4 px-4 py-6">
        <p className="text-sm text-muted-foreground">
          Move the roster in or out as CSV. Required import columns: firstName,
          lastName, email, jobTitle.
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          <section
            className="rounded-xl border bg-card p-6"
            data-tour="employees-import-upload"
          >
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-[#272156] p-2 text-white">
                <Upload className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-base font-semibold">Import CSV</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Create employees from a spreadsheet. Matching emails are
                  skipped.
                </p>
              </div>
            </div>

            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                onFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />

            <div className="mt-5 flex flex-wrap gap-2">
              <Button
                className="bg-[#272156] text-white hover:bg-[#272156]/90"
                disabled={importMutation.isPending}
                onClick={() => fileRef.current?.click()}
              >
                {importMutation.isPending ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-1.5 h-4 w-4" />
                )}
                {importMutation.isPending ? "Importing…" : "Choose CSV"}
              </Button>
              <Button variant="outline" onClick={downloadTemplate}>
                <FileSpreadsheet className="mr-1.5 h-4 w-4" />
                Template
              </Button>
            </div>

            {lastFileName ? (
              <p className="mt-3 text-xs text-muted-foreground">
                Last file: {lastFileName}
                {previewCount != null ? ` · ${previewCount} rows parsed` : ""}
              </p>
            ) : null}
          </section>

          <section
            className="rounded-xl border bg-card p-6"
            data-tour="employees-import-export"
          >
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-[#272156] p-2 text-white">
                <Download className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-base font-semibold">Export CSV</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Download the live roster (up to 500 people).
                </p>
              </div>
            </div>

            {exportLoading ? (
              <div className="mt-5 space-y-3">
                <Skeleton className="h-10 w-44" />
                <Skeleton className="h-3 w-56" />
              </div>
            ) : (
              <>
                <Button
                  className="mt-5 bg-[#272156] text-white hover:bg-[#272156]/90"
                  onClick={exportCsv}
                >
                  <Download className="mr-1.5 h-4 w-4" />
                  Export CSV ({data?.employees?.length ?? 0})
                </Button>

                {data?.employees?.length ? (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Includes {fullName(data.employees[0])} and{" "}
                    {Math.max(0, (data.employees.length || 1) - 1)} others.
                  </p>
                ) : (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Roster is empty — nothing to export yet.
                  </p>
                )}
              </>
            )}
          </section>
        </div>
      </div>
    </AdminPageLayout>
  );
}
