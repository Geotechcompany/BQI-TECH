"use client";

import { useAuth } from "@/contexts/AuthContext";
import {
  fetchAdminLoginDirectory,
  getLoginToastFromError,
  type AdminLoginDirectoryAccount,
} from "@/lib/auth-backend";
import { motion, useReducedMotion } from "framer-motion";
import {
  Loader2,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  Activity,
  Database,
  ChevronsUpDown,
} from "lucide-react";
import { AdminLoginBrand } from "@/components/admin/AdminLoginBrand";
import { PremiumDashboardLoader } from "@/components/admin/PremiumDashboardLoader";
import { AdminTwoFactorChallenge } from "@/components/admin/auth/AdminTwoFactorChallenge";
import { AdminTwoFactorSetup } from "@/components/admin/auth/AdminTwoFactorSetup";
import { PortalAudienceSwitcher } from "@/components/auth/PortalAudienceSwitcher";
import { PortalBrandPanel } from "@/components/auth/PortalBrandPanel";
import { InstallPwaButton } from "@/components/pwa/InstallPwaButton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { markPostLoginLoader } from "@/lib/post-login-loader";
import { fetchAdmin2faStatus } from "@/lib/admin-2fa";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { flushSync } from "react-dom";
import { useAdminPath } from "@/contexts/AdminPathContext";

const BRAND_PANEL_BACKGROUND =
  "linear-gradient(160deg, hsl(222 47% 11%) 0%, hsl(222 84% 6%) 100%)";
const BRAND_PANEL_GLOW =
  "radial-gradient(110% 90% at 0% 0%, hsl(var(--primary) / 0.55), transparent 55%), radial-gradient(95% 95% at 100% 100%, hsl(217 91% 60% / 0.22), transparent 55%)";
const FORM_MESH =
  "radial-gradient(60% 45% at 50% 0%, hsl(var(--primary) / 0.07), transparent 70%), radial-gradient(45% 40% at 100% 100%, hsl(var(--primary) / 0.05), transparent 70%)";

const OTHER_ACCOUNT_VALUE = "__other__";

type LoginFormValues = {
  email: string;
  password: string;
};

