"use client";

import { ReactNode, useState, useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/contexts/SettingsContext";
import DashboardSidebar, {
  adminShellOffset,
  adminSidebarSpring,
} from "@/components/admin/DashboardSidebar";
import MobileDashboardSidebar from "@/components/admin/MobileDashboardSidebar";
import { EmailVerificationGuard } from "@/components/auth/EmailVerificationGuard";
import { Menu } from "lucide-react";
import { AdminThemeProvider } from "@/contexts/AdminThemeContext";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import WhatsNewFloat from "@/components/admin/WhatsNewFloat";
import FinishSetupChecklist from "@/components/admin/FinishSetupChecklist";
import { SessionTimeoutModal } from "@/components/admin/SessionTimeoutModal";
import { AdminBrandTitle } from "@/components/admin/AdminBrandTitle";
import { FeaturePreviewDialog } from "@/components/admin/FeaturePreviewDialog";
import {
  FEATURE_PREVIEW_DIALOG_ENABLED,
  WHATS_NEW_FLOAT_ENABLED,
} from "@/lib/admin-whats-new";
import { AiStatusProvider } from "@/contexts/AiStatusContext";
import { BqiIntelligenceProvider } from "@/contexts/BqiIntelligenceContext";
import { AiConfigBanner } from "@/components/admin/AiConfigBanner";
import { AiRankProvider } from "@/contexts/AiRankContext";
import { AiRankProgressHost } from "@/components/admin/AiRankProgress";
import { PlatformTourProvider } from "@/components/admin/tour/PlatformTour";
import {
  isAdminLoginRoute,
  isBareFullscreenAdminRoute,
  isBlogWizardAdminRoute,
  isCandidateProfileAdminRoute,
  isEmployeeWizardAdminRoute,
  isJobWizardAdminRoute,
} from "@/lib/admin-routes";
import { PremiumDashboardLoader } from "@/components/admin/PremiumDashboardLoader";
import { usePremiumLoaderGate } from "@/hooks/usePremiumLoaderGate";
import { AdminLockScreenProvider } from "@/contexts/AdminLockScreenContext";
import { AdminLockScreen } from "@/components/admin/AdminLockScreen";
import { useAdminPath } from "@/contexts/AdminPathContext";

function AdminFullscreenProviders({ children }: { children: ReactNode }) {
  const {
    showSessionTimeout,
    sessionTimeRemaining,
    refreshSession,
    logout,
  } = useAuth();

  return (
    <EmailVerificationGuard requireVerification={true}>
      <AdminLockScreenProvider>
        <AdminThemeProvider targetId="admin-root">
          <PlatformTourProvider>
            <AiStatusProvider>
              <BqiIntelligenceProvider>
                <AiRankProvider>
                  <div
                    id="admin-root"
                    data-admin-page
                    data-admin-fullscreen
                    className="flex h-dvh w-screen flex-col overflow-auto bg-[#f4f5f7]"
                  >
                    {children}
                  </div>
                  <SessionTimeoutModal
                    isOpen={showSessionTimeout}
                    onStayLoggedIn={refreshSession}
                    onLogout={logout}
                    timeRemaining={sessionTimeRemaining}
                    totalTime={5 * 60}
                  />
                  <AiRankProgressHost />
                </AiRankProvider>
              </BqiIntelligenceProvider>
            </AiStatusProvider>
          </PlatformTourProvider>
        </AdminThemeProvider>
        <AdminLockScreen />
      </AdminLockScreenProvider>
    </EmailVerificationGuard>
  );
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { sidebarCollapsed } = useSettings();
  const reducedMotion = useReducedMotion();
  const {
    user,
    authLoading,
    isAuthenticated,
    isAdmin,
    showSessionTimeout,
    sessionTimeRemaining,
    refreshSession,
    logout,
    isExtendingSession,
  } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const { adminHref } = useAdminPath();
  const shellOffset = adminShellOffset(sidebarCollapsed);
  const shellSpring = adminSidebarSpring(!!reducedMotion);
  const showPremiumLoader = usePremiumLoaderGate({
    isLoginRoute: isAdminLoginRoute(pathname),
    authLoading,
  });

  // Soft client navigation only — never window.location (that nukes the SPA
  // mid Stay Logged In / token refresh). Skip while session is being extended.
  useEffect(() => {
    if (isAdminLoginRoute(pathname)) {
      return;
    }
    if (isExtendingSession) {
      return;
    }

    if (!authLoading) {
      if (!isAuthenticated) {
        router.replace(adminHref("/admin/login"));
        return;
      }

      if (isAuthenticated && !isAdmin) {
        toast.error("Access denied. Admin privileges required.");
        router.replace("/dashboard");
        return;
      }

      // Fail closed: required 2FA not enrolled → force setup on login
      if (
        isAuthenticated &&
        isAdmin &&
        user?.admin2faSatisfied === false
      ) {
        router.replace(adminHref("/admin/login"));
        return;
      }
    }
  }, [
    authLoading,
    isAuthenticated,
    isAdmin,
    pathname,
    router,
    isExtendingSession,
    user?.admin2faSatisfied,
    adminHref,
  ]);

  if (showPremiumLoader) {
    return <PremiumDashboardLoader />;
  }

  if (isBareFullscreenAdminRoute(pathname)) {
    return (
      <div data-admin-page data-admin-fullscreen className="h-dvh w-screen overflow-auto">
        {children}
      </div>
    );
  }

  // Fullscreen admin shells that still need tour/AI providers
  if (
    isJobWizardAdminRoute(pathname) ||
    isBlogWizardAdminRoute(pathname) ||
    isEmployeeWizardAdminRoute(pathname) ||
    isCandidateProfileAdminRoute(pathname)
  ) {
    if (!authLoading && (!isAuthenticated || !isAdmin)) {
      return null;
    }

    return <AdminFullscreenProviders>{children}</AdminFullscreenProviders>;
  }

  if (!authLoading && (!isAuthenticated || !isAdmin)) {
    return null;
  }

  return (
    <EmailVerificationGuard requireVerification={true}>
      <AdminLockScreenProvider>
        <AdminThemeProvider targetId="admin-root">
          <PlatformTourProvider>
          <AiStatusProvider>
          <BqiIntelligenceProvider>
          <AiRankProvider>
          <div
            id="admin-root"
            data-admin-page
            className="flex flex-col h-screen w-screen bg-gray-100 md:flex-row overflow-hidden"
          >
            <div
              className="md:hidden bg-white flex justify-between items-center h-16 px-4 flex-shrink-0 z-50"
              style={{ marginTop: "var(--admin-banner-offset, 0px)" }}
            >
              <AdminBrandTitle
                titleClassName="text-xl text-gray-800"
                badgeVariant="slate"
              />
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="text-gray-500"
              >
                <Menu size={24} />
              </button>
            </div>

            <DashboardSidebar
              isOpen={sidebarOpen}
              onClose={() => setSidebarOpen(false)}
            />

            <MobileDashboardSidebar
              isOpen={sidebarOpen}
              onClose={() => setSidebarOpen(false)}
            />

            {/* Spacer mirrors fixed dual-rail width so content tracks the spring */}
            <motion.div
              aria-hidden
              className="hidden shrink-0 md:block"
              initial={false}
              animate={{ width: shellOffset }}
              transition={shellSpring}
              style={{ willChange: "width" }}
            />

            <main className="h-full w-full min-w-0 flex-1 overflow-x-hidden overflow-y-auto bg-gray-100">
              <AiConfigBanner />
              <div className="h-full w-full">{children}</div>
              {/* Re-enable via WHATS_NEW_FLOAT_ENABLED / FEATURE_PREVIEW_DIALOG_ENABLED */}
              {WHATS_NEW_FLOAT_ENABLED ? <WhatsNewFloat /> : null}
              <FinishSetupChecklist />
              {FEATURE_PREVIEW_DIALOG_ENABLED ? <FeaturePreviewDialog /> : null}
            </main>
          </div>

          <SessionTimeoutModal
            isOpen={showSessionTimeout}
            onStayLoggedIn={refreshSession}
            onLogout={logout}
            timeRemaining={sessionTimeRemaining}
            totalTime={5 * 60}
          />
          <AiRankProgressHost />
          </AiRankProvider>
          </BqiIntelligenceProvider>
          </AiStatusProvider>
          </PlatformTourProvider>
        </AdminThemeProvider>
        <AdminLockScreen />
      </AdminLockScreenProvider>
    </EmailVerificationGuard>
  );
}
