"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  FileText,
  CheckCircle,
  Code,
  MessageSquare,
  UserCheck,
  XCircle,
  ArrowUpRight,
  Briefcase,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { DashboardOverviewSkeleton } from "@/components/skeletons";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { formatDate, cn } from "@/lib/utils";
import type { Application, ApplicationStats } from "@/types/application";
import { HiringProgress } from "@/components/user/HiringProgress";
import { UserWelcomeBanner } from "@/components/user/UserWelcomeBanner";
import { TourPageHelper } from "@/components/admin/tour/TourPageHelper";
import { userApi } from "@/lib/api-backend";
import { Skeleton } from "@/components/ui/skeleton";

const BRAND_NAVY = "#272156";
const BRAND_CYAN = "#31CDFF";
const SPRING_ENTER = { type: "spring" as const, bounce: 0, duration: 0.4 };

function statusCount(
  byStatus: ApplicationStats["byStatus"] | undefined,
  keys: string[]
) {
  if (!byStatus) return 0;
  return keys.reduce((sum, key) => sum + (byStatus[key] || 0), 0);
}

function getPositionTitle(application: Application) {
  return (
    application.jobDetails?.title ||
    application.jobId?.title ||
    application.position ||
    "Position"
  );
}

function statusTone(status?: string) {
  switch (status) {
    case "Hired":
      return "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800";
    case "Rejected":
    case "Disqualified":
      return "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800";
    case "Shortlisted":
      return "bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800";
    case "Interviewing":
      return "bg-[#272156]/08 text-[#272156] border-[#272156]/20 dark:bg-[#31CDFF]/10 dark:text-[#31CDFF] dark:border-[#31CDFF]/25";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

export default function DashboardOverviewPage() {
  const { user } = useAuth();
  const reduceMotion = useReducedMotion();
  const userId = user?.id;
  const press = reduceMotion ? undefined : { scale: 0.97 };

  const { data: statsData, isLoading: isStatsLoading } =
    useQuery<ApplicationStats>({
      queryKey: ["applicationStats", userId],
      queryFn: async () => {
        if (!userId) throw new Error("User ID not found");
        const response = await api.get(
          `/api/applications/users/application-stats`
        );
        return response.data;
      },
      enabled: !!userId,
      staleTime: 30000,
    });

  const { data: latestApplication, isLoading: isLatestAppLoading } = useQuery<
    Application | null
  >({
    queryKey: ["latestApplication", userId],
    queryFn: async () => {
      if (!userId) throw new Error("User ID not found");
      const response = await api.get(
        `/api/applications/users/latest-application`
      );
      return response.data;
    },
    enabled: !!userId,
    staleTime: 30000,
    gcTime: 60000,
  });

  const { data: openJobsCount = 0 } = useQuery({
    queryKey: ["openJobsCount", userId],
    queryFn: async () => {
      try {
        const response = await userApi.getJobs({ skip: 0, limit: 1 });
        return (
          response?.total ??
          response?.totalCount ??
          (Array.isArray(response?.jobs) ? response.jobs.length : 0)
        );
      } catch {
        return 0;
      }
    },
    enabled: !!userId,
    staleTime: 60000,
  });

  if (isStatsLoading || !userId) {
    return <DashboardOverviewSkeleton />;
  }

  const stats = statsData;
  const shortlisted = statusCount(stats?.byStatus, [
    "SHORTLISTED",
    "shortlisted",
    "Shortlisted",
  ]);
  const assessment = statusCount(stats?.byStatus, [
    "PENDING",
    "pending",
    "Pending",
    "Technical Assessment",
  ]);
  const interviewing = statusCount(stats?.byStatus, [
    "INTERVIEWING",
    "interviewing",
    "Interviewing",
  ]);
  const hired = statusCount(stats?.byStatus, ["HIRED", "hired", "Hired"]);
  const closed = statusCount(stats?.byStatus, [
    "REJECTED",
    "rejected",
    "Rejected",
    "DISQUALIFIED",
    "disqualified",
    "Disqualified",
  ]);
  const inReview = shortlisted + assessment + interviewing;

  const overviewItems = [
    {
      title: "Applications",
      value: stats?.total || 0,
      icon: FileText,
      description: "Submitted",
    },
    {
      title: "Shortlisted",
      value: shortlisted,
      icon: CheckCircle,
      description: "Moving forward",
    },
    {
      title: "Assessment",
      value: assessment,
      icon: Code,
      description: "Skills check",
    },
    {
      title: "Interview",
      value: interviewing,
      icon: MessageSquare,
      description: "Conversations",
    },
    {
      title: "Offers",
      value: hired,
      icon: UserCheck,
      description: "You're in",
    },
    {
      title: "Closed",
      value: closed,
      icon: XCircle,
      description: "Not selected",
    },
  ];

  return (
    <div className="space-y-5 sm:space-y-6">
      <TourPageHelper tourId="user-overview" />
      <UserWelcomeBanner
        totalApplications={stats?.total || 0}
        inReview={inReview}
        openJobs={typeof openJobsCount === "number" ? openJobsCount : 0}
        tourId="user-overview"
      />

      <HiringProgress />

      <div
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3"
        data-tour="user-overview-stats"
      >
        {overviewItems.map((item, index) => (
          <motion.div
            key={item.title}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={
              reduceMotion
                ? { duration: 0.2 }
                : { ...SPRING_ENTER, delay: index * 0.04 }
            }
            whileTap={press}
            className={cn(
              "group relative overflow-hidden rounded-2xl border border-border/80",
              "bg-card/90 p-4 shadow-sm backdrop-blur-sm sm:p-5",
              "transition-transform duration-100 ease-out",
              "active:scale-[0.98] motion-reduce:active:scale-100"
            )}
          >
            <div
              className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full blur-2xl opacity-60"
              style={{ backgroundColor: `${BRAND_CYAN}14` }}
            />
            <div className="relative z-10 flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  {item.title}
                </p>
                <p
                  className="text-3xl font-semibold tabular-nums tracking-tight"
                  style={{ color: BRAND_NAVY }}
                >
                  {item.value}
                </p>
                <p className="text-xs text-muted-foreground">
                  {item.description}
                </p>
              </div>
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-sm"
                style={{
                  background: `linear-gradient(135deg, ${BRAND_CYAN}, ${BRAND_NAVY})`,
                }}
              >
                <item.icon className="h-5 w-5 text-white" aria-hidden />
              </div>
            </div>
            <div
              className="absolute bottom-0 left-0 right-0 h-0.5 opacity-80"
              style={{
                background: `linear-gradient(90deg, ${BRAND_NAVY}, ${BRAND_CYAN})`,
              }}
            />
          </motion.div>
        ))}
      </div>

      {isLatestAppLoading ? (
        <Skeleton className="h-40 w-full rounded-2xl sm:h-44" />
      ) : latestApplication ? (
        <motion.div
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduceMotion ? { duration: 0.2 } : SPRING_ENTER}
          data-tour="user-latest-application"
          className={cn(
            "relative overflow-hidden rounded-2xl border border-border/80",
            "bg-card/90 p-5 shadow-sm backdrop-blur-sm sm:p-6"
          )}
        >
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3 sm:gap-4">
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-sm"
                style={{
                  background: `linear-gradient(135deg, ${BRAND_CYAN}28, ${BRAND_NAVY}22)`,
                }}
              >
                <Briefcase
                  className="h-5 w-5"
                  style={{ color: BRAND_NAVY }}
                  aria-hidden
                />
              </div>
              <div className="min-w-0 space-y-2">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                    Latest application
                  </p>
                  <h2 className="mt-1 text-lg font-semibold tracking-tight text-foreground sm:text-xl">
                    {getPositionTitle(latestApplication)}
                  </h2>
                </div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <span
                    className={cn(
                      "inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold",
                      statusTone(latestApplication.status)
                    )}
                  >
                    {latestApplication.status || "New"}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    Applied {formatDate(latestApplication.appliedDate)}
                  </span>
                </div>
              </div>
            </div>

            <motion.div whileTap={press} className="w-full lg:w-auto">
              <Button
                asChild
                className={cn(
                  "h-10 w-full gap-2 text-white shadow-md lg:w-auto",
                  "transition-transform duration-100 ease-out",
                  "active:scale-[0.97] motion-reduce:active:scale-100"
                )}
                style={{
                  background: `linear-gradient(135deg, ${BRAND_NAVY}, #1e1844)`,
                }}
              >
                <Link href="/dashboard/applications">
                  View details
                  <ArrowUpRight className="h-4 w-4" aria-hidden />
                </Link>
              </Button>
            </motion.div>
          </div>
        </motion.div>
      ) : (
        <motion.div
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduceMotion ? { duration: 0.2 } : SPRING_ENTER}
          data-tour="user-latest-application"
          className="rounded-2xl border border-dashed border-border bg-card/60 px-5 py-10 text-center sm:px-8"
        >
          <div
            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{
              background: `linear-gradient(135deg, ${BRAND_CYAN}22, ${BRAND_NAVY}18)`,
            }}
          >
            <FileText
              className="h-7 w-7"
              style={{ color: BRAND_NAVY }}
              aria-hidden
            />
          </div>
          <h3 className="text-lg font-semibold tracking-tight text-foreground">
            No applications yet
          </h3>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">
            Browse open positions and submit your first application.
          </p>
          <motion.div whileTap={press} className="mt-5 inline-flex">
            <Button
              asChild
              className={cn(
                "h-10 gap-2 text-white shadow-md",
                "transition-transform duration-100 ease-out",
                "active:scale-[0.97] motion-reduce:active:scale-100"
              )}
              style={{
                background: `linear-gradient(135deg, ${BRAND_NAVY}, #1e1844)`,
              }}
            >
              <Link href="/dashboard/jobs">
                <Briefcase className="h-4 w-4" aria-hidden />
                Browse jobs
              </Link>
            </Button>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
