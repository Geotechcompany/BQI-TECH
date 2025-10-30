"use client";

import { Suspense } from "react";
import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2, CheckCircle2, XCircle, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import OtpInput from "react-otp-input";
import { Controller } from "react-hook-form";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.3 } },
};

const childVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: { y: 0, opacity: 1 },
};

const otpSchema = z.object({
  code: z.string().length(6, "Code must be 6 digits"),
});

const initialState = "idle";

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
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-blue-500" />
            <p className="mt-4 text-lg text-muted-foreground">
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
  const { updateEmailVerificationStatus, authLoading, user, isAuthenticated } =
    useAuth();

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
        toast.error(error.message || "Failed to send verification email");
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
  }, [email, user?.isEmailVerified, hasAutoSentForEmail, markAutoSentForEmail]); // Include callback dependencies

  // Cleanup effect to reset flags on unmount
  useEffect(() => {
    return () => {
      isRequestInProgress.current = false;
    };
  }, []);

  // Auto-submit when OTP is complete (memoized to prevent unnecessary re-renders)
  const handleOtpSubmit = useCallback(() => {
    if (otp.length === 6 && !isVerifyingRef.current && status !== "loading") {
      handleSubmit(onSubmit)();
    }
  }, [otp, handleSubmit, onSubmit, status]);

  useEffect(() => {
    handleOtpSubmit();
  }, [handleOtpSubmit]);

  // Prevent rendering if authentication is loading or no email
  if (authLoading || !email) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-12 w-12 animate-spin text-blue-500" />
          <p className="mt-4 text-lg text-muted-foreground">
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
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left Panel - Gradient Background (Same as Login) */}
      <div className="hidden lg:block relative bg-gradient-to-br from-[#31CDFF] to-blue-600">
        <div className="absolute inset-0 pattern-dots pattern-blue-500 pattern-bg-transparent pattern-opacity-20 pattern-size-4" />
        <div className="relative h-full flex flex-col justify-between p-12 text-white">
          <Zap className="w-12 h-12" />
          <div className="space-y-4">
            <h2 className="text-4xl font-bold">BQI Tech Portal</h2>
            <p className="text-lg opacity-90">
              Empowering innovation through secure access
            </p>
          </div>
          <div className="flex gap-4 opacity-75">
            <span className="text-sm">v2.4.0</span>
            <span className="text-sm">•</span>
            <span className="text-sm">Secure Verification</span>
          </div>
        </div>
      </div>

      {/* Right Panel - Adjusted for mobile */}
      <div className="flex items-center justify-center p-8 bg-background sm:px-4">
        <div className="relative z-10 bg-background p-8 rounded-lg shadow-2xl w-full max-w-[90%] sm:max-w-md">
          <Card className="w-full">
            <CardHeader className="text-center space-y-2">
              <h1 className="text-3xl sm:text-2xl font-bold">
                Verify Your Email
              </h1>
              <p className="text-muted-foreground text-sm sm:text-base">
                Enter the 6-digit code sent to <br className="sm:hidden" />
                {email || "your email"}
              </p>
            </CardHeader>

            <CardContent>
              <motion.form
                onSubmit={handleSubmit(onSubmit)}
                variants={childVariants}
                className="space-y-6"
              >
                <div className="space-y-2">
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
                            className="!w-10 h-12 sm:!w-12 sm:h-14 text-center border rounded-md 
                                     focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg sm:text-xl"
                            disabled={status === "loading"}
                          />
                        )}
                        containerStyle="flex justify-center gap-2 sm:gap-4"
                        inputType="number"
                        shouldAutoFocus
                      />
                    )}
                  />
                  {errors.code && (
                    <p className="text-sm text-destructive text-center">
                      {errors.code.message}
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 text-sm sm:text-base"
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
                  ) : null}
                </Button>
              </motion.form>
            </CardContent>

            <CardFooter className="flex justify-center">
              <p className="text-sm text-muted-foreground text-center">
                Didn't receive the code?{" "}
                <Button
                  variant="link"
                  className="h-auto p-0 text-blue-600 whitespace-nowrap"
                  onClick={handleResendCode}
                  disabled={status === "loading"}
                >
                  {status === "loading" ? "Sending..." : "Resend code"}
                </Button>
              </p>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
