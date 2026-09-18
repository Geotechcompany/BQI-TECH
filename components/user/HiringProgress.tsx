"use client";

import { useQuery } from "@tanstack/react-query";
import { userApi } from "@/lib/api-backend";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";
import { motion, useReducedMotion } from "framer-motion";
import { CheckCircle, Clock, Target, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

const BRAND_NAVY = "#272156";
const BRAND_CYAN = "#31CDFF";
const SPRING_ENTER = { type: "spring" as const, bounce: 0, duration: 0.4 };

interface HiringProgressResponse {
  stages: string[];
  currentStage: string | null;
  stageData: {
    [key: string]: {
      count: number;
      applications: Array<{
        id: string;
        jobId: string;
        status: string;
        appliedDate: string;
      }>;
    };
  };
}

const statusIcons: Record<string, typeof Clock> = {
  New: Clock,
  Shortlisted: CheckCircle,
  "Technical Assessment": Target,
  Interviewing: MessageSquare,
  Hired: CheckCircle,
  Rejected: Clock,
  Disqualified: Clock,
};

export function HiringProgress() {
  const { user } = useAuth();
  const reduceMotion = useReducedMotion();

  const { data, isLoading } = useQuery<HiringProgressResponse>({
    queryKey: ["hiringProgress", user?.id],
    queryFn: () => userApi.getHiringProgress(),
    enabled: !!user?.id,
    staleTime: 30000,
    gcTime: 60000,
  });

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border/80 bg-card/80 p-5 shadow-sm backdrop-blur-sm sm:p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
          <Skeleton className="h-2.5 w-full rounded-full" />
          <div className="flex justify-between">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-14" />
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const hasApplications = Object.values(data.stageData).some(
    (stage) => stage.count > 0
  );
  const currentStageIndex = hasApplications
    ? data.stages.indexOf(data.currentStage || "New")
    : -1;
  const progress = hasApplications
    ? ((currentStageIndex + 1) / data.stages.length) * 100
    : 0;

  const StatusIcon =
    statusIcons[data.currentStage || ""] || statusIcons.New;

  return (
    <motion.div
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduceMotion ? { duration: 0.2 } : SPRING_ENTER}
      data-tour="user-hiring-progress"
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border/80",
        "bg-card/90 p-5 shadow-sm backdrop-blur-md backdrop-saturate-150 sm:p-6"
      )}
    >
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full blur-3xl"
        style={{ backgroundColor: `${BRAND_CYAN}18` }}
      />

      <div className="relative z-10 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-sm"
              style={{
                background: `linear-gradient(135deg, ${BRAND_CYAN}22, ${BRAND_NAVY}18)`,
              }}
            >
              <StatusIcon
                className="h-5 w-5"
                style={{ color: BRAND_NAVY }}
                aria-hidden
              />
            </div>
            <div>
              <h3 className="text-base font-semibold tracking-tight text-foreground">
                Your progress
              </h3>
              <p className="text-sm text-muted-foreground">
                Where your latest application stands
              </p>
            </div>
          </div>
          <span
            className="shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums"
            style={{
              color: BRAND_NAVY,
              backgroundColor: `${BRAND_CYAN}22`,
            }}
          >
            {Math.round(progress)}%
          </span>
        </div>

        <div className="space-y-3">
          <div className="relative">
            <Progress
              value={progress}
              className="h-2.5 overflow-hidden rounded-full bg-muted"
            />
            <div
              className="absolute left-0 top-0 h-full rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none"
              style={{
                width: `${progress}%`,
                background: `linear-gradient(90deg, ${BRAND_NAVY}, ${BRAND_CYAN})`,
              }}
            />
          </div>

          <div className="flex justify-between gap-1">
            {data.stages.slice(0, 4).map((stage, index) => {
              const reached = index <= currentStageIndex;
              return (
                <div
                  key={stage}
                  className="flex min-w-0 flex-1 flex-col items-center gap-1.5"
                >
                  <div
                    className={cn(
                      "h-2.5 w-2.5 rounded-full transition-colors duration-200",
                      reached ? "shadow-sm" : "bg-muted"
                    )}
                    style={
                      reached
                        ? {
                            background: `linear-gradient(135deg, ${BRAND_CYAN}, ${BRAND_NAVY})`,
                          }
                        : undefined
                    }
                  />
                  <span className="max-w-full truncate text-center text-[10px] font-medium leading-tight text-muted-foreground sm:text-xs">
                    {stage}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-border/70 pt-4 text-sm">
          <span className="text-muted-foreground">
            {hasApplications
              ? `Step ${currentStageIndex + 1} of ${data.stages.length}`
              : "No applications yet"}
          </span>
          <span
            className="font-semibold"
            style={{ color: hasApplications ? BRAND_NAVY : undefined }}
          >
            {hasApplications ? data.currentStage || "New" : "Get started"}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
