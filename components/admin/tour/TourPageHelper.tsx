"use client";

import { usePageTour, type UsePageTourOptions } from "@/hooks/usePlatformTour";

interface TourPageHelperProps extends UsePageTourOptions {
  tourId: string;
}

/** Mount once per page to handle first-visit auto-start. */
export function TourPageHelper({ tourId, autoStart, delay }: TourPageHelperProps) {
  usePageTour(tourId, { autoStart, delay });
  return null;
}
