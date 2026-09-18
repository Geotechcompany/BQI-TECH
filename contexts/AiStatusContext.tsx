"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { adminApi } from "@/lib/api-backend";

interface AiStatus {
  configured: boolean | null;
  source?: string | null;
  activeProviderLabel?: string | null;
  model?: string | null;
}

interface AiStatusContextValue extends AiStatus {
  loading: boolean;
  isConfigured: boolean;
  isUnconfigured: boolean;
  refresh: () => Promise<void>;
}

const AiStatusContext = createContext<AiStatusContextValue | undefined>(
  undefined,
);

export function AiStatusProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AiStatus>({ configured: null });
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await adminApi.getAiStatus();
      setStatus({
        configured: Boolean(data?.configured),
        source: data?.source ?? null,
        activeProviderLabel: data?.activeProviderLabel ?? null,
        model: data?.model ?? null,
      });
    } catch {
      // Network/auth failures shouldn't block AI actions — stay optimistic.
      setStatus({ configured: null });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const value = useMemo<AiStatusContextValue>(
    () => ({
      ...status,
      loading,
      isConfigured: status.configured === true,
      // Only block when we positively know AI is unconfigured.
      isUnconfigured: status.configured === false,
      refresh,
    }),
    [status, loading, refresh],
  );

  return (
    <AiStatusContext.Provider value={value}>
      {children}
    </AiStatusContext.Provider>
  );
}

export function useAiStatus(): AiStatusContextValue {
  const ctx = useContext(AiStatusContext);
  if (!ctx) {
    return {
      configured: null,
      source: null,
      activeProviderLabel: null,
      model: null,
      loading: false,
      isConfigured: false,
      isUnconfigured: false,
      refresh: async () => {},
    };
  }
  return ctx;
}

export const AI_UNCONFIGURED_MESSAGE =
  "BQI Intelligence is not configured. Add an API key in Settings → AI providers to enable this.";
