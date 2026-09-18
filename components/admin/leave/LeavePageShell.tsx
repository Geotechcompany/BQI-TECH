"use client";

import { LeaveSubNav } from "@/components/admin/leave/LeaveSubNav";
import { TourHelpButton } from "@/components/admin/tour/TourHelpButton";
import { TourPageHelper } from "@/components/admin/tour/TourPageHelper";
import { cn } from "@/lib/utils";

type LeavePageShellProps = {
  title: string;
  description: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  tourId?: string;
};

export function LeavePageShell({
  title,
  description,
  actions,
  children,
  className,
  tourId,
}: LeavePageShellProps) {
  return (
    <div className={cn("space-y-5", className)}>
      {tourId ? <TourPageHelper tourId={tourId} /> : null}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-semibold tracking-tight text-[#272156] dark:text-foreground">
            {title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        {(actions || tourId) ? (
          <div className="flex flex-wrap items-center gap-2">
            {tourId ? <TourHelpButton tourId={tourId} /> : null}
            {actions}
          </div>
        ) : null}
      </div>
      <LeaveSubNav />
      {children}
    </div>
  );
}
