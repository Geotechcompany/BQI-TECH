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
import {
  DEFAULT_BQI_INTELLIGENCE,
  normalizeBqiIntelligence,
  type BqiIntelligenceSettings,
} from "@/lib/bqi-intelligence";

interface BqiIntelligenceContextValue extends BqiIntelligenceSettings {
  loading: boolean;
  refresh: () => Promise<void>;
  setFeatures: (next: BqiIntelligenceSettings) => void;
}

const BqiIntelligenceContext = createContext<
  BqiIntelligenceContextValue | undefined
>(undefined);

export function BqiIntelligenceProvider({ children }: { children: ReactNode }) {
  const [features, setFeatures] = useState<BqiIntelligenceSettings>(
    DEFAULT_BQI_INTELLIGENCE
  );
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const response = await adminApi.getSettings();
      const payload = (response as { settings?: Record<string, unknown> })
        ?.settings ?? response;
      const raw = (payload as { bqiIntelligence?: Partial<BqiIntelligenceSettings> })
        ?.bqiIntelligence;
      setFeatures(normalizeBqiIntelligence(raw));
    } catch {
      setFeatures(DEFAULT_BQI_INTELLIGENCE);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<BqiIntelligenceContextValue>(
    () => ({
      ...features,
      loading,
      refresh,
      setFeatures,
    }),
    [features, loading, refresh]
  );

  return (
    <BqiIntelligenceContext.Provider value={value}>
      {children}
    </BqiIntelligenceContext.Provider>
  );
}

export function useBqiIntelligence(): BqiIntelligenceContextValue {
  const ctx = useContext(BqiIntelligenceContext);
  if (!ctx) {
    return {
      ...DEFAULT_BQI_INTELLIGENCE,
      loading: false,
      refresh: async () => {},
      setFeatures: () => {},
    };
  }
  return ctx;
}
