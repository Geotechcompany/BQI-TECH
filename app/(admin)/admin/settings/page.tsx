"use client";

import { motion } from 'framer-motion';
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import { 
  Layout, 
  Bell, 
  Shield,
  RefreshCw,
} from 'lucide-react';
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "react-hot-toast";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Camera } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { adminApi, backendApi } from "@/lib/api-backend";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { FormSkeleton } from "@/components/ui/skeleton";
import { authService } from "@/lib/auth-backend";
import { useTheme } from "next-themes";
import { useSettings } from "@/contexts/SettingsContext";


interface AdminSettings {
  emailNotifications: boolean;
  pushNotifications: boolean;
  contactFormEnabled: boolean;
  contactProtection: {
    minMessageChars: number;
    maxSubmissionsPerIp: number;
    ipWindowMinutes: number;
    blockWindowMinutes: number;
    captchaEnabled: boolean;
    captchaScoreThreshold: number;
    blockScoreThreshold: number;
  };
  autoLogout: number;
  tableRowsPerPage: number;
  sidebarCollapsed: boolean;
  theme: string;
  language: string;
  avatar: string;
}

interface ContactSpamEvent {
  id?: string;
  ip?: string;
  reason?: string;
  eventType?: string;
  createdAt?: string;
}

const defaultSettings: AdminSettings = {
  emailNotifications: true,
  pushNotifications: true,
  contactFormEnabled: true,
  contactProtection: {
    minMessageChars: 25,
    maxSubmissionsPerIp: 5,
    ipWindowMinutes: 15,
    blockWindowMinutes: 60,
    captchaEnabled: true,
    captchaScoreThreshold: 55,
    blockScoreThreshold: 35,
  },
  autoLogout: 30,
  tableRowsPerPage: 25,
  sidebarCollapsed: false,
  theme: 'light',
  language: 'en',
  avatar: ''
};

