"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LEAVE_NAV = [
  { name: "Overview", href: "/admin/leave/overview" },
  { name: "Requests", href: "/admin/leave/requests" },
  { name: "Balances", href: "/admin/leave/balances" },
  { name: "Calendar", href: "/admin/leave/calendar" },
  { name: "Leave Types", href: "/admin/leave/types" },
  { name: "Policies", href: "/admin/leave/policies" },
] as const;

export function LeaveSubNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Leave sections"
      data-tour="leave-subnav"
      className="flex gap-1 overflow-x-auto border-b border-[#272156]/10 pb-px"
    >
      {LEAVE_NAV.map((item) => {
        const active =
          pathname === item.href ||
          (item.href === "/admin/leave/overview" &&
            (pathname === "/admin/leave" || pathname === "/admin/leave/"));
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
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
