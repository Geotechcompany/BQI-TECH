"use client";

import { LoginForm } from "@/components/LoginForm";
import { PortalAuthCard } from "@/components/auth/PortalAuthCard";
import { PortalBrandPanel } from "@/components/auth/PortalBrandPanel";
import { useAuth } from "@/contexts/AuthContext";
import { getLoginToastFromError } from "@/lib/auth-backend";
import { toast } from "sonner";

export default function LoginWrapper() {
  const { login } = useAuth();

  const handleLogin = async (email: string, password: string) => {
    try {
      await login(email, password);
    } catch (error: unknown) {
      throw error;
    }
  };

  const handleError = (error: unknown) => {
    const { title, description } = getLoginToastFromError(error);
    toast.error(title, { description });
  };

  return (
    <div className="min-h-[100dvh] grid lg:grid-cols-2">
      <PortalBrandPanel
        subtitle="Sign in to view your applications, manage your profile, and access your BQI Tech account."
        footerLabel="Secure Login"
      />

      <PortalAuthCard>
        <LoginForm onLogin={handleLogin} onError={handleError} />
      </PortalAuthCard>
    </div>
  );
}
