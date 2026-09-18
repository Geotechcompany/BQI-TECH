"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Unplug,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { adminApi } from "@/lib/api-backend";
import { cn } from "@/lib/utils";

export interface MicrosoftIntegrationStatus {
  provider?: string;
  configured: boolean;
  connected: boolean;
  accountEmail?: string | null;
  accountName?: string | null;
  connectedAt?: string | null;
  lastSyncAt?: string | null;
  lastSyncCount?: number;
  lastSyncError?: string | null;
  redirectUri?: string | null;
  tenantId?: string | null;
  clientId?: string | null;
  hasClientSecret?: boolean;
  clientSecretHint?: string | null;
  message?: string | null;
}

function formatSyncTime(value?: string | null): string {
  if (!value) return "Never";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Never";
  return parsed.toLocaleString();
}

function MicrosoftLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 23 23"
      className={className}
      aria-hidden
      focusable="false"
    >
      <path fill="#f25022" d="M1 1h10v10H1z" />
      <path fill="#7fba00" d="M12 1h10v10H12z" />
      <path fill="#00a4ef" d="M1 12h10v10H1z" />
      <path fill="#ffb900" d="M12 12h10v10H12z" />
    </svg>
  );
}

interface MicrosoftIntegrationCardProps {
  oauthNotice?: "connected" | "error" | null;
  oauthError?: string | null;
  onOAuthNoticeHandled?: () => void;
}

