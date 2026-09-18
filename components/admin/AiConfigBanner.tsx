"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { useAiStatus } from "@/contexts/AiStatusContext";

const DISMISS_KEY = "bqi.aiConfigBanner.dismissed";

export function AiConfigBanner() {
  const { isUnconfigured, loading } = useAiStatus();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1");
  }, []);

  if (loading || !isUnconfigured || dismissed) {
    return null;
  }

  const handleDismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  return (
    <div className="border-b border-amber-300/60 bg-amber-50 px-4 py-2.5 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
      <div className="flex items-center gap-3">
        <AlertTriangle className="h-4 w-4 flex-shrink-0" />
        <p className="text-sm">
          BQI Intelligence features are turned off because no provider API key is
          set. Add one in{" "}
          <Link
            href="/manage/settings?section=ai"
            className="font-semibold underline underline-offset-2 hover:opacity-80"
          >
            Settings → AI providers
          </Link>{" "}
          to enable ranking.
        </p>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss"
          className="ml-auto flex-shrink-0 rounded p-1 transition hover:bg-amber-100 dark:hover:bg-amber-500/20"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
