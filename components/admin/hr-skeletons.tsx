import {
  ChartSkeleton,
  FormSkeleton,
  Skeleton,
  StatsSkeleton,
  TableSkeleton,
} from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function EmployeeListSkeleton({
  rows = 8,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-3", className)}>
      <Skeleton className="h-3 w-24" />
      <TableSkeleton rows={rows} columns={7} />
    </div>
  );
}

export function EmployeeDirectorySkeleton({
  count = 8,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
        className
      )}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-4 rounded-xl border bg-card p-5">
          <div className="flex items-start gap-3">
            <Skeleton className="h-12 w-12 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-[70%]" />
              <Skeleton className="h-3 w-[55%]" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          </div>
          <div className="space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-[60%]" />
            <Skeleton className="h-3 w-[80%]" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function EmployeeProfileSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-6 w-48" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-8 w-28" />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="h-fit rounded-xl border bg-card p-5">
          <div className="flex flex-col items-center space-y-3 text-center">
            <Skeleton className="h-24 w-24 rounded-full" />
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-3 w-20" />
          </div>
          <div className="mt-6 space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-2">
                <Skeleton className="mt-0.5 h-4 w-4 shrink-0 rounded" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-3.5 w-[70%]" />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 space-y-2 border-t pt-4">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        </aside>

        <div className="min-w-0 rounded-xl border bg-card">
          <div className="flex gap-1 overflow-hidden border-b px-2 py-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-24 shrink-0" />
            ))}
          </div>
          <div className="space-y-4 p-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="space-y-3 rounded-lg border border-border/60 p-4"
                >
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-6 w-20" />
                </div>
              ))}
            </div>
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex justify-between gap-4">
                  <Skeleton className="h-3.5 w-28" />
                  <Skeleton className="h-3.5 w-40" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function EmployeeFormSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-4", className)}>
      <div className="space-y-2">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-3.5 w-64 max-w-full" />
      </div>
      <div className="rounded-xl border bg-card p-6">
        <FormSkeleton />
      </div>
    </div>
  );
}

export function EmployeePickerSkeleton({
  rows = 8,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div className={cn("divide-y rounded-xl border bg-card", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-[45%]" />
            <Skeleton className="h-3 w-[65%]" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-8 w-16" />
        </div>
      ))}
    </div>
  );
}

export function OrgChartSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "overflow-x-auto rounded-xl border bg-muted/20 p-8",
        className
      )}
    >
      <div className="flex min-w-max flex-wrap justify-center gap-8">
        <div className="flex flex-col items-center">
          <div className="w-52 space-y-2 rounded-xl border bg-card p-3 text-center">
            <Skeleton className="mx-auto h-12 w-12 rounded-full" />
            <Skeleton className="mx-auto h-3.5 w-28" />
            <Skeleton className="mx-auto h-3 w-20" />
            <Skeleton className="mx-auto h-3 w-24" />
          </div>
          <div className="mt-4 flex flex-wrap justify-center gap-4 border-t border-dashed pt-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="w-52 space-y-2 rounded-xl border bg-card p-3 text-center"
              >
                <Skeleton className="mx-auto h-12 w-12 rounded-full" />
                <Skeleton className="mx-auto h-3.5 w-28" />
                <Skeleton className="mx-auto h-3 w-20" />
                <Skeleton className="mx-auto h-3 w-24" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function OnboardingSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-6", className)}>
      <StatsSkeleton count={4} />
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <ChartSkeleton />
        </div>
        <div className="space-y-4 rounded-xl border bg-card p-4 lg:col-span-2">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3 w-48" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <div className="flex justify-between gap-2">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-1.5 w-full rounded-full" />
            </div>
          ))}
        </div>
      </div>
      <TableSkeleton rows={5} columns={5} />
    </div>
  );
}

export function OffboardingSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-6", className)}>
      <StatsSkeleton count={4} />
      <div className="space-y-4 rounded-xl border bg-card p-4">
        <Skeleton className="h-4 w-36" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <div className="flex justify-between gap-2">
              <Skeleton className="h-3 w-36" />
              <Skeleton className="h-3 w-16" />
            </div>
            <Skeleton className="h-1.5 w-full rounded-full" />
          </div>
        ))}
      </div>
      <TableSkeleton rows={5} columns={5} />
    </div>
  );
}

export function DepartmentsSkeleton({
  count = 6,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div
      className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-3", className)}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border bg-card p-5">
          <div className="flex items-start gap-3">
            <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-[60%]" />
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="mt-2 h-3.5 w-24" />
              <Skeleton className="h-3 w-32" />
              <Skeleton className="mt-2 h-8 w-28" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function AttendanceSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-4", className)}>
      <StatsSkeleton count={4} />
      <TableSkeleton rows={8} columns={6} />
    </div>
  );
}

export function LeaveOverviewSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-4", className)}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-5">
        <Skeleton className="h-80 rounded-xl lg:col-span-3" />
        <Skeleton className="h-80 rounded-xl lg:col-span-2" />
      </div>
    </div>
  );
}

export function LeaveTableSkeleton({
  rows = 8,
  columns = 6,
  className,
}: {
  rows?: number;
  columns?: number;
  className?: string;
}) {
  return <TableSkeleton rows={rows} columns={columns} className={className} />;
}

export function LeavePoliciesSkeleton({
  count = 6,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid gap-4 sm:grid-cols-2 xl:grid-cols-3",
        className
      )}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-4 rounded-xl border bg-card p-5">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-2">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-[80%]" />
          <div className="space-y-2 border-t pt-3">
            <Skeleton className="h-3 w-[55%]" />
            <Skeleton className="h-3 w-[45%]" />
            <Skeleton className="h-3 w-[60%]" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function LeaveCalendarSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-[#272156]/10 bg-card p-3 sm:p-4",
        className
      )}
    >
      <div className="mb-2 grid grid-cols-7 gap-1">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="mx-auto h-3 w-8" />
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 35 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-md sm:h-24" />
        ))}
      </div>
    </div>
  );
}

export function EmployeeWizardRoleSkeleton({
  className,
}: {
  className?: string;
}) {
  return (
    <div className={cn("space-y-5", className)}>
      <div className="space-y-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-10 w-full" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-10 max-w-md" />
      </div>
    </div>
  );
}
