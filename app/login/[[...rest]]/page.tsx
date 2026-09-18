"use client";

import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import LoginWrapper from "../LoginWrapper";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle } from "lucide-react";
import {
  PremiumDashboardLoader,
  USER_LOADING_PHRASES,
} from "@/components/admin/PremiumDashboardLoader";
import { markPostLoginLoader } from "@/lib/post-login-loader";

export default function LoginPage() {
  const { isAuthenticated, authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo");
  const [showLogoutSuccess, setShowLogoutSuccess] = useState(false);
  const [showPasswordResetSuccess, setShowPasswordResetSuccess] =
    useState(false);
  const [showPostLoginLoader, setShowPostLoginLoader] = useState(false);
  const redirectedRef = useRef(false);

  useEffect(() => {
    if (searchParams.get("passwordReset") === "1") {
      setShowPasswordResetSuccess(true);
      setTimeout(() => setShowPasswordResetSuccess(false), 5000);
      router.replace("/login");
    }
  }, [searchParams, router]);

  useEffect(() => {
    const message = searchParams.get("message");
    if (message === "Successfully logged out") {
      setShowLogoutSuccess(true);
      setTimeout(() => setShowLogoutSuccess(false), 3000);
      router.replace("/login");
    }
  }, [searchParams, router]);

  useEffect(() => {
    if (authLoading || !isAuthenticated || redirectedRef.current) return;

    redirectedRef.current = true;
    const destination = redirectTo || "/dashboard";
    flushSync(() => {
      markPostLoginLoader();
      setShowPostLoginLoader(true);
    });
    router.replace(destination);
  }, [isAuthenticated, authLoading, redirectTo, router]);

  if (showPostLoginLoader || authLoading || isAuthenticated) {
    return <PremiumDashboardLoader phrases={USER_LOADING_PHRASES} />;
  }

  return (
    <div className="relative">
      {showLogoutSuccess && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-md px-4">
          <Alert className="shadow-lg">
            <CheckCircle className="h-4 w-4" />
            <AlertTitle>Success</AlertTitle>
            <AlertDescription>
              You have successfully logged out.
            </AlertDescription>
          </Alert>
        </div>
      )}
      {showPasswordResetSuccess && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-md px-4">
          <Alert className="shadow-lg border-emerald-200 bg-emerald-50">
            <CheckCircle className="h-4 w-4 text-emerald-600" />
            <AlertTitle>Password updated</AlertTitle>
            <AlertDescription>
              Your password was reset successfully. Sign in with your new
              password below.
            </AlertDescription>
          </Alert>
        </div>
      )}
      <LoginWrapper />
    </div>
  );
}
