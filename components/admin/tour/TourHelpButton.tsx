"use client";

import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePlatformTour } from "@/hooks/usePlatformTour";
import { cn } from "@/lib/utils";

interface TourHelpButtonProps {
  tourId: string;
  className?: string;
  label?: string;
  /** Default matches page chrome; on-dark sits on navy welcome banners */
  tone?: "default" | "on-dark";
  /** Icon-only (still labeled for screen readers) */
  iconOnly?: boolean;
}

export function TourHelpButton({
  tourId,
  className,
  label = "Guide",
  tone = "default",
  iconOnly = false,
}: TourHelpButtonProps) {
  const { startTour, isRunning, activeTourId } = usePlatformTour();
  const isActive = isRunning && activeTourId === tourId;

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn(
        "gap-1.5",
        tone === "on-dark" &&
          "h-8 border-white/25 bg-white/10 px-2.5 text-white shadow-none backdrop-blur-md backdrop-saturate-150 hover:bg-white/20 hover:text-white active:scale-[0.97] motion-reduce:active:scale-100",
        iconOnly && "px-2",
        className
      )}
      data-tour="tour-help-button"
      aria-label={`Start ${label}`}
      aria-pressed={isActive}
      onClick={() => startTour(tourId)}
    >
      <HelpCircle className="h-4 w-4 shrink-0" aria-hidden />
      {!iconOnly ? (
        <span className="hidden sm:inline">{label}</span>
      ) : null}
    </Button>
  );
}
