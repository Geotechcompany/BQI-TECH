"use client";

import { motion } from "framer-motion";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import { AdminPageWelcomeBanner } from "@/components/admin/AdminPageWelcomeBanner";
import { TourPageHelper } from "@/components/admin/tour/TourPageHelper";
import {
  Layout,
  Bell,
  Shield,
  RefreshCw,
  Mail,
  MessageSquare,
  Database,
  Camera,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Palette,
  Bot,
  Sparkles,
  Plus,
  Trash2,
  Star,
  Plug,
  ChevronDown,
  HardDrive,
  ScrollText,
  Users,
  AlertTriangle,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
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
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useState, useEffect, Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useAiStatus } from "@/contexts/AiStatusContext";
import { useBqiIntelligence } from "@/contexts/BqiIntelligenceContext";
import { adminApi, backendApi } from "@/lib/api-backend";
import { canAccessAdminPath } from "@/lib/admin-permissions";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { FormSkeleton } from "@/components/ui/skeleton";
import { authService } from "@/lib/auth-backend";
import { useTheme } from "next-themes";
import { useSettings } from "@/contexts/SettingsContext";
import { useAdminTheme, type AdminTheme } from "@/contexts/AdminThemeContext";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  BQI_INTELLIGENCE_FEATURES,
  DEFAULT_BQI_INTELLIGENCE,
  normalizeBqiIntelligence,
  type BqiIntelligenceSettings,
} from "@/lib/bqi-intelligence";
import { MicrosoftIntegrationCard } from "@/components/admin/settings/MicrosoftIntegrationCard";
import { DocuSignIntegrationCard } from "@/components/admin/settings/DocuSignIntegrationCard";
import { LinearIntegrationCard } from "@/components/admin/settings/LinearIntegrationCard";
import { AdminSecurity2faCard } from "@/components/admin/settings/AdminSecurity2faCard";
import { useAdminPath } from "@/contexts/AdminPathContext";
import {
  APP_URL,
} from "@/lib/config";
import { getPublicAdminBasePath,
  validateAdminPathSlug, publicAdminHref } from "@/lib/admin-path";

