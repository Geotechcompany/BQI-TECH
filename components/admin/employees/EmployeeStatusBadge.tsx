import { cn } from "@/lib/utils";
import {
  EMPLOYEE_STATUS_LABELS,
  type EmployeeStatus,
} from "@/types/employee";

const statusStyles: Record<EmployeeStatus, string> = {
  active:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
  on_leave:
    "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
  probation:
    "bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300",
  onboarding:
    "bg-[#31CDFF]/15 text-[#272156] dark:text-[#31CDFF]",
  offboarding:
    "bg-orange-100 text-orange-800 dark:bg-orange-950/50 dark:text-orange-300",
  terminated:
    "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
};

export function EmployeeStatusBadge({
  status,
  className,
}: {
  status: EmployeeStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
        statusStyles[status],
        className
      )}
    >
      {EMPLOYEE_STATUS_LABELS[status]}
    </span>
  );
}
