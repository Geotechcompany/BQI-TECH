"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { format } from "date-fns";
import {
  ArrowRight,
  Briefcase,
  FileText,
  Sparkles,
  Sun,
  Moon,
  Sunset,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const BANNER_IMAGE =
  "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1920&q=80";

interface OverviewWelcomeBannerProps {
  recentApplications?: number;
  activeJobs?: number;
  newApplications?: number;
  className?: string;
}

function getGreeting(hour: number) {
  if (hour < 12) return { label: "Good morning", emoji: "🌅", Icon: Sun };
  if (hour < 17) return { label: "Good afternoon", emoji: "☀️", Icon: Sun };
  if (hour < 21) return { label: "Good evening", emoji: "🌆", Icon: Sunset };
  return { label: "Good night", emoji: "🌙", Icon: Moon };
}

function getDisplayName(user: ReturnType<typeof useAuth>["user"]) {
  if (!user) return "there";
  const first =
    user.firstName?.trim() ||
    user.name?.trim().split(/\s+/)[0] ||
    user.email?.split("@")[0] ||
    "there";
  return first;
}

export function OverviewWelcomeBanner({
  recentApplications = 0,
  activeJobs = 0,
  newApplications = 0,
  className,
}: OverviewWelcomeBannerProps) {
  const { user } = useAuth();
  const now = new Date();
  const { label: greeting, emoji, Icon: GreetingIcon } = getGreeting(now.getHours());
  const displayName = getDisplayName(user);
  const dateLabel = format(now, "EEEE, MMMM d");

  const highlights = [
    {
      label: "New this week",
      value: recentApplications,
      icon: FileText,
    },
    {
      label: "Open roles",
      value: activeJobs,
      icon: Briefcase,
    },
    {
      label: "In pipeline",
      value: newApplications,
      icon: Sparkles,
    },
  ];

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "relative isolate overflow-hidden rounded-2xl border border-white/10 shadow-2xl shadow-[#272055]/20",
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

      <div className="absolute inset-0 bg-gradient-to-br from-[#272055]/95 via-[#1e1844]/88 to-[#31CDFF]/35" />
      <div
        className="absolute inset-0 opacity-[0.14] mix-blend-overlay"
        style={{
          backgroundImage: "url('/mesh-pattern.svg')",
          backgroundSize: "cover",
        }}
      />
      <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[#31CDFF]/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-10 h-48 w-48 rounded-full bg-violet-500/20 blur-3xl" />

      <div className="relative z-10 flex flex-col gap-4 p-5 sm:p-6 lg:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl space-y-2.5">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur-md">
              <GreetingIcon className="h-3.5 w-3.5 text-[#31CDFF]" />
              <span>{dateLabel}</span>
            </div>

            <div className="space-y-1.5">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#31CDFF]/90">
                <span className="mr-1.5 normal-case tracking-normal" aria-hidden>
                  {emoji}
                </span>
                {greeting}
              </p>
              <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl lg:text-[2rem] lg:leading-tight">
                Welcome back,{" "}
                <span className="bg-gradient-to-r from-white via-white to-[#31CDFF] bg-clip-text text-transparent">
                  {displayName}
                </span>
                <span className="ml-2 inline-block" aria-hidden>
                  👋
                </span>
              </h2>
              <p className="max-w-xl text-xs leading-relaxed text-white/75 sm:text-sm">
                Good to see you back. Here&apos;s the latest on your candidates and open roles.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 lg:shrink-0">
            <Link href="/admin/applications">
              <Button
                size="sm"
                className="gap-2 border-0 bg-white text-[#272055] shadow-lg shadow-black/10 hover:bg-white/90"
              >
                <FileText className="h-4 w-4" />
                Applications
              </Button>
            </Link>
            <Link href="/admin/job-postings/new">
              <Button
                size="sm"
                variant="outline"
                className="gap-2 border-white/25 bg-white/10 text-white backdrop-blur-sm hover:bg-white/20 hover:text-white"
              >
                Post a role
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          {highlights.map((item, index) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + index * 0.08, duration: 0.4 }}
              className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/10 px-3.5 py-2.5 backdrop-blur-md"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#31CDFF] to-[#272055] shadow-md shadow-[#272055]/30">
                <item.icon className="h-4 w-4 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-xl font-semibold tabular-nums text-white">
                  {item.value}
                </p>
                <p className="truncate text-xs text-white/65">{item.label}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.section>
  );
}
