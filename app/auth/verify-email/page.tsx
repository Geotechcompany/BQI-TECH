"use client";

import { Suspense } from "react";
import { useState, useEffect, useCallback, useRef } from "react";
import { BACKEND_URL } from "@/lib/config";
import { useSearchParams } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import OtpInput from "react-otp-input";
import { PortalAuthCard } from "@/components/auth/PortalAuthCard";
import { PortalBrandPanel } from "@/components/auth/PortalBrandPanel";
import {
  criticallyDampedSpring,
  portalAuthButtonClass,
  portalAuthLinkClass,
} from "@/components/auth/portal-auth-styles";
import { Controller } from "react-hook-form";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { authService } from "@/lib/auth-backend";
import { resolveEmailVerified } from "@/lib/resolve-email-verified";
import { cn } from "@/lib/utils";

const otpSchema = z.object({
  code: z.string().length(6, "Code must be 6 digits"),
});

const otpInputClass = cn(
  "!w-10 h-12 sm:!w-12 sm:h-14 text-center rounded-2xl",
  "border border-black/[0.08] bg-[#F5F5F7]",
  "text-lg sm:text-xl text-[#1d1d1f] caret-[#272156]",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]",
  "transition-[border-color,box-shadow,background-color] duration-200 ease-out",
  "focus:outline-none focus:border-[#272156]/35 focus:bg-white",
  "focus:ring-2 focus:ring-[#272156]/22",
  "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
  "disabled:cursor-not-allowed disabled:opacity-55"
);

// Utility function to safely access localStorage
const safeLocalStorage = {
  getItem: (key: string): string | null => {
    if (typeof window !== "undefined" && window.localStorage) {
      return localStorage.getItem(key);
    }
    return null;
  },
  setItem: (key: string, value: string): void => {
    if (typeof window !== "undefined" && window.localStorage) {
      localStorage.setItem(key, value);
    }
  },
  removeItem: (key: string): void => {
    if (typeof window !== "undefined" && window.localStorage) {
      localStorage.removeItem(key);
    }
  },
};

// Wrapper component to add Suspense support
export default function EmailVerificationPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[100dvh] items-center justify-center bg-[#f7f7f9]">
          <div className="text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#272156]" />
            <p className="mt-4 text-[15px] text-[#6e6e73]">
              Loading verification page...
            </p>
          </div>
        </div>
      }
    >
      <EmailVerificationContent />
    </Suspense>
  );
}

function EmailVerificationContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const { updateEmailVerificationStatus, authLoading, user, isAuthenticated, isAdmin } =
    useAuth();

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

  // Robust email retrieval with multiple fallback mechanisms
  const getEmailFromSources = useCallback(() => {
    // Priority 1: Search Params
    const emailFromParams = searchParams.get("email");
    const sentFlag = searchParams.get("sent");

    // Priority 2: User Object
    const emailFromUser = user?.email;

    // Priority 3: Local Storage (safely accessed)
    const emailFromStorage = safeLocalStorage.getItem("verification_email");
    // If signup marked 'sent', mark auto-sent guard here as well
    if (emailFromParams && sentFlag === "1") {
      try {
        localStorage.setItem(
          `verification_auto_sent_${emailFromParams}`,
          "true"
        );
        localStorage.setItem(
          `verification_last_send_time_${emailFromParams}`,
          Date.now().toString()
        );
      } catch {}
    }

    return emailFromParams || emailFromUser || emailFromStorage;
  }, [searchParams, user]);

  // State for email and verification
  const [email, setEmail] = useState<string | null>(() => {
    // Use a safe initialization that works on both server and client
    if (typeof window !== "undefined") {
      return getEmailFromSources();
    }
    return null;
  });
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [initialEmailSent, setInitialEmailSent] = useState(false);
  // Guards to prevent duplicate verification submits/toasts
  const isVerifyingRef = useRef(false);
  const hasShownSuccessRef = useRef(false);
  const hasShownAlreadyVerifiedToastRef = useRef(false);
  const isRedirectingRef = useRef(false);
  const verifiedCheckEmailRef = useRef<string | null>(null);

  // Constants for duplicate prevention
  const RESEND_COOLDOWN = 30000; // 30 seconds cooldown between resends
  const AUTO_SEND_STORAGE_KEY = "verification_auto_sent";
  const LAST_SEND_TIME_KEY = "verification_last_send_time";

  // Ref to prevent duplicate verification requests
  const isRequestInProgress = useRef(false);

  // Session-based tracking to handle React StrictMode
  const sessionSentEmails = useRef(new Set<string>());

  // Helper functions for duplicate prevention
  const hasAutoSentForEmail = useCallback((emailToCheck: string) => {
    if (typeof window === "undefined") return false;

    // Check session tracking first (handles React StrictMode)
    if (sessionSentEmails.current.has(emailToCheck)) {
      return true;
    }

    // Check localStorage (handles page refreshes)
    const stored = localStorage.getItem(
      `${AUTO_SEND_STORAGE_KEY}_${emailToCheck}`
    );
    return stored === "true";
  }, []);

  const markAutoSentForEmail = useCallback((emailToCheck: string) => {
    // Add to session tracking (prevents React StrictMode duplicates)
    sessionSentEmails.current.add(emailToCheck);

    if (typeof window !== "undefined") {
      localStorage.setItem(`${AUTO_SEND_STORAGE_KEY}_${emailToCheck}`, "true");
      localStorage.setItem(
        `${LAST_SEND_TIME_KEY}_${emailToCheck}`,
        Date.now().toString()
      );
    }
  }, []);

  const getLastSendTime = useCallback((emailToCheck: string) => {
    if (typeof window === "undefined") return 0;
    const stored = localStorage.getItem(
      `${LAST_SEND_TIME_KEY}_${emailToCheck}`
    );
    return stored ? parseInt(stored, 10) : 0;
  }, []);

  const clearVerificationTracking = useCallback((emailToCheck: string) => {
    // Clear session tracking
    sessionSentEmails.current.delete(emailToCheck);

    if (typeof window !== "undefined") {
      localStorage.removeItem(`${AUTO_SEND_STORAGE_KEY}_${emailToCheck}`);
      localStorage.removeItem(`${LAST_SEND_TIME_KEY}_${emailToCheck}`);
    }
  }, []);

  const redirectIfVerified = useCallback(
    async (targetEmail: string) => {
      if (isRedirectingRef.current) {
        return true;
      }

      try {
        const refreshed = await authService.refreshUserProfile();
        let verified = resolveEmailVerified(
          refreshed?.user?.isEmailVerified,
          false
        );

        if (!verified) {
          const statusResponse = await fetch(
            `${BACKEND_URL}/api/auth/verify-email/status`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify(targetEmail),
            }
          );
          if (statusResponse.ok) {
            const statusData = await statusResponse.json();
            verified = resolveEmailVerified(statusData?.isEmailVerified, false);
          }
        }

        if (verified) {
          isRedirectingRef.current = true;
          await updateEmailVerificationStatus(true);
          if (!hasShownAlreadyVerifiedToastRef.current) {
            toast.success("Email already verified. Redirecting...");
            hasShownAlreadyVerifiedToastRef.current = true;
          }
          router.replace(isAdmin ? "/admin/overview" : "/dashboard");
          return true;
        }
      } catch (error) {
        console.error("Verification status check failed:", error);
      }
      return false;
    },
    [updateEmailVerificationStatus, router, isAdmin]
  );

  // Initialize form outside of any conditional block
  const {
    handleSubmit,
    formState: { errors },
    control,
    setError: setFormError,
  } = useForm<z.infer<typeof otpSchema>>({
    resolver: zodResolver(otpSchema),
    defaultValues: {
      code: "",
    },
  });

  // Memoize onSubmit to prevent unnecessary re-renders
  const onSubmit = useCallback(
    async (data: z.infer<typeof otpSchema>) => {
      if (isVerifyingRef.current || status === "loading") {
        return;
      }
      if (!email) {
        toast.error(
          "No email found. Please start the verification process again."
        );
        router.push("/login");
        return;
      }

      isVerifyingRef.current = true;
      setStatus("loading");
      try {
        const response = await fetch(
          `${BACKEND_URL}/api/auth/verify-email`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              email,
              code: data.code,
            }),
          }
        );

        // Parse the response to handle different error scenarios
        const responseData = await response.json();

        if (!response.ok) {
          // Handle specific error scenarios
          if (responseData.detail === "Email already registered") {
            toast.error(
              "This email is already registered. Please login or use a different email.",
              {
                duration: 5000,
                position: "top-center",
                style: {
                  background: "#FF6B6B",
                  color: "white",
                  fontWeight: "bold",
                  padding: "16px",
                  borderRadius: "8px",
                },
                icon: "🚫",
              }
            );

            // Redirect to login page after showing the notification
            setTimeout(() => {
              router.push("/login");
            }, 3000);

            setStatus("error");
            return;
          }

          // Generic error handling
          throw new Error(responseData.detail || "Verification failed");
        }

        const result = responseData;
        setStatus("success");
        if (!hasShownSuccessRef.current) {
          toast.success("Email verified successfully!");
          hasShownSuccessRef.current = true;
        }

        // Try to refresh user profile to update verification status
        try {
          await updateEmailVerificationStatus(true);
        } catch (sessionError) {
          // Silent error - session update is not critical for user experience
        }

        // Remove stored email after successful verification
        safeLocalStorage.removeItem("verification_email");

        // Clear verification tracking for this email
        clearVerificationTracking(email);

        // Clean redirect to login after verification
        const redirectPath = `/login?verified=1${
          email ? `&email=${encodeURIComponent(email)}` : ""
        }`;
        setTimeout(() => {
          router.replace(redirectPath);
        }, 1000);
      } catch (error) {
        setStatus("error");
        toast.error(error.message || "Verification failed", {
          duration: 3000,
          position: "top-center",
        });
        setOtp("");
      } finally {
        isVerifyingRef.current = false;
      }
    },
    [email, router, updateEmailVerificationStatus, status]
  );

  // Effect to handle email retrieval and redirect logic
  useEffect(() => {
    // Prevent redirect if email is present and user is authenticated
    if (!email && isAuthenticated) {
      const retrievedEmail = getEmailFromSources();

      if (retrievedEmail) {
        setEmail(retrievedEmail);
        // Safely store in localStorage
        safeLocalStorage.setItem("verification_email", retrievedEmail);
      } else {
        // Last resort: redirect to login or dashboard
        router.replace("/login");
      }
    }
  }, [email, isAuthenticated, router, getEmailFromSources]);

  // Confirm verification status once per email (avoid toast/redirect loops)
  useEffect(() => {
    if (!email || authLoading) return;
    if (verifiedCheckEmailRef.current === email) return;
    verifiedCheckEmailRef.current = email;
    redirectIfVerified(email);
  }, [email, authLoading, redirectIfVerified]);

  // Send initial verification email with bulletproof duplicate prevention
  useEffect(() => {
    const sendInitialVerification = async () => {
      // Robust safeguards to prevent any duplicate sends
      if (
        !email ||
        status !== "idle" ||
        isRequestInProgress.current ||
        hasAutoSentForEmail(email) ||
        user?.isEmailVerified
      ) {
        // Don't send if already verified
        return;
      }

      if (await redirectIfVerified(email)) {
        return;
      }

      try {
        // Set flags to prevent duplicate requests
        isRequestInProgress.current = true;
        setStatus("loading");

        const response = await fetch(
          `${BACKEND_URL}/api/auth/send-verification-code`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(email),
          }
        );

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.detail || "Failed to send verification");
        }

        // Mark this email as sent persistently
        markAutoSentForEmail(email);
        setInitialEmailSent(true);
        toast.success("Verification code sent! Check your email.");
      } catch (error: any) {
        const message = error?.message || "";
        if (message.toLowerCase().includes("already verified")) {
          if (await redirectIfVerified(email)) {
            return;
          }
        }
        toast.error(message || "Failed to send verification email");
      } finally {
        setStatus("idle");
        isRequestInProgress.current = false;
      }
    };

    // Only run once per email with longer debounce
    const debounceTimer = setTimeout(sendInitialVerification, 1500);
    return () => {
      clearTimeout(debounceTimer);
      isRequestInProgress.current = false;
    };
  }, [email, user?.isEmailVerified, hasAutoSentForEmail, markAutoSentForEmail, redirectIfVerified, status]);

  // Cleanup effect to reset flags on unmount
  useEffect(() => {
    return () => {
      isRequestInProgress.current = false;
    };
  }, []);

  // Auto-submit when OTP is complete (once per code entry)
  useEffect(() => {
    if (
      otp.length === 6 &&
      !isVerifyingRef.current &&
      status === "idle"
    ) {
      handleSubmit(onSubmit)();
    }
  }, [otp, status, handleSubmit, onSubmit]);

  // Prevent rendering if authentication is loading or no email
  if (authLoading || !email) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#f7f7f9]">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#272156]" />
          <p className="mt-4 text-[15px] text-[#6e6e73]">
            {authLoading
              ? "Checking authentication status..."
              : "Redirecting..."}
          </p>
        </div>
      </div>
    );
  }

  const handleInputChange = (value: string) => {
    setOtp(value);
    if (error) setError("");
  };

  const handleResendCode = async () => {
    try {
      // Enhanced duplicate prevention for manual resend
      if (!email || status === "loading" || isRequestInProgress.current) {
        throw new Error("Operation in progress");
      }

      // Check cooldown period using persistent storage
      const now = Date.now();
      const lastSendTime = getLastSendTime(email);
      const timeSinceLastResend = now - lastSendTime;
      if (timeSinceLastResend < RESEND_COOLDOWN) {
        const remainingTime = Math.ceil(
          (RESEND_COOLDOWN - timeSinceLastResend) / 1000
        );
        throw new Error(
          `Please wait ${remainingTime} seconds before requesting another code`
        );
      }

      // Set flags to prevent duplicate requests
      isRequestInProgress.current = true;
      setStatus("loading");

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_PYTHON_API_URL}/api/auth/send-verification-code`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(email),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || "Failed to resend code");
      }

      // Update tracking with persistent storage
      markAutoSentForEmail(email);
      toast.success("New verification code sent!");
    } catch (error: any) {
      toast.error(error.message || "Failed to resend code");
    } finally {
      setStatus("idle");
      isRequestInProgress.current = false;
    }
  };

  return (
    <div className="min-h-[100dvh] grid lg:grid-cols-2">
      <PortalBrandPanel
        subtitle="Confirm your email to unlock BQI HR applications and secure account access."
        footerLabel="Secure Login"
      />

      <PortalAuthCard backHref="/login" backLabel="Back to login">
        <div className="space-y-7">
          <motion.div {...fadeUp(0.05)} className="space-y-2 text-center">
            <h1 className="text-[1.75rem] font-semibold leading-tight tracking-[-0.025em] text-[#1d1d1f] sm:text-[2rem]">
              Verify Your Email
            </h1>
            <p className="text-[15px] leading-relaxed text-[#6e6e73]">
              Enter the 6-digit code sent to{" "}
              <span className="font-medium text-[#1d1d1f]">
                {email || "your email"}
              </span>
            </p>
          </motion.div>

          <form
            onSubmit={handleSubmit(onSubmit)}
            className="portal-auth-form space-y-4"
          >
            <motion.div {...fadeUp(0.1)} className="space-y-2">
              <Controller
                name="code"
                control={control}
                render={({ field: { ref, ...field } }) => (
                  <OtpInput
                    {...field}
                    value={otp}
                    onChange={(value) => {
                      field.onChange(value);
                      handleInputChange(value);
                    }}
                    numInputs={6}
                    renderInput={(props) => (
                      <input
                        {...props}
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        className={otpInputClass}
                        disabled={status === "loading"}
                      />
                    )}
                    containerStyle="flex justify-center gap-2 sm:gap-3"
                    inputType="tel"
                    shouldAutoFocus
                  />
                )}
              />
              {errors.code && (
                <p className="text-center text-sm text-red-500">
                  {errors.code.message}
                </p>
              )}
            </motion.div>

            <motion.div {...fadeUp(0.16)}>
              <Button
                type="submit"
                className={portalAuthButtonClass}
                disabled={status === "loading" || otp.length !== 6}
              >
                {status === "loading" ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : status === "success" ? (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Verified
                  </>
                ) : status === "error" ? (
                  <>
                    <XCircle className="mr-2 h-4 w-4" />
                    Try Again
                  </>
                ) : (
                  "Verify Email"
                )}
              </Button>
            </motion.div>
          </form>

          <motion.div
            {...fadeUp(0.22)}
            className="text-center text-sm text-[#6e6e73]"
          >
            Didn&apos;t receive the code?{" "}
            <button
              type="button"
              className={cn(
                portalAuthLinkClass,
                "disabled:pointer-events-none disabled:opacity-50"
              )}
              onClick={handleResendCode}
              disabled={status === "loading"}
            >
              {status === "loading" ? "Sending..." : "Resend code"}
            </button>
          </motion.div>
        </div>
      </PortalAuthCard>
    </div>
  );
}
