"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAdminPath } from "@/contexts/AdminPathContext";

const LEAVE_NAV = [
  { name: "Overview", path: "/manage/leave/overview" },
  { name: "Requests", path: "/manage/leave/requests" },
  { name: "Balances", path: "/manage/leave/balances" },
  { name: "Calendar", path: "/manage/leave/calendar" },
  { name: "Leave Types", path: "/manage/leave/types" },
  { name: "Policies", path: "/manage/leave/policies" },
] as const;

export function LeaveSubNav() {
  const pathname = usePathname();
  const { adminHref, toCanonical } = useAdminPath();
  const canonical = toCanonical(pathname || "");

  return (
    <nav
      aria-label="Leave sections"
      data-tour="leave-subnav"
      className="flex gap-1 overflow-x-auto border-b border-[#272156]/10 pb-px"
    >
      {LEAVE_NAV.map((item) => {
        const active =
          canonical === item.path ||
          (item.path === "/manage/leave/overview" &&
            (canonical === "/manage/leave" || canonical === "/manage/leave/"));
        return (
          <Link
            key={item.path}
            href={adminHref(item.path)}
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
