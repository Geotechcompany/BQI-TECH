"use client";

import { useCallback, useEffect, useRef } from "react";
import { getTourById } from "@/lib/admin-tours";
import { usePlatformTourContext } from "@/components/admin/tour/PlatformTour";

export interface UsePageTourOptions {
  autoStart?: boolean;
  delay?: number;
}

export function usePlatformTour() {
  return usePlatformTourContext();
}

export function usePageTour(tourId: string, options?: UsePageTourOptions) {
  const { startTour, isTourDismissed, isTourSnoozed, isRunning } =
    usePlatformTourContext();
  const hasAutoStarted = useRef(false);

  const tryAutoStart = useCallback(() => {
    const definition = getTourById(tourId);
    const shouldAutoStart = options?.autoStart ?? definition?.autoStart ?? false;

    if (!shouldAutoStart || hasAutoStarted.current || isRunning) return;
    if (isTourDismissed(tourId) || isTourSnoozed(tourId)) return;

    hasAutoStarted.current = true;
    startTour(tourId);
  }, [
    tourId,
    options?.autoStart,
    isRunning,
    isTourDismissed,
    isTourSnoozed,
    startTour,
  ]);

  useEffect(() => {
    const definition = getTourById(tourId);
    const shouldAutoStart = options?.autoStart ?? definition?.autoStart ?? false;
    if (!shouldAutoStart) return;

    const delay = options?.delay ?? definition?.autoStartDelay ?? 800;
    const timer = window.setTimeout(tryAutoStart, delay);
    return () => window.clearTimeout(timer);
  }, [tourId, options?.autoStart, options?.delay, tryAutoStart]);
}
