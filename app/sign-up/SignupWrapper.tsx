"use client";

import { ChevronLeft, Zap } from "lucide-react";
import { SignupForm } from "@/components/auth/signup-form";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SignupWrapper() {
  const { register } = useAuth();
  const router = useRouter();

  const handleSignup = async (
    email: string,
    password: string,
    name: string
  ) => {
    try {
      await register(email, password, name);
      toast.success("Account created successfully! Please verify your email.");
      if (typeof window !== "undefined") {
        const normalized = email.trim().toLowerCase();
        localStorage.setItem("verification_email", normalized);
        // Pre-mark verification as sent to prevent auto-resend on the verify page
        localStorage.setItem(`verification_auto_sent_${normalized}`, "true");
        localStorage.setItem(`verification_last_send_time_${normalized}`, Date.now().toString());
      }
      router.push(`/auth/verify-email?email=${encodeURIComponent(email)}&sent=1`);
    } catch (error: any) {
      const message = (error?.message || "").toLowerCase();
      const requiresVerification =
        message.includes("verify") || message.includes("verification");
      const alreadyRegistered = message.includes("email already registered");
      const rateLimited =
        message.includes("rate limit exceeded") ||
        message.includes("too many requests") ||
        message.includes("429");
      if (requiresVerification) {
        toast.success(
          "Account created successfully! Please verify your email."
        );
        if (typeof window !== "undefined") {
          const normalized = email.trim().toLowerCase();
          localStorage.setItem("verification_email", normalized);
          localStorage.setItem(`verification_auto_sent_${normalized}`, "true");
          localStorage.setItem(`verification_last_send_time_${normalized}`, Date.now().toString());
        }
        router.push(`/auth/verify-email?email=${encodeURIComponent(email)}&sent=1`);
        return;
      }
      if (alreadyRegistered) {
        toast.error(
          "Email already registered. Please sign in or use a different email."
        );
        return;
      }
      if (rateLimited) {
        toast.error(
          "Too many attempts. Please wait a minute before trying again."
        );
        return;
      }
      toast.error(error?.message || "Failed to create account");
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left Panel - Gradient Background */}
      <div className="hidden lg:block relative bg-gradient-to-br from-[#31CDFF] to-blue-600">
        <div className="absolute inset-0 pattern-dots pattern-blue-500 pattern-bg-transparent pattern-opacity-20 pattern-size-4" />
        <div className="relative h-full flex flex-col justify-between p-12 text-white">
          <Zap className="w-12 h-12" />
          <div className="space-y-4">
            <h2 className="text-4xl font-bold">BQI Tech Portal</h2>
            <p className="text-lg opacity-90">Join our innovative platform</p>
          </div>
          <div className="flex gap-4 opacity-75">
            <span className="text-sm">v2.4.0</span>
            <span className="text-sm">•</span>
            <span className="text-sm">Secure Registration</span>
          </div>
        </div>
      </div>

      {/* Right Panel - Signup Form */}
      <div className="flex items-center justify-center p-8 bg-background">
        <div className="relative z-10 bg-background p-8 rounded-lg shadow-2xl w-full max-w-md">
          <div className="mb-4">
            <Link
              href="/"
              className="flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back to Home
            </Link>
          </div>
          <SignupForm onSignup={handleSignup} />
        </div>
      </div>
    </div>
  );
}
