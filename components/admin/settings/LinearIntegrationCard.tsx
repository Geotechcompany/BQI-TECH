"use client";

import { useCallback, useEffect, useState } from "react";
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
import { adminApi } from "@/lib/api-backend";
import { cn } from "@/lib/utils";

function LinearLogo({ className }: { className?: string }) {
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

export interface LinearIntegrationStatus {
  provider?: string;
  configured: boolean;
  connected: boolean;
  clientId?: string;
  hasApiKey?: boolean;
  hasClientSecret?: boolean;
  message?: string | null;
}

export function LinearIntegrationCard() {
  const [status, setStatus] = useState<LinearIntegrationStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [form, setForm] = useState({
    apiKey: "",
    clientId: "",
    clientSecret: "",
  });

  const loadStatus = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await adminApi.getLinearIntegrationStatus();
      const next =
        (response as { status?: LinearIntegrationStatus })?.status ?? null;
      setStatus(next);
      setForm((current) => ({
        ...current,
        clientId: next?.clientId || "",
        apiKey: "",
        clientSecret: "",
      }));
    } catch (error) {
      console.error("Failed to load Linear status:", error);
      setStatus(null);
      toast.error("Failed to load Linear status");
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
        clientId: form.clientId.trim(),
      };
      if (form.apiKey.trim()) payload.apiKey = form.apiKey.trim();
      if (form.clientSecret.trim()) {
        payload.clientSecret = form.clientSecret.trim();
      }
      await adminApi.saveIntegrationCredentials("linear", payload);
      setForm((current) => ({ ...current, apiKey: "", clientSecret: "" }));
      await loadStatus();
      toast.success("Linear credentials saved");
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save Linear credentials"
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleVerify = async () => {
    setIsVerifying(true);
    try {
      const response = await adminApi.verifyLinearIntegration();
      const name = (response as { accountName?: string })?.accountName;
      toast.success(
        name ? `Linear connected as ${name}` : "Linear API key verified"
      );
      await loadStatus();
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Linear verification failed"
      );
    } finally {
      setIsVerifying(false);
    }
  };

  const handleClear = async () => {
    setIsClearing(true);
    try {
      await adminApi.clearIntegrationCredentials("linear");
      toast.success("Linear credentials cleared");
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
          <LinearLogo className="h-7 w-7" />
        </div>
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">Linear</h3>
            {connected ? (
              <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-600">
                <CheckCircle2 className="h-3 w-3" />
                Connected
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1 text-amber-700">
                <AlertCircle className="h-3 w-3" />
                Credentials needed
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Project tracking for hiring workflows and ops.
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-3 rounded-lg border border-border/50 bg-background/80 px-4 py-3">
        <p className="text-xs text-muted-foreground">
          Paste a Linear personal API key from Settings → API. OAuth client
          fields are optional for later webhook work. Leave secrets blank to
          keep the saved value.
        </p>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label htmlFor="linear-api-key" className="text-xs">
              API key
              {status?.hasApiKey ? " — saved" : ""}
            </Label>
            <Input
              id="linear-api-key"
              type="password"
              className="mt-1.5"
              value={form.apiKey}
              placeholder={
                status?.hasApiKey ? "•••• saved — enter to replace" : "lin_api_…"
              }
              onChange={(e) =>
                setForm((c) => ({ ...c, apiKey: e.target.value }))
              }
              autoComplete="off"
            />
          </div>
          <div>
            <Label htmlFor="linear-client-id" className="text-xs">
              OAuth client ID (optional)
            </Label>
            <Input
              id="linear-client-id"
              className="mt-1.5"
              value={form.clientId}
              onChange={(e) =>
                setForm((c) => ({ ...c, clientId: e.target.value }))
              }
              autoComplete="off"
            />
          </div>
          <div>
            <Label htmlFor="linear-client-secret" className="text-xs">
              OAuth client secret (optional)
            </Label>
            <Input
              id="linear-client-secret"
              type="password"
              className="mt-1.5"
              value={form.clientSecret}
              placeholder={
                status?.hasClientSecret
                  ? "•••• saved — enter to replace"
                  : undefined
              }
              onChange={(e) =>
                setForm((c) => ({ ...c, clientSecret: e.target.value }))
              }
              autoComplete="off"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={isSaving || isClearing || isVerifying}
            className="bg-[#272156] text-white hover:bg-[#272156]/90"
          >
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Save credentials
          </Button>
          {connected ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleVerify}
                disabled={isSaving || isClearing || isVerifying}
              >
                {isVerifying ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Verify
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={handleClear}
                disabled={isSaving || isClearing || isVerifying}
              >
                {isClearing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Unplug className="mr-2 h-4 w-4" />
                )}
                Disconnect
              </Button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