function SettingsPageContent() {
  const { user, updateUserAvatar } = useAuth();
  const [settings, setSettings] = useState<AdminSettings>(defaultSettings);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncingDatabases, setIsSyncingDatabases] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);
  const [contactSpamEvents, setContactSpamEvents] = useState<ContactSpamEvent[]>([]);
  const [recaptchaSiteKey, setRecaptchaSiteKey] = useState("");
  const [recaptchaSecretKey, setRecaptchaSecretKey] = useState("");
  const [hasRecaptchaSecret, setHasRecaptchaSecret] = useState(false);
  const { setTheme } = useTheme();
  const { updateTheme, updateSettings } = useSettings();

  useEffect(() => {
    loadSettings();
    loadContactAnalytics();
    loadRecaptchaSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setIsLoading(true);
      

      
      const response = await adminApi.getSettings();
      if (response) {
        const payload = (response as any).settings ?? response;
        setSettings({
          ...defaultSettings,
          ...payload,
          contactProtection: {
            ...defaultSettings.contactProtection,
            ...(payload?.contactProtection ?? {}),
          },
        });
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
      toast.error('Failed to load settings');
      // Use default settings if loading fails
      setSettings(defaultSettings);
    } finally {
      setIsLoading(false);
    }
  };

  const loadContactAnalytics = async () => {
    try {
      setIsLoadingAnalytics(true);
      const analyticsApi = (adminApi as any).getContactProtectionAnalytics;
      const response = analyticsApi
        ? await analyticsApi({ days: 7, limit: 20 })
        : { events: [] };
      setContactSpamEvents((response as any)?.events ?? []);
    } catch (error) {
      console.error('Failed to load contact spam analytics:', error);
      setContactSpamEvents([]);
    } finally {
      setIsLoadingAnalytics(false);
    }
  };

  const loadRecaptchaSettings = async () => {
    try {
      const getRecaptchaSettingsApi = (adminApi as any).getRecaptchaSettings;
      const response = getRecaptchaSettingsApi
        ? await getRecaptchaSettingsApi()
        : await backendApi.get("/api/admin/settings/recaptcha");
      setRecaptchaSiteKey(String((response as any)?.siteKey || ""));
      setHasRecaptchaSecret(Boolean((response as any)?.hasSecretKey));
    } catch (error) {
      console.error("Failed to load reCAPTCHA settings:", error);
    }
  };

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    
    try {
      // Persist only known fields
      const payload = {
        emailNotifications: settings.emailNotifications,
        pushNotifications: settings.pushNotifications,
        contactFormEnabled: settings.contactFormEnabled,
        contactProtection: settings.contactProtection,
        autoLogout: settings.autoLogout,
        tableRowsPerPage: settings.tableRowsPerPage,
        sidebarCollapsed: settings.sidebarCollapsed,
        theme: settings.theme,
        language: settings.language,
        avatar: settings.avatar,
      };
      await adminApi.updateSettings(payload);
      // Save reCAPTCHA settings if provided
      if (recaptchaSiteKey.trim() || recaptchaSecretKey.trim()) {
        const updateRecaptchaSettingsApi = (adminApi as any).updateRecaptchaSettings;
        if (updateRecaptchaSettingsApi) {
          await updateRecaptchaSettingsApi({
            siteKey: recaptchaSiteKey.trim() || undefined,
            secretKey: recaptchaSecretKey.trim() || undefined,
          });
        } else {
          await backendApi.put("/api/admin/settings/recaptcha", {
            siteKey: recaptchaSiteKey.trim() || undefined,
            secretKey: recaptchaSecretKey.trim() || undefined,
          });
        }
      }
      // Reload from server to confirm persistence
      await loadSettings();
      await loadRecaptchaSettings();
      setRecaptchaSecretKey("");
      toast.success('Settings saved successfully');
    } catch (error) {
      console.error('Save error:', error);
      toast.error(error.message || 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleManualDatabaseSync = async () => {
    if (isSyncingDatabases) return;
    setIsSyncingDatabases(true);
    try {
      await adminApi.syncDatabases();
      toast.success("Database sync completed");
    } catch (error: any) {
      toast.error(error?.message || "Failed to sync databases");
    } finally {
      setIsSyncingDatabases(false);
    }
  };

  const updateSetting = <K extends keyof AdminSettings>(
    key: K, 
    value: AdminSettings[K]
  ) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const updateContactProtection = (
    patch: Partial<AdminSettings["contactProtection"]>
  ) => {
    setSettings((prev) => ({
      ...prev,
      contactProtection: {
        ...prev.contactProtection,
        ...patch,
      },
    }));
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      // Create form data
      const formData = new FormData();
      formData.append('file', file);

      // Upload avatar
      const response = await fetch(`${process.env.NEXT_PUBLIC_PYTHON_API_URL}/api/upload/avatar`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${authService.getSession()?.token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to upload avatar');
      }

      const data = await response.json();
      
      // Update local state with new avatar URL
      setSettings(prev => ({
        ...prev,
        avatar: data.url
      }));

      // Update auth context to sync avatar across components
      updateUserAvatar(data.url);

      toast.success('Avatar updated successfully');
    } catch (error) {
      console.error('Avatar upload error:', error);
      toast.error('Failed to upload avatar');
    }
  };

  const SettingCard = ({ 
    icon: Icon, 
    title, 
    description, 
    children 
  }: { 
    icon: any, 
    title: string, 
    description: string, 
    children: React.ReactNode 
  }) => (
    <motion.div
      initial={false}
      className="bg-background p-6 rounded-xl shadow-sm border border-muted/50 hover:border-primary/20 transition-all"
    >
      <div className="flex items-start gap-4">
        <div className="p-3 rounded-lg bg-primary/10">
          <Icon className="w-6 h-6 text-primary" />
        </div>
        <div className="flex-1 space-y-4">
          <div>
            <h3 className="text-lg font-semibold">{title}</h3>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          {children}
        </div>
      </div>
    </motion.div>
  );

  if (isLoading) {
    return (
      <AdminPageLayout title="Settings" showSearch={false}>
        <FormSkeleton />
      </AdminPageLayout>
    );
  }

  return (
    <AdminPageLayout
      title="Settings"
      showSearch={false}
      className="mx-auto px-4 md:px-6 lg:px-8"
    >
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Profile Header */}
        <motion.div 
          initial={false}
          className="p-6 rounded-2xl shadow-sm border border-border bg-card"
        >
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="relative group shrink-0">
              <Avatar className="h-32 w-32 md:h-40 md:w-40 ring-4 ring-white/80 shadow-lg">
                <AvatarImage 
                  src={user?.avatar}
                  alt={user?.name || 'Admin User'}
                  className="object-cover"
                />
                <AvatarFallback>
                  {[user?.firstName?.[0], user?.lastName?.[0]].filter(Boolean).join('') || 'A'}
                </AvatarFallback>
              </Avatar>
              <label 
                htmlFor="avatarUpload"
                className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full cursor-pointer"
              >
                <Camera className="h-8 w-8 text-white" />
              </label>
              <input
                id="avatarUpload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
              />
            </div>
            
            <div className="space-y-2 text-center md:text-left">
              <h2 className="text-2xl md:text-3xl font-bold">
                {user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Admin User' : 'Admin User'}
              </h2>
              <p className="text-muted-foreground text-sm md:text-base">
                {user?.email}
              </p>
              <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                {user?.role || 'admin'}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Settings Cards */}
        <div className="flex flex-col gap-6">
          <SettingCard
            icon={Layout}
            title="Interface Preferences"
            description="Customize your dashboard appearance and layout"
          >
            <div className="space-y-6">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Table Density</Label>
                <Select
                  value={settings.tableRowsPerPage.toString()}
                  onValueChange={(value) => 
                    updateSetting('tableRowsPerPage', Number(value))
                  }
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Rows per page" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10 rows</SelectItem>
                    <SelectItem value="25">25 rows</SelectItem>
                    <SelectItem value="50">50 rows</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Theme</Label>
                <Select
                  value={settings.theme}
                  onValueChange={(value) => {
                    updateSetting('theme', value);
                    try {
                      setTheme(value);
                    } catch {}
                    updateTheme(value as any);
                  }}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Theme" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                    <SelectItem value="system">System</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                <div>
                  <Label className="font-medium">Compact Sidebar</Label>
                  <p className="text-sm text-muted-foreground">
                    Collapse sidebar navigation
                  </p>
                </div>
                <Switch
                  checked={settings.sidebarCollapsed}
                  onCheckedChange={async (checked) => {
                    updateSetting('sidebarCollapsed', checked)
                    try {
                      await updateSettings({ sidebarCollapsed: checked } as any)
                    } catch {}
                  }}
                />
              </div>
            </div>
          </SettingCard>

          <SettingCard
            icon={Bell}
            title="Notifications"
            description="Manage your notification preferences"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                <div>
                  <Label className="font-medium">Email Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive notifications via email
                  </p>
                </div>
                <Switch
                  checked={settings.emailNotifications}
                  onCheckedChange={(checked) => 
                    updateSetting('emailNotifications', checked)
                  }
                />
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                <div>
                  <Label className="font-medium">Push Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive browser push notifications
                  </p>
                </div>
                <Switch
                  checked={settings.pushNotifications}
                  onCheckedChange={(checked) => 
                    updateSetting('pushNotifications', checked)
                  }
                />
              </div>
            </div>
          </SettingCard>

          <SettingCard
            icon={Shield}
            title="Security"
            description="Manage your security preferences"
          >
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Auto Logout (minutes)</Label>
                <Select
                  value={settings.autoLogout.toString()}
                  onValueChange={(value) => 
                    updateSetting('autoLogout', Number(value))
                  }
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Auto logout time" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">15 minutes</SelectItem>
                    <SelectItem value="30">30 minutes</SelectItem>
                    <SelectItem value="60">1 hour</SelectItem>
                    <SelectItem value="120">2 hours</SelectItem>
                    <SelectItem value="0">Never</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </SettingCard>

          <SettingCard
            icon={Bell}
            title="Public Contact Form"
            description="Control whether website visitors can submit contact messages"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                <div>
                  <Label className="font-medium">Enable Contact Form</Label>
                  <p className="text-sm text-muted-foreground">
                    Disable this to temporarily block all contact form submissions
                  </p>
                </div>
                <Switch
                  checked={settings.contactFormEnabled}
                  onCheckedChange={(checked) =>
                    updateSetting('contactFormEnabled', checked)
                  }
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="font-medium">Minimum Message Characters</Label>
                  <Input
                    type="number"
                    min={5}
                    value={settings.contactProtection.minMessageChars}
                    onChange={(e) =>
                      updateContactProtection({ minMessageChars: Number(e.target.value || 5) })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label className="font-medium">Max Submissions Per IP</Label>
                  <Input
                    type="number"
                    min={1}
                    value={settings.contactProtection.maxSubmissionsPerIp}
                    onChange={(e) =>
                      updateContactProtection({ maxSubmissionsPerIp: Number(e.target.value || 1) })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label className="font-medium">IP Window (minutes)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={settings.contactProtection.ipWindowMinutes}
                    onChange={(e) =>
                      updateContactProtection({ ipWindowMinutes: Number(e.target.value || 1) })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label className="font-medium">Block Duration (minutes)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={settings.contactProtection.blockWindowMinutes}
                    onChange={(e) =>
                      updateContactProtection({ blockWindowMinutes: Number(e.target.value || 1) })
                    }
                  />
                </div>
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                <div>
                  <Label className="font-medium">Enable Captcha Fallback</Label>
                  <p className="text-sm text-muted-foreground">
                    Show captcha for borderline suspicious messages
                  </p>
                </div>
                <Switch
                  checked={settings.contactProtection.captchaEnabled}
                  onCheckedChange={(checked) =>
                    updateContactProtection({ captchaEnabled: checked })
                  }
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="font-medium">Captcha Score Threshold</Label>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={settings.contactProtection.captchaScoreThreshold}
                    onChange={(e) =>
                      updateContactProtection({ captchaScoreThreshold: Number(e.target.value || 55) })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label className="font-medium">Block Score Threshold</Label>
                  <Input
                    type="number"
                    min={0}
                    max={99}
                    value={settings.contactProtection.blockScoreThreshold}
                    onChange={(e) =>
                      updateContactProtection({ blockScoreThreshold: Number(e.target.value || 35) })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="font-medium">Google reCAPTCHA Site Key</Label>
                <Input
                  type="text"
                  value={recaptchaSiteKey}
                  onChange={(e) => setRecaptchaSiteKey(e.target.value)}
                  placeholder="Enter site key"
                />
              </div>

              <div className="space-y-2">
                <Label className="font-medium">Google reCAPTCHA Secret Key</Label>
                <Input
                  type="password"
                  value={recaptchaSecretKey}
                  onChange={(e) => setRecaptchaSecretKey(e.target.value)}
                  placeholder={hasRecaptchaSecret ? "Secret key already set (enter new to replace)" : "Enter secret key"}
                />
                <p className="text-xs text-muted-foreground">
                  {hasRecaptchaSecret
                    ? "Secret key is currently configured. Enter a new value only if you want to rotate it."
                    : "No secret key configured yet."}
                </p>
              </div>
            </div>
          </SettingCard>

          <SettingCard
            icon={Shield}
            title="Contact Spam Analytics"
            description="Recent blocked/challenged submissions by IP, reason, and time"
          >
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">
                  Last 7 days, latest 20 events
                </p>
                <Button variant="outline" size="sm" onClick={loadContactAnalytics} disabled={isLoadingAnalytics}>
                  {isLoadingAnalytics ? "Refreshing..." : "Refresh"}
                </Button>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <div className="grid grid-cols-4 gap-2 px-3 py-2 text-xs font-semibold bg-muted/50">
                  <span>IP</span>
                  <span>Reason</span>
                  <span>Event</span>
                  <span>Time</span>
                </div>
                {contactSpamEvents.length === 0 ? (
                  <div className="px-3 py-4 text-sm text-muted-foreground">
                    No spam events recorded yet.
                  </div>
                ) : (
                  contactSpamEvents.map((event, index) => (
                    <div key={event.id || `${event.ip}-${index}`} className="grid grid-cols-4 gap-2 px-3 py-2 text-xs border-t">
                      <span className="truncate">{event.ip || "unknown"}</span>
                      <span className="truncate">{event.reason || "unknown"}</span>
                      <span className="truncate">{event.eventType || "unknown"}</span>
                      <span className="truncate">
                        {event.createdAt ? new Date(event.createdAt).toLocaleString() : "-"}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </SettingCard>
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-6">
          <Button
            onClick={handleManualDatabaseSync}
            disabled={isSyncingDatabases}
            variant="outline"
            size="lg"
            className="mr-3 min-w-[170px]"
          >
            {isSyncingDatabases ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Sync Databases
              </>
            )}
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={isSaving}
            size="lg"
            className="min-w-[120px]"
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Settings'
            )}
          </Button>
        </div>
      </div>
    </AdminPageLayout>
  );
}

export default function SettingsPage() {
  return (
    <ProtectedRoute requireAdmin>
      <SettingsPageContent />
    </ProtectedRoute>
  );
} 