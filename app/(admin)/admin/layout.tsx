"use client";

import { ReactNode, useState, useEffect, useCallback } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/contexts/SettingsContext";
import DashboardSidebar, {
  adminShellOffset,
  adminSidebarSpring,
} from "@/components/admin/DashboardSidebar";
import MobileDashboardSidebar from "@/components/admin/MobileDashboardSidebar";
import { EmailVerificationGuard } from "@/components/auth/EmailVerificationGuard";
import { Menu, Shield } from "lucide-react";
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
import { AdminTwoFactorSetup } from "@/components/admin/auth/AdminTwoFactorSetup";
import {
  fetchAdmin2faStatus,
  type Admin2faPolicy,
} from "@/lib/admin-2fa";
import { AdminTwoFactorSetup } from "@/components/admin/auth/AdminTwoFactorSetup";
import { fetchAdmin2faStatus } from "@/lib/admin-2fa";

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
  const [force2faSetup, setForce2faSetup] = useState(false);
  const [checking2fa, setChecking2fa] = useState(false);
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
    refreshUserProfile,
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

  const needs2faSetup =
    Boolean(isAuthenticated && isAdmin) &&
    (user?.admin2faSatisfied === false || force2faSetup);

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
    }
  }, [
    authLoading,
    isAuthenticated,
    isAdmin,
    pathname,
    router,
    isExtendingSession,
    adminHref,
  ]);

  // Failsafe: if profile omitted admin2faSatisfied, ask /auth/2fa/status
  useEffect(() => {
    if (authLoading || !isAuthenticated || !isAdmin) return;
    if (isAdminLoginRoute(pathname)) return;
    if (user?.admin2faSatisfied === false) {
      setForce2faSetup(true);
      return;
    }
    if (user?.admin2faSatisfied === true) {
      setForce2faSetup(false);
      return;
    }

    let cancelled = false;
    setChecking2fa(true);
    void (async () => {
      try {
        const status = await fetchAdmin2faStatus();
        if (cancelled) return;
        setForce2faSetup(!status.satisfied);
      } catch {
        // Keep existing gate; admin APIs will still 403 until enrolled
      } finally {
        if (!cancelled) setChecking2fa(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    authLoading,
    isAuthenticated,
    isAdmin,
    pathname,
    user?.admin2faSatisfied,
  ]);

  const handle2faSetupComplete = async () => {
    await refreshUserProfile();
    try {
      const status = await fetchAdmin2faStatus();
      if (!status.satisfied) {
        setForce2faSetup(true);
        toast.error("Additional security factors are still required");
        return;
      }
      setForce2faSetup(false);
      toast.success("Security setup complete");
    } catch {
      setForce2faSetup(false);
    }
  };

  if (showPremiumLoader) {
    return <PremiumDashboardLoader />;
  }

  // Hard gate: block all admin tools until required factors are enrolled
  // (runs before fullscreen shells so wizards cannot bypass enrollment)
  if (
    !authLoading &&
    isAuthenticated &&
    isAdmin &&
    !isAdminLoginRoute(pathname) &&
    (needs2faSetup || checking2fa)
  ) {
    if (checking2fa && !needs2faSetup) {
      return <PremiumDashboardLoader />;
    }
    return (
      <EmailVerificationGuard requireVerification={true}>
        <div
          id="admin-root"
          data-admin-page
          data-admin-2fa-setup
          className="flex min-h-dvh w-screen items-center justify-center bg-[#f4f5f7] px-4 py-10"
        >
          <div className="w-full max-w-md rounded-3xl border border-border/60 bg-card p-8 shadow-[0_24px_70px_-30px_hsl(222_47%_30%/0.35)] sm:p-10">
            <AdminTwoFactorSetup
              policy={user?.admin2faPolicy || "require_one"}
              emailHint={user?.email}
              required
              onComplete={() => void handle2faSetupComplete()}
            />
          </div>
        </div>
      </EmailVerificationGuard>
    );
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