interface AdminSettings {
  emailNotifications: boolean;
  pushNotifications: boolean;
  contactFormEnabled: boolean;
  contactProtection: {
    minMessageChars: number;
    maxMessageChars: number;
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
  admin_path_hidden: boolean;
  admin_path_slug: string;
}

interface ContactSpamEvent {
  id?: string;
  ip?: string;
  reason?: string;
  eventType?: string;
  createdAt?: string;
}

type SettingsSection =
  | "general"
  | "notifications"
  | "security"
  | "contact"
  | "email"
  | "integrations"
  | "ai"
  | "intelligence"
  | "system";

const NAV_ITEMS: {
  id: SettingsSection;
  label: string;
  description: string;
  icon: LucideIcon;
}[] = [
  {
    id: "general",
    label: "Appearance",
    description: "Theme, density & layout",
    icon: Palette,
  },
  {
    id: "notifications",
    label: "Notifications",
    description: "Email & push alerts",
    icon: Bell,
  },
  {
    id: "security",
    label: "Security",
    description: "2FA, session & admin URL",
    icon: Shield,
  },
  {
    id: "contact",
    label: "Contact form",
    description: "Public form & spam",
    icon: MessageSquare,
  },
  {
    id: "email",
    label: "Email delivery",
    description: "Outbound mail relay",
    icon: Mail,
  },
  {
    id: "integrations",
    label: "Integrations",
    description: "Microsoft, DocuSign & more",
    icon: Plug,
  },
  {
    id: "ai",
    label: "AI providers",
    description: "Models & API keys",
    icon: Bot,
  },
  {
    id: "intelligence",
    label: "BQI Intelligence",
    description: "Feature toggles",
    icon: Sparkles,
  },
  {
    id: "system",
    label: "System",
    description: "Database operations",
    icon: Database,
  },
];

const defaultSettings: AdminSettings = {
  emailNotifications: true,
  pushNotifications: true,
  contactFormEnabled: true,
  contactProtection: {
    minMessageChars: 25,
    maxMessageChars: 2000,
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
  theme: "light",
  language: "en",
  avatar: "",
  admin_path_hidden: false,
  admin_path_slug: "",
};

function SettingsToggleRow({
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
}: {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-muted/30 px-4 py-3.5 transition-colors hover:bg-muted/50">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-none">{label}</p>
        <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
      />
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
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label className="text-sm font-medium">{label}</Label>
      {children}
      {hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

function SettingsPanel({
  title,
  description,
  children,
  badge,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  badge?: React.ReactNode;
}) {
  return (
    <Card className="overflow-hidden border-border/60 shadow-sm">
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

const DEFAULT_BQITECH_RELAY_URL =
  "https://api.bqitech.com/api/internal/send-email";

function isBqitechApiRelayUrl(url: string): boolean {
  return url.includes("api.bqitech.com");
}

function isLegacyNetlifyRelayUrl(url: string): boolean {
  return url.includes("netlify.app");
}

interface AiProvider {
  id: string;
  label: string;
  providerType: string;
  baseUrl: string;
  model: string;
  apiKey: string;
  hasApiKey: boolean;
  apiKeyHint?: string;
}

const AI_PROVIDER_PRESETS: {
  value: string;
  label: string;
  baseUrl: string;
  model: string;
}[] = [
  {
    value: "nvidia",
    label: "NVIDIA",
    baseUrl: "https://integrate.api.nvidia.com/v1",
    model: "meta/llama-3.1-70b-instruct",
  },
  {
    value: "openai",
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
  },
  {
    value: "openrouter",
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    model: "openai/gpt-4o-mini",
  },
  {
    value: "groq",
    label: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    model: "llama-3.1-70b-versatile",
  },
  {
    value: "deepseek",
    label: "DeepSeek",
    baseUrl: "https://api.deepseek.com",
    model: "deepseek-chat",
  },
  {
    value: "together",
    label: "Together",
    baseUrl: "https://api.together.xyz/v1",
    model: "meta-llama/Llama-3-70b-chat-hf",
  },
  {
    value: "custom",
    label: "Custom (OpenAI-compatible)",
    baseUrl: "",
    model: "",
  },
];

function createEmptyAiProvider(): AiProvider {
  const preset = AI_PROVIDER_PRESETS[0];
  return {
    id: `new_${Math.random().toString(36).slice(2, 12)}`,
    label: preset.label,
    providerType: preset.value,
    baseUrl: preset.baseUrl,
    model: preset.model,
    apiKey: "",
    hasApiKey: false,
  };
}

function SettingsPageContent() {
  const { user, updateUserAvatar } = useAuth();
  const { applyConfig, adminHref, basePath } = useAdminPath();
  const searchParams = useSearchParams();
  const [settings, setSettings] = useState<AdminSettings>(defaultSettings);
  const [activeSection, setActiveSection] = useState<SettingsSection>("general");
  const [isSavingAdminPath, setIsSavingAdminPath] = useState(false);
  const [adminPathDraftError, setAdminPathDraftError] = useState<string | null>(
    null
  );

  const relatedSettingsLinks = useMemo(() => {
    const links: {
      href: string;
      label: string;
      description: string;
      icon: LucideIcon;
    }[] = [];
    if (
      canAccessAdminPath(
        "/manage/user-management",
        user?.role,
        user?.adminModules
      )
    ) {
      links.push({
        href: publicAdminHref("/manage/user-management"),
        label: "User Management",
        description: "Invite admins and manage roles",
        icon: Users,
      });
    }
    if (
      canAccessAdminPath(
        "/manage/email-broadcast",
        user?.role,
        user?.adminModules
      )
    ) {
      links.push({
        href: publicAdminHref("/manage/email-broadcast"),
        label: "Email Broadcast",
        description: "Send announcements to recipients",
        icon: Mail,
      });
    }
    if (canAccessAdminPath("/manage/audit-logs", user?.role, user?.adminModules)) {
      links.push({
        href: publicAdminHref("/manage/audit-logs"),
        label: "Admin Activity",
        description: "Review admin actions and audit history",
        icon: ScrollText,
      });
    }
    if (canAccessAdminPath("/manage/backup", user?.role, user?.adminModules)) {
      links.push({
        href: publicAdminHref("/manage/backup"),
        label: "Backup",
        description: "Schedules, runs, and off-site exports",
        icon: HardDrive,
      });
    }
    return links;
  }, [user?.role, user?.adminModules]);

  const [isSaving, setIsSaving] = useState(false);
  const [isSyncingDatabases, setIsSyncingDatabases] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);
  const [contactSpamEvents, setContactSpamEvents] = useState<ContactSpamEvent[]>(
    []
  );
  const [recaptchaSiteKey, setRecaptchaSiteKey] = useState("");
  const [recaptchaSecretKey, setRecaptchaSecretKey] = useState("");
  const [hasRecaptchaSecret, setHasRecaptchaSecret] = useState(false);
  const [emailTransport, setEmailTransport] = useState({
    provider: "netlify_relay",
    relayUrl: DEFAULT_BQITECH_RELAY_URL,
    fromEmail: "",
    sendgridApiKey: "",
    relaySecret: "",
    hasSendgridApiKey: false,
    hasRelaySecret: false,
    usesBqitechApiRelay: true,
    configured: false,
  });
  const [isSavingEmailTransport, setIsSavingEmailTransport] = useState(false);
  const [isTestingEmail, setIsTestingEmail] = useState(false);
  const [aiProviders, setAiProviders] = useState<AiProvider[]>([]);
  const [aiActiveProviderId, setAiActiveProviderId] = useState("");
  const [isSavingAiProviders, setIsSavingAiProviders] = useState(false);
  const [testingAiProviderId, setTestingAiProviderId] = useState<string | null>(
    null
  );
  const [expandedAiProviderIds, setExpandedAiProviderIds] = useState<
    Set<string>
  >(() => new Set());
  const { setTheme } = useTheme();
  const { updateTheme, updateSettings } = useSettings();
  const { setTheme: setAdminTheme } = useAdminTheme();
  const { refresh: refreshAiStatus } = useAiStatus();
  const {
    setFeatures: setBqiIntelligenceFeatures,
    refresh: refreshBqiIntelligence,
  } = useBqiIntelligence();
  const [bqiIntelligence, setBqiIntelligence] =
    useState<BqiIntelligenceSettings>(DEFAULT_BQI_INTELLIGENCE);
  const [isSavingIntelligence, setIsSavingIntelligence] = useState(false);
  const [microsoftOAuthNotice, setMicrosoftOAuthNotice] = useState<
    "connected" | "error" | null
  >(null);
  const [microsoftOAuthError, setMicrosoftOAuthError] = useState<string | null>(
    null
  );

  useEffect(() => {
    loadSettings();
    loadContactAnalytics();
    loadRecaptchaSettings();
    loadEmailTransportSettings();
    loadAiProviderSettings();
  }, []);

  useEffect(() => {
    const section = searchParams?.get("section");
    if (section && NAV_ITEMS.some((item) => item.id === section)) {
      setActiveSection(section as SettingsSection);
    }
    const microsoft = searchParams?.get("microsoft");
    if (microsoft === "connected") {
      setMicrosoftOAuthNotice("connected");
    } else if (microsoft === "error") {
      setMicrosoftOAuthNotice("error");
      setMicrosoftOAuthError(searchParams?.get("microsoft_error"));
    }
  }, [searchParams]);

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
          admin_path_hidden: Boolean(payload?.admin_path_hidden),
          admin_path_slug: String(payload?.admin_path_slug ?? ""),
        });
        applyConfig({
          admin_path_hidden: Boolean(payload?.admin_path_hidden),
          admin_path_slug: payload?.admin_path_slug ?? null,
        });
        setBqiIntelligence(
          normalizeBqiIntelligence(payload?.bqiIntelligence)
        );
      }
    } catch (error) {
      console.error("Failed to load settings:", error);
      toast.error("Failed to load settings");
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
      console.error("Failed to load contact spam analytics:", error);
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

  const loadEmailTransportSettings = async () => {
    try {
      const response = await adminApi.getEmailTransportSettings();
      const transport = (response as any)?.transport ?? {};
      setEmailTransport((current) => ({
        ...current,
        provider: transport.provider || "netlify_relay",
        relayUrl:
          transport.relayUrl ||
          transport.defaultRelayUrl ||
          DEFAULT_BQITECH_RELAY_URL,
        fromEmail: transport.fromEmail || "",
        hasSendgridApiKey: Boolean(transport.hasSendgridApiKey),
        hasRelaySecret: Boolean(transport.hasRelaySecret),
        usesBqitechApiRelay: Boolean(
          transport.usesBqitechApiRelay ??
            String(transport.relayUrl || transport.defaultRelayUrl || "").includes(
              "api.bqitech.com"
            )
        ),
        configured: Boolean(transport.configured),
        sendgridApiKey: "",
        relaySecret: "",
      }));
    } catch (error) {
      console.error("Failed to load email transport settings:", error);
    }
  };

  const handleSaveEmailTransport = async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setIsSavingEmailTransport(true);
    }
    try {
      const payload: Record<string, string> = {
        provider: emailTransport.provider,
        relayUrl: emailTransport.relayUrl.trim(),
        fromEmail: emailTransport.fromEmail.trim(),
      };
      if (emailTransport.sendgridApiKey.trim()) {
        payload.sendgridApiKey = emailTransport.sendgridApiKey.trim();
      }
      if (emailTransport.relaySecret.trim()) {
        payload.relaySecret = emailTransport.relaySecret.trim();
      }
      const response = await adminApi.updateEmailTransportSettings(payload);
      const transport = (response as any)?.transport ?? {};
      setEmailTransport((current) => ({
        ...current,
        provider: transport.provider || current.provider,
        relayUrl: transport.relayUrl || current.relayUrl,
        fromEmail: transport.fromEmail || current.fromEmail,
        hasSendgridApiKey: Boolean(transport.hasSendgridApiKey),
        hasRelaySecret: Boolean(transport.hasRelaySecret),
        usesBqitechApiRelay: Boolean(
          transport.usesBqitechApiRelay ??
            String(transport.relayUrl || "").includes("api.bqitech.com")
        ),
        configured: Boolean(transport.configured),
        sendgridApiKey: "",
        relaySecret: "",
      }));
      if (!options?.silent) {
        toast.success("Email delivery settings saved");
      }
      return true;
    } catch (error: any) {
      toast.error(error?.message || "Failed to save email delivery settings");
      return false;
    } finally {
      if (!options?.silent) {
        setIsSavingEmailTransport(false);
      }
    }
  };

  const handleTestEmailTransport = async () => {
    const relayUrl = emailTransport.relayUrl.trim();
    const usesBqitechApiRelay =
      emailTransport.usesBqitechApiRelay || isBqitechApiRelayUrl(relayUrl);
    const usesLegacyNetlifyRelay = isLegacyNetlifyRelayUrl(relayUrl);
    const needsSendgridKey =
      emailTransport.provider === "sendgrid" ||
      (usesLegacyNetlifyRelay &&
        (emailTransport.provider === "netlify_relay" ||
          emailTransport.provider === "relay"));

    if (
      (emailTransport.provider === "netlify_relay" ||
        emailTransport.provider === "relay") &&
      !relayUrl
    ) {
      toast.error("Enter a relay URL, then save, before sending a test email.");
      return;
    }

    if (usesLegacyNetlifyRelay && !usesBqitechApiRelay) {
      toast.error(
        "Legacy Netlify relay requires SendGrid. Switch relay URL to api.bqitech.com (recommended) or enter a SendGrid API key."
      );
      return;
    }

    if (
      needsSendgridKey &&
      !emailTransport.hasSendgridApiKey &&
      !emailTransport.sendgridApiKey.trim()
    ) {
      toast.error("Enter your SendGrid API key, then save, before sending a test email.");
      return;
    }

    if (usesBqitechApiRelay && !emailTransport.fromEmail.trim()) {
      toast.error("Enter a from email address, then save, before sending a test email.");
      return;
    }

    setIsTestingEmail(true);
    try {
      const saved = await handleSaveEmailTransport({ silent: true });
      if (!saved) return;

      const response = await adminApi.testEmailTransport({
        to: user?.email,
      });
      toast.success(
        (response as any)?.message || "Test email sent — check your inbox"
      );
    } catch (error: any) {
      toast.error(error?.message || "Test email failed");
    } finally {
      setIsTestingEmail(false);
    }
  };

  const applyAiProvidersResponse = (config: any) => {
    const incoming: AiProvider[] = ((config?.providers as any[]) ?? []).map(
      (provider) => ({
        id: String(provider.id),
        label: String(provider.label ?? ""),
        providerType: String(provider.providerType ?? "custom"),
        baseUrl: String(provider.baseUrl ?? ""),
        model: String(provider.model ?? ""),
        apiKey: "",
        hasApiKey: Boolean(provider.hasApiKey),
        apiKeyHint: provider.apiKeyHint ?? "",
      })
    );
    setAiProviders(incoming);
    setAiActiveProviderId(
      String(config?.activeProviderId ?? incoming[0]?.id ?? "")
    );
  };

  const loadAiProviderSettings = async () => {
    try {
      const response = await adminApi.getAiProviderSettings();
      applyAiProvidersResponse((response as any)?.aiProviders ?? {});
    } catch (error) {
      console.error("Failed to load AI provider settings:", error);
    }
  };

  const updateAiProvider = (id: string, patch: Partial<AiProvider>) => {
    setAiProviders((current) =>
      current.map((provider) =>
        provider.id === id ? { ...provider, ...patch } : provider
      )
    );
  };

  const handleAiProviderTypeChange = (id: string, providerType: string) => {
    const preset = AI_PROVIDER_PRESETS.find((p) => p.value === providerType);
    setAiProviders((current) =>
      current.map((provider) => {
        if (provider.id !== id) return provider;
        const next: AiProvider = { ...provider, providerType };
        if (preset && preset.value !== "custom") {
          next.baseUrl = preset.baseUrl;
          next.model = preset.model;
          const labelIsPreset = AI_PROVIDER_PRESETS.some(
            (p) => p.label === provider.label
          );
          if (!provider.label.trim() || labelIsPreset) {
            next.label = preset.label;
          }
        }
        return next;
      })
    );
  };

  const handleAddAiProvider = () => {
    const created = createEmptyAiProvider();
    setAiProviders((current) => {
      const next = [...current, created];
      if (next.length === 1) {
        setAiActiveProviderId(created.id);
      }
      return next;
    });
    setExpandedAiProviderIds((current) => new Set(current).add(created.id));
  };

  const handleRemoveAiProvider = (id: string) => {
    setAiProviders((current) => {
      const next = current.filter((provider) => provider.id !== id);
      if (aiActiveProviderId === id) {
        setAiActiveProviderId(next[0]?.id ?? "");
      }
      return next;
    });
    setExpandedAiProviderIds((current) => {
      if (!current.has(id)) return current;
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  };

  const toggleAiProviderExpanded = (id: string, open: boolean) => {
    setExpandedAiProviderIds((current) => {
      const next = new Set(current);
      if (open) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const buildAiProvidersPayload = () => ({
    providers: aiProviders.map((provider) => {
      const entry: Record<string, unknown> = {
        id: provider.id,
        label: provider.label.trim(),
        providerType: provider.providerType,
        baseUrl: provider.baseUrl.trim(),
        model: provider.model.trim(),
      };
      if (provider.apiKey.trim()) {
        entry.apiKey = provider.apiKey.trim();
      }
      return entry;
    }),
    activeProviderId: aiActiveProviderId,
  });

  const handleSaveAiProviders = async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setIsSavingAiProviders(true);
    }
    try {
      const response = await adminApi.updateAiProviderSettings(
        buildAiProvidersPayload()
      );
      applyAiProvidersResponse((response as any)?.aiProviders ?? {});
      await refreshAiStatus();
      if (!options?.silent) {
        toast.success("AI provider settings saved");
      }
      return true;
    } catch (error: any) {
      toast.error(error?.message || "Failed to save AI provider settings");
      return false;
    } finally {
      if (!options?.silent) {
        setIsSavingAiProviders(false);
      }
    }
  };

  const handleTestAiProvider = async (provider: AiProvider) => {
    if (!provider.baseUrl.trim() || !provider.model.trim()) {
      toast.error("Enter a base URL and model before testing.");
      return;
    }
    if (!provider.hasApiKey && !provider.apiKey.trim()) {
      toast.error("Enter an API key before testing this provider.");
      return;
    }

    setTestingAiProviderId(provider.id);
    try {
      if (provider.apiKey.trim()) {
        const saved = await handleSaveAiProviders({ silent: true });
        if (!saved) return;
      }

      const payload: Record<string, unknown> = {
        baseUrl: provider.baseUrl.trim(),
        model: provider.model.trim(),
      };
      if (provider.apiKey.trim()) {
        payload.apiKey = provider.apiKey.trim();
      } else {
        payload.id = provider.id;
      }
      const response = await adminApi.testAiProvider(payload);
      const result = response as { message?: string; sampleReply?: string };
      const successMessage = result.sampleReply
        ? `Connection successful — model replied: "${result.sampleReply}"`
        : result.message || "Connection successful — provider is reachable";
      toast.success(successMessage);
    } catch (error: any) {
      toast.error(error?.message || "Provider test failed");
    } finally {
      setTestingAiProviderId(null);
    }
  };

  const handleBqiIntelligenceToggle = async (
    key: keyof BqiIntelligenceSettings,
    checked: boolean
  ) => {
    const previous = bqiIntelligence;
    const next = { ...previous, [key]: checked };
    setBqiIntelligence(next);
    setBqiIntelligenceFeatures(next);
    setIsSavingIntelligence(true);
    try {
      await adminApi.updateSettings({ bqiIntelligence: next });
      await refreshBqiIntelligence();
    } catch (error: any) {
      setBqiIntelligence(previous);
      setBqiIntelligenceFeatures(previous);
      toast.error(error?.message || "Failed to update BQI Intelligence");
    } finally {
      setIsSavingIntelligence(false);
    }
  };

  const handleSaveAdminPath = async () => {
    if (isSavingAdminPath) return;

    if (settings.admin_path_hidden) {
      const validation = validateAdminPathSlug(settings.admin_path_slug);
      if (!validation.ok) {
        setAdminPathDraftError(validation.error || "Invalid slug");
        toast.error(validation.error || "Invalid admin path slug");
        return;
      }
      setAdminPathDraftError(null);
    } else {
      setAdminPathDraftError(null);
    }

    setIsSavingAdminPath(true);
    try {
      const slug = settings.admin_path_hidden
        ? validateAdminPathSlug(settings.admin_path_slug).slug
        : settings.admin_path_slug.trim()
          ? validateAdminPathSlug(settings.admin_path_slug).slug
          : null;

      if (settings.admin_path_hidden && !slug) {
        throw new Error("A valid custom slug is required when hiding /admin");
      }

      const payload = {
        admin_path_hidden: Boolean(settings.admin_path_hidden),
        admin_path_slug: slug,
      };
      const response = await adminApi.updateSettings(payload);
      const next = (response as any)?.settings ?? payload;
      applyConfig({
        admin_path_hidden: Boolean(next.admin_path_hidden ?? payload.admin_path_hidden),
        admin_path_slug: next.admin_path_slug ?? payload.admin_path_slug,
      });
      setSettings((prev) => ({
        ...prev,
        admin_path_hidden: Boolean(next.admin_path_hidden ?? payload.admin_path_hidden),
        admin_path_slug: String(next.admin_path_slug ?? payload.admin_path_slug ?? ""),
      }));

      const nextBase = getPublicAdminBasePath({
        admin_path_hidden: Boolean(next.admin_path_hidden ?? payload.admin_path_hidden),
        admin_path_slug: next.admin_path_slug ?? payload.admin_path_slug,
      });
      toast.success(
        nextBase === "/manage"
          ? "Admin URL restored to /admin"
          : `Admin URL updated. Use ${nextBase} from now on.`
      );

      // Keep the admin on the settings page under the new public path.
      if (typeof window !== "undefined") {
        const target = `${nextBase}/settings?section=security`;
        if (window.location.pathname !== `${nextBase}/settings`) {
          window.location.assign(target);
        }
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to update admin URL");
    } finally {
      setIsSavingAdminPath(false);
    }
  };

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);

    try {
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
      if (recaptchaSiteKey.trim() || recaptchaSecretKey.trim()) {
        const updateRecaptchaSettingsApi = (adminApi as any)
          .updateRecaptchaSettings;
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
      await loadSettings();
      await loadRecaptchaSettings();
      setRecaptchaSecretKey("");
      toast.success("Settings saved successfully");
    } catch (error: any) {
      console.error("Save error:", error);
      toast.error(error?.message || "Failed to save settings");
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

  const preserveScrollPosition = (updateFn: () => void) => {
    if (typeof window === "undefined") {
      updateFn();
      return;
    }

    const container =
      (document.querySelector("main.overflow-y-auto") as HTMLElement | null) ||
      (document.scrollingElement as HTMLElement | null);
    const previousScrollTop = container?.scrollTop ?? window.scrollY;

    updateFn();

    requestAnimationFrame(() => {
      if (container) {
        container.scrollTop = previousScrollTop;
      } else {
        window.scrollTo({ top: previousScrollTop });
      }
    });
  };

  const updateSetting = <K extends keyof AdminSettings>(
    key: K,
    value: AdminSettings[K]
  ) => {
    preserveScrollPosition(() => {
      setSettings((prev) => ({ ...prev, [key]: value }));
    });
  };

  const updateContactProtection = (
    patch: Partial<AdminSettings["contactProtection"]>
  ) => {
    preserveScrollPosition(() => {
      setSettings((prev) => ({
        ...prev,
        contactProtection: {
          ...prev.contactProtection,
          ...patch,
        },
      }));
    });
  };

  const updateContactProtectionNumber = (
    key: keyof AdminSettings["contactProtection"],
    value: string,
    min: number,
    max?: number
  ) => {
    if (value.trim() === "") return;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return;
    let normalized = Math.trunc(parsed);
    if (normalized < min) normalized = min;
    if (typeof max === "number" && normalized > max) normalized = max;
    updateContactProtection({
      [key]: normalized,
    } as Partial<AdminSettings["contactProtection"]>);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_PYTHON_API_URL}/api/upload/avatar`,
        {
          method: "POST",
          body: formData,
          credentials: "include",
          headers: {
            Authorization: `Bearer ${authService.getSession()?.token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to upload avatar");
      }

      const data = await response.json();
      setSettings((prev) => ({
        ...prev,
        avatar: data.url,
      }));
      updateUserAvatar(data.url);
      toast.success("Avatar updated successfully");
    } catch (error) {
      console.error("Avatar upload error:", error);
      toast.error("Failed to upload avatar");
    }
  };

  const displayName = user
    ? `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Admin User"
    : "Admin User";
  const initials =
    [user?.firstName?.[0], user?.lastName?.[0]].filter(Boolean).join("") || "A";

  const renderSectionContent = () => {
    switch (activeSection) {
      case "general":
        return (
          <SettingsPanel
            title="Appearance & layout"
            description="Personalize how the admin dashboard looks and behaves"
          >
            <div className="grid gap-6 sm:grid-cols-2">
              <SettingsField label="Table density">
                <Select
                  value={settings.tableRowsPerPage.toString()}
                  onValueChange={(value) =>
                    updateSetting("tableRowsPerPage", Number(value))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Rows per page" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10 rows per page</SelectItem>
                    <SelectItem value="25">25 rows per page</SelectItem>
                    <SelectItem value="50">50 rows per page</SelectItem>
                  </SelectContent>
                </Select>
              </SettingsField>

              <SettingsField label="Color theme">
                <Select
                  value={settings.theme}
                  onValueChange={(value) => {
                    updateSetting("theme", value);
                    setAdminTheme(value as AdminTheme);
                    if (value !== "studio") {
                      try {
                        setTheme(value);
                      } catch {}
                    }
                    updateTheme(value as AdminTheme);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Theme" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                    <SelectItem value="studio">Studio</SelectItem>
                    <SelectItem value="system">System</SelectItem>
                  </SelectContent>
                </Select>
                <p className="mt-2 text-xs text-muted-foreground">
                  Studio keeps dashboard pages light with a premium dark sidebar.
                </p>
              </SettingsField>
            </div>

            <Separator />

            <SettingsToggleRow
              label="Compact sidebar"
              description="Hide the navigation labels panel to maximize workspace (icon rail stays visible)"
              checked={settings.sidebarCollapsed}
              onCheckedChange={async (checked) => {
                updateSetting("sidebarCollapsed", checked);
                try {
                  await updateSettings({ sidebarCollapsed: checked } as any);
                } catch {}
              }}
            />
          </SettingsPanel>
        );

      case "notifications":
        return (
          <SettingsPanel
            title="Notification preferences"
            description="Choose how you receive alerts and updates"
          >
            <div className="space-y-3">
              <SettingsToggleRow
                label="Email notifications"
                description="Receive important updates and alerts via email"
                checked={settings.emailNotifications}
                onCheckedChange={(checked) =>
                  updateSetting("emailNotifications", checked)
                }
              />
              <SettingsToggleRow
                label="Push notifications"
                description="Receive real-time browser push notifications"
                checked={settings.pushNotifications}
                onCheckedChange={(checked) =>
                  updateSetting("pushNotifications", checked)
                }
              />
            </div>
          </SettingsPanel>
        );

      case "security":
        return (
          <div className="space-y-6">
            <SettingsPanel
              title="Two-factor authentication"
              description="Authenticator apps, email codes, recovery codes, and org policy"
            >
              <AdminSecurity2faCard
                canEditPolicy={
                  String(user?.role || "").toUpperCase() === "SUPER_ADMIN"
                }
              />
            </SettingsPanel>

            <SettingsPanel
              title="Session security"
              description="Control automatic logout and session duration"
            >
              <SettingsField
                label="Auto logout"
                hint="Automatically sign out after a period of inactivity"
              >
                <Select
                  value={settings.autoLogout.toString()}
                  onValueChange={(value) =>
                    updateSetting("autoLogout", Number(value))
                  }
                >
                  <SelectTrigger className="max-w-xs">
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
              </SettingsField>
            </SettingsPanel>

            <SettingsPanel
              title="Admin login URL"
              description="Hide /admin behind a unique slug (WordPress-style). Only people who know the slug can reach the panel."
            >
              <SettingsToggleRow
                label="Hide default /admin path"
                description="When enabled, /admin and /admin/* return a generic 404. Use your custom slug instead."
                checked={settings.admin_path_hidden}
                onCheckedChange={(checked) => {
                  updateSetting("admin_path_hidden", checked);
                  setAdminPathDraftError(null);
                }}
              />

              <SettingsField
                label="Custom slug"
                hint="Lowercase letters, numbers, and hyphens. Avoid reserved routes like api, login, blog, employee."
              >
                <div className="flex max-w-md items-center gap-2">
                  <span className="shrink-0 text-sm text-muted-foreground">
                    /
                  </span>
                  <Input
                    value={settings.admin_path_slug}
                    onChange={(e) => {
                      updateSetting("admin_path_slug", e.target.value);
                      setAdminPathDraftError(null);
                    }}
                    placeholder="my-secure-portal"
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>
                {adminPathDraftError ? (
                  <p className="mt-2 text-sm text-destructive">
                    {adminPathDraftError}
                  </p>
                ) : null}
              </SettingsField>

              <div className="rounded-xl border border-border/60 bg-muted/30 px-4 py-3.5">
                <p className="text-sm font-medium">Resulting admin URL</p>
                <p className="mt-1 break-all font-mono text-sm text-muted-foreground">
                  {(APP_URL || "").replace(/\/+$/, "")}
                  {getPublicAdminBasePath({
                    admin_path_hidden: settings.admin_path_hidden,
                    admin_path_slug: settings.admin_path_slug || null,
                  })}
                  /login
                </p>
                {settings.admin_path_hidden ? (
                  <p className="mt-3 flex gap-2 text-sm text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      Bookmark the new URL before saving. After the change,
                      old /admin bookmarks will stop working and will not
                      reveal that an admin panel exists.
                    </span>
                  </p>
                ) : null}
                {basePath !== "/manage" ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Current live base path (admins only):{" "}
                    <span className="font-mono">{basePath}</span>
                    {" · "}
                    <a
                      className="underline underline-offset-2"
                      href={adminHref("/manage/settings")}
                    >
                      Open settings
                    </a>
                  </p>
                ) : null}
              </div>

              <div className="flex justify-end">
                <Button
                  type="button"
                  onClick={() => void handleSaveAdminPath()}
                  disabled={isSavingAdminPath}
                >
                  {isSavingAdminPath ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving URL…
                    </>
                  ) : (
                    "Save admin URL"
                  )}
                </Button>
              </div>
            </SettingsPanel>
          </div>
        );

      case "contact":
        return (
          <div className="space-y-6">
            <SettingsPanel
              title="Public contact form"
              description="Control visitor submissions and anti-spam protection"
            >
              <SettingsToggleRow
                label="Enable contact form"
                description="Allow visitors to send messages through the public site"
                checked={settings.contactFormEnabled}
                onCheckedChange={(checked) =>
                  updateSetting("contactFormEnabled", checked)
                }
              />

              <Separator />

              <div>
                <p className="mb-4 text-sm font-medium">Rate limiting</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <SettingsField label="Min message length">
                    <Input
                      type="number"
                      min={5}
                      inputMode="numeric"
                      value={settings.contactProtection.minMessageChars}
                      onChange={(e) =>
                        updateContactProtectionNumber(
                          "minMessageChars",
                          e.target.value,
                          5,
                          10000
                        )
                      }
                    />
                  </SettingsField>
                  <SettingsField label="Max message length">
                    <Input
                      type="number"
                      min={10}
                      inputMode="numeric"
                      value={settings.contactProtection.maxMessageChars}
                      onChange={(e) =>
                        updateContactProtectionNumber(
                          "maxMessageChars",
                          e.target.value,
                          10,
                          50000
                        )
                      }
                    />
                  </SettingsField>
                  <SettingsField label="Max submissions per IP">
                    <Input
                      type="number"
                      min={1}
                      inputMode="numeric"
                      value={settings.contactProtection.maxSubmissionsPerIp}
                      onChange={(e) =>
                        updateContactProtectionNumber(
                          "maxSubmissionsPerIp",
                          e.target.value,
                          1,
                          100000
                        )
                      }
                    />
                  </SettingsField>
                  <SettingsField label="IP window (minutes)">
                    <Input
                      type="number"
                      min={1}
                      inputMode="numeric"
                      value={settings.contactProtection.ipWindowMinutes}
                      onChange={(e) =>
                        updateContactProtectionNumber(
                          "ipWindowMinutes",
                          e.target.value,
                          1,
                          10080
                        )
                      }
                    />
                  </SettingsField>
                  <SettingsField label="Block duration (minutes)">
                    <Input
                      type="number"
                      min={1}
                      inputMode="numeric"
                      value={settings.contactProtection.blockWindowMinutes}
                      onChange={(e) =>
                        updateContactProtectionNumber(
                          "blockWindowMinutes",
                          e.target.value,
                          1,
                          10080
                        )
                      }
                    />
                  </SettingsField>
                </div>
              </div>

              <Separator />

              <div>
                <p className="mb-4 text-sm font-medium">Captcha & scoring</p>
                <div className="space-y-4">
                  <SettingsToggleRow
                    label="Captcha fallback"
                    description="Challenge borderline suspicious submissions"
                    checked={settings.contactProtection.captchaEnabled}
                    onCheckedChange={(checked) =>
                      updateContactProtection({ captchaEnabled: checked })
                    }
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <SettingsField label="Captcha score threshold">
                      <Input
                        type="number"
                        min={1}
                        max={100}
                        inputMode="numeric"
                        value={settings.contactProtection.captchaScoreThreshold}
                        onChange={(e) =>
                          updateContactProtectionNumber(
                            "captchaScoreThreshold",
                            e.target.value,
                            1,
                            100
                          )
                        }
                      />
                    </SettingsField>
                    <SettingsField label="Block score threshold">
                      <Input
                        type="number"
                        min={0}
                        max={99}
                        inputMode="numeric"
                        value={settings.contactProtection.blockScoreThreshold}
                        onChange={(e) =>
                          updateContactProtectionNumber(
                            "blockScoreThreshold",
                            e.target.value,
                            0,
                            99
                          )
                        }
                      />
                    </SettingsField>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <p className="mb-4 text-sm font-medium">Google reCAPTCHA</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <SettingsField label="Site key">
                    <Input
                      type="text"
                      value={recaptchaSiteKey}
                      onChange={(e) =>
                        preserveScrollPosition(() =>
                          setRecaptchaSiteKey(e.target.value)
                        )
                      }
                      placeholder="Enter site key"
                    />
                  </SettingsField>
                  <SettingsField
                    label="Secret key"
                    hint={
                      hasRecaptchaSecret
                        ? "Secret is configured. Enter a new value only to rotate."
                        : "No secret key configured yet."
                    }
                  >
                    <Input
                      type="password"
                      value={recaptchaSecretKey}
                      onChange={(e) =>
                        preserveScrollPosition(() =>
                          setRecaptchaSecretKey(e.target.value)
                        )
                      }
                      placeholder={
                        hasRecaptchaSecret
                          ? "Leave blank to keep current secret"
                          : "Enter secret key"
                      }
                    />
                  </SettingsField>
                </div>
              </div>
            </SettingsPanel>

            <SettingsPanel
              title="Spam analytics"
              description="Recent blocked and challenged submissions"
              badge={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadContactAnalytics}
                  disabled={isLoadingAnalytics}
                >
                  {isLoadingAnalytics ? (
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-3.5 w-3.5" />
                  )}
                  Refresh
                </Button>
              }
            >
              <p className="text-sm text-muted-foreground">
                Last 7 days · latest 20 events
              </p>
              <div className="overflow-hidden rounded-xl border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead className="font-semibold">IP</TableHead>
                      <TableHead className="font-semibold">Reason</TableHead>
                      <TableHead className="font-semibold">Event</TableHead>
                      <TableHead className="font-semibold text-right">
                        Time
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contactSpamEvents.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="py-8 text-center text-muted-foreground"
                        >
                          No spam events recorded yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      contactSpamEvents.map((event, index) => (
                        <TableRow key={event.id || `${event.ip}-${index}`}>
                          <TableCell className="font-mono text-xs">
                            {event.ip || "unknown"}
                          </TableCell>
                          <TableCell className="max-w-[180px] truncate">
                            {event.reason || "unknown"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="font-normal">
                              {event.eventType || "unknown"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground">
                            {event.createdAt
                              ? new Date(event.createdAt).toLocaleString()
                              : "—"}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </SettingsPanel>
          </div>
        );

      case "email":
        return (
          <SettingsPanel
            title="Email delivery"
            description="Configure outbound email for invites and notifications without SMTP on Render"
            badge={
              emailTransport.configured ? (
                <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-600">
                  <CheckCircle2 className="h-3 w-3" />
                  Configured
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1 text-amber-600">
                  <AlertCircle className="h-3 w-3" />
                  Not configured
                </Badge>
              )
            }
          >
            <SettingsField label="Provider">
              <Select
                value={emailTransport.provider}
                onValueChange={(value) =>
                  setEmailTransport((current) => {
                    const next = { ...current, provider: value };
                    if (value === "netlify_relay" || value === "relay") {
                      next.relayUrl = DEFAULT_BQITECH_RELAY_URL;
                      next.usesBqitechApiRelay = true;
                    }
                    return next;
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="netlify_relay">
                    BQI API relay (api.bqitech.com — recommended)
                  </SelectItem>
                  <SelectItem value="sendgrid">SendGrid API (direct)</SelectItem>
                  <SelectItem value="smtp">SMTP (Office 365)</SelectItem>
                </SelectContent>
              </Select>
            </SettingsField>

            <div className="grid gap-4 sm:grid-cols-2">
              {(emailTransport.provider === "netlify_relay" ||
                emailTransport.provider === "relay") && (
                <SettingsField
                  label="Relay URL"
                  hint={
                    isBqitechApiRelayUrl(emailTransport.relayUrl)
                      ? "Production API on paid Render — sends via Office 365 SMTP"
                      : isLegacyNetlifyRelayUrl(emailTransport.relayUrl)
                        ? "Legacy Netlify relay — requires SendGrid API key below"
                        : "HTTP relay endpoint"
                  }
                  className="sm:col-span-2"
                >
                  <Input
                    value={emailTransport.relayUrl}
                    onChange={(e) =>
                      setEmailTransport((current) => ({
                        ...current,
                        relayUrl: e.target.value,
                        usesBqitechApiRelay: isBqitechApiRelayUrl(e.target.value),
                      }))
                    }
                    placeholder={DEFAULT_BQITECH_RELAY_URL}
                  />
                </SettingsField>
              )}

              {isLegacyNetlifyRelayUrl(emailTransport.relayUrl) && (
                <div className="sm:col-span-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  This URL points at Netlify. For dev on Render, use{" "}
                  <button
                    type="button"
                    className="font-medium underline"
                    onClick={() =>
                      setEmailTransport((current) => ({
                        ...current,
                        relayUrl: DEFAULT_BQITECH_RELAY_URL,
                        usesBqitechApiRelay: true,
                      }))
                    }
                  >
                    {DEFAULT_BQITECH_RELAY_URL}
                  </button>{" "}
                  — no SendGrid required.
                </div>
              )}

              {isBqitechApiRelayUrl(emailTransport.relayUrl) && (
                <SettingsField
                  label="Relay secret"
                  hint={
                    emailTransport.hasRelaySecret
                      ? "Secret is saved. Enter a new value only to replace it."
                      : "Must match EMAIL_RELAY_SECRET on api.bqitech.com (Render)"
                  }
                  className="sm:col-span-2"
                >
                  <Input
                    type="password"
                    value={emailTransport.relaySecret}
                    onChange={(e) =>
                      setEmailTransport((current) => ({
                        ...current,
                        relaySecret: e.target.value,
                      }))
                    }
                    placeholder={
                      emailTransport.hasRelaySecret
                        ? "••••••••••••••••"
                        : "Shared relay key"
                    }
                  />
                </SettingsField>
              )}

              <SettingsField label="From email" hint="Sender address for outbound mail">
                <Input
                  type="email"
                  value={emailTransport.fromEmail}
                  onChange={(e) =>
                    setEmailTransport((current) => ({
                      ...current,
                      fromEmail: e.target.value,
                    }))
                  }
                  placeholder="hr@bqitech.com"
                />
              </SettingsField>

              {(emailTransport.provider === "sendgrid" ||
                isLegacyNetlifyRelayUrl(emailTransport.relayUrl)) && (
                <SettingsField
                  label="SendGrid API key"
                  hint={
                    emailTransport.hasSendgridApiKey
                      ? "API key is saved. Enter a new value only to replace it."
                      : "From your SendGrid dashboard → Settings → API Keys"
                  }
                >
                  <Input
                    type="password"
                    value={emailTransport.sendgridApiKey}
                    onChange={(e) =>
                      setEmailTransport((current) => ({
                        ...current,
                        sendgridApiKey: e.target.value,
                      }))
                    }
                    placeholder={
                      emailTransport.hasSendgridApiKey
                        ? "••••••••••••••••"
                        : "SG.xxxxxxxxxxxx"
                    }
                  />
                </SettingsField>
              )}
            </div>

            <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 p-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">BQI production relay</p>
              <p className="mt-1">
                Dev backends POST to{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-xs">
                  {DEFAULT_BQITECH_RELAY_URL}
                </code>
                . Production sends mail via Office 365 SMTP — no SendGrid required.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                type="button"
                onClick={() => handleSaveEmailTransport()}
                disabled={isSavingEmailTransport}
              >
                {isSavingEmailTransport ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Save email settings
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleTestEmailTransport}
                disabled={isTestingEmail}
              >
                {isTestingEmail ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Mail className="mr-2 h-4 w-4" />
                )}
                Send test email
              </Button>
            </div>
          </SettingsPanel>
        );

      case "integrations":
        return (
          <SettingsPanel
            title="Integrations"
            description="Connect external accounts used across the admin workspace"
          >
            <div className="grid gap-4">
              <MicrosoftIntegrationCard
                oauthNotice={microsoftOAuthNotice}
                oauthError={microsoftOAuthError}
                onOAuthNoticeHandled={() => {
                  setMicrosoftOAuthNotice(null);
                  setMicrosoftOAuthError(null);
                  if (typeof window !== "undefined") {
                    const url = new URL(window.location.href);
                    url.searchParams.delete("microsoft");
                    url.searchParams.delete("microsoft_error");
                    window.history.replaceState({}, "", url.toString());
                  }
                }}
              />
              <DocuSignIntegrationCard />
              <LinearIntegrationCard />
            </div>
          </SettingsPanel>
        );

      case "ai":
        return (
          <SettingsPanel
            title="AI providers"
            description="Configure OpenAI-compatible providers, models and API keys. The active provider powers BQI Intelligence ranking, survey and email generation."
            badge={
              aiProviders.some((provider) => provider.hasApiKey) ? (
                <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-600">
                  <CheckCircle2 className="h-3 w-3" />
                  Configured
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1 text-amber-600">
                  <AlertCircle className="h-3 w-3" />
                  Not configured
                </Badge>
              )
            }
          >
            {aiProviders.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 p-6 text-center text-sm text-muted-foreground">
                No AI providers configured yet. Add one to get started.
              </div>
            ) : (
              <div className="space-y-3">
                {aiProviders.map((provider) => {
                  const isActive = aiActiveProviderId === provider.id;
                  const isTesting = testingAiProviderId === provider.id;
                  const isExpanded = expandedAiProviderIds.has(provider.id);
                  const providerTypeLabel =
                    AI_PROVIDER_PRESETS.find(
                      (preset) => preset.value === provider.providerType
                    )?.label ?? provider.providerType;

                  return (
                    <Collapsible
                      key={provider.id}
                      open={isExpanded}
                      onOpenChange={(open) =>
                        toggleAiProviderExpanded(provider.id, open)
                      }
                      className={cn(
                        "rounded-xl border transition-colors",
                        isActive
                          ? "border-primary/40 bg-primary/[0.04]"
                          : "border-border/60 bg-muted/20"
                      )}
                    >
                      <div className="flex items-center gap-2 px-4 py-3">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setAiActiveProviderId(provider.id);
                          }}
                          className={cn(
                            "flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
                            isActive
                              ? "border-primary/40 bg-primary/10 text-primary"
                              : "border-border/60 text-muted-foreground hover:text-foreground"
                          )}
                        >
                          <Star
                            className={cn(
                              "h-3.5 w-3.5",
                              isActive && "fill-current"
                            )}
                          />
                          {isActive ? "Active" : "Set active"}
                        </button>

                        <CollapsibleTrigger asChild>
                          <button
                            type="button"
                            className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1 py-1 text-left transition-colors hover:bg-muted/40"
                            aria-label={
                              isExpanded
                                ? `Collapse ${provider.label || "provider"}`
                                : `Expand ${provider.label || "provider"}`
                            }
                          >
                            <span className="min-w-0 truncate text-sm font-medium text-foreground">
                              {provider.label?.trim() || "Untitled provider"}
                            </span>
                            <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                              {providerTypeLabel}
                            </span>
                            {provider.model ? (
                              <span className="hidden min-w-0 truncate text-xs text-muted-foreground md:inline">
                                · {provider.model}
                              </span>
                            ) : null}
                            <ChevronDown
                              className={cn(
                                "ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
                                isExpanded && "rotate-180"
                              )}
                            />
                          </button>
                        </CollapsibleTrigger>
                      </div>

                      <CollapsibleContent>
                        <div className="space-y-4 border-t border-border/50 px-4 pb-4 pt-4">
                          <div className="flex justify-end">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() =>
                                handleRemoveAiProvider(provider.id)
                              }
                            >
                              <Trash2 className="mr-1.5 h-4 w-4" />
                              Remove
                            </Button>
                          </div>

                          <div className="grid gap-4 sm:grid-cols-2">
                            <SettingsField label="Display name">
                              <Input
                                value={provider.label}
                                onChange={(e) =>
                                  updateAiProvider(provider.id, {
                                    label: e.target.value,
                                  })
                                }
                                placeholder="e.g. NVIDIA production"
                              />
                            </SettingsField>

                            <SettingsField label="Provider type">
                              <Select
                                value={provider.providerType}
                                onValueChange={(value) =>
                                  handleAiProviderTypeChange(
                                    provider.id,
                                    value
                                  )
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {AI_PROVIDER_PRESETS.map((preset) => (
                                    <SelectItem
                                      key={preset.value}
                                      value={preset.value}
                                    >
                                      {preset.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </SettingsField>

                            <SettingsField
                              label="Base URL"
                              hint="OpenAI-compatible endpoint (without /chat/completions)"
                              className="sm:col-span-2"
                            >
                              <Input
                                value={provider.baseUrl}
                                onChange={(e) =>
                                  updateAiProvider(provider.id, {
                                    baseUrl: e.target.value,
                                  })
                                }
                                placeholder="https://api.openai.com/v1"
                              />
                            </SettingsField>

                            <SettingsField label="Model">
                              <Input
                                value={provider.model}
                                onChange={(e) =>
                                  updateAiProvider(provider.id, {
                                    model: e.target.value,
                                  })
                                }
                                placeholder="gpt-4o-mini"
                              />
                            </SettingsField>

                            <SettingsField
                              label="API key"
                              hint={
                                provider.hasApiKey
                                  ? "Key is saved. Enter a new value only to replace it."
                                  : "Bearer token for this provider"
                              }
                            >
                              <Input
                                type="password"
                                autoComplete="new-password"
                                value={provider.apiKey}
                                onChange={(e) =>
                                  updateAiProvider(provider.id, {
                                    apiKey: e.target.value,
                                  })
                                }
                                placeholder={
                                  provider.hasApiKey
                                    ? provider.apiKeyHint ||
                                      "••••••••••••••••"
                                    : "sk-..."
                                }
                              />
                            </SettingsField>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleTestAiProvider(provider)}
                              disabled={isTesting}
                            >
                              {isTesting ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <Bot className="mr-2 h-4 w-4" />
                              )}
                              Test connection
                            </Button>
                          </div>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })}
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              <Button type="button" variant="outline" onClick={handleAddAiProvider}>
                <Plus className="mr-2 h-4 w-4" />
                Add provider
              </Button>
              <Button
                type="button"
                onClick={() => handleSaveAiProviders()}
                disabled={isSavingAiProviders}
              >
                {isSavingAiProviders ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Save AI settings
              </Button>
            </div>

            <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 p-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Shared across admins</p>
              <p className="mt-1">
                AI providers are stored centrally, so a key saved by any admin
                enables BQI Intelligence features for every admin. Ranking stays
                off until a provider with an API key is saved here.
              </p>
            </div>
          </SettingsPanel>
        );

      case "intelligence":
        return (
          <SettingsPanel
            title="BQI Intelligence"
            description="Manage how your company uses features of BQI Intelligence."
            badge={
              isSavingIntelligence ? (
                <Badge variant="outline" className="gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Saving
                </Badge>
              ) : null
            }
          >
            <div className="space-y-3">
              {BQI_INTELLIGENCE_FEATURES.map((feature) => (
                <SettingsToggleRow
                  key={feature.key}
                  label={feature.label}
                  description={feature.description}
                  checked={bqiIntelligence[feature.key]}
                  disabled={isSavingIntelligence}
                  onCheckedChange={(checked) =>
                    void handleBqiIntelligenceToggle(feature.key, checked)
                  }
                />
              ))}
            </div>
          </SettingsPanel>
        );

      case "system":
        return (
          <SettingsPanel
            title="Database sync"
            description="Manually synchronize database replicas and connected stores"
          >
            <div className="flex flex-col gap-4 rounded-xl border border-border/60 bg-muted/20 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium">Run database sync</p>
                <p className="text-sm text-muted-foreground">
                  Triggers an immediate sync between configured database targets.
                  Use after configuration changes or data migrations.
                </p>
              </div>
              <Button
                onClick={handleManualDatabaseSync}
                disabled={isSyncingDatabases}
                variant="outline"
                className="shrink-0"
              >
                {isSyncingDatabases ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Syncing…
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Sync now
                  </>
                )}
              </Button>
            </div>
          </SettingsPanel>
        );

      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <AdminPageLayout title="Settings" showSearch={false}>
        <FormSkeleton />
      </AdminPageLayout>
    );
  }

  const showGlobalSave =
    activeSection !== "email" &&
    activeSection !== "integrations" &&
    activeSection !== "ai" &&
    activeSection !== "intelligence" &&
    activeSection !== "system";

  return (
    <AdminPageLayout title="Settings" showSearch={false} tourId="settings" guideInBanner>
      <TourPageHelper tourId="settings" />
      <div className="mx-auto max-w-6xl space-y-8">
        <AdminPageWelcomeBanner bannerKey="settings" tourId="settings" />
        {/* Profile hero */}
        <motion.div
          initial={false}
          className="relative overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm"
          data-tour="settings-profile"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.07] via-transparent to-primary/[0.03]" />
          <div className="relative flex flex-col items-center gap-6 p-6 md:flex-row md:p-8">
            <div className="group relative shrink-0">
              <Avatar className="h-28 w-28 ring-4 ring-background shadow-lg md:h-32 md:w-32">
                <AvatarImage
                  src={user?.avatar}
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
                <Camera className="h-7 w-7 text-white" />
              </label>
              <input
                id="avatarUpload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
              />
            </div>

            <div className="flex-1 space-y-3 text-center md:text-left">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
                  {displayName}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground md:text-base">
                  {user?.email}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2 md:justify-start">
                <Badge variant="secondary" className="capitalize">
                  {user?.role || "admin"}
                </Badge>
                <Badge variant="outline" className="gap-1">
                  <Layout className="h-3 w-3" />
                  Admin settings
                </Badge>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Main layout: sidebar + content */}
        <div className="grid gap-8 lg:grid-cols-[260px_minmax(0,1fr)]">
          <nav className="lg:sticky lg:top-24 lg:self-start" data-tour="settings-nav">
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
                    onClick={() => setActiveSection(item.id)}
                    data-tour={
                      item.id === "intelligence"
                        ? "settings-intelligence"
                        : undefined
                    }
                    className={cn(
                      "flex min-w-[200px] shrink-0 items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-all lg:min-w-0 lg:w-full",
                      isActive
                        ? "border-primary/30 bg-primary/10 text-primary shadow-sm"
                        : "border-transparent bg-muted/30 text-muted-foreground hover:border-border/60 hover:bg-muted/50 hover:text-foreground"
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                        isActive ? "bg-primary/15" : "bg-background"
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
            {relatedSettingsLinks.length > 0 ? (
              <div className="mt-6 space-y-2" data-tour="settings-related">
                <p className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Related
                </p>
                {relatedSettingsLinks.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="flex items-center gap-3 rounded-xl border border-transparent bg-muted/30 px-3.5 py-3 text-left text-muted-foreground transition-all hover:border-border/60 hover:bg-muted/50 hover:text-foreground"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background">
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
                    </Link>
                  );
                })}
              </div>
            ) : null}
          </nav>

          <motion.div
            key={activeSection}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="min-w-0"
            data-tour="settings-content"
          >
            {renderSectionContent()}
          </motion.div>
        </div>

        {/* Sticky action bar */}
        {showGlobalSave ? (
          <div className="sticky bottom-0 z-10 -mx-4 border-t border-border/60 bg-background/90 px-4 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/75 sm:-mx-6 sm:px-6">
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
              <p className="text-center text-xs text-muted-foreground sm:mr-auto sm:text-left">
                Changes apply after you save settings.
              </p>
              <Button
                onClick={handleSave}
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
        ) : null}
      </div>
    </AdminPageLayout>
  );
}

export default function SettingsPage() {
  return (
    <ProtectedRoute requireAdmin>
      <Suspense fallback={null}>
        <SettingsPageContent />
      </Suspense>
    </ProtectedRoute>
  );
}
