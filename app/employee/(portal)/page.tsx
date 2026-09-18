"use client";

import Link from "next/link";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  CalendarDays,
  FileText,
  MapPin,
  Rocket,
  UserRound,
} from "lucide-react";
import { employeePortalApi } from "@/lib/api-backend";
import {
  getMissingDocumentCategories,
  getMissingProfileFields,
} from "@/lib/employee-portal-completeness";
import { PORTAL_COVER_SRC } from "@/components/auth/PortalBrandPanel";
import { EmployeeQuickStartModal } from "@/components/employee/EmployeeQuickStartModal";
import { DashboardOverviewSkeleton } from "@/components/skeletons";
import { Button } from "@/components/ui/button";
import { usePlatformTour } from "@/hooks/usePlatformTour";
import { EMPLOYEE_STATUS_LABELS, type Employee } from "@/types/employee";
import type { LeaveBalanceRow } from "@/types/leave";
import { cn } from "@/lib/utils";
import { resolveEmployeeAvatarSrc } from "@/lib/employee-portal-avatar";

const BRAND_NAVY = "#272156";
const SPRING = { type: "spring" as const, bounce: 0, duration: 0.4 };

function displayName(employee: Employee) {
  return (
    employee.displayName ||
    `${employee.firstName || ""} ${employee.lastName || ""}`.trim() ||
    employee.email
  );
}

