"use client";

import { useEffect, useState, type ReactNode } from "react";
import { userApi } from "@/lib/api-backend";
import { resolveEmailVerified } from "@/lib/resolve-email-verified";
import { toast } from "react-hot-toast";
import { useAuth } from "@/contexts/AuthContext";
import { FormSkeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  CheckCircle,
  XCircle,
  Mail,
  Camera,
  User,
  Lock,
  Bell,
  Shield,
  SlidersHorizontal,
  type LucideIcon,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AdminSecurity2faCard } from "@/components/admin/settings/AdminSecurity2faCard";
import { z } from "zod";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TourPageHelper } from "@/components/admin/tour/TourPageHelper";
import { cn } from "@/lib/utils";

interface UserSettings {
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
}

interface UserProfile {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  isEmailVerified: boolean;
  avatar?: string;
}

type SettingsSection =
  | "profile"
  | "security"
  | "notifications"
  | "privacy"
  | "preferences";

const NAV_ITEMS: {
  id: SettingsSection;
  label: string;
  description: string;
  icon: LucideIcon;
}[] = [
  {
    id: "profile",
    label: "Profile",
    description: "Name, photo & contact",
    icon: User,
  },
  {
    id: "security",
    label: "Security",
    description: "Password & access",
    icon: Lock,
  },
  {
    id: "notifications",
    label: "Notifications",
    description: "Email & push alerts",
    icon: Bell,
  },
  {
    id: "privacy",
    label: "Privacy",
    description: "Visibility & activity",
    icon: Shield,
  },
  {
    id: "preferences",
    label: "Preferences",
    description: "Theme, language & time",
    icon: SlidersHorizontal,
  },
];

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

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(8, "Password must be at least 8 characters"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

function SettingsToggleRow({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-muted/30 px-4 py-3.5 transition-colors hover:bg-muted/50">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-none">{label}</p>
        <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function SettingsField({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label className="text-sm font-medium">{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function SettingsPanel({
  title,
  description,
  children,
  badge,
  id,
  "data-tour": dataTour,
}: {
  title: string;
  description: string;
  children: ReactNode;
  badge?: ReactNode;
  id?: string;
  "data-tour"?: string;
}) {
  return (
    <Card
      id={id}
      data-tour={dataTour}
      className="scroll-mt-28 overflow-hidden border-border/60 shadow-sm"
    >
      <CardHeader className="border-b border-border/40 bg-muted/20 pb-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-lg font-semibold tracking-tight">
              {title}
            </CardTitle>
            <CardDescription className="text-sm">{description}</CardDescription>
          </div>
          {badge}
        </div>
      </CardHeader>
      <CardContent className="space-y-6 p-6">{children}</CardContent>
    </Card>
  );
}

export default function SettingsPage() {
  const { user, updateUserAvatar } = useAuth();
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [profile, setProfile] = useState<UserProfile>({
    firstName: user?.firstName || "",
    lastName: user?.lastName || "",
    email: user?.email || "",
    phone: "",
    isEmailVerified: resolveEmailVerified(user?.isEmailVerified, false),
    avatar: user?.avatar || "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>(
    {}
  );
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [activeSection, setActiveSection] =
    useState<SettingsSection>("profile");

  useEffect(() => {
    loadSettings();
    loadProfile();
  }, []);

  const loadSettings = async () => {
    try {
      setIsLoading(true);
      const response = await userApi.getSettings();
      if (response?.settings) {
        setSettings(response.settings);
      }
    } catch (error) {
      console.error("Failed to load settings:", error);
      toast.error("Failed to load settings");
    } finally {
      setIsLoading(false);
    }
  };

  const loadProfile = async () => {
    try {
      const response = await userApi.getProfile();
      if (response) {
        const looksEncrypted =
          response.encrypted === true ||
          (typeof response.payload === "string" && !response.email);
        if (looksEncrypted) {
          // Keep session-backed verification rather than treating opaque payload as unverified
          setProfile((prev) => ({
            ...prev,
            firstName: user?.firstName || prev.firstName || "",
            lastName: user?.lastName || prev.lastName || "",
            email: user?.email || prev.email || "",
            isEmailVerified: resolveEmailVerified(
              user?.isEmailVerified,
              prev.isEmailVerified
            ),
            avatar: user?.avatar || prev.avatar || "",
          }));
          return;
        }
        setProfile({
          firstName: response.firstName || user?.firstName || "",
          lastName: response.lastName || user?.lastName || "",
          email: response.email || user?.email || "",
          phone: response.phone || "",
          isEmailVerified: resolveEmailVerified(
            response.isEmailVerified,
            resolveEmailVerified(user?.isEmailVerified, false)
          ),
          avatar: response.avatar || user?.avatar || "",
        });
      }
    } catch (error) {
      console.error("Failed to load profile:", error);
      toast.error("Failed to load profile");
    }
  };

  const handleSaveSettings = async () => {
    if (isSaving) return;
    setIsSaving(true);

    try {
      await userApi.updateSettings(settings);
      toast.success("Settings saved successfully");
    } catch (error) {
      console.error("Save error:", error);
      toast.error("Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveProfile = async () => {
    if (isSaving) return;
    setIsSaving(true);

    try {
      const { isEmailVerified: _ignored, ...profileUpdate } = profile;
      await userApi.updateProfile(profileUpdate);
      toast.success("Profile updated successfully");
    } catch (error) {
      console.error("Profile update error:", error);
      toast.error("Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async () => {
    try {
      setIsChangingPassword(true);
      setPasswordErrors({});

      const validatedData = passwordSchema.parse(passwordData);
      await userApi.changePassword({
        currentPassword: validatedData.currentPassword,
        newPassword: validatedData.newPassword,
      });

      toast.success("Password changed successfully");
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            errors[err.path[0].toString()] = err.message;
          }
        });
        setPasswordErrors(errors);
      } else {
        toast.error("Failed to change password");
      }
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleResendVerification = async () => {
    try {
      await userApi.resendVerification();
      toast.success("Verification email sent successfully");
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to send verification email";
      toast.error(message);
    }
  };

  const handleAvatarUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const validTypes = ["image/jpeg", "image/png", "image/gif"];
    if (!validTypes.includes(file.type)) {
      toast.error("Please upload a valid image file (JPEG, PNG, or GIF)");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size should be less than 5MB");
      return;
    }

    setIsUploadingAvatar(true);

    try {
      const response = await userApi.uploadAvatar(file);

      setProfile((prev) => ({
        ...prev,
        avatar: response.url,
      }));

      updateUserAvatar(response.url);

      toast.success("Profile photo updated successfully!");
    } catch (error) {
      console.error("Avatar upload error:", error);
      toast.error("Failed to upload profile photo. Please try again.");
    } finally {
      setIsUploadingAvatar(false);
      event.target.value = "";
    }
  };

  const scrollToSection = (section: SettingsSection) => {
    setActiveSection(section);
    const el = document.getElementById(`user-settings-${section}`);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const displayName =
    [profile.firstName, profile.lastName].filter(Boolean).join(" ") ||
    user?.email ||
    "Your profile";
  const initials =
    `${profile.firstName?.[0] || ""}${profile.lastName?.[0] || ""}`.toUpperCase() ||
    "U";

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl space-y-8 p-4 sm:p-6">
        <FormSkeleton />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-4 sm:p-6">
      <TourPageHelper tourId="user-settings" />

      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
        <div className="absolute inset-0 bg-gradient-to-br from-[#272156]/[0.07] via-transparent to-[#31CDFF]/[0.04]" />
        <div className="relative flex flex-col items-center gap-6 p-6 md:flex-row md:p-8">
          <div className="group relative shrink-0">
            <Avatar className="h-28 w-28 ring-4 ring-background shadow-lg md:h-32 md:w-32">
              <AvatarImage
                src={profile.avatar}
                alt={displayName}
                className="object-cover"
              />
              <AvatarFallback className="text-xl font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <label
              htmlFor="avatarUpload"
              className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity group-hover:opacity-100"
            >
              {isUploadingAvatar ? (
                <Loader2 className="h-7 w-7 animate-spin text-white" />
              ) : (
                <Camera className="h-7 w-7 text-white" />
              )}
            </label>
            <input
              id="avatarUpload"
              type="file"
              accept="image/jpeg,image/png,image/gif"
              className="hidden"
              onChange={handleAvatarUpload}
              disabled={isUploadingAvatar}
            />
          </div>

          <div className="flex-1 space-y-3 text-center md:text-left">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
                {displayName}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground md:text-base">
                {profile.email}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 md:justify-start">
              {profile.isEmailVerified ? (
                <Badge variant="secondary" className="gap-1">
                  <CheckCircle className="h-3 w-3" />
                  Verified
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="gap-1 border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400"
                >
                  <XCircle className="h-3 w-3" />
                  Unverified
                </Badge>
              )}
              <Badge variant="outline">Account settings</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Hover your photo to upload a new image (JPEG, PNG, or GIF · max
              5MB).
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[240px_minmax(0,1fr)]">
        <nav className="lg:sticky lg:top-24 lg:self-start">
          <p className="mb-3 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Sections
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => scrollToSection(item.id)}
                  className={cn(
                    "flex min-w-[200px] shrink-0 items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-all lg:min-w-0 lg:w-full",
                    isActive
                      ? "border-[#272156]/30 bg-[#272156]/10 text-[#272156] shadow-sm dark:border-[#31CDFF]/30 dark:bg-[#31CDFF]/10 dark:text-[#31CDFF]"
                      : "border-transparent bg-muted/30 text-muted-foreground hover:border-border/60 hover:bg-muted/50 hover:text-foreground"
                  )}
                >
                  <div
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                      isActive
                        ? "bg-[#272156]/15 dark:bg-[#31CDFF]/15"
                        : "bg-background"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-none">
                      {item.label}
                    </p>
                    <p className="mt-1 truncate text-xs opacity-80">
                      {item.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </nav>

        <div className="min-w-0 space-y-6">
          <SettingsPanel
            id="user-settings-profile"
            data-tour="user-settings-profile"
            title="Profile information"
            description="Update the details recruiters and hiring teams see on your applications."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <SettingsField label="First name">
                <Input
                  id="firstName"
                  value={profile.firstName}
                  onChange={(e) =>
                    setProfile((prev) => ({
                      ...prev,
                      firstName: e.target.value,
                    }))
                  }
                />
              </SettingsField>
              <SettingsField label="Last name">
                <Input
                  id="lastName"
                  value={profile.lastName}
                  onChange={(e) =>
                    setProfile((prev) => ({
                      ...prev,
                      lastName: e.target.value,
                    }))
                  }
                />
              </SettingsField>
              <SettingsField
                label="Email"
                className="sm:col-span-2"
                hint={
                  profile.isEmailVerified
                    ? undefined
                    : "Verify your email to keep application alerts reliable."
                }
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Input
                    id="email"
                    value={profile.email}
                    onChange={(e) =>
                      setProfile((prev) => ({
                        ...prev,
                        email: e.target.value,
                      }))
                    }
                    className="flex-1"
                  />
                  {profile.isEmailVerified ? (
                    <div className="flex shrink-0 items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                      <CheckCircle className="h-4 w-4" />
                      <span className="text-sm font-medium">Verified</span>
                    </div>
                  ) : (
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                        <XCircle className="h-4 w-4" />
                        <span className="text-sm font-medium">Unverified</span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleResendVerification}
                      >
                        <Mail className="mr-1.5 h-4 w-4" />
                        Resend
                      </Button>
                    </div>
                  )}
                </div>
              </SettingsField>
              <SettingsField
                label="Phone number"
                className="sm:col-span-2"
                hint="Optional. Used for interview scheduling when needed."
              >
                <Input
                  id="phone"
                  value={profile.phone || ""}
                  onChange={(e) =>
                    setProfile((prev) => ({
                      ...prev,
                      phone: e.target.value,
                    }))
                  }
                  placeholder="Optional"
                />
              </SettingsField>
            </div>

            <div className="flex justify-end border-t border-border/40 pt-4">
              <Button onClick={handleSaveProfile} disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Save profile"
                )}
              </Button>
            </div>
          </SettingsPanel>

          <SettingsPanel
            id="user-settings-security"
            data-tour="user-settings-password"
            title="Password"
            description="Change the password you use to sign in to your account."
          >
            <div className="grid max-w-xl gap-4">
              <SettingsField label="Current password">
                <Input
                  id="currentPassword"
                  type="password"
                  value={passwordData.currentPassword}
                  onChange={(e) =>
                    setPasswordData((prev) => ({
                      ...prev,
                      currentPassword: e.target.value,
                    }))
                  }
                  autoComplete="current-password"
                />
                {passwordErrors.currentPassword ? (
                  <p className="text-sm text-destructive">
                    {passwordErrors.currentPassword}
                  </p>
                ) : null}
              </SettingsField>

              <SettingsField
                label="New password"
                hint="At least 8 characters."
              >
                <Input
                  id="newPassword"
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) =>
                    setPasswordData((prev) => ({
                      ...prev,
                      newPassword: e.target.value,
                    }))
                  }
                  autoComplete="new-password"
                />
                {passwordErrors.newPassword ? (
                  <p className="text-sm text-destructive">
                    {passwordErrors.newPassword}
                  </p>
                ) : null}
              </SettingsField>

              <SettingsField label="Confirm new password">
                <Input
                  id="confirmPassword"
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) =>
                    setPasswordData((prev) => ({
                      ...prev,
                      confirmPassword: e.target.value,
                    }))
                  }
                  autoComplete="new-password"
                />
                {passwordErrors.confirmPassword ? (
                  <p className="text-sm text-destructive">
                    {passwordErrors.confirmPassword}
                  </p>
                ) : null}
              </SettingsField>
            </div>

            <div className="flex justify-end border-t border-border/40 pt-4">
              <Button
                onClick={handleChangePassword}
                disabled={isChangingPassword}
                variant="secondary"
              >
                {isChangingPassword ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Changing…
                  </>
                ) : (
                  "Change password"
                )}
              </Button>
            </div>
          </SettingsPanel>

          <SettingsPanel
            id="user-settings-2fa"
            data-tour="user-settings-2fa"
            title="Two-factor authentication"
            description="Add an authenticator app or email codes to protect your account."
          >
            <AdminSecurity2faCard canEditPolicy={false} />
          </SettingsPanel>

          <SettingsPanel
            id="user-settings-notifications"
            data-tour="user-settings-notifications"
            title="Notifications"
            description="Choose how you hear about jobs and application updates."
          >
            <div className="space-y-3">
              <SettingsToggleRow
                label="Email notifications"
                description="Receive notifications via email"
                checked={settings.notifications.email}
                onCheckedChange={(checked) =>
                  setSettings((prev) => ({
                    ...prev,
                    notifications: {
                      ...prev.notifications,
                      email: checked,
                    },
                  }))
                }
              />
              <SettingsToggleRow
                label="Push notifications"
                description="Receive browser push notifications"
                checked={settings.notifications.push}
                onCheckedChange={(checked) =>
                  setSettings((prev) => ({
                    ...prev,
                    notifications: {
                      ...prev.notifications,
                      push: checked,
                    },
                  }))
                }
              />
              <SettingsToggleRow
                label="Job alerts"
                description="Get notified about new job postings"
                checked={settings.notifications.jobAlerts}
                onCheckedChange={(checked) =>
                  setSettings((prev) => ({
                    ...prev,
                    notifications: {
                      ...prev.notifications,
                      jobAlerts: checked,
                    },
                  }))
                }
              />
              <SettingsToggleRow
                label="Application updates"
                description="Get notified when your application status changes"
                checked={settings.notifications.applicationUpdates}
                onCheckedChange={(checked) =>
                  setSettings((prev) => ({
                    ...prev,
                    notifications: {
                      ...prev.notifications,
                      applicationUpdates: checked,
                    },
                  }))
                }
              />
              <SettingsToggleRow
                label="Marketing emails"
                description="Receive promotional emails and newsletters"
                checked={settings.notifications.marketingEmails}
                onCheckedChange={(checked) =>
                  setSettings((prev) => ({
                    ...prev,
                    notifications: {
                      ...prev.notifications,
                      marketingEmails: checked,
                    },
                  }))
                }
              />
            </div>
          </SettingsPanel>

          <SettingsPanel
            id="user-settings-privacy"
            data-tour="user-settings-privacy"
            title="Privacy"
            description="Control what others can see about your activity."
          >
            <SettingsField label="Profile visibility">
              <Select
                value={settings.privacy.profileVisibility}
                onValueChange={(value) =>
                  setSettings((prev) => ({
                    ...prev,
                    privacy: {
                      ...prev.privacy,
                      profileVisibility: value,
                    },
                  }))
                }
              >
                <SelectTrigger className="max-w-md">
                  <SelectValue placeholder="Select visibility" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Public</SelectItem>
                  <SelectItem value="private">Private</SelectItem>
                  <SelectItem value="contacts">Contacts only</SelectItem>
                </SelectContent>
              </Select>
            </SettingsField>

            <div className="space-y-3">
              <SettingsToggleRow
                label="Show activity"
                description="Show your activity status to others"
                checked={settings.privacy.showActivity}
                onCheckedChange={(checked) =>
                  setSettings((prev) => ({
                    ...prev,
                    privacy: {
                      ...prev.privacy,
                      showActivity: checked,
                    },
                  }))
                }
              />
              <SettingsToggleRow
                label="Show application history"
                description="Allow others to see your application history"
                checked={settings.privacy.showApplicationHistory}
                onCheckedChange={(checked) =>
                  setSettings((prev) => ({
                    ...prev,
                    privacy: {
                      ...prev.privacy,
                      showApplicationHistory: checked,
                    },
                  }))
                }
              />
            </div>
          </SettingsPanel>

          <SettingsPanel
            id="user-settings-preferences"
            title="Preferences"
            description="Set theme, language, and timezone for your dashboard."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <SettingsField label="Theme">
                <Select
                  value={settings.preferences.theme}
                  onValueChange={(value) =>
                    setSettings((prev) => ({
                      ...prev,
                      preferences: {
                        ...prev.preferences,
                        theme: value,
                      },
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select theme" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                    <SelectItem value="system">System</SelectItem>
                  </SelectContent>
                </Select>
              </SettingsField>

              <SettingsField label="Language">
                <Select
                  value={settings.preferences.language}
                  onValueChange={(value) =>
                    setSettings((prev) => ({
                      ...prev,
                      preferences: {
                        ...prev.preferences,
                        language: value,
                      },
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="es">Spanish</SelectItem>
                    <SelectItem value="fr">French</SelectItem>
                  </SelectContent>
                </Select>
              </SettingsField>

              <SettingsField label="Timezone" className="sm:col-span-2">
                <Select
                  value={settings.preferences.timezone}
                  onValueChange={(value) =>
                    setSettings((prev) => ({
                      ...prev,
                      preferences: {
                        ...prev.preferences,
                        timezone: value,
                      },
                    }))
                  }
                >
                  <SelectTrigger className="max-w-md">
                    <SelectValue placeholder="Select timezone" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UTC">UTC</SelectItem>
                    <SelectItem value="America/New_York">
                      Eastern Time
                    </SelectItem>
                    <SelectItem value="America/Chicago">
                      Central Time
                    </SelectItem>
                    <SelectItem value="America/Denver">
                      Mountain Time
                    </SelectItem>
                    <SelectItem value="America/Los_Angeles">
                      Pacific Time
                    </SelectItem>
                  </SelectContent>
                </Select>
              </SettingsField>
            </div>
          </SettingsPanel>
        </div>
      </div>

      <div className="sticky bottom-0 z-10 -mx-4 border-t border-border/60 bg-background/90 px-4 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/75 sm:-mx-6 sm:px-6">
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
          <p className="text-center text-xs text-muted-foreground sm:mr-auto sm:text-left">
            Saves notifications, privacy, and preferences. Profile and password
            save in their own sections.
          </p>
          <Button
            onClick={handleSaveSettings}
            disabled={isSaving}
            size="lg"
            className="min-w-[140px]"
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              "Save settings"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
