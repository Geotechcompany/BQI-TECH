"use client";

import { ReactNode, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/contexts/SettingsContext";
import {
  EmployeeMobileBottomTabs,
  EmployeePortalSidebar,
  employeeShellOffset,
  employeeSidebarSpring,
} from "@/components/employee/EmployeePortalSidebar";
import { EmployeePortalHeader } from "@/components/employee/EmployeePortalHeader";
import {
  PremiumDashboardLoader,
  USER_LOADING_PHRASES,
} from "@/components/admin/PremiumDashboardLoader";
import { usePremiumLoaderGate } from "@/hooks/usePremiumLoaderGate";
import { employeePortalApi } from "@/lib/api-backend";
import { Button } from "@/components/ui/button";
import type { Employee } from "@/types/employee";
import { PlatformTourProvider } from "@/components/admin/tour/PlatformTour";
import { TourPageHelper } from "@/components/admin/tour/TourPageHelper";
import { EmployeeQuickStartChecklist } from "@/components/employee/EmployeeQuickStartChecklist";
import { TwoFactorSetupGuard } from "@/components/auth/TwoFactorSetupGuard";
import { getEmployeeTourIdForPath } from "@/lib/employee-tours";
import {
  EMPLOYEE_LEAVE_NAV,
  isEmployeeLeaveNavActive,
  isEmployeeLeavePath,
} from "@/lib/employee-leave-nav";

function pageTitle(pathname: string) {
  if (pathname.startsWith("/employee/profile")) return "My profile";
  if (isEmployeeLeavePath(pathname)) {
    const leavePage = EMPLOYEE_LEAVE_NAV.find((item) =>
      isEmployeeLeaveNavActive(pathname, item.href)
    );
    return leavePage ? `Leave · ${leavePage.name}` : "Leave";
  }
  if (pathname.startsWith("/employee/documents")) return "Documents";
  if (pathname.startsWith("/employee/settings")) return "Settings";
  return "Overview";
}

export default function EmployeePortalLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { isAuthenticated, authLoading, isExtendingSession, logout } =
    useAuth();
  const { sidebarCollapsed } = useSettings();
  const reducedMotion = useReducedMotion();
  const router = useRouter();
  const pathname = usePathname();
  const tourId = getEmployeeTourIdForPath(pathname);
  const shellOffset = employeeShellOffset(sidebarCollapsed);
  const shellSpring = employeeSidebarSpring(!!reducedMotion);
  const showPremiumLoader = usePremiumLoaderGate({
    isLoginRoute: false,
    authLoading,
  });

  useEffect(() => {
    if (isExtendingSession) return;
    if (!authLoading && !isAuthenticated) {
      router.replace("/employee/login");
    }
  }, [isAuthenticated, authLoading, router, isExtendingSession]);

  const {
    data: employee,
    isLoading: employeeLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["employee-portal-me"],
    queryFn: () => employeePortalApi.getMe() as Promise<Employee>,
    enabled: isAuthenticated && !authLoading,
    staleTime: 60_000,
    retry: false,
  });

  if (showPremiumLoader || (isAuthenticated && employeeLoading)) {
    return <PremiumDashboardLoader phrases={USER_LOADING_PHRASES} />;
  }

  if (!isAuthenticated) {
    return null;
  }

  if (isError || !employee) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : "No employee account for this email";

    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background px-6">
        <div className="w-full max-w-md rounded-3xl border border-border/60 bg-card p-8 text-center shadow-[0_24px_70px_-30px_hsl(222_47%_30%/0.35)] sm:p-10">
          <h2 className="text-2xl font-semibold tracking-tight">
            Employee access required
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">{message}</p>
          <div className="mt-6 flex flex-col gap-3">
            <Button
              className="h-12 w-full rounded-xl bg-[#272156] font-semibold hover:bg-[#1f1a45]"
              onClick={() => router.replace("/employee/login")}
            >
              Back to employee login
            </Button>
            <Button
              variant="outline"
              className="h-11 w-full rounded-xl"
              onClick={async () => {
                await logout();
                router.replace("/login");
              }}
            >
              Applicant portal
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <TwoFactorSetupGuard requireSetup={true}>
      <PlatformTourProvider>
        <div
          id="employee-root"
          className="flex h-screen w-screen flex-col overflow-hidden bg-gray-100 dark:bg-gray-950 md:flex-row"
        >
          <EmployeePortalSidebar />

          {/* Spacer mirrors fixed dual-rail width so content tracks the spring */}
          <motion.div
            aria-hidden
            className="hidden shrink-0 md:block"
            initial={false}
            animate={{ width: shellOffset }}
            transition={shellSpring}
            style={{ willChange: "width" }}
          />

          <main className="flex h-full w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 pb-20 dark:bg-gray-950 md:pb-0">
            <EmployeePortalHeader
              title={pageTitle(pathname)}
              tourId={tourId}
            />

            <div className="h-full w-full flex-1 overflow-x-hidden overflow-y-auto">
              <div className="h-full w-full p-4 sm:p-6 md:p-8">
                {tourId ? <TourPageHelper tourId={tourId} /> : null}
                {children}
              </div>
            </div>
          </main>

          <EmployeeMobileBottomTabs />
          <EmployeeQuickStartChecklist />
        </div>
      </PlatformTourProvider>
    </TwoFactorSetupGuard>
  );
}
