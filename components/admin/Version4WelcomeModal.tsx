"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  Brain,
  Inbox,
  Layers2,
  MessagesSquare,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePlatformTour } from "@/hooks/usePlatformTour";
import {
  dismissWelcomeV4,
  isWelcomeV4Dismissed,
} from "@/lib/admin-welcome-v4";
import { cn } from "@/lib/utils";

const HIGHLIGHTS = [
  {
    icon: Wand2,
    label: "Pipeline Quickdrop",
    detail: "Drop candidates into a stage from the board.",
  },
  {
    icon: MessagesSquare,
    label: "Communications",
    detail: "Email and outreach live in the sidebar.",
  },
  {
    icon: Inbox,
    label: "Inbox & Reports",
    detail: "Review messages and hiring metrics.",
  },
  {
    icon: Brain,
    label: "BQI Intelligence",
    detail: "Turn ranking on under Settings.",
  },
] as const;

interface Version4WelcomeModalProps {
  className?: string;
  tourId?: string;
}

export function Version4WelcomeModal({
  className,
  tourId = "overview",
}: Version4WelcomeModalProps) {
  const { startTour } = usePlatformTour();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(!isWelcomeV4Dismissed());
  }, []);

  const handleDismiss = () => {
    dismissWelcomeV4();
    setOpen(false);
  };

  const handleTakeTour = () => {
    dismissWelcomeV4();
    setOpen(false);
    // Let the dialog close before driver.js measures layout.
    window.setTimeout(() => startTour(tourId), 120);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) handleDismiss();
      }}
    >
      <DialogContent
        data-tour="overview-v4-welcome"
        className={cn(
          "gap-0 overflow-hidden p-0 sm:max-w-xl",
          "border-[#272055]/12 bg-background",
          className
        )}
      >
        {/* Hero — admin login cover graded into BQI navy/cyan */}
        <div className="relative h-36 w-full overflow-hidden sm:h-44">
          <Image
            src="/images/admin-login-cover.png"
            alt=""
            fill
            priority
            sizes="(max-width: 640px) 100vw, 576px"
            className="object-cover object-center"
          />
          <div
            className="absolute inset-0 bg-gradient-to-br from-[#272055]/88 via-[#272055]/55 to-[#31CDFF]/45"
            aria-hidden
          />
          <div
            className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent"
            aria-hidden
          />
          <div className="absolute bottom-3 left-5 flex items-center gap-2 sm:left-6">
            <Image
              src="/bqilogo-light.png"
              alt="BQI"
              width={72}
              height={28}
              className="h-6 w-auto object-contain drop-shadow-sm sm:h-7"
            />
          </div>
        </div>

        <div className="relative space-y-4 px-5 pb-5 pt-1 sm:px-6 sm:pb-6">
          <DialogHeader className="space-y-2 pr-6 text-left">
            <div
              className="inline-flex w-fit items-center gap-1.5 rounded-md border border-[#272055]/15 bg-[#272055]/[0.06] px-2 py-0.5 text-[11px] font-semibold tracking-wide text-[#272055]"
            >
              <Layers2 className="h-3 w-3 text-[#31CDFF]" aria-hidden />
              Version 4
            </div>
            <DialogTitle className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
              What&apos;s new in Version 4
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
              Pipeline Quickdrop, Communications, Inbox, Reports, and BQI
              Intelligence settings land in this release. Finish Setup still
              walks new workspaces through the first positions.
            </DialogDescription>
          </DialogHeader>

          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {HIGHLIGHTS.map((item) => (
              <li
                key={item.label}
                className="flex items-start gap-2.5 rounded-lg border border-[#272055]/10 bg-muted/40 px-3 py-2"
              >
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#272055]/10 text-[#272055]">
                  <item.icon className="h-3.5 w-3.5" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-foreground">
                    {item.label}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {item.detail}
                  </span>
                </span>
              </li>
            ))}
          </ul>

          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end sm:space-x-0 sm:gap-2">
            <Button
              type="button"
              size="sm"
              className="bg-[#272055] text-white hover:bg-[#1e1844]"
              onClick={handleTakeTour}
            >
              Take the tour
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-[#272055]/20 text-[#272055] hover:bg-[#272055]/5 hover:text-[#272055]"
              onClick={handleDismiss}
            >
              Got it
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default Version4WelcomeModal;
