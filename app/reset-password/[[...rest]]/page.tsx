"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { FieldError } from "react-hook-form";
import toast from "react-hot-toast";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { PortalAuthCard } from "@/components/auth/PortalAuthCard";
import { PortalBrandPanel } from "@/components/auth/PortalBrandPanel";
import {
  criticallyDampedSpring,
  portalAuthAutofillCss,
  portalAuthButtonClass,
  portalAuthInputClass,
  portalAuthLabelClass,
  portalAuthLinkClass,
} from "@/components/auth/portal-auth-styles";
import { authService } from "@/lib/auth-backend";
import { BACKEND_URL } from "@/lib/config";

const VALIDATE_TOKEN_TIMEOUT_MS = 12_000;

const formSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

const DEFAULT_POST_RESET_REDIRECT = "/login?passwordReset=1";
const EMPLOYEE_DASHBOARD_PATH = "/employee";

type ResetPasswordResponse = {
  message?: string;
  isEmployee?: boolean;
  redirectTo?: string;
  access_token?: string;
  refresh_token?: string;
  user?: {
    id?: string;
    _id?: string;
    email: string;
    name: string;
    role: string;
    avatar?: string;
    adminModules?: string[];
    isEmailVerified?: boolean;
  };
};

export default function ResetPasswordPage() {
  const [isValidToken, setIsValidToken] = useState(false);
  const [isEmployeeInvite, setIsEmployeeInvite] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const reduceMotion = useReducedMotion();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(formSchema),
  });

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(
      () => controller.abort(),
      VALIDATE_TOKEN_TIMEOUT_MS
    );

    const validateToken = async () => {
      if (!token) {
        if (!cancelled) {
          setIsValidToken(false);
          setIsLoading(false);
        }
        return;
      }

      try {
        const response = await fetch(
          `${BACKEND_URL}/api/auth/validate-reset-token?token=${encodeURIComponent(token)}`,
          { signal: controller.signal }
        );
        if (!response.ok) throw new Error("Invalid or expired token");
        const payload = await response.json();
        if (cancelled) return;
        setIsValidToken(true);
        setIsEmployeeInvite(Boolean(payload?.isEmployee));
      } catch (error) {
        if (cancelled) return;
        setIsValidToken(false);
        const isAbort =
          error instanceof Error && error.name === "AbortError";
        const message = isAbort
          ? "Could not verify reset link. Please try again."
          : error instanceof Error
            ? error.message
            : "Invalid or expired token";
        toast.error(message);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void validateToken();

    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [token]);

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password: data.password }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const detail = errorData?.detail;
        const message =
          typeof detail === "string"
            ? detail
            : detail?.message || "Password reset failed";
        throw new Error(message);
      }

      const result = (await response.json()) as ResetPasswordResponse;
      const isEmployee = Boolean(result.isEmployee);
      const destination =
        result.redirectTo ||
        (isEmployee ? EMPLOYEE_DASHBOARD_PATH : DEFAULT_POST_RESET_REDIRECT);

      if (
        isEmployee &&
        result.access_token &&
        result.refresh_token &&
        result.user
      ) {
        authService.setSession({
          user: {
            ...result.user,
            id: result.user.id || result.user._id || "",
            isEmailVerified: Boolean(result.user.isEmailVerified),
          },
          token: result.access_token,
          refreshToken: result.refresh_token,
        });
        toast.success("Password set. Opening your employee dashboard…");
      } else {
        toast.success(
          "Password updated successfully! You can now sign in with your new password."
        );
      }

      setTimeout(() => {
        window.location.href = destination;
      }, 2000);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to reset password"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const fadeUp = (delay: number) =>
    reduceMotion
      ? {
          initial: { opacity: 0 },
          animate: { opacity: 1 },
          transition: { duration: 0.28, delay },
        }
      : {
          initial: { opacity: 0, y: 14 },
          animate: { opacity: 1, y: 0 },
          transition: { ...criticallyDampedSpring, delay },
        };

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] grid lg:grid-cols-2">
        <PortalBrandPanel
          subtitle={
            isEmployeeInvite
              ? "Create a password to access your employee portal."
              : "Choose a new password for your BQI HR account."
          }
          footerLabel="Secure Login"
        />
        <div className="relative flex min-h-[100dvh] items-center justify-center bg-[#f7f7f9]">
          <Loader2 className="h-8 w-8 animate-spin text-[#272156]" />
        </div>
      </div>
    );
  }

  const backHref = isEmployeeInvite ? "/employee/login" : "/login";
  const title = isEmployeeInvite ? "Create your password" : "Reset Password";
  const subtitle = isEmployeeInvite
    ? "Set a password for your employee account"
    : "Enter your new password";
  const submitLabel = isEmployeeInvite ? "Create password" : "Reset Password";
  const submittingLabel = isEmployeeInvite ? "Saving..." : "Resetting...";

  return (
    <div className="min-h-[100dvh] grid lg:grid-cols-2">
      <PortalBrandPanel
        subtitle={
          isEmployeeInvite
            ? "Create a password to access your employee portal."
            : "Choose a new password for your BQI HR account."
        }
        footerLabel="Secure Login"
      />

      <PortalAuthCard backHref={backHref} backLabel="Back to login">
        {isValidToken ? (
          <div className="space-y-7">
            <motion.div {...fadeUp(0.05)} className="space-y-2 text-center">
              <h1 className="text-[1.75rem] font-semibold leading-tight tracking-[-0.025em] text-[#1d1d1f] sm:text-[2rem]">
                {title}
              </h1>
              <p className="text-[15px] leading-relaxed text-[#6e6e73]">
                {subtitle}
              </p>
            </motion.div>

            <style>{portalAuthAutofillCss}</style>

            <form
              onSubmit={handleSubmit(onSubmit)}
              className="portal-auth-form space-y-4"
            >
              <motion.div {...fadeUp(0.1)} className="space-y-2">
                <Label htmlFor="password" className={portalAuthLabelClass}>
                  New Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  disabled={isSubmitting}
                  {...register("password")}
                  className={portalAuthInputClass}
                />
                {errors.password && (
                  <p className="text-sm text-red-500">
                    {(errors.password as FieldError).message}
                  </p>
                )}
              </motion.div>

              <motion.div {...fadeUp(0.14)} className="space-y-2">
                <Label
                  htmlFor="confirmPassword"
                  className={portalAuthLabelClass}
                >
                  Confirm Password
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  disabled={isSubmitting}
                  {...register("confirmPassword")}
                  className={portalAuthInputClass}
                />
                {errors.confirmPassword && (
                  <p className="text-sm text-red-500">
                    {(errors.confirmPassword as FieldError).message}
                  </p>
                )}
              </motion.div>

              <motion.div {...fadeUp(0.2)}>
                <Button
                  type="submit"
                  className={portalAuthButtonClass}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {submittingLabel}
                    </>
                  ) : (
                    submitLabel
                  )}
                </Button>
              </motion.div>
            </form>
          </div>
        ) : (
          <div className="space-y-4 text-center">
            <motion.div {...fadeUp(0.05)} className="space-y-2">
              <h1 className="text-[1.75rem] font-semibold leading-tight tracking-[-0.025em] text-[#1d1d1f] sm:text-[2rem]">
                Invalid Token
              </h1>
              <p className="text-[15px] leading-relaxed text-[#6e6e73]">
                The password reset link is invalid or has expired
              </p>
            </motion.div>
            <motion.div {...fadeUp(0.12)}>
              <Link href="/forgot-password" className={portalAuthLinkClass}>
                Request new reset link
              </Link>
            </motion.div>
          </div>
        )}
      </PortalAuthCard>
    </div>
  );
}
