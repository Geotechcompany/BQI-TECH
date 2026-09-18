"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import { toast } from "sonner";
import {
  ArrowUpRight,
  CheckCircle2,
  Loader2,
  Lock,
  Monitor,
  Moon,
  Sun,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/contexts/SettingsContext";
import { employeePortalApi, userApi } from "@/lib/api-backend";
import { markEmployeeSettingsSeen } from "@/lib/employee-quick-start";
import { resolveEmailVerified } from "@/lib/resolve-email-verified";
import type { Employee } from "@/types/employee";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { AdminSecurity2faCard } from "@/components/admin/settings/AdminSecurity2faCard";

const SPRING = { type: "spring" as const, bounce: 0, duration: 0.4 };

type PasswordForm = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

type UserSettings = {
  notifications: {
    email: boolean;
    push: boolean;
    jobAlerts: boolean;
    applicationUpdates: boolean;
    marketingEmails: boolean;
  };
  privacy: {
    profileVisibility: string;
    showActivity: boolean;
    showApplicationHistory: boolean;
  };
  preferences: {
    theme: string;
    language: string;
    timezone: string;
  };
};

const defaultSettings: UserSettings = {
  notifications: {
    email: true,
    push: true,
    jobAlerts: true,
    applicationUpdates: true,
    marketingEmails: false,
  },
  privacy: {
    profileVisibility: "public",
    showActivity: true,
    showApplicationHistory: true,
  },
  preferences: {
    theme: "light",
    language: "en",
    timezone: "UTC",
  },
};

const TIMEZONES = [
  "UTC",
  "Africa/Nairobi",
  "Africa/Kampala",
  "Africa/Lagos",
  "Europe/London",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Asia/Dubai",
  "Asia/Singapore",
] as const;

function mergeSettings(raw: Partial<UserSettings> | undefined): UserSettings {
  return {
    notifications: {
      ...defaultSettings.notifications,
      ...(raw?.notifications ?? {}),
    },
    privacy: {
      ...defaultSettings.privacy,
      ...(raw?.privacy ?? {}),
    },
    preferences: {
      ...defaultSettings.preferences,
      ...(raw?.preferences ?? {}),
    },
  };
}

function SettingsSection({
  id,
  title,
  description,
  children,
  "data-tour": dataTour,
}: {
  id: string;
  title: string;
  description: string;
  children: ReactNode;
  "data-tour"?: string;
}) {
  return (
    <section
      id={id}
      data-tour={dataTour}
      className="scroll-mt-24"
    >
      <div className="mb-3 px-0.5">
        <h2 className="text-sm font-semibold tracking-tight text-[#272156] dark:text-[#31CDFF]">
          {title}
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/90 shadow-[0_1px_0_hsl(0_0%_100%/0.04)_inset] backdrop-blur-sm">
        {children}
      </div>
    </section>
  );
}

function SettingsRow({
  label,
  description,
  children,
  className,
}: {
  label: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 px-4 py-3.5 sm:px-5",
        className
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description ? (
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground sm:text-sm">
            {description}
          </p>
        ) : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function ThemeChip({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Sun;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors active:scale-[0.97]",
        active
          ? "bg-[#272156] text-white shadow-sm"
          : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
      {label}
    </button>
  );
}

export default function EmployeeSettingsPage() {
  const reduceMotion = useReducedMotion();
  const { user } = useAuth();
  const {
    theme,
    updateTheme,
    sidebarCollapsed,
    updateSettings: updateChromeSettings,
  } = useSettings();

  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [resending, setResending] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<PasswordForm>();

  const newPassword = watch("newPassword");

  const { data: employee } = useQuery({
    queryKey: ["employee-portal-me"],
    queryFn: () => employeePortalApi.getMe() as Promise<Employee>,
    staleTime: 60_000,
  });

  useEffect(() => {
    markEmployeeSettingsSeen();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoadingSettings(true);
        const response = await userApi.getSettings();
        if (cancelled) return;
        const merged = mergeSettings(response?.settings);
        setSettings(merged);
        const apiTheme = merged.preferences.theme;
        if (
          apiTheme === "light" ||
          apiTheme === "dark" ||
          apiTheme === "system"
        ) {
          // Prefer stored theme; only apply API theme when local has no choice yet
          const localTheme = localStorage.getItem("theme");
          if (!localTheme) {
            updateTheme(apiTheme);
          }
        }
      } catch (error) {
        console.error("Failed to load settings:", error);
        if (!cancelled) {
          toast.error("Could not load your preferences");
        }
      } finally {
        if (!cancelled) setLoadingSettings(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once on mount
  }, []);

  const persistSettings = useCallback(async (next: UserSettings) => {
    setSavingPrefs(true);
    try {
      await userApi.updateSettings(next);
      setSettings(next);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not save preferences";
      toast.error(message);
      throw error;
    } finally {
      setSavingPrefs(false);
    }
  }, []);

  const patchNotifications = async (
    key: keyof UserSettings["notifications"],
    value: boolean
  ) => {
    const previous = settings;
    const next: UserSettings = {
      ...settings,
      notifications: { ...settings.notifications, [key]: value },
    };
    setSettings(next);
    try {
      await persistSettings(next);
      toast.success("Notification preference saved");
    } catch {
      setSettings(previous);
    }
  };

  const patchTimezone = async (timezone: string) => {
    const previous = settings;
    const next: UserSettings = {
      ...settings,
      preferences: { ...settings.preferences, timezone },
    };
    setSettings(next);
    try {
      await persistSettings(next);
      toast.success("Timezone saved");
    } catch {
      setSettings(previous);
    }
  };

  const handleThemeChange = async (
    nextTheme: "light" | "dark" | "system"
  ) => {
    updateTheme(nextTheme);
    if (loadingSettings) return;
    const next: UserSettings = {
      ...settings,
      preferences: { ...settings.preferences, theme: nextTheme },
    };
    setSettings(next);
    try {
      await persistSettings(next);
    } catch {
      // Theme already applied locally; API sync can retry later
    }
  };

  const onPasswordSubmit = async (data: PasswordForm) => {
    if (data.newPassword !== data.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setSavingPassword(true);
    try {
      await userApi.changePassword({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      toast.success("Password updated");
      reset();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not update password";
      toast.error(message);
    } finally {
      setSavingPassword(false);
    }
  };

  const handleResendVerification = async () => {
    setResending(true);
    try {
      await userApi.resendVerification();
      toast.success("Verification email sent");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Could not send verification email";
      toast.error(message);
    } finally {
      setResending(false);
    }
  };

  const email = employee?.email || user?.email || "";
  const displayEmail = email || "—";
  const displayName =
    employee?.displayName ||
    [employee?.firstName || user?.firstName, employee?.lastName || user?.lastName]
      .filter(Boolean)
      .join(" ") ||
    user?.name ||
    "—";
  const emailVerified = resolveEmailVerified(user?.isEmailVerified, false);

  return (
    <div className="mx-auto max-w-2xl pb-8">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={SPRING}
        className="mb-8"
      >
        <p className="text-sm text-muted-foreground">
          Account, security, and portal preferences for{" "}
          <span className="font-medium text-foreground">{displayName}</span>.
          {savingPrefs ? (
            <span className="ml-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Saving
            </span>
          ) : null}
        </p>
      </motion.div>

      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...SPRING, delay: reduceMotion ? 0 : 0.04 }}
        className="space-y-8"
      >
        {/* Account */}
        <SettingsSection
          id="employee-settings-account"
          data-tour="employee-settings-account"
          title="Account"
          description="Sign-in identity for this portal. Edit personal details on your profile."
        >
          {loadingSettings ? (
            <div className="space-y-3 p-5">
              <Skeleton className="h-10 w-full rounded-xl" />
              <Skeleton className="h-10 w-3/4 rounded-xl" />
            </div>
          ) : (
            <>
              <SettingsRow label="Name" description="From your employee record">
                <span className="max-w-[200px] truncate text-sm text-foreground sm:max-w-xs">
                  {displayName}
                </span>
              </SettingsRow>
              <div className="h-px bg-border/60" />
              <SettingsRow
                label="Work email"
                description="Read-only. Used to sign in."
              >
                <span className="max-w-[200px] truncate text-sm tabular-nums text-foreground sm:max-w-xs">
                  {displayEmail}
                </span>
              </SettingsRow>
              <div className="h-px bg-border/60" />
              <SettingsRow
                label="Email verification"
                description={
                  emailVerified
                    ? "Your account email is verified."
                    : "Verify to keep account recovery available."
                }
              >
                {emailVerified ? (
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-4 w-4" strokeWidth={1.75} />
                    Verified
                  </span>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 rounded-xl"
                    disabled={resending || !email}
                    onClick={() => void handleResendVerification()}
                  >
                    {resending ? (
                      <>
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        Sending…
                      </>
                    ) : (
                      "Resend email"
                    )}
                  </Button>
                )}
              </SettingsRow>
              <div className="h-px bg-border/60" />
              <div className="px-4 py-3.5 sm:px-5">
                <Link
                  href="/employee/profile"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-[#272156] transition-colors hover:text-[#31CDFF] dark:text-[#31CDFF]"
                >
                  Edit profile
                  <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.75} />
                </Link>
              </div>
            </>
          )}
        </SettingsSection>

        {/* Security */}
        <SettingsSection
          id="employee-settings-security"
          data-tour="employee-settings-password"
          title="Security"
          description="Update the password for your BQI login."
        >
          <form
            onSubmit={handleSubmit(onPasswordSubmit)}
            className="space-y-4 p-4 sm:p-5"
          >
            <div className="flex items-start gap-3 rounded-xl bg-[#272156]/[0.04] px-3 py-2.5 dark:bg-[#31CDFF]/10">
              <Lock
                className="mt-0.5 h-4 w-4 shrink-0 text-[#272156] dark:text-[#31CDFF]"
                strokeWidth={1.75}
              />
              <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
                Active device sessions cannot be listed here yet. Sign out from
                the header when you leave a shared computer.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current password</Label>
              <Input
                id="currentPassword"
                type="password"
                autoComplete="current-password"
                className="h-11 rounded-xl"
                {...register("currentPassword", { required: true })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">New password</Label>
              <Input
                id="newPassword"
                type="password"
                autoComplete="new-password"
                className="h-11 rounded-xl"
                {...register("newPassword", {
                  required: true,
                  minLength: {
                    value: 8,
                    message: "Use at least 8 characters",
                  },
                })}
              />
              {errors.newPassword?.message ? (
                <p className="text-xs text-destructive">
                  {errors.newPassword.message}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm new password</Label>
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                className="h-11 rounded-xl"
                {...register("confirmPassword", {
                  required: true,
                  validate: (value) =>
                    value === newPassword || "Passwords do not match",
                })}
              />
              {errors.confirmPassword?.message ? (
                <p className="text-xs text-destructive">
                  {errors.confirmPassword.message}
                </p>
              ) : null}
            </div>
            <Button
              type="submit"
              disabled={savingPassword}
              className="h-11 w-full rounded-xl bg-[#272156] font-semibold hover:bg-[#1f1a45] sm:w-auto sm:min-w-[160px]"
            >
              {savingPassword ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Update password"
              )}
            </Button>
          </form>
        </SettingsSection>

        <SettingsSection
          id="employee-settings-2fa"
          data-tour="employee-settings-2fa"
          title="Two-factor authentication"
          description="Protect your employee portal login with an authenticator app or email codes."
        >
          <div className="p-4 sm:p-5">
            <AdminSecurity2faCard canEditPolicy={false} />
          </div>
        </SettingsSection>

        {/* Notifications */}
        <SettingsSection
          id="employee-settings-notifications"
          data-tour="employee-settings-notifications"
          title="Notifications"
          description="Email preferences saved to your BQI account."
        >
          {loadingSettings ? (
            <div className="space-y-3 p-5">
              <Skeleton className="h-12 w-full rounded-xl" />
              <Skeleton className="h-12 w-full rounded-xl" />
            </div>
          ) : (
            <>
              <SettingsRow
                label="Email notifications"
                description="Account and portal messages by email"
              >
                <Switch
                  checked={settings.notifications.email}
                  disabled={savingPrefs}
                  onCheckedChange={(checked) =>
                    void patchNotifications("email", checked)
                  }
                  className="data-[state=checked]:bg-[#272156]"
                />
              </SettingsRow>
              <div className="h-px bg-border/60" />
              <SettingsRow
                label="Company updates"
                description="Occasional product and company email"
              >
                <Switch
                  checked={settings.notifications.marketingEmails}
                  disabled={savingPrefs}
                  onCheckedChange={(checked) =>
                    void patchNotifications("marketingEmails", checked)
                  }
                  className="data-[state=checked]:bg-[#272156]"
                />
              </SettingsRow>
            </>
          )}
        </SettingsSection>

        {/* Appearance */}
        <SettingsSection
          id="employee-settings-appearance"
          data-tour="employee-settings-appearance"
          title="Appearance"
          description="Theme applies across the employee portal."
        >
          <div className="space-y-1 px-4 py-4 sm:px-5">
            <p className="mb-2.5 text-sm font-medium">Theme</p>
            <div className="flex flex-wrap gap-2">
              <ThemeChip
                active={theme === "light"}
                onClick={() => void handleThemeChange("light")}
                icon={Sun}
                label="Light"
              />
              <ThemeChip
                active={theme === "dark"}
                onClick={() => void handleThemeChange("dark")}
                icon={Moon}
                label="Dark"
              />
              <ThemeChip
                active={theme === "system"}
                onClick={() => void handleThemeChange("system")}
                icon={Monitor}
                label="System"
              />
            </div>
          </div>
          <div className="h-px bg-border/60" />
          <SettingsRow
            label="Compact sidebar"
            description="Collapse the dual-rail navigation on desktop"
          >
            <Switch
              checked={sidebarCollapsed}
              onCheckedChange={(checked) =>
                void updateChromeSettings({ sidebarCollapsed: checked })
              }
              className="data-[state=checked]:bg-[#272156]"
            />
          </SettingsRow>
        </SettingsSection>

        {/* Portal preferences */}
        <SettingsSection
          id="employee-settings-portal"
          data-tour="employee-settings-portal"
          title="Portal preferences"
          description="Timezone is stored on your account. Leave calendars still use server defaults until wired."
        >
          {loadingSettings ? (
            <div className="p-5">
              <Skeleton className="h-11 w-full max-w-md rounded-xl" />
            </div>
          ) : (
            <div className="px-4 py-4 sm:px-5">
              <Label htmlFor="timezone" className="text-sm font-medium">
                Timezone
              </Label>
              <Select
                value={settings.preferences.timezone}
                onValueChange={(value) => void patchTimezone(value)}
                disabled={savingPrefs}
              >
                <SelectTrigger
                  id="timezone"
                  className="mt-2 h-11 max-w-md rounded-xl"
                >
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz} value={tz}>
                      {tz.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                  {!TIMEZONES.includes(
                    settings.preferences.timezone as (typeof TIMEZONES)[number]
                  ) && settings.preferences.timezone ? (
                    <SelectItem value={settings.preferences.timezone}>
                      {settings.preferences.timezone.replace(/_/g, " ")}
                    </SelectItem>
                  ) : null}
                </SelectContent>
              </Select>
            </div>
          )}
        </SettingsSection>
      </motion.div>
    </div>
  );
}
