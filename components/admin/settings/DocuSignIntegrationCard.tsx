"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Unplug,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { adminApi } from "@/lib/api-backend";
import { cn } from "@/lib/utils";

export interface DocuSignIntegrationStatus {
  provider?: string;
  configured: boolean;
  connected: boolean;
  integrationKey?: string;
  accountId?: string;
  userId?: string;
  authServer?: string;
  basePath?: string;
  hasClientSecret?: boolean;
  hasRsaPrivateKey?: boolean;
  message?: string | null;
}

function DocuSignLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      aria-hidden
      focusable="false"
    >
      <rect width="32" height="32" rx="6" fill="#272156" />
      <path
        fill="#31CDFF"
        d="M8 10h16v2.2H8V10zm0 4.9h12v2.2H8v-2.2zm0 4.9h14v2.2H8V19.8z"
      />
      <path
        fill="white"
        fillOpacity="0.9"
        d="M22.5 18.2l2.8 2.8-2.8 2.8-.9-.9 1.3-1.3H17v-1.2h5.9l-1.3-1.3.9-.9z"
      />
    </svg>
  );
}

function StatusBadge({
  connected,
  configured,
}: {
  connected: boolean;
  configured: boolean;
}) {
  if (connected) {
    return (
      <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-600">
        <CheckCircle2 className="h-3 w-3" />
        Connected
      </Badge>
    );
  }
  if (configured) {
    return (
      <Badge variant="outline" className="gap-1 text-muted-foreground">
        Not connected
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1 text-amber-700">
      <AlertCircle className="h-3 w-3" />
      Credentials needed
    </Badge>
  );
}

export function DocuSignIntegrationCard() {
  const [status, setStatus] = useState<DocuSignIntegrationStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [form, setForm] = useState({
    integrationKey: "",
    clientSecret: "",
    accountId: "",
    userId: "",
    rsaPrivateKey: "",
    authServer: "account-d.docusign.com",
    basePath: "",
  });

  const loadStatus = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await adminApi.getDocuSignIntegrationStatus();
      const next =
        (response as { status?: DocuSignIntegrationStatus })?.status ?? null;
      setStatus(next);
      setForm((current) => ({
        ...current,
        integrationKey: next?.integrationKey || "",
        accountId: next?.accountId || "",
        userId: next?.userId || "",
        authServer: next?.authServer || "account-d.docusign.com",
        basePath: next?.basePath || "",
        clientSecret: "",
        rsaPrivateKey: "",
      }));
    } catch (error) {
      console.error("Failed to load DocuSign status:", error);
      setStatus(null);
      toast.error("Failed to load DocuSign status");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload: Record<string, string> = {
        integrationKey: form.integrationKey.trim(),
        accountId: form.accountId.trim(),
        userId: form.userId.trim(),
        authServer: form.authServer.trim() || "account-d.docusign.com",
        basePath: form.basePath.trim(),
      };
      if (form.clientSecret.trim()) {
        payload.clientSecret = form.clientSecret.trim();
      }
      if (form.rsaPrivateKey.trim()) {
        payload.rsaPrivateKey = form.rsaPrivateKey.trim();
      }
      const response = await adminApi.saveIntegrationCredentials(
        "docusign",
        payload
      );
      const saved =
        (response as { credentials?: DocuSignIntegrationStatus })?.credentials;
      if (saved) {
        setStatus({
          ...saved,
          configured: Boolean(saved.configured),
          connected: Boolean(saved.connected ?? saved.configured),
        });
      }
      setForm((current) => ({
        ...current,
        clientSecret: "",
        rsaPrivateKey: "",
      }));
      await loadStatus();
      toast.success("DocuSign credentials saved");
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save DocuSign credentials"
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = async () => {
    setIsClearing(true);
    try {
      await adminApi.clearIntegrationCredentials("docusign");
      toast.success("DocuSign credentials cleared");
      await loadStatus();
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Failed to clear credentials"
      );
    } finally {
      setIsClearing(false);
    }
  };

  if (isLoading && !status) {
    return (
      <div className="rounded-xl border border-border/60 bg-muted/20 p-5">
        <div className="flex gap-3">
          <Skeleton className="h-11 w-11 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-full max-w-sm" />
          </div>
        </div>
      </div>
    );
  }

  const connected = Boolean(status?.connected);
  const configured = Boolean(status?.configured);

  return (
    <div
      className={cn(
        "rounded-xl border p-5 transition-colors",
        connected
          ? "border-[#272156]/25 bg-[#272156]/[0.03]"
          : "border-border/60 bg-muted/20"
      )}
    >
      <div className="flex gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-white">
          <DocuSignLogo className="h-7 w-7" />
        </div>
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">DocuSign</h3>
            <StatusBadge connected={connected} configured={configured} />
          </div>
          <p className="text-sm text-muted-foreground">
            E-signatures for offer letters and HR packets (JWT grant).
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-3 rounded-lg border border-border/50 bg-background/80 px-4 py-3">
        <p className="text-xs text-muted-foreground">
          JWT needs Integration Key, User ID (GUID), Account ID, and the RSA
          private key from your DocuSign Apps and Keys page. Use{" "}
          <code className="rounded bg-muted px-1">account-d.docusign.com</code>{" "}
          for demo. Leave secret/key blank to keep the saved value.
        </p>

        <div className="grid gap-3 md:grid-cols-2">
          <Field
            id="ds-integration-key"
            label="Integration Key"
            value={form.integrationKey}
            onChange={(v) => setForm((c) => ({ ...c, integrationKey: v }))}
          />
          <Field
            id="ds-client-secret"
            label="Client Secret (optional)"
            type="password"
            placeholder={
              status?.hasClientSecret ? "•••• saved — enter to replace" : ""
            }
            value={form.clientSecret}
            onChange={(v) => setForm((c) => ({ ...c, clientSecret: v }))}
          />
          <Field
            id="ds-account-id"
            label="Account ID"
            value={form.accountId}
            onChange={(v) => setForm((c) => ({ ...c, accountId: v }))}
          />
          <Field
            id="ds-user-id"
            label="User ID (API username GUID)"
            value={form.userId}
            onChange={(v) => setForm((c) => ({ ...c, userId: v }))}
          />
          <Field
            id="ds-auth-server"
            label="Auth server"
            value={form.authServer}
            onChange={(v) => setForm((c) => ({ ...c, authServer: v }))}
            hint="account-d.docusign.com (demo) or account.docusign.com (prod)"
          />
          <Field
            id="ds-base-path"
            label="REST base path (optional)"
            value={form.basePath}
            onChange={(v) => setForm((c) => ({ ...c, basePath: v }))}
            hint="Defaults from auth server (demo vs prod REST host)"
          />
        </div>

        <div>
          <Label htmlFor="ds-rsa" className="text-xs">
            RSA private key (PEM)
            {status?.hasRsaPrivateKey ? " — saved" : ""}
          </Label>
          <Textarea
            id="ds-rsa"
            className="mt-1.5 font-mono text-xs"
            rows={4}
            placeholder={
              status?.hasRsaPrivateKey
                ? "•••• saved — paste a new PEM to replace"
                : "-----BEGIN RSA PRIVATE KEY-----"
            }
            value={form.rsaPrivateKey}
            onChange={(e) =>
              setForm((c) => ({ ...c, rsaPrivateKey: e.target.value }))
            }
          />
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={isSaving || isClearing}
            className="bg-[#272156] text-white hover:bg-[#272156]/90"
          >
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Save credentials
          </Button>
          {(configured || connected) && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={handleClear}
              disabled={isSaving || isClearing}
            >
              {isClearing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Unplug className="mr-2 h-4 w-4" />
              )}
              Disconnect
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <div>
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <Input
        id={id}
        type={type}
        className="mt-1.5"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
      />
      {hint ? (
        <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export function LinearLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      aria-hidden
      focusable="false"
    >
      <rect width="32" height="32" rx="6" fill="#272156" />
      <path
        fill="#31CDFF"
        d="M22.8 9.2a1.2 1.2 0 0 1 0 1.7L10.9 22.8a1.2 1.2 0 1 1-1.7-1.7L21.1 9.2a1.2 1.2 0 0 1 1.7 0z"
      />
      <path
        fill="white"
        fillOpacity="0.85"
        d="M18.4 9.5a7.4 7.4 0 0 0-8.9 8.9l1.6-1.6a5.4 5.4 0 0 1 5.7-5.7l1.6-1.6zm4.1 4.1l-1.6 1.6a5.4 5.4 0 0 1-5.7 5.7l-1.6 1.6a7.4 7.4 0 0 0 8.9-8.9z"
      />
    </svg>
  );
}

export function IntegrationCardShell({
  connected,
  children,
}: {
  connected: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-5 transition-colors",
        connected
          ? "border-[#272156]/25 bg-[#272156]/[0.03]"
          : "border-border/60 bg-muted/20"
      )}
    >
      {children}
    </div>
  );
}
