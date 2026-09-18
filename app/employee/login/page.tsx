"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { useForm } from "react-hook-form";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
} from "lucide-react";
import { toast } from "sonner";
import { AdminLoginBrand } from "@/components/admin/AdminLoginBrand";
import {
  PremiumDashboardLoader,
  USER_LOADING_PHRASES,
} from "@/components/admin/PremiumDashboardLoader";
import { PortalAudienceSwitcher } from "@/components/auth/PortalAudienceSwitcher";
import { PortalBrandPanel } from "@/components/auth/PortalBrandPanel";
import { criticallyDampedSpring } from "@/components/auth/portal-auth-styles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { employeePortalApi } from "@/lib/api-backend";
import { getLoginToastFromError } from "@/lib/auth-backend";
import { markPostLoginLoader } from "@/lib/post-login-loader";
import { cn } from "@/lib/utils";

type LoginFormValues = {
  email: string;
  password: string;
};

function extractErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) return "";
  return error.message || "";
}

function isNoEmployeeAccountError(error: unknown): boolean {
  const message = extractErrorMessage(error).toLowerCase();
  return (
    message.includes("no employee account") ||
    message.includes("no_employee_account")
  );
}

export default function EmployeeLoginPage() {
  const router = useRouter();
  const { login, logout, isAuthenticated, authLoading } = useAuth();
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<LoginFormValues>();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPostLoginLoader, setShowPostLoginLoader] = useState(false);
  const [hasCheckedAuth, setHasCheckedAuth] = useState(false);
  const reduce = useReducedMotion();

  const goToEmployeeHome = () => {
    flushSync(() => {
      markPostLoginLoader();
      setShowPostLoginLoader(true);
    });
    router.replace("/employee");
  };

  const verifyEmployeeAccess = async () => {
    await employeePortalApi.getMe();
  };

  useEffect(() => {
    if (authLoading || hasCheckedAuth) return;
    setHasCheckedAuth(true);

    if (!isAuthenticated) return;

    let cancelled = false;
    (async () => {
      try {
        await verifyEmployeeAccess();
        if (!cancelled) {
          toast.success("Already signed in", {
            description: "Opening your employee workspace…",
          });
          goToEmployeeHome();
        }
      } catch {
        // Stay on login — applicant sessions without roster access.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, isAuthenticated, hasCheckedAuth]);

  const onSubmit = async (data: LoginFormValues) => {
    setIsLoading(true);
    try {
      await login(data.email, data.password);
      try {
        await verifyEmployeeAccess();
      } catch (accessError) {
        await logout();
        if (isNoEmployeeAccountError(accessError)) {
          toast.error("No employee account for this email", {
            description:
              "This login is for BQI staff on the HR roster. Applicants use the main portal login.",
          });
        } else {
          const { title, description } = getLoginToastFromError(accessError);
          toast.error(title, { description });
        }
        setIsLoading(false);
        return;
      }

      toast.success("Welcome back", {
        description: "Opening your employee workspace…",
      });
      goToEmployeeHome();
    } catch (error) {
      const { title, description } = getLoginToastFromError(error);
      toast.error(title, { description });
      setIsLoading(false);
    }
  };

  if (showPostLoginLoader || (authLoading && !hasCheckedAuth)) {
    return <PremiumDashboardLoader phrases={USER_LOADING_PHRASES} />;
  }

  const isBusy = isLoading || isSubmitting;

  const cardMotion = reduce
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        transition: { duration: 0.3 },
      }
    : {
        initial: { opacity: 0, y: 16 },
        animate: { opacity: 1, y: 0 },
        transition: criticallyDampedSpring,
      };

  return (
    <div className="grid min-h-[100dvh] lg:grid-cols-[1.05fr_1fr]">
      <PortalBrandPanel variant="employee" />

      <div className="relative flex min-h-[100dvh] items-center justify-center overflow-y-auto bg-background px-6 py-10 sm:px-10">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(80% 60% at 100% 0%, rgba(49,205,255,0.08), transparent 55%), radial-gradient(70% 50% at 0% 100%, rgba(39,33,86,0.06), transparent 50%), linear-gradient(180deg, #f7f7f9 0%, #eef0f4 100%)",
          }}
        />

        <motion.div
          {...cardMotion}
          className="relative z-10 my-auto w-full max-w-md"
        >
          <div
            className={cn(
              "rounded-[28px] border border-white/70 bg-white/90 p-8 sm:p-10",
              "shadow-[0_24px_64px_-28px_rgba(39,33,86,0.28),0_1px_0_rgba(255,255,255,0.8)_inset]",
              "backdrop-blur-2xl backdrop-saturate-150",
              "supports-[backdrop-filter]:bg-white/70",
              "motion-reduce:backdrop-blur-none motion-reduce:bg-white"
            )}
          >
            <div className="mb-8 flex flex-col gap-4">
              <div className="lg:hidden">
                <AdminLoginBrand size="md" showBadge={false} showCard={false} />
              </div>
              <PortalAudienceSwitcher active="employee" />
              <div className="space-y-1.5">
                <h1 className="text-2xl font-semibold tracking-tight text-[#1d1d1f]">
                  Employee login
                </h1>
                <p className="text-sm text-[#6e6e73]">
                  Sign in with your BQI work email
                </p>
              </div>
            </div>

            <style>{`
              .auth-form input:-webkit-autofill,
              .auth-form input:-webkit-autofill:hover,
              .auth-form input:-webkit-autofill:focus {
                -webkit-text-fill-color: #1d1d1f;
                -webkit-box-shadow: 0 0 0 1000px #fff inset;
                box-shadow: 0 0 0 1000px #fff inset;
                caret-color: #1d1d1f;
                transition: background-color 9999s ease-in-out 0s;
              }
            `}</style>

            <form
              onSubmit={handleSubmit(onSubmit)}
              className="auth-form space-y-5"
            >
              <div className="space-y-2">
                <Label htmlFor="email">Email address</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#86868b]" />
                  <Input
                    id="email"
                    type="email"
                    {...register("email", { required: true })}
                    placeholder="you@bqitech.com"
                    autoComplete="email"
                    className="h-12 rounded-xl border-[#d2d2d7] bg-white pl-11 text-[#1d1d1f] placeholder:text-[#86868b]"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="password">Password</Label>
                  <Link
                    href="/forgot-password"
                    className="text-xs font-medium text-[#272156] hover:text-[#31CDFF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#31CDFF]/45"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#86868b]" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    {...register("password", { required: true })}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    className="h-12 rounded-xl border-[#d2d2d7] bg-white pl-11 pr-11 text-[#1d1d1f] placeholder:text-[#86868b]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-[#86868b] transition-colors hover:text-[#1d1d1f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#31CDFF]/45"
                  >
                    {showPassword ? (
                      <EyeOff className="h-[18px] w-[18px]" />
                    ) : (
                      <Eye className="h-[18px] w-[18px]" />
                    )}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={isBusy}
                className="group h-12 w-full rounded-xl bg-[#272156] text-base font-semibold text-white shadow-[0_8px_24px_-8px_rgba(39,33,86,0.45)] transition-[transform,background-color,box-shadow] hover:bg-[#1f1a45] hover:shadow-[0_8px_28px_-8px_rgba(49,205,255,0.35)] active:scale-[0.99] focus-visible:ring-[#31CDFF]/50"
              >
                {isBusy ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in…
                  </>
                ) : (
                  <>
                    Sign in
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </>
                )}
              </Button>
            </form>
          </div>

          <p className="mt-6 text-center text-xs text-[#86868b]">
            Staff access for people on the BQI employee roster.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
