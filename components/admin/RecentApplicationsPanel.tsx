"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Briefcase,
  Clock,
  FileText,
  Mail,
  Sparkles,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Application } from "@/types/application";
import {
  getEmailDisplay,
  getNameDisplay,
  getPositionDisplay,
} from "@/components/admin/utils/table-utils";
import { cn } from "@/lib/utils";

const statusStyles: Record<
  string,
  { badge: string; dot: string; ring: string }
> = {
  New: {
    badge:
      "bg-blue-500/10 text-blue-700 ring-blue-500/20 dark:text-blue-300",
    dot: "bg-blue-500",
    ring: "from-blue-500/20 to-blue-500/5",
  },
  Shortlisted: {
    badge:
      "bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:text-emerald-300",
    dot: "bg-emerald-500",
    ring: "from-emerald-500/20 to-emerald-500/5",
  },
  "Technical Assessment": {
    badge:
      "bg-amber-500/10 text-amber-700 ring-amber-500/20 dark:text-amber-300",
    dot: "bg-amber-500",
    ring: "from-amber-500/20 to-amber-500/5",
  },
  Interviewing: {
    badge:
      "bg-violet-500/10 text-violet-700 ring-violet-500/20 dark:text-violet-300",
    dot: "bg-violet-500",
    ring: "from-violet-500/20 to-violet-500/5",
  },
  Hired: {
    badge:
      "bg-teal-500/10 text-teal-700 ring-teal-500/20 dark:text-teal-300",
    dot: "bg-teal-500",
    ring: "from-teal-500/20 to-teal-500/5",
  },
  Rejected: {
    badge:
      "bg-rose-500/10 text-rose-700 ring-rose-500/20 dark:text-rose-300",
    dot: "bg-rose-500",
    ring: "from-rose-500/20 to-rose-500/5",
  },
  Disqualified: {
    badge:
      "bg-slate-500/10 text-slate-700 ring-slate-500/20 dark:text-slate-300",
    dot: "bg-slate-500",
    ring: "from-slate-500/20 to-slate-500/5",
  },
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function getStatusStyle(status: string) {
  return (
    statusStyles[status] ?? {
      badge: "bg-muted text-muted-foreground ring-border",
      dot: "bg-muted-foreground",
      ring: "from-muted/30 to-transparent",
    }
  );
}

interface RecentApplicationsPanelProps {
  applications: Application[];
  jobTitles: Record<string, string>;
  onView: (application: Application) => void;
  viewAllHref?: string;
  maxItems?: number;
  className?: string;
}

export function RecentApplicationsPanel({
  applications,
  jobTitles,
  onView,
  viewAllHref = "/admin/applications",
  maxItems = 8,
  className,
}: RecentApplicationsPanelProps) {
  const items = applications.slice(0, maxItems);

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border/60",
        "bg-gradient-to-br from-violet-50/50 via-card to-card",
        "dark:from-violet-950/20 dark:via-card dark:to-card",
        "shadow-sm backdrop-blur-xl",
        className
      )}
    >
      <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-violet-400/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-10 h-32 w-32 rounded-full bg-[#31CDFF]/10 blur-3xl" />

      <div className="relative border-b border-border/50 px-6 py-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/25">
              <Clock className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-foreground">
                Recent Applications
              </h2>
              <p className="text-sm text-muted-foreground">
                Latest candidates across all positions
              </p>
            </div>
          </div>
          <Link
            href={viewAllHref}
            className="group inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-background/80 px-4 py-2 text-sm font-medium text-foreground shadow-sm transition-all hover:border-violet-500/30 hover:bg-violet-500/5 hover:text-violet-700 dark:hover:text-violet-300"
          >
            View all
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>

      <div className="relative p-4 md:p-6">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-muted/20 px-6 py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/10 to-purple-500/10">
              <FileText className="h-7 w-7 text-violet-500/60" />
            </div>
            <p className="font-medium text-foreground">No recent applications</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              New submissions will appear here as candidates apply.
            </p>
            <Link
              href={viewAllHref}
              className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-violet-600 hover:text-violet-700 dark:text-violet-400"
            >
              Browse applications
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-4">
            {items.map((app, index) => {
              const name = getNameDisplay(app);
              const email = getEmailDisplay(app);
              const position = getPositionDisplay(app, jobTitles);
              const style = getStatusStyle(app.status);
              const appliedLabel = app.appliedDate
                ? formatDistanceToNow(new Date(app.appliedDate), {
                    addSuffix: true,
                  })
                : "Recently";

              return (
                <motion.button
                  key={app.id}
                  type="button"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05, duration: 0.35 }}
                  whileHover={{ y: -2 }}
                  onClick={() => onView(app)}
                  className={cn(
                    "group relative w-full overflow-hidden rounded-xl border border-border/50 p-4 text-left",
                    "bg-gradient-to-br from-background/90 to-background/60",
                    "shadow-sm transition-all duration-300",
                    "hover:border-violet-500/25 hover:shadow-md hover:shadow-violet-500/5",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40"
                  )}
                >
                  <div
                    className={cn(
                      "pointer-events-none absolute inset-0 bg-gradient-to-br opacity-0 transition-opacity group-hover:opacity-100",
                      style.ring
                    )}
                  />

                  <div className="relative flex gap-3">
                    <div
                      className={cn(
                        "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-sm font-bold text-white shadow-md",
                        "from-[#272055] to-violet-600"
                      )}
                    >
                      {getInitials(name)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate font-semibold text-foreground">
                          {name}
                        </p>
                        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
                      </div>

                      <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Briefcase className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{position}</span>
                      </div>

                      {email && email !== "No Contact Info" && (
                        <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Mail className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{email}</span>
                        </div>
                      )}

                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset",
                            style.badge
                          )}
                        >
                          <span
                            className={cn("h-1.5 w-1.5 rounded-full", style.dot)}
                          />
                          {app.status}
                        </span>
                        <span className="text-[11px] font-medium text-muted-foreground">
                          {appliedLabel}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="absolute right-3 top-3 opacity-0 transition-opacity group-hover:opacity-100">
                    <Sparkles className="h-3.5 w-3.5 text-violet-400/80" />
                  </div>
                </motion.button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
