"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { AdminTwoFactorSetup } from "@/components/admin/auth/AdminTwoFactorSetup";
import { PortalAuthCard } from "@/components/auth/PortalAuthCard";
import { PortalBrandPanel } from "@/components/auth/PortalBrandPanel";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { fetchAdmin2faStatus } from "@/lib/admin-2fa";
import { authService } from "@/lib/auth-backend";
import {
  needsUserTwoFactorSetup,
  userHasEnrolledTwoFactor,
  USER_2FA_SETUP_PATH,
} from "@/lib/user-2fa-gate";
import {
  PremiumDashboardLoader,
  USER_LOADING_PHRASES,
} from "@/components/admin/PremiumDashboardLoader";

function safeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
    return "/dashboard";
  }
  if (raw.startsWith(USER_2FA_SETUP_PATH) || raw.startsWith("/auth/verify-email")) {
    return "/dashboard";
  }
  return raw;
}

function Setup2faContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    user,
    isAuthenticated,
    authLoading,
    isAdmin,
    logout,
    applyAdmin2faStatus,
  } = useAuth();
  const [checking, setChecking] = useState(true);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const redirectedRef = useRef(false);
  const nextPath = safeNextPath(searchParams.get("next"));

  const leaveGate = useCallback(
    (destination: string) => {
      if (redirectedRef.current) return;
      redirectedRef.current = true;
      router.replace(destination);
    },
    [router]
  );

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated || !user) {
      leaveGate(`/login?redirectTo=${encodeURIComponent(USER_2FA_SETUP_PATH)}`);
      return;
    }

    if (!user.isEmailVerified) {
      leaveGate(
        `/auth/verify-email?email=${encodeURIComponent(user.email || "")}`
      );
      return;
    }

    // Admins use the manage-area enrollment flow
    if (isAdmin) {
      leaveGate("/manage/overview");
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        if (userHasEnrolledTwoFactor(user)) {
          if (!cancelled) leaveGate(nextPath);
          return;
        }

        const refreshed = await authService.refreshUserProfile();
        if (userHasEnrolledTwoFactor(refreshed?.user)) {
          if (!cancelled) leaveGate(nextPath);
          return;
        }

        const status = await fetchAdmin2faStatus();
        applyAdmin2faStatus({
          satisfied: Boolean(status.totpEnabled || status.email2faEnabled),
          factors: status.factors,
          totpEnabled: status.totpEnabled,
          email2faEnabled: status.email2faEnabled,
          policy: status.policy,
          prompt: status.prompt,
        });

        if (status.totpEnabled || status.email2faEnabled) {
          if (!cancelled) leaveGate(nextPath);
          return;
        }
      } catch (error) {
        console.error("2FA setup gate status check failed:", error);
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    applyAdmin2faStatus,
    authLoading,
    isAdmin,
    isAuthenticated,
    leaveGate,
    nextPath,
    user,
  ]);

  const handleComplete = async (result?: { recoveryCodes?: string[] }) => {
    const codes = result?.recoveryCodes || [];
    if (codes.length) {
      setRecoveryCodes(codes);
    }

    try {
      const status = await fetchAdmin2faStatus();
      applyAdmin2faStatus({
        satisfied: true,
        factors: status.factors,
        totpEnabled: status.totpEnabled,
        email2faEnabled: status.email2faEnabled,
        policy: status.policy,
        prompt: false,
      });
      await authService.refreshUserProfile();
    } catch {
      applyAdmin2faStatus({
        satisfied: true,
        totpEnabled: true,
        prompt: false,
      });
    }

    if (codes.length) {
      toast.success("Two-factor authentication enabled", {
        description: "Save your recovery codes before continuing.",
      });
      return;
    }

    toast.success("Two-factor authentication enabled");
    leaveGate(nextPath);
  };

  const continueAfterRecovery = () => {
    leaveGate(nextPath);
  };

  if (authLoading || checking) {
    return <PremiumDashboardLoader phrases={USER_LOADING_PHRASES} />;
  }

  if (!isAuthenticated || !user || isAdmin) {
    return <PremiumDashboardLoader phrases={USER_LOADING_PHRASES} />;
  }

  if (recoveryCodes.length > 0) {
    return (
      <div className="min-h-[100dvh] grid lg:grid-cols-2">
        <PortalBrandPanel
          subtitle="Your account is safer. Store these recovery codes somewhere you can find them."
          footerLabel="Account security"
        />
        <PortalAuthCard backHref="">
          <div className="space-y-6">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-700">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <div className="space-y-1">
                <h1 className="text-2xl font-semibold tracking-tight text-[#1d1d1f]">
                  Save your recovery codes
                </h1>
                <p className="text-sm text-[#6e6e73]">
                  Each code can be used once if you lose access to your
                  authenticator. You will not see them again.
                </p>
              </div>
            </div>

            <ul className="grid grid-cols-1 gap-2 rounded-2xl border border-black/[0.08] bg-[#F5F5F7] p-4 font-mono text-sm sm:grid-cols-2">
              {recoveryCodes.map((code) => (
                <li key={code} className="text-[#1d1d1f]">
                  {code}
                </li>
              ))}
            </ul>

            <Button
              type="button"
              className="w-full"
              onClick={continueAfterRecovery}
            >
              Continue to app
            </Button>
          </div>
        </PortalAuthCard>
      </div>
    );
  }

  // Still needed? (defensive — if profile already enrolled, effect redirects)
  if (!needsUserTwoFactorSetup(user) && userHasEnrolledTwoFactor(user)) {
    return <PremiumDashboardLoader phrases={USER_LOADING_PHRASES} />;
  }

  return (
    <div className="min-h-[100dvh] grid lg:grid-cols-2">
      <PortalBrandPanel
        subtitle="One more step after email verification: add a second factor so only you can sign in."
        footerLabel="Account security"
      />
      <PortalAuthCard backHref="">
        <div className="space-y-8">
          <AdminTwoFactorSetup
            policy="require_one"
            emailHint={user.email}
            required
            title="Set up two-factor authentication"
            description="Choose an authenticator app or email one-time codes. You need at least one method before using the rest of the app."
            onComplete={(result) => void handleComplete(result)}
          />

          <div className="border-t border-black/[0.06] pt-4 text-center">
            <button
              type="button"
              className="text-sm text-[#6e6e73] underline-offset-4 transition hover:text-[#1d1d1f] hover:underline"
              onClick={() => void logout()}
            >
              Sign out
            </button>
          </div>
        </div>
      </PortalAuthCard>
    </div>
  );
}

export default function Setup2faPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[100dvh] items-center justify-center bg-[#f7f7f9]">
          <Loader2 className="h-8 w-8 animate-spin text-[#272156]" />
        </div>
      }
    >
      <Setup2faContent />
    </Suspense>
  );
}
