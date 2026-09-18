"use client";

import { useEffect, type ReactNode } from "react";
import { EmployeeLeaveSubNav } from "@/components/employee/leave/EmployeeLeaveSubNav";
import { markEmployeeLeaveSeen } from "@/lib/employee-quick-start";

export default function EmployeeLeaveLayout({
  children,
}: {
  children: ReactNode;
}) {
  useEffect(() => {
    markEmployeeLeaveSeen();
  }, []);

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[#272156] dark:text-foreground">
          Time off
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Apply for leave, check the calendar, track requests, and review
          entitlements.
        </p>
      </div>
      <EmployeeLeaveSubNav />
      {children}
    </div>
  );
}
