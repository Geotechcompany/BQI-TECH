"use client";

import { ReactNode, useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/contexts/SettingsContext";
import UserDashboardSidebar, {
  MobileBottomTabs,
  userShellOffset,
  userSidebarSpring,
} from "@/components/user/UserDashboardSidebar";
import { DashboardHeader } from "@/components/user/DashboardHeader";
import { EmailVerificationGuard } from "@/components/auth/EmailVerificationGuard";
import { useRouter, usePathname } from "next/navigation";
import {
  PremiumDashboardLoader,
  USER_LOADING_PHRASES,
} from "@/components/admin/PremiumDashboardLoader";
import { usePremiumLoaderGate } from "@/hooks/usePremiumLoaderGate";
import { PlatformTourProvider } from "@/components/admin/tour/PlatformTour";
import { getUserTourIdForPath } from "@/lib/user-tours";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { isAuthenticated, authLoading, isExtendingSession } = useAuth();
  const { sidebarCollapsed } = useSettings();
  const reducedMotion = useReducedMotion();
  const router = useRouter();
  const pathname = usePathname();
  const shellOffset = userShellOffset(sidebarCollapsed);
  const shellSpring = userSidebarSpring(!!reducedMotion);
  const showPremiumLoader = usePremiumLoaderGate({
    isLoginRoute: false,
    authLoading,
  });

  useEffect(() => {
    if (isExtendingSession) return;
    if (!authLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, authLoading, router, isExtendingSession]);

  const tourId = getUserTourIdForPath(pathname);
  const guideInBanner = tourId === "user-overview";

  const getPageTitle = () => {
    if (pathname.includes("/dashboard/apply/")) return "Apply";
    const path = pathname.split("/").pop();
    switch (path) {
      case "overview":
        return "Dashboard Overview";
      case "applications":
        return "My Applications";
      case "jobs":
        return "Available Jobs";
      case "settings":
        return "Settings";
      default:
        return "Dashboard";
    }
  };

  if (showPremiumLoader) {
    return <PremiumDashboardLoader phrases={USER_LOADING_PHRASES} />;
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <EmailVerificationGuard requireVerification={true}>
      <PlatformTourProvider>
        <div
          id="user-root"
          className="flex h-screen w-screen flex-col overflow-hidden bg-gray-100 dark:bg-gray-950 md:flex-row"
        >
          <UserDashboardSidebar />

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
            <DashboardHeader
              title={getPageTitle()}
              tourId={guideInBanner ? undefined : tourId}
            />

            <div className="h-full w-full flex-1 overflow-x-hidden overflow-y-auto">
              <div className="h-full w-full p-4 sm:p-6 md:p-8">{children}</div>
            </div>
          </main>

          <MobileBottomTabs />
        </div>
      </PlatformTourProvider>
    </EmailVerificationGuard>
  );
}
