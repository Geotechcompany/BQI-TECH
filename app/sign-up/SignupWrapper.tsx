"use client";

import { SignupForm } from "@/components/auth/signup-form";
import { PortalAuthCard } from "@/components/auth/PortalAuthCard";
import { PortalBrandPanel } from "@/components/auth/PortalBrandPanel";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

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
        localStorage.setItem(
          `verification_last_send_time_${normalized}`,
          Date.now().toString()
        );
      }
      router.push(
        `/auth/verify-email?email=${encodeURIComponent(email)}&sent=1`
      );
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
          localStorage.setItem(
            `verification_last_send_time_${normalized}`,
            Date.now().toString()
          );
        }
        router.push(
          `/auth/verify-email?email=${encodeURIComponent(email)}&sent=1`
        );
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
    <div className="min-h-[100dvh] grid lg:grid-cols-2">
      <PortalBrandPanel
        subtitle="Create your BQI HR account to apply for roles and track your applications."
        footerLabel="Secure Registration"
      />

      <PortalAuthCard>
        <SignupForm onSignup={handleSignup} />
      </PortalAuthCard>
    </div>
  );
}
