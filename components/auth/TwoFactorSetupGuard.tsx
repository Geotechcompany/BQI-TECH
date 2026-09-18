"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { authService } from "@/lib/auth-backend";
import { fetchAdmin2faStatus } from "@/lib/admin-2fa";
import {
  buildUser2faSetupUrl,
  isUser2faSetupExemptPath,
  needsUserTwoFactorSetup,
  userHasEnrolledTwoFactor,
  USER_2FA_SETUP_PATH,
} from "@/lib/user-2fa-gate";
import { PremiumDashboardLoader } from "@/components/admin/PremiumDashboardLoader";

interface TwoFactorSetupGuardProps {
  children: React.ReactNode;
  requireSetup?: boolean;
}

/**
 * Client-side gate: email-verified normal users must enroll at least one
 * 2FA factor before using dashboard / employee routes.
 * Admins are skipped (handled by admin layout + org policy).
 */
export function TwoFactorSetupGuard({
  children,
  requireSetup = true,
}: TwoFactorSetupGuardProps) {
  const { user, isAuthenticated, authLoading, applyAdmin2faStatus, isAdmin } =
    useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const check = async () => {
      if (!requireSetup || isUser2faSetupExemptPath(pathname || "")) {
        setIsChecking(false);
        return;
      }

      if (authLoading) return;

      if (!isAuthenticated || !user) {
        setIsChecking(false);
        return;
      }

      // Admins use /manage 2FA policy — do not trap them here
      if (isAdmin) {
        setIsChecking(false);
        return;
      }

      if (!user.isEmailVerified) {
        // EmailVerificationGuard / middleware handle this first
        setIsChecking(false);
        return;
      }

      let enrolled = userHasEnrolledTwoFactor(user);

      if (!enrolled) {
        try {
          const refreshed = await authService.refreshUserProfile();
          enrolled = userHasEnrolledTwoFactor(refreshed?.user ?? user);
        } catch {
          // fall through to status API
        }
      }

      if (!enrolled) {
        try {
          const status = await fetchAdmin2faStatus();
          applyAdmin2faStatus({
            satisfied: Boolean(status.totpEnabled || status.email2faEnabled),
            factors: status.factors,
            totpEnabled: status.totpEnabled,
            email2faEnabled: status.email2faEnabled,
            policy: status.policy,
            prompt: status.prompt,
          });
          enrolled = Boolean(status.totpEnabled || status.email2faEnabled);
        } catch (error) {
          console.error("Failed to confirm 2FA enrollment status:", error);
        }
      }

      if (!enrolled && !(pathname || "").startsWith(USER_2FA_SETUP_PATH)) {
        router.replace(buildUser2faSetupUrl(pathname));
        return;
      }

      setIsChecking(false);
    };

    void check();
  }, [
    applyAdmin2faStatus,
    authLoading,
    isAdmin,
    isAuthenticated,
    pathname,
    requireSetup,
    router,
    user,
  ]);

  if (isChecking || authLoading) {
    return <PremiumDashboardLoader />;
  }

  // Defensive: if somehow still needed, block render
  if (
    requireSetup &&
    isAuthenticated &&
    user &&
    needsUserTwoFactorSetup(user) &&
    !isUser2faSetupExemptPath(pathname || "")
  ) {
    return <PremiumDashboardLoader />;
  }

  return <>{children}</>;
}