function accountInitials(name: string, email: string): string {
  const source = (name || email || "?").trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

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
  const { adminHref } = useAdminPath();
  const {
    login,
    completeAdmin2faLogin,
    isAuthenticated,
    isAdmin,
    authLoading,
    user,
    refreshUserProfile,
    applyAdmin2faStatus,
  } = useAuth();
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { isSubmitting },
  } = useForm<LoginFormValues>({
    defaultValues: { email: "", password: "" },
  });
  const [isLoading, setIsLoading] = useState(false);
  const [hasCheckedAuth, setHasCheckedAuth] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPostLoginLoader, setShowPostLoginLoader] = useState(false);
  const [directoryLoading, setDirectoryLoading] = useState(true);
  const [directoryEnabled, setDirectoryEnabled] = useState(false);
  const [adminAccounts, setAdminAccounts] = useState<
    AdminLoginDirectoryAccount[]
  >([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [useManualEmail, setUseManualEmail] = useState(false);
  const [challenge, setChallenge] = useState<{
    challenge_token: string;
    methods: Array<"email" | "totp" | "recovery">;
    email_hint?: string;
  } | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [setupRequired, setSetupRequired] = useState(true);
  const reduce = useReducedMotion();
  const emailValue = watch("email");
  const emailField = register("email", { required: true });

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
    let cancelled = false;

    const loadDirectory = async () => {
      setDirectoryLoading(true);
      const directory = await fetchAdminLoginDirectory();
      if (cancelled) return;

      setDirectoryEnabled(directory.enabled);
      setAdminAccounts(directory.accounts);
      setDirectoryLoading(false);

      if (directory.enabled && directory.accounts.length === 1) {
        const only = directory.accounts[0];
        setSelectedAccountId(only.id);
        setUseManualEmail(false);
        setValue("email", only.email, { shouldValidate: true });
      }
    };

    void loadDirectory();
    return () => {
      cancelled = true;
    };
  }, [setValue]);

  const goToDashboardWithLoader = () => {
    flushSync(() => {
      markPostLoginLoader();
      setShowPostLoginLoader(true);
      setNeedsSetup(false);
      setChallenge(null);
    });
    router.replace(adminHref("/manage/overview"));
  };

  const evaluateSetupGate = async () => {
    try {
      const status = await fetchAdmin2faStatus();
      // Block dashboard when unsatisfied; soft-prompt when policy is "prompt".
      if (!status.satisfied) {
        setNeedsSetup(true);
        setSetupRequired(true);
        return true;
      }
      if (status.prompt) {
        setNeedsSetup(true);
        setSetupRequired(false);
        return true;
      }
    } catch {
      if (user?.admin2faSatisfied === false) {
        setNeedsSetup(true);
        setSetupRequired(true);
        return true;
      }
    }
    return false;
  };

  useEffect(() => {
    if (!authLoading && !hasCheckedAuth) {
      setHasCheckedAuth(true);

      if (isAuthenticated && isAdmin) {
        void (async () => {
          const blocked = await evaluateSetupGate();
          if (blocked) return;
          toast.success("Already logged in!", {
            description: "Redirecting to dashboard...",
          });
          goToDashboardWithLoader();
        })();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isAuthenticated, isAdmin, hasCheckedAuth]);

  const onAccountSelect = (value: string) => {
    if (value === OTHER_ACCOUNT_VALUE) {
      setSelectedAccountId(OTHER_ACCOUNT_VALUE);
      setUseManualEmail(true);
      setValue("email", "", { shouldValidate: false });
      return;
    }

    const account = adminAccounts.find((entry) => entry.id === value);
    if (!account) return;

    setSelectedAccountId(account.id);
    setUseManualEmail(false);
    setValue("email", account.email, { shouldValidate: true });
  };

  const onSubmit = async (formValues: LoginFormValues) => {
    const email = formValues.email.trim();
    if (!email) {
      toast.error("Select an account", {
        description: useManualEmail
          ? "Enter the admin email address to continue."
          : "Choose an admin account from the list.",
      });
      return;
    }

    setIsLoading(true);
    try {
      const result = await login(email, formValues.password);

      if (result.kind === "challenge") {
        setChallenge({
          challenge_token: result.challenge_token,
          methods: result.methods,
          email_hint: result.email_hint || email,
        });
        setIsLoading(false);
        return;
      }

      if (result.requiresSetup) {
        setNeedsSetup(true);
        setSetupRequired(true);
        setIsLoading(false);
        return;
      }

      const blocked = await evaluateSetupGate();
      if (blocked) {
        setIsLoading(false);
        return;
      }

      toast.success("Welcome back!", {
        description: "Redirecting to dashboard...",
      });

      goToDashboardWithLoader();
    } catch (error) {
      console.error("Login error:", error);
      const { title, description } = getLoginToastFromError(error);
      toast.error(title, { description });
      setIsLoading(false);
    }
  };

  const handleChallengeVerified = async (tokens: {
    access_token: string;
    refresh_token: string;
    token_type?: string;
    user: any;
  }) => {
    await completeAdmin2faLogin(tokens);
    setChallenge(null);
    const blocked = await evaluateSetupGate();
    if (blocked) return;
    toast.success("Verified", { description: "Redirecting to dashboard..." });
    goToDashboardWithLoader();
  };

  const handleSetupComplete = async (result?: {
    recoveryCodes?: string[];
  }) => {
    const codes = (result?.recoveryCodes || []).filter(Boolean);
    if (codes.length > 0 && typeof window !== "undefined") {
      try {
        sessionStorage.setItem(
          "admin_2fa_recovery_codes",
          JSON.stringify(codes)
        );
      } catch {
        // Non-fatal — user can re-enroll recovery codes from settings later
      }
    }

    try {
      await refreshUserProfile();
      const status = await fetchAdmin2faStatus();
      if (!status.satisfied) {
        toast.error("Additional security factors are still required");
        setNeedsSetup(true);
        setSetupRequired(true);
        return;
      }
      applyAdmin2faStatus({
        satisfied: true,
        policy: status.policy,
        factors: status.factors,
        totpEnabled: status.totpEnabled,
        email2faEnabled: status.email2faEnabled,
        prompt: status.prompt,
      });
    } catch {
      // Enroll succeeded — unlock and proceed; backend still enforces policy.
      applyAdmin2faStatus({ satisfied: true, prompt: false });
    }
    toast.success("Security setup complete");
    goToDashboardWithLoader();
  };

  if (showPostLoginLoader || (authLoading && !challenge && !needsSetup)) {
    return <PremiumDashboardLoader />;
  }

  if (isAuthenticated && !isAdmin && !challenge && !needsSetup) {
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
  const showAccountPicker = directoryEnabled && !directoryLoading;
  const selectedAccount = adminAccounts.find(
    (account) => account.id === selectedAccountId
  );
  const showEmailTextField = !showAccountPicker || useManualEmail;
  const showMfaPanel = Boolean(challenge) || needsSetup;

  return (
    <div className="grid min-h-[100dvh] lg:grid-cols-[1.05fr_1fr]">
      <PortalBrandPanel variant="admin" />

      {/* Form panel — min-h matches PortalAuthCard so the card centers in the viewport */}
      <div className="relative flex min-h-[100dvh] items-center justify-center overflow-y-auto bg-background px-6 py-10 sm:px-10">
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: FORM_MESH }}
        />

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-10 my-auto w-full max-w-md"
        >
          <div className="rounded-3xl border border-border/60 bg-card/80 p-8 shadow-[0_24px_70px_-30px_hsl(222_47%_30%/0.35)] backdrop-blur-sm sm:p-10">
            {!showMfaPanel ? (
              <div className="mb-8 flex flex-col gap-4">
                <div className="lg:hidden">
                  <AdminLoginBrand size="md" showBadge={false} showCard={false} />
                </div>
                <PortalAudienceSwitcher active="admin" />
                <div className="space-y-1.5">
                  <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                    Admin login
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Sign in to manage your organization
                  </p>
                </div>
              </div>
            ) : (
              <div className="mb-6 lg:hidden">
                <AdminLoginBrand size="md" showBadge={false} showCard={false} />
              </div>
            )}

            {challenge ? (
              <AdminTwoFactorChallenge
                challengeToken={challenge.challenge_token}
                methods={challenge.methods}
                emailHint={challenge.email_hint}
                onVerified={handleChallengeVerified}
                onCancel={() => {
                  setChallenge(null);
                  setIsLoading(false);
                }}
              />
            ) : needsSetup ? (
              <AdminTwoFactorSetup
                policy={user?.admin2faPolicy || "require_one"}
                emailHint={user?.email}
                required={setupRequired}
                onComplete={(result) => void handleSetupComplete(result)}
                onSkip={
                  setupRequired
                    ? undefined
                    : () => {
                        goToDashboardWithLoader();
                      }
                }
              />
            ) : (
              <>
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
                <Label htmlFor={showEmailTextField ? "email" : "admin-account"}>
                  {showAccountPicker ? "Admin account" : "Email address"}
                </Label>

                {directoryLoading ? (
                  <div className="flex h-12 items-center gap-2 rounded-xl border border-border bg-background px-3.5 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading admin accounts…
                  </div>
                ) : null}

                {showAccountPicker ? (
                  <Select
                    value={selectedAccountId || undefined}
                    onValueChange={onAccountSelect}
                    disabled={isBusy}
                  >
                    <SelectTrigger
                      id="admin-account"
                      className="h-12 rounded-xl border-border bg-background px-3 text-left text-foreground [&>span]:line-clamp-none [&>span]:flex [&>span]:w-full [&>span]:items-center"
                    >
                      <SelectValue placeholder="Select an admin account">
                        {selectedAccount ? (
                          <span className="flex min-w-0 items-center gap-3">
                            <Avatar className="h-8 w-8 shrink-0">
                              {selectedAccount.avatarUrl ? (
                                <AvatarImage
                                  src={selectedAccount.avatarUrl}
                                  alt=""
                                />
                              ) : null}
                              <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
                                {accountInitials(
                                  selectedAccount.name,
                                  selectedAccount.email
                                )}
                              </AvatarFallback>
                            </Avatar>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium text-foreground">
                                {selectedAccount.name}
                              </span>
                              <span className="block truncate text-xs text-muted-foreground">
                                {selectedAccount.email}
                              </span>
                            </span>
                          </span>
                        ) : useManualEmail ? (
                          <span className="flex items-center gap-2 text-sm text-foreground">
                            <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
                            Other email…
                          </span>
                        ) : null}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {adminAccounts.length === 0 ? (
                        <div className="px-3 py-4 text-sm text-muted-foreground">
                          No admin accounts found in this environment.
                        </div>
                      ) : (
                        adminAccounts.map((account) => (
                          <SelectItem
                            key={account.id}
                            value={account.id}
                            className="rounded-lg py-2.5"
                          >
                            <span className="flex min-w-0 items-center gap-3">
                              <Avatar className="h-8 w-8 shrink-0">
                                {account.avatarUrl ? (
                                  <AvatarImage src={account.avatarUrl} alt="" />
                                ) : null}
                                <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
                                  {accountInitials(account.name, account.email)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-medium">
                                  {account.name}
                                </span>
                                <span className="block truncate text-xs text-muted-foreground">
                                  {account.email}
                                </span>
                              </span>
                            </span>
                          </SelectItem>
                        ))
                      )}
                      <SelectSeparator />
                      <SelectItem
                        value={OTHER_ACCOUNT_VALUE}
                        className="rounded-lg py-2.5"
                      >
                        Other email…
                      </SelectItem>
                    </SelectContent>
                  </Select>
                ) : null}

                {showEmailTextField && !directoryLoading ? (
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      name={emailField.name}
                      ref={emailField.ref}
                      onBlur={emailField.onBlur}
                      value={emailValue}
                      onChange={(event) =>
                        setValue("email", event.target.value, {
                          shouldValidate: true,
                        })
                      }
                      placeholder="you@bqitech.com"
                      autoComplete="email"
                      className="h-12 rounded-xl border-border bg-background pl-11 text-foreground placeholder:text-muted-foreground"
                    />
                  </div>
                ) : (
                  <input
                    type="hidden"
                    name={emailField.name}
                    ref={emailField.ref}
                    value={emailValue}
                    readOnly
                  />
                )}
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
              </>
            )}
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Protected admin access for BQI staff only.
          </p>
          <div className="mx-auto mt-4 max-w-xs">
            <InstallPwaButton tone="brand" />
          </div>
        </motion.div>
      </div>
    </div>
  );
}
