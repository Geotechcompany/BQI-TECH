"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  CalendarDays,
  FileText,
  Lock,
  Rocket,
  UserRound,
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
  dismissEmployeeQuickStartWelcome,
  isEmployeeQuickStartWelcomeDismissed,
} from "@/lib/employee-quick-start";
import { cn } from "@/lib/utils";

const HIGHLIGHTS = [
  {
    icon: UserRound,
    label: "Profile",
    detail: "Fill phone, address, and emergency contact.",
  },
  {
    icon: FileText,
    label: "Documents",
    detail: "Upload National ID, CV, and other files HR needs.",
  },
  {
    icon: CalendarDays,
    label: "Leave",
    detail: "Check remaining days and your request history.",
  },
  {
    icon: Lock,
    label: "Settings",
    detail: "Change the password for this portal login.",
  },
] as const;

interface EmployeeQuickStartModalProps {
  className?: string;
  tourId?: string;
}

export function EmployeeQuickStartModal({
  className,
  tourId = "employee-overview",
}: EmployeeQuickStartModalProps) {
  const { startTour } = usePlatformTour();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(!isEmployeeQuickStartWelcomeDismissed());
  }, []);

  const handleDismiss = () => {
    dismissEmployeeQuickStartWelcome();
    setOpen(false);
  };

  const handleTakeTour = () => {
    dismissEmployeeQuickStartWelcome();
    setOpen(false);
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
        data-tour="employee-quick-start-welcome"
        className={cn(
          "gap-0 overflow-hidden p-0 sm:max-w-xl",
          "border-[#272156]/12 bg-background",
          className
        )}
      >
        <div className="relative h-36 w-full overflow-hidden sm:h-44">
          <Image
            src="/images/portal-user-login-cover.jpg"
            alt=""
            fill
            priority
            sizes="(max-width: 640px) 100vw, 576px"
            className="object-cover object-center"
          />
          <div
            className="absolute inset-0 bg-gradient-to-br from-[#272156]/88 via-[#272156]/55 to-[#31CDFF]/45"
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
            <div className="inline-flex w-fit items-center gap-1.5 rounded-md border border-[#272156]/15 bg-[#272156]/[0.06] px-2 py-0.5 text-[11px] font-semibold tracking-wide text-[#272156]">
              <Rocket className="h-3 w-3 text-[#31CDFF]" aria-hidden />
              Quick Start
            </div>
            <DialogTitle className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
              Get oriented in the employee portal
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
              Finish your profile and documents, then check leave and password
              settings. Guide in the header replays any page walkthrough.
            </DialogDescription>
          </DialogHeader>

          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {HIGHLIGHTS.map((item) => (
              <li
                key={item.label}
                className="flex items-start gap-2.5 rounded-lg border border-[#272156]/10 bg-muted/40 px-3 py-2"
              >
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#272156]/10 text-[#272156]">
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
              className="bg-[#272156] text-white hover:bg-[#1f1a45]"
              onClick={handleTakeTour}
            >
              Take the tour
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-[#272156]/20 text-[#272156] hover:bg-[#272156]/5 hover:text-[#272156]"
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

export default EmployeeQuickStartModal;