export default function EmployeeHomePage() {
  const reduceMotion = useReducedMotion();
  const press = reduceMotion ? undefined : { scale: 0.97 };
  const { startTour } = usePlatformTour();

  const { data: employee, isLoading } = useQuery({
    queryKey: ["employee-portal-me"],
    queryFn: () => employeePortalApi.getMe() as Promise<Employee>,
    staleTime: 60_000,
  });

  const { data: balances } = useQuery({
    queryKey: ["employee-portal-leave-balances"],
    queryFn: () =>
      employeePortalApi.getLeaveBalances() as Promise<{
        items: LeaveBalanceRow[];
        total: number;
      }>,
    staleTime: 60_000,
  });

  if (isLoading || !employee) {
    return <DashboardOverviewSkeleton />;
  }

  const remainingLeave =
    balances?.items?.reduce((sum, row) => sum + (row.remaining || 0), 0) ??
    employee.leaveBalanceDays ??
    0;
  const docCount = employee.documents?.length ?? 0;
  const statusLabel =
    EMPLOYEE_STATUS_LABELS[employee.status] || employee.status || "Active";
  const missingProfile = getMissingProfileFields(employee);
  const missingDocs = getMissingDocumentCategories(employee.documents || []);
  const hasGaps = missingProfile.length > 0 || missingDocs.length > 0;
  const avatarSrc = resolveEmployeeAvatarSrc(employee.avatarUrl);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <EmployeeQuickStartModal tourId="employee-overview" />

      <motion.section
        initial={reduceMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={SPRING}
        data-tour="employee-overview-welcome"
        className="relative overflow-hidden rounded-3xl bg-[#272156] px-6 py-7 text-white sm:px-8 sm:py-9"
      >
        <Image
          src={PORTAL_COVER_SRC}
          alt=""
          fill
          priority
          sizes="(max-width: 1024px) 100vw, 1024px"
          className="pointer-events-none object-cover object-center"
        />
        {/* Navy scrim — dims photo so white type stays readable */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(165deg, rgba(39,33,86,0.88) 0%, rgba(39,33,86,0.72) 42%, rgba(15,12,40,0.9) 100%)",
          }}
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(80% 70% at 100% 0%, rgba(49,205,255,0.28), transparent 55%), radial-gradient(60% 50% at 0% 100%, rgba(49,205,255,0.1), transparent 50%)",
          }}
        />
        <div className="relative z-10 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#1a1740] ring-2 ring-white/25">
              <Image
                src={avatarSrc}
                alt=""
                width={64}
                height={64}
                className="h-full w-full object-cover"
                priority
              />
            </div>
            <div>
              <p className="text-sm text-white/80 drop-shadow-[0_1px_8px_rgba(15,12,40,0.55)]">
                Welcome back
              </p>
              <h2 className="text-2xl font-semibold tracking-tight drop-shadow-[0_1px_12px_rgba(15,12,40,0.45)] sm:text-3xl">
                {displayName(employee)}
              </h2>
              <p className="mt-1 text-sm text-white/85 drop-shadow-[0_1px_8px_rgba(15,12,40,0.5)]">
                {[employee.jobTitle, employee.departmentName]
                  .filter(Boolean)
                  .join(" · ") || "BQI Tech"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium ring-1 ring-inset ring-white/20 backdrop-blur-sm">
              {statusLabel}
            </span>
            {employee.employeeNumber ? (
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/90 ring-1 ring-inset ring-white/15 backdrop-blur-sm">
                #{employee.employeeNumber}
              </span>
            ) : null}
            <motion.div whileTap={press} className="inline-flex">
              <Button
                type="button"
                size="sm"
                data-tour="employee-quick-start-button"
                className="h-8 gap-1.5 border-white/25 bg-white/10 px-3 text-white backdrop-blur-md hover:bg-white/20 hover:text-white"
                onClick={() => startTour("employee-overview")}
              >
                <Rocket className="h-3.5 w-3.5" aria-hidden />
                Quick Start
              </Button>
            </motion.div>
          </div>
        </div>
      </motion.section>

      {hasGaps ? (
        <motion.section
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING, delay: 0.05 }}
          className="rounded-2xl border border-[#31CDFF]/35 bg-[#31CDFF]/10 px-4 py-4 backdrop-blur-md sm:px-5"
          data-tour="employee-overview-gaps"
        >
          <p className="text-sm font-semibold text-[#272156]">
            Finish your employee file
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {[
              missingProfile.length
                ? `${missingProfile.length} profile field${missingProfile.length === 1 ? "" : "s"}`
                : null,
              missingDocs.length
                ? `${missingDocs.length} document${missingDocs.length === 1 ? "" : "s"}`
                : null,
            ]
              .filter(Boolean)
              .join(" · ")}{" "}
            still needed.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {missingProfile.length > 0 ? (
              <motion.div whileTap={press}>
                <Link
                  href="/employee/profile"
                  className="inline-flex h-9 items-center rounded-xl bg-[#272156] px-3 text-xs font-medium text-white hover:bg-[#272156]/90"
                >
                  Update profile
                </Link>
              </motion.div>
            ) : null}
            {missingDocs.length > 0 ? (
              <motion.div whileTap={press}>
                <Link
                  href="/employee/documents"
                  className="inline-flex h-9 items-center rounded-xl border border-[#272156]/25 bg-background/70 px-3 text-xs font-medium text-[#272156] hover:bg-background"
                >
                  Upload documents
                </Link>
              </motion.div>
            ) : null}
          </div>
        </motion.section>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3" data-tour="employee-overview-stats">
        {[
          {
            label: "Leave remaining",
            value: `${Number(remainingLeave).toFixed(remainingLeave % 1 ? 1 : 0)} days`,
            href: "/employee/leave/entitlement",
            icon: CalendarDays,
          },
          {
            label: "Documents",
            value: String(docCount),
            href: "/employee/documents",
            icon: FileText,
          },
          {
            label: "Profile",
            value: employee.location || "View details",
            href: "/employee/profile",
            icon: employee.location ? MapPin : UserRound,
          },
        ].map((card, index) => (
          <motion.div
            key={card.label}
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SPRING, delay: 0.05 * index }}
            whileTap={press}
          >
            <Link
              href={card.href}
              className={cn(
                "group flex h-full flex-col justify-between rounded-2xl border border-border/60 bg-card p-5",
                "shadow-[0_12px_40px_-28px_rgba(39,33,86,0.35)] transition-colors hover:border-[#272156]/25"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <span className="text-sm text-muted-foreground">{card.label}</span>
                <card.icon
                  className="h-4 w-4 text-[#272156]/70"
                  strokeWidth={1.75}
                />
              </div>
              <div className="mt-4 flex items-end justify-between gap-2">
                <p className="text-xl font-semibold tracking-tight text-foreground">
                  {card.value}
                </p>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-[#272156]" />
              </div>
            </Link>
          </motion.div>
        ))}
      </div>

      <section
        className="rounded-2xl border border-border/60 bg-card p-5 sm:p-6"
        data-tour="employee-overview-links"
      >
        <h3 className="text-base font-semibold tracking-tight" style={{ color: BRAND_NAVY }}>
          Quick links
        </h3>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {[
            { href: "/employee/profile", label: "My profile" },
            { href: "/employee/leave/apply", label: "Request leave" },
            { href: "/employee/documents", label: "My documents" },
            { href: "/employee/settings", label: "Settings" },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-[#272156]/06"
            >
              {link.label}
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
