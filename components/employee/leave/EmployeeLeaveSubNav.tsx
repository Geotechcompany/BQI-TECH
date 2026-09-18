"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  EMPLOYEE_LEAVE_NAV,
  isEmployeeLeaveNavActive,
} from "@/lib/employee-leave-nav";
import { cn } from "@/lib/utils";

export function EmployeeLeaveSubNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Time off sections"
      data-tour="employee-leave-subnav"
      className="flex gap-1 overflow-x-auto border-b border-[#272156]/10 pb-px md:hidden"
    >
      {EMPLOYEE_LEAVE_NAV.map((item) => {
        const active = isEmployeeLeaveNavActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            data-tour={`employee-leave-tab-${item.id}`}
            className={cn(
              "shrink-0 rounded-t-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "border-b-2 border-[#31CDFF] text-[#272156] dark:text-[#31CDFF]"
                : "text-muted-foreground hover:text-[#272156] dark:hover:text-[#31CDFF]"
            )}
          >
            {item.name}
          </Link>
        );
      })}
    </nav>
  );
}
