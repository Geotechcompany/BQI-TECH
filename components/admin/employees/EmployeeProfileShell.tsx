"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Employee } from "@/types/employee";
import { EMPLOYMENT_TYPE_LABELS } from "@/types/employee";
import { fullName, initials } from "@/lib/employees";
import { EmployeeStatusBadge } from "./EmployeeStatusBadge";
import { OverviewTab } from "./tabs/OverviewTab";
import { CompensationTab } from "./tabs/CompensationTab";
import { TimeAttendanceTab } from "./tabs/TimeAttendanceTab";
import { PerformanceTab } from "./tabs/PerformanceTab";
import { DocumentsTab } from "./tabs/DocumentsTab";
import { ActivityTab } from "./tabs/ActivityTab";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Briefcase,
  Building2,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Printer,
  UserRound,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { publicAdminHref } from "@/lib/admin-path";

const TAB_TRIGGER =
  "rounded-none border-b-2 border-transparent px-3 py-2.5 data-[state=active]:border-[#31CDFF] data-[state=active]:bg-transparent data-[state=active]:text-[#272156] data-[state=active]:shadow-none dark:data-[state=active]:text-[#31CDFF]";

export function EmployeeProfileShell({ employee }: { employee: Employee }) {
  const router = useRouter();
  const name = fullName(employee);

  return (
    <div className="space-y-4" data-tour="employee-profile">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">
            <Link href={publicAdminHref("/manage/employees")}className="hover:text-[#31CDFF]">
              Employees
            </Link>
            <span className="mx-1.5">/</span>
            {name}
          </p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-[#272156] dark:text-foreground">
            Employee profile
          </h1>
        </div>
        <div className="flex flex-wrap gap-2" data-tour="employee-profile-actions">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              window.print();
            }}
          >
            <Printer className="mr-1.5 h-4 w-4" />
            Print
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(publicAdminHref(`/manage/employees/${employee.id}/edit`))}
          >
            <Pencil className="mr-1.5 h-4 w-4" />
            Edit profile
          </Button>
          <Button
            size="sm"
            className="bg-[#272156] hover:bg-[#272156]/90 text-white"
            onClick={() => toast("Quick actions menu coming soon")}
          >
            Quick actions
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)]">
        {/* Summary card */}
        <aside
          className="h-fit rounded-xl border bg-card p-5 lg:sticky lg:top-24"
          data-tour="employee-profile-summary"
        >
          <div className="flex flex-col items-center text-center">
            <Avatar className="h-24 w-24 border-2 border-[#31CDFF]/40">
              {employee.avatarUrl ? (
                <AvatarImage src={employee.avatarUrl} alt={name} />
              ) : null}
              <AvatarFallback className="bg-[#272156] text-xl text-white">
                {initials(employee)}
              </AvatarFallback>
            </Avatar>
            <h2 className="mt-3 text-lg font-semibold">{name}</h2>
            <p className="text-sm text-muted-foreground">{employee.jobTitle}</p>
            <div className="mt-2">
              <EmployeeStatusBadge status={employee.status} />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {employee.employeeNumber}
            </p>
          </div>

          <dl className="mt-6 space-y-3 text-left text-sm">
            <div className="flex gap-2">
              <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-[#31CDFF]" />
              <div>
                <dt className="text-xs text-muted-foreground">Department</dt>
                <dd className="font-medium">{employee.departmentName}</dd>
              </div>
            </div>
            <div className="flex gap-2">
              <Briefcase className="mt-0.5 h-4 w-4 shrink-0 text-[#31CDFF]" />
              <div>
                <dt className="text-xs text-muted-foreground">Type</dt>
                <dd className="font-medium">
                  {EMPLOYMENT_TYPE_LABELS[employee.employmentType]}
                </dd>
              </div>
            </div>
            <div className="flex gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#31CDFF]" />
              <div>
                <dt className="text-xs text-muted-foreground">Location</dt>
                <dd className="font-medium">{employee.location}</dd>
              </div>
            </div>
            <div className="flex gap-2">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-[#31CDFF]" />
              <div>
                <dt className="text-xs text-muted-foreground">Email</dt>
                <dd className="break-all font-medium">{employee.workEmail}</dd>
              </div>
            </div>
            <div className="flex gap-2">
              <Phone className="mt-0.5 h-4 w-4 shrink-0 text-[#31CDFF]" />
              <div>
                <dt className="text-xs text-muted-foreground">Phone</dt>
                <dd className="font-medium">{employee.phone}</dd>
              </div>
            </div>
            {employee.managerName ? (
              <div className="flex gap-2">
                <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-[#31CDFF]" />
                <div>
                  <dt className="text-xs text-muted-foreground">Reports to</dt>
                  <dd>
                    {employee.managerId ? (
                      <Link
                        href={publicAdminHref(`/manage/employees/${employee.managerId}`)}
                        className="font-medium text-[#272156] hover:underline dark:text-[#31CDFF]"
                      >
                        {employee.managerName}
                      </Link>
                    ) : (
                      <span className="font-medium">{employee.managerName}</span>
                    )}
                  </dd>
                </div>
              </div>
            ) : null}
          </dl>

          <div className="mt-6 space-y-2 border-t pt-4">
            <Button
              variant="outline"
              className="w-full"
              size="sm"
              asChild
            >
              <Link href={publicAdminHref(`/manage/employees/${employee.id}/edit`)}>
                Edit employee
              </Link>
            </Button>
            <Button
              variant="ghost"
              className="w-full text-muted-foreground"
              size="sm"
              asChild
            >
              <Link href={publicAdminHref("/manage/hired")}>View recent hires</Link>
            </Button>
          </div>
        </aside>

        {/* Tabbed detail */}
        <div
          className="min-w-0 rounded-xl border bg-card"
          data-tour="employee-profile-tabs"
        >
          <Tabs defaultValue="overview" className="w-full">
            <div className="overflow-x-auto border-b px-2">
              <TabsList className="h-auto w-max justify-start gap-0 rounded-none bg-transparent p-0">
                <TabsTrigger value="overview" className={TAB_TRIGGER}>
                  Overview
                </TabsTrigger>
                <TabsTrigger value="compensation" className={TAB_TRIGGER}>
                  Compensation
                </TabsTrigger>
                <TabsTrigger value="attendance" className={TAB_TRIGGER}>
                  Time & Attendance
                </TabsTrigger>
                <TabsTrigger value="performance" className={TAB_TRIGGER}>
                  Performance
                </TabsTrigger>
                <TabsTrigger value="documents" className={TAB_TRIGGER}>
                  Documents
                </TabsTrigger>
                <TabsTrigger value="activity" className={TAB_TRIGGER}>
                  Activity
                </TabsTrigger>
              </TabsList>
            </div>
            <div className="p-5">
              <TabsContent value="overview" className="mt-0">
                <OverviewTab employee={employee} />
              </TabsContent>
              <TabsContent value="compensation" className="mt-0">
                <CompensationTab employee={employee} />
              </TabsContent>
              <TabsContent value="attendance" className="mt-0">
                <TimeAttendanceTab employee={employee} />
              </TabsContent>
              <TabsContent value="performance" className="mt-0">
                <PerformanceTab employee={employee} />
              </TabsContent>
              <TabsContent value="documents" className="mt-0">
                <DocumentsTab employee={employee} />
              </TabsContent>
              <TabsContent value="activity" className="mt-0">
                <ActivityTab employee={employee} />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
