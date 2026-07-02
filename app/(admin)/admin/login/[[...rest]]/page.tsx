"use client";

import { useAuth } from "@/contexts/AuthContext";
import { getLoginToastFromError } from "@/lib/auth-backend";
import { motion, useReducedMotion } from "framer-motion";
import {
  Loader2,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  BarChart3,
  Users2,
  Activity,
  Database,
} from "lucide-react";
import { AdminLoginBrand } from "@/components/admin/AdminLoginBrand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useState, useEffect } from "react";

const BRAND_PANEL_BACKGROUND =
  "linear-gradient(160deg, hsl(222 47% 11%) 0%, hsl(222 84% 6%) 100%)";
const BRAND_PANEL_GLOW =
  "radial-gradient(110% 90% at 0% 0%, hsl(var(--primary) / 0.55), transparent 55%), radial-gradient(95% 95% at 100% 100%, hsl(217 91% 60% / 0.22), transparent 55%)";
const FORM_MESH =
  "radial-gradient(60% 45% at 50% 0%, hsl(var(--primary) / 0.07), transparent 70%), radial-gradient(45% 40% at 100% 100%, hsl(var(--primary) / 0.05), transparent 70%)";

const TechLoadingScreen = ({ message = "Loading..." }) => {
  const reduce = useReducedMotion();
  const [systemStatus, setSystemStatus] = useState({
    systemOnline: false,
    secureConnection: false,
    databaseReady: false,
    isChecking: true,
  });

  useEffect(() => {
    checkSystemStatus();
  }, []);

  const checkSystemStatus = async () => {
    setSystemStatus((prev) => ({ ...prev, isChecking: true }));

    try {
      const healthResponse = await fetch("/api/health", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      const systemOnline = healthResponse.ok;

      const secureConnection =
        window.location.protocol === "https:" ||
        window.location.hostname === "localhost";

      let databaseReady = false;
      try {
        const backendUrl =
          process.env.NEXT_PUBLIC_PYTHON_API_URL || "http://localhost:8000";
        const dbResponse = await fetch(`${backendUrl}/api/health`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });
        databaseReady = dbResponse.ok;
      } catch (error) {
        console.log("Backend health check failed:", error);
        databaseReady = false;
      }

      setSystemStatus({
        systemOnline,
        secureConnection,
        databaseReady,
        isChecking: false,
      });
    } catch (error) {
      console.error("System status check failed:", error);
      setSystemStatus({
        systemOnline: false,
        secureConnection:
          window.location.protocol === "https:" ||
          window.location.hostname === "localhost",
        databaseReady: false,
        isChecking: false,
      });
    }
  };

  const statusItems = [
    {
      icon: Activity,
      label: "System",
      checking: systemStatus.isChecking,
      ok: systemStatus.systemOnline,
      okText: "Online",
      failText: "Offline",
    },
    {
      icon: ShieldCheck,
      label: "Connection",
      checking: false,
      ok: systemStatus.secureConnection,
      okText: "Secure",
      failText: "Insecure",
    },
    {
      icon: Database,
      label: "Database",
      checking: systemStatus.isChecking,
      ok: systemStatus.databaseReady,
      okText: "Ready",
      failText: "Offline",
    },
  ];

  return (
    <div
      className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden px-6 text-white"
      style={{ background: BRAND_PANEL_BACKGROUND }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: BRAND_PANEL_GLOW }}
      />
      <div className="pointer-events-none absolute inset-0 text-white/[0.06] pattern-dots" />

      <motion.div
        initial={reduce ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-sm space-y-8 text-center"
      >
        <div className="flex justify-center">
          <AdminLoginBrand
            variant="dark"
            size="lg"
            showBadge={false}
            showCard={false}
            className="justify-center"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-center gap-2 text-white/90">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm font-medium">{message}</span>
          </div>
          <p className="text-xs text-white/50">
            Preparing your secure admin workspace
          </p>
        </div>

        <div className="mx-auto h-1 w-full max-w-xs overflow-hidden rounded-full bg-white/10">
          {reduce ? (
            <div className="h-full w-2/5 rounded-full bg-gradient-to-r from-primary to-blue-400" />
          ) : (
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-primary to-blue-400"
              initial={{ x: "-100%" }}
              animate={{ x: "100%" }}
              transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
              style={{ width: "60%" }}
            />
          )}
        </div>

        <div className="space-y-1 rounded-2xl border border-white/10 bg-white/[0.04] p-2 text-left">
          {statusItems.map((item) => {
            const Icon = item.icon;
            const tone = item.checking
              ? "text-amber-300"
              : item.ok
                ? "text-emerald-300"
                : "text-rose-300";
            return (
              <div
                key={item.label}
                className="flex items-center justify-between rounded-xl px-3 py-2"
              >
                <span className="flex items-center gap-2.5 text-sm text-white/70">
                  <Icon className="h-4 w-4 text-white/50" />
                  {item.label}
                </span>
                <span className={`text-xs font-medium ${tone}`}>
                  {item.checking
                    ? "Checking"
                    : item.ok
                      ? item.okText
                      : item.failText}
                </span>
              </div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
};

export default function AdminLoginPage() {
  const router = useRouter();
  const { login, isAuthenticated, isAdmin, authLoading, user } = useAuth();
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm();
  const [isLoading, setIsLoading] = useState(false);
  const [hasCheckedAuth, setHasCheckedAuth] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const reduce = useReducedMotion();

  useEffect(() => {
    console.log("Auth State Debug:", {
      authLoading,
      isAuthenticated,
      isAdmin,
      user,
      userRole: user?.role,
      hasCheckedAuth,
    });
  }, [authLoading, isAuthenticated, isAdmin, user, hasCheckedAuth]);

  useEffect(() => {
    if (!authLoading && !hasCheckedAuth) {
      setHasCheckedAuth(true);

      if (isAuthenticated && isAdmin) {
        console.log("Already authenticated admin user, redirecting to overview");
        toast.success("Already logged in!", {
          description: "Redirecting to dashboard...",
        });

        setTimeout(() => {
          window.location.href = "/admin/overview";
        }, 1000);
      }
    }
  }, [authLoading, isAuthenticated, isAdmin, hasCheckedAuth]);

  const onSubmit = async (data) => {
    setIsLoading(true);
    try {
      console.log("Attempting login...");
      await login(data.email, data.password);

      console.log("Login successful, redirecting...");

      toast.success("Welcome back!", {
        description: "Redirecting to dashboard...",
      });

      setTimeout(() => {
        console.log("Performing post-login redirect...");
        window.location.href = "/admin/overview";
      }, 500);
    } catch (error) {
      console.error("Login error:", error);
      const { title, description } = getLoginToastFromError(error);
      toast.error(title, { description });
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading) {
    return <TechLoadingScreen message="Initializing System..." />;
  }

  if (isAuthenticated && isAdmin) {
    return <TechLoadingScreen message="Already logged in! Redirecting..." />;
  }

  if (isAuthenticated && !isAdmin) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background px-6">
        <div className="w-full max-w-md rounded-3xl border border-border/60 bg-card p-8 text-center shadow-[0_24px_70px_-30px_hsl(222_47%_30%/0.35)] sm:p-10">
          <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">Access denied</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            You don&apos;t have admin privileges to access this area.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Current role: {user?.role || "Unknown"}
          </p>
          <Button
            onClick={() => (window.location.href = "/dashboard")}
            className="mt-6 h-12 w-full rounded-xl text-base font-semibold"
          >
            Go to user dashboard
          </Button>
        </div>
      </div>
    );
  }

  const isBusy = isLoading || isSubmitting;

  return (
    <div className="grid min-h-[100dvh] lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel - desktop only */}
      <div className="relative hidden overflow-hidden bg-[hsl(222_84%_6%)] p-12 text-white lg:flex lg:flex-col xl:p-16">
        <img
          src="/images/admin-login-cover.png"
          alt="Modern BQI workspace with desk, monitor, and wall art"
          loading="eager"
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/40" />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(90% 80% at 0% 0%, hsl(var(--primary) / 0.35), transparent 60%)",
          }}
        />

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-10 flex h-full flex-col justify-between gap-12"
        >
          <AdminLoginBrand
            variant="dark"
            size="lg"
            showBadge={false}
            showCard={false}
          />

          <div className="space-y-5">
            <h1 className="max-w-md text-3xl font-semibold leading-tight tracking-tight xl:text-4xl">
              Your organization, under one secure console.
            </h1>
            <p className="max-w-md text-base leading-relaxed text-white/70">
              Sign in to manage teams, hiring, and operations from one admin
              workspace.
            </p>
          </div>

          <ul className="space-y-4">
            {[
              { icon: ShieldCheck, text: "Role-based, secure admin access" },
              { icon: BarChart3, text: "Live hiring and team insights" },
              { icon: Users2, text: "Built for the whole BQI organization" },
            ].map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 ring-1 ring-inset ring-white/15">
                  <Icon className="h-4 w-4 text-white" />
                </span>
                <span className="text-sm text-white/80">{text}</span>
              </li>
            ))}
          </ul>
        </motion.div>
      </div>

      {/* Form panel */}
      <div className="relative flex items-center justify-center overflow-y-auto bg-background px-6 py-10 sm:px-10">
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: FORM_MESH }}
        />

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-10 w-full max-w-md"
        >
          <div className="rounded-3xl border border-border/60 bg-card/80 p-8 shadow-[0_24px_70px_-30px_hsl(222_47%_30%/0.35)] backdrop-blur-sm sm:p-10">
            <div className="mb-8 flex flex-col gap-4">
              <div className="lg:hidden">
                <AdminLoginBrand size="md" showBadge={false} showCard={false} />
              </div>
              <div className="space-y-1.5">
                <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                  Admin login
                </h2>
                <p className="text-sm text-muted-foreground">
                  Sign in to manage your organization
                </p>
              </div>
            </div>

            <style>{`
              .auth-form input:-webkit-autofill,
              .auth-form input:-webkit-autofill:hover,
              .auth-form input:-webkit-autofill:focus {
                -webkit-text-fill-color: hsl(var(--foreground));
                -webkit-box-shadow: 0 0 0 1000px hsl(var(--background)) inset;
                box-shadow: 0 0 0 1000px hsl(var(--background)) inset;
                caret-color: hsl(var(--foreground));
                border-color: hsl(var(--border));
                transition: background-color 9999s ease-in-out 0s;
              }
            `}</style>
            <form onSubmit={handleSubmit(onSubmit)} className="auth-form space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">Email address</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    {...register("email", { required: true })}
                    placeholder="you@bqitech.com"
                    autoComplete="email"
                    className="h-12 rounded-xl border-border bg-background pl-11 text-foreground placeholder:text-muted-foreground"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    {...register("password", { required: true })}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    className="h-12 rounded-xl border-border bg-background pl-11 pr-11 text-foreground placeholder:text-muted-foreground"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                className="group h-12 w-full rounded-xl text-base font-semibold shadow-lg shadow-primary/25 transition-all hover:shadow-primary/30 active:scale-[0.99]"
                disabled={isBusy}
              >
                {isBusy ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Authenticating...
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

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Protected admin access for BQI staff only.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
