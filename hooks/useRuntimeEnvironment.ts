"use client";

import { useQuery } from "@tanstack/react-query";
import { BACKEND_URL } from "@/lib/config";

export type RuntimeEnvironment = "development" | "staging" | "production";

export interface RuntimeEnvironmentInfo {
  environment: RuntimeEnvironment;
  databaseName: string;
  showBanner: boolean;
  label: string;
  databaseConnected?: boolean;
}

export function useRuntimeEnvironment() {
  return useQuery({
    queryKey: ["runtime-environment"],
    queryFn: async (): Promise<RuntimeEnvironmentInfo> => {
      const response = await fetch(`${BACKEND_URL}/api/environment`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Failed to load environment info");
      }

      return response.json();
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}
