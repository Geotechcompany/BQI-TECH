"use client";

import { useEffect, useState } from "react";
import { Database, FlaskConical, Layers, X } from "lucide-react";
import { useRuntimeEnvironment } from "@/hooks/useRuntimeEnvironment";
import { cn } from "@/lib/utils";

const DISMISS_STORAGE_PREFIX = "env-banner-dismissed:";

const ENV_STYLES = {
  development: {
    icon: FlaskConical,
    pill: "bg-sky-600/75 border-sky-400/30 text-white shadow-sky-900/20",
  },
  staging: {
    icon: Layers,
    pill: "bg-amber-500/75 border-amber-300/30 text-white shadow-amber-900/20",
  },
  production: {
    icon: Database,
    pill: "",
  },
} as const;

function getDismissKey(databaseName: string, environment: string) {
  return `${DISMISS_STORAGE_PREFIX}${environment}:${databaseName}`;
}

export function EnvironmentBanner() {
  const { data } = useRuntimeEnvironment();
  const [isDismissed, setIsDismissed] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!data?.showBanner) return;
    const key = getDismissKey(data.databaseName, data.environment);
    setIsDismissed(sessionStorage.getItem(key) === "1");
  }, [data?.databaseName, data?.environment, data?.showBanner]);

  // Floating banner — no layout offset
  useEffect(() => {
    document.documentElement.style.setProperty("--env-banner-height", "0px");
    document.documentElement.style.setProperty("--admin-banner-offset", "0px");
  }, []);

  const showBanner = Boolean(data?.showBanner) && isMounted && !isDismissed;

  if (!showBanner || !data) {
    return null;
  }

  const styles =
    ENV_STYLES[data.environment as keyof typeof ENV_STYLES] ??
    ENV_STYLES.development;
  const Icon = styles.icon;

  const handleDismiss = () => {
    const key = getDismissKey(data.databaseName, data.environment);
    sessionStorage.setItem(key, "1");
    setIsDismissed(true);
  };

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-4 z-[10001] flex justify-center px-4"
      role="status"
      aria-live="polite"
    >
      <div
        className={cn(
          "pointer-events-auto flex max-w-xl items-center gap-2 rounded-full border px-4 py-2 shadow-lg backdrop-blur-md transition-all duration-300",
          "animate-in fade-in slide-in-from-top-2",
          styles.pill
        )}
      >
        <Icon className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
        <p className="text-center text-xs font-medium leading-snug sm:text-sm">
          {data.label} environment
          <span className="hidden sm:inline">
            {" "}
            ·{" "}
            <span className="font-semibold">{data.databaseName}</span>
          </span>
          <span className="sm:hidden font-semibold"> · {data.databaseName}</span>
          {!data.databaseConnected && (
            <span className="ml-2 rounded-full bg-black/20 px-2 py-0.5 text-[10px] uppercase tracking-wide">
              DB offline
            </span>
          )}
        </p>
        <button
          type="button"
          onClick={handleDismiss}
          className="ml-1 shrink-0 rounded-full p-1 text-white/80 transition-colors hover:bg-white/15 hover:text-white"
          aria-label="Dismiss environment notice for this session"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
