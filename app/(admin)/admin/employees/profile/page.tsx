"use client";

import Link from "next/link";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import { Button } from "@/components/ui/button";
import { IdCard, Users } from "lucide-react";
import { publicAdminHref } from "@/lib/admin-path";

export default function EmployeeProfileEntryPage() {
  return (
    <AdminPageLayout title="Employee Profile" showSearch={false}>
      <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-16 text-center">
        <div className="rounded-xl bg-[#272156] p-3 text-white">
          <IdCard className="h-6 w-6" strokeWidth={1.75} />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-[#272156] dark:text-foreground">
          Open a person from the directory
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Profiles live on each employee record. Pick someone in the directory or
          the full roster to view their details.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button
            asChild
            className="bg-[#272156] text-white hover:bg-[#272156]/90"
          >
            <Link href={publicAdminHref("/manage/employees/directory")}>
              <Users className="mr-1.5 h-4 w-4" />
              Directory
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={publicAdminHref("/manage/employees")}>All Employees</Link>
          </Button>
        </div>
      </div>
    </AdminPageLayout>
  );
}
