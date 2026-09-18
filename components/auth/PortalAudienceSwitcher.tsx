"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

export type PortalAudience = "admin" | "employee";

type PortalAudienceSwitcherProps = {
  active: PortalAudience;
  className?: string;
};

const OPTIONS: {
  id: PortalAudience;
  label: string;
  href: string;
}[] = [
  { id: "admin", label: "Admin", href: "/admin/login" },
  { id: "employee", label: "Employee", href: "/employee/login" },
];

export function PortalAudienceSwitcher({
  active,
  className,
}: PortalAudienceSwitcherProps) {
  return (
    <div
      role="tablist"
      aria-label="Sign-in audience"
      className={cn(
        "grid grid-cols-2 rounded-2xl bg-[#F5F5F7] p-1 ring-1 ring-inset ring-black/[0.06]",
        className
      )}
    >
      {OPTIONS.map((option) => {
        const isActive = option.id === active;
        return (
          <Link
            key={option.id}
            href={option.href}
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            className={cn(
              "relative flex h-10 items-center justify-center rounded-xl text-[13px] font-semibold tracking-[-0.01em] transition-colors duration-150",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#31CDFF]/55 focus-visible:ring-offset-2",
              isActive
                ? "bg-white text-[#272156] shadow-[0_1px_3px_rgba(39,33,86,0.12),0_0_0_1px_rgba(39,33,86,0.04)]"
                : "text-[#6e6e73] hover:text-[#1d1d1f]"
            )}
          >
            {option.label}
          </Link>
        );
      })}
    </div>
  );
}
