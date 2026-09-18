"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { format } from "date-fns";
import {
  ArrowRight,
  Briefcase,
  FileText,
  CalendarDays,
  Sun,
  Moon,
  Sunset,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { TourHelpButton } from "@/components/admin/tour/TourHelpButton";
import { cn } from "@/lib/utils";

const BRAND_NAVY = "#272156";
const BRAND_CYAN = "#31CDFF";

const BANNER_IMAGE =
  "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1920&q=80";

const SPRING_ENTER = { type: "spring" as const, bounce: 0, duration: 0.4 };

interface UserWelcomeBannerProps {
  totalApplications?: number;
  inReview?: number;
  openJobs?: number;
  className?: string;
  /** When set, shows Guide (on-dark) in the banner corner */
  tourId?: string;
}

function getGreeting(hour: number) {
  if (hour < 12) return { label: "Good morning", Icon: Sun };
  if (hour < 17) return { label: "Good afternoon", Icon: Sun };
  if (hour < 21) return { label: "Good evening", Icon: Sunset };
  return { label: "Good night", Icon: Moon };
}

function getDisplayName(user: ReturnType<typeof useAuth>["user"]) {
  if (!user) return "there";
  return (
    user.firstName?.trim() ||
    user.name?.trim().split(/\s+/)[0] ||
    user.email?.split("@")[0] ||
    "there"
  );
}

export function UserWelcomeBanner({
  totalApplications = 0,
  inReview = 0,
  openJobs = 0,
  className,
  tourId,
}: UserWelcomeBannerProps) {
  const { user } = useAuth();
  const reduceMotion = useReducedMotion();
  const now = new Date();
  const { label: greeting, Icon: GreetingIcon } = getGreeting(now.getHours());
  const displayName = getDisplayName(user);
  const dateLabel = format(now, "EEEE, MMMM d");
  const press = reduceMotion ? undefined : { scale: 0.97 };
  const showGuide = Boolean(tourId);

  const highlights = [
    {
      label: "Your applications",
      value: totalApplications,
      icon: FileText,
    },
    {
      label: "In review",
      value: inReview,
      icon: CalendarDays,
    },
    {
      label: "Open positions",
      value: openJobs,
      icon: Briefcase,
    },
  ];

  return (
    <motion.section
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduceMotion ? { duration: 0.2 } : SPRING_ENTER}
      data-tour="user-welcome-banner"
      className={cn(
        "relative isolate overflow-hidden rounded-2xl border border-white/10",
        "shadow-xl shadow-[#272156]/18",
        className
      )}
    >
      <Image
        src={BANNER_IMAGE}
        alt=""
        fill
        priority
        className="object-cover object-center scale-105"
        sizes="(max-width: 1280px) 100vw, 1280px"
      />

      <div className="absolute inset-0 bg-gradient-to-br from-[#272156]/96 via-[#1e1844]/90 to-[#31CDFF]/30" />
      <div
        className="absolute inset-0 opacity-[0.12] mix-blend-overlay"
        style={{
          backgroundImage: "url('/mesh-pattern.svg')",
          backgroundSize: "cover",
        }}
      />
      <div
        className="pointer-events-none absolute -right-14 -top-14 h-48 w-48 rounded-full blur-3xl"
        style={{ backgroundColor: `${BRAND_CYAN}30` }}
      />
      <div
        className="pointer-events-none absolute -bottom-16 -left-10 h-40 w-40 rounded-full blur-3xl"
        style={{ backgroundColor: `${BRAND_NAVY}80` }}
      />

      {showGuide ? (
        <div className="absolute right-2 top-2 z-20 sm:right-2.5 sm:top-2.5">
          <TourHelpButton tourId={tourId!} tone="on-dark" />
        </div>
      ) : null}

      <div
        className={cn(
          "relative z-10 flex flex-col gap-4 p-5 sm:p-6 lg:p-7",
          showGuide && "pr-20 sm:pr-24"
        )}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl space-y-2.5">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur-md backdrop-saturate-150">
              <GreetingIcon
                className="h-3.5 w-3.5"
                style={{ color: BRAND_CYAN }}
                aria-hidden
              />
              <span>{dateLabel}</span>
            </div>

            <div className="space-y-1.5">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#31CDFF]/90">
                {greeting}
              </p>
              <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl lg:text-[2rem] lg:leading-tight">
                Welcome back,{" "}
                <span className="bg-gradient-to-r from-white via-white to-[#31CDFF] bg-clip-text text-transparent">
                  {displayName}
                </span>
              </h2>
              <p className="max-w-xl text-sm leading-relaxed text-white/75">
                Track your applications and keep your profile up to date.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2.5 lg:shrink-0">
            <motion.div whileTap={press} className="inline-flex">
              <Button
                asChild
                size="sm"
                className={cn(
                  "h-9 gap-2 border-0 bg-white px-3.5 text-[#272156]",
                  "shadow-md shadow-black/10",
                  "transition-transform duration-100 ease-out",
                  "hover:bg-white/90",
                  "active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100"
                )}
              >
                <Link href="/dashboard/applications">
                  <FileText className="h-4 w-4" aria-hidden />
                  My applications
                </Link>
              </Button>
            </motion.div>
            <motion.div whileTap={press} className="inline-flex">
              <Button
                asChild
                size="sm"
                variant="outline"
                className={cn(
                  "h-9 gap-2 border-white/25 bg-white/10 px-3.5 text-white",
                  "backdrop-blur-md backdrop-saturate-150",
                  "transition-transform duration-100 ease-out",
                  "hover:bg-white/20 hover:text-white",
                  "active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100"
                )}
              >
                <Link href="/dashboard/jobs">
                  Browse jobs
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </Button>
            </motion.div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3 sm:gap-2">
          {highlights.map((item, index) => (
            <motion.div
              key={item.label}
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={
                reduceMotion
                  ? { duration: 0.2 }
                  : { ...SPRING_ENTER, delay: 0.05 + index * 0.04 }
              }
              className={cn(
                "flex items-center gap-2 rounded-lg border border-white/10",
                "bg-white/10 px-2.5 py-1.5",
                "backdrop-blur-md backdrop-saturate-150",
                "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)]"
              )}
            >
              <div
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md shadow-sm"
                style={{
                  background: `linear-gradient(135deg, ${BRAND_CYAN}, ${BRAND_NAVY})`,
                  boxShadow: `0 3px 10px -2px ${BRAND_NAVY}4D`,
                }}
              >
                <item.icon className="h-3.5 w-3.5 text-white" aria-hidden />
              </div>
              <div className="min-w-0 leading-none">
                <p className="text-base font-semibold tabular-nums tracking-tight text-white sm:text-lg">
                  {item.value}
                </p>
                <p className="mt-0.5 truncate text-[10px] tracking-wide text-white/65 sm:text-[11px]">
                  {item.label}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.section>
  );
}