export function MicrosoftIntegrationCard({
  oauthNotice,
  oauthError,
  onOAuthNoticeHandled,
}: MicrosoftIntegrationCardProps) {
  const [status, setStatus] = useState<MicrosoftIntegrationStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSavingCreds, setIsSavingCreds] = useState(false);
  const [isClearingCreds, setIsClearingCreds] = useState(false);
  const [credForm, setCredForm] = useState({
    clientId: "",
    clientSecret: "",
    tenantId: "organizations",
  });

  const loadStatus = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await adminApi.getMicrosoftIntegrationStatus();
      const next =
        (response as { status?: MicrosoftIntegrationStatus })?.status ?? null;
      setStatus(next);
      setCredForm((current) => ({
        ...current,
        clientId: next?.clientId || "",
        tenantId: next?.tenantId || "organizations",
        clientSecret: "",
      }));
    } catch (error) {
      console.error("Failed to load Microsoft integration status:", error);
      setStatus(null);
      toast.error("Failed to load Microsoft integration status");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    if (!oauthNotice) return;
    if (oauthNotice === "connected") {
      toast.success("Microsoft account connected");
      void loadStatus();
    } else if (oauthNotice === "error") {
      toast.error(oauthError || "Microsoft connection failed");
    }
    onOAuthNoticeHandled?.();
  }, [oauthNotice, oauthError, loadStatus, onOAuthNoticeHandled]);

  const handleConnect = async () => {
    if (!status?.configured) {
      toast.error(
        status?.message ||
          "Save Client ID and Client Secret below, then Connect."
      );
      return;
    }
    setIsConnecting(true);
    try {
      const response = await adminApi.startMicrosoftConnect();
      const url = (response as { authorizeUrl?: string })?.authorizeUrl;
      if (!url) {
        throw new Error("No authorize URL returned");
      }
      window.location.href = url;
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to start Microsoft connection";
      toast.error(message);
      setIsConnecting(false);
    }
  };

  const handleSaveCredentials = async () => {
    setIsSavingCreds(true);
    try {
      const payload: Record<string, string> = {
        clientId: credForm.clientId.trim(),
        tenantId: credForm.tenantId.trim() || "organizations",
      };
      if (credForm.clientSecret.trim()) {
        payload.clientSecret = credForm.clientSecret.trim();
      }
      await adminApi.saveIntegrationCredentials("microsoft", payload);
      setCredForm((current) => ({ ...current, clientSecret: "" }));
      await loadStatus();
      toast.success("Microsoft credentials saved");
    } catch (error: unknown) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to save Microsoft credentials"
      );
    } finally {
      setIsSavingCreds(false);
    }
  };

  const handleClearCredentials = async () => {
    setIsClearingCreds(true);
    try {
      await adminApi.clearIntegrationCredentials("microsoft");
      toast.success("Microsoft app credentials cleared");
      await loadStatus();
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Failed to clear credentials"
      );
    } finally {
      setIsClearingCreds(false);
    }
  };

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      const response = await adminApi.disconnectMicrosoft();
      setStatus(
        (response as { status?: MicrosoftIntegrationStatus })?.status ?? {
          configured: status?.configured ?? false,
          connected: false,
        }
      );
      toast.success("Microsoft calendar disconnected");
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to disconnect";
      toast.error(message);
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const response = await adminApi.syncMicrosoftCalendar();
      const next =
        (response as { status?: MicrosoftIntegrationStatus })?.status ?? status;
      if (next) setStatus(next);
      const synced = (response as { synced?: number })?.synced ?? 0;
      toast.success(
        synced === 1
          ? "Synced 1 Outlook event"
          : `Synced ${synced} Outlook events`
      );
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Calendar sync failed";
      toast.error(message);
      void loadStatus();
    } finally {
      setIsSyncing(false);
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
            <Skeleton className="h-3 w-40" />
          </div>
          <Skeleton className="h-9 w-24" />
        </div>
      </div>
    );
  }

  const configured = Boolean(status?.configured);
  const connected = Boolean(status?.connected);

  return (
    <div
      className={cn(
        "rounded-xl border p-5 transition-colors",
        connected
          ? "border-[#272156]/25 bg-[#272156]/[0.03]"
          : "border-border/60 bg-muted/20"
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-white">
            <MicrosoftLogo className="h-6 w-6" />
          </div>
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">Microsoft</h3>
              {connected ? (
                <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-600">
                  <CheckCircle2 className="h-3 w-3" />
                  Connected
                </Badge>
              ) : configured ? (
                <Badge variant="outline" className="gap-1 text-muted-foreground">
                  Not connected
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1 text-amber-700">
                  <AlertCircle className="h-3 w-3" />
                  Credentials needed
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Sync Outlook calendars and meetings into the admin Calendar.
            </p>
          </div>
        </div>
      </div>

      {!configured ? (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-medium">Save credentials below, then Connect</p>
          <p className="mt-1 text-xs">
            Register this redirect URI in Azure app registration:
          </p>
          <p className="mt-1 break-all text-xs font-mono">
            {status?.redirectUri ||
              "http://localhost:9000/api/admin/integrations/microsoft/callback"}
          </p>
        </div>
      ) : null}

      <div className="mt-4 space-y-3 rounded-lg border border-border/50 bg-background/80 px-4 py-3">
        <p className="text-xs text-muted-foreground">
          App credentials for OAuth. Env vars still work as fallback. Leave
          Client Secret blank to keep the saved value.
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label htmlFor="ms-client-id" className="text-xs">
              Client ID
            </Label>
            <Input
              id="ms-client-id"
              className="mt-1.5"
              value={credForm.clientId}
              onChange={(e) =>
                setCredForm((c) => ({ ...c, clientId: e.target.value }))
              }
              autoComplete="off"
            />
          </div>
          <div>
            <Label htmlFor="ms-client-secret" className="text-xs">
              Client Secret
              {status?.hasClientSecret ? " — saved" : ""}
            </Label>
            <Input
              id="ms-client-secret"
              type="password"
              className="mt-1.5"
              value={credForm.clientSecret}
              placeholder={
                status?.hasClientSecret
                  ? "•••• saved — enter to replace"
                  : undefined
              }
              onChange={(e) =>
                setCredForm((c) => ({ ...c, clientSecret: e.target.value }))
              }
              autoComplete="off"
            />
          </div>
          <div>
            <Label htmlFor="ms-tenant-id" className="text-xs">
              Tenant ID (optional)
            </Label>
            <Input
              id="ms-tenant-id"
              className="mt-1.5"
              value={credForm.tenantId}
              onChange={(e) =>
                setCredForm((c) => ({ ...c, tenantId: e.target.value }))
              }
              autoComplete="off"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Use <code className="rounded bg-muted px-1">organizations</code>{" "}
              for multi-tenant, or your directory GUID.
            </p>
          </div>
          <div>
            <Label htmlFor="ms-redirect" className="text-xs">
              Redirect URI
            </Label>
            <Input
              id="ms-redirect"
              className="mt-1.5"
              value={
                status?.redirectUri ||
                "http://localhost:9000/api/admin/integrations/microsoft/callback"
              }
              readOnly
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleSaveCredentials}
            disabled={isSavingCreds || isClearingCreds}
          >
            {isSavingCreds ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Save credentials
          </Button>
          {configured ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={handleClearCredentials}
              disabled={isSavingCreds || isClearingCreds}
            >
              {isClearingCreds ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Unplug className="mr-2 h-4 w-4" />
              )}
              Clear app credentials
            </Button>
          ) : null}
        </div>
      </div>

      {connected ? (
        <div className="mt-4 space-y-3">
          <div className="rounded-lg border border-border/50 bg-background/80 px-4 py-3 text-sm">
            <p className="font-medium text-foreground">
              {status?.accountName || "Microsoft account"}
            </p>
            <p className="mt-0.5 text-muted-foreground">
              {status?.accountEmail || "—"}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Last sync: {formatSyncTime(status?.lastSyncAt)}
              {typeof status?.lastSyncCount === "number"
                ? ` · ${status.lastSyncCount} events`
                : ""}
            </p>
            {status?.lastSyncError ? (
              <p className="mt-2 text-xs text-destructive">
                Last sync error: {status.lastSyncError}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSync}
              disabled={isSyncing || isDisconnecting}
            >
              {isSyncing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Sync now
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={handleDisconnect}
              disabled={isDisconnecting || isSyncing}
            >
              {isDisconnecting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Unplug className="mr-2 h-4 w-4" />
              )}
              Disconnect
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4">
          <Button
            type="button"
            onClick={handleConnect}
            disabled={!configured || isConnecting}
            className="bg-[#272156] text-white hover:bg-[#272156]/90"
          >
            {isConnecting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <MicrosoftLogo className="mr-2 h-4 w-4" />
            )}
            Connect Microsoft
          </Button>
        </div>
      )}
    </div>
  );
}
