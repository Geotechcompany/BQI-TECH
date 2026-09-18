"use client";

import { useState, useEffect } from "react";
import { BACKEND_URL } from "@/lib/config";
import { motion, useReducedMotion } from "framer-motion";
import {
  Briefcase,
  Clock,
  CheckCircle,
  XCircle,
  Calendar,
  Eye,
  ArrowRight,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { UserWelcomeBanner } from "@/components/user/UserWelcomeBanner";
import { TourPageHelper } from "@/components/admin/tour/TourPageHelper";
import { CardGridSkeleton, Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "react-hot-toast";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { userApi } from "@/lib/api-backend";

const BRAND_NAVY = "#272156";
const BRAND_CYAN = "#31CDFF";
const SPRING_ENTER = { type: "spring" as const, bounce: 0, duration: 0.4 };

interface Application {
  id: string;
  position: string;
  status: string;
  appliedDate: string;
  lastUpdated: string;
  name: string;
  email: string;
  resumeUrl?: string;
}

export default function Dashboard() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [openJobs, setOpenJobs] = useState(0);
  const { user } = useAuth();
  const reduceMotion = useReducedMotion();
  const press = reduceMotion ? undefined : { scale: 0.97 };

  useEffect(() => {
    const fetchApplications = async () => {
      if (!user) return;

      try {
        const [appsResponse, jobsResponse] = await Promise.all([
          fetch(`${BACKEND_URL}/api/applications/user`, {
            credentials: "include",
            headers: { Accept: "application/json" },
          }),
          userApi.getJobs({ skip: 0, limit: 1 }).catch(() => null),
        ]);

        if (!appsResponse.ok) {
          const error = await appsResponse.json();
          throw new Error(error.error || "Failed to fetch applications");
        }

        const data = await appsResponse.json();
        setApplications(data.applications || []);
        setOpenJobs(
          jobsResponse?.total ??
            jobsResponse?.totalCount ??
            (Array.isArray(jobsResponse?.jobs) ? jobsResponse.jobs.length : 0)
        );
      } catch (error) {
        console.error("Error fetching applications:", error);
        toast.error("Failed to load your applications");
        setApplications([]);
      } finally {
        setIsLoading(false);
      }
    };

    if (user) {
      fetchApplications();
    }
  }, [user]);

  const handleViewApplication = async (id: string) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/applications/${id}`, {
        credentials: "include",
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to fetch application details");
      }

      const data = await response.json();
      setSelectedApp(data.application);
    } catch (error) {
      console.error("Error fetching application details:", error);
      toast.error("Failed to load application details");
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "New":
        return "bg-sky-50 text-sky-800 ring-sky-700/10 dark:bg-sky-950/40 dark:text-sky-300";
      case "Under Review":
      case "Shortlisted":
        return "bg-amber-50 text-amber-800 ring-amber-700/10 dark:bg-amber-950/40 dark:text-amber-300";
      case "Interview Scheduled":
      case "Interviewing":
        return "bg-[#272156]/08 text-[#272156] ring-[#272156]/15 dark:bg-[#31CDFF]/10 dark:text-[#31CDFF]";
      case "Offer Extended":
      case "Hired":
        return "bg-emerald-50 text-emerald-800 ring-emerald-700/10 dark:bg-emerald-950/40 dark:text-emerald-300";
      case "Rejected":
        return "bg-rose-50 text-rose-800 ring-rose-700/10 dark:bg-rose-950/40 dark:text-rose-300";
      default:
        return "bg-muted text-muted-foreground ring-border";
    }
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case "New":
        return <Briefcase className="h-4 w-4" aria-hidden />;
      case "Shortlisted":
      case "Under Review":
        return <Clock className="h-4 w-4" aria-hidden />;
      case "Interview Scheduled":
      case "Interviewing":
        return <Calendar className="h-4 w-4" aria-hidden />;
      case "Offer Extended":
      case "Hired":
        return <CheckCircle className="h-4 w-4" aria-hidden />;
      case "Rejected":
        return <XCircle className="h-4 w-4" aria-hidden />;
      default:
        return null;
    }
  };

  const inReview = applications.filter((app) =>
    ["Shortlisted", "Under Review", "Interviewing", "Interview Scheduled"].includes(
      app.status
    )
  ).length;

  if (isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-44 w-full rounded-2xl sm:h-52" />
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-44" />
          <Skeleton className="h-8 w-24" />
        </div>
        <CardGridSkeleton count={3} />
      </div>
    );
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <TourPageHelper tourId="user-overview" />
      <UserWelcomeBanner
        totalApplications={applications.length}
        inReview={inReview}
        openJobs={openJobs}
        tourId="user-overview"
      />

      <div
        className="flex items-end justify-between gap-3"
        data-tour="user-latest-application"
      >
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
            Recent applications
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Your three most recent submissions
          </p>
        </div>
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="gap-1.5 text-[#272156] hover:bg-[#272156]/05 hover:text-[#272156]"
        >
          <Link href="/dashboard/applications">
            View all
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </Button>
      </div>

      {applications.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/60 px-5 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            No applications yet. Browse open positions to get started.
          </p>
          <Button
            asChild
            className="mt-4 h-9 gap-2 text-white"
            style={{
              background: `linear-gradient(135deg, ${BRAND_NAVY}, #1e1844)`,
            }}
          >
            <Link href="/dashboard/jobs">
              <Briefcase className="h-4 w-4" aria-hidden />
              Browse jobs
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
          {applications.slice(0, 3).map((app, index) => (
            <motion.div
              key={app.id}
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={
                reduceMotion
                  ? { duration: 0.2 }
                  : { ...SPRING_ENTER, delay: index * 0.05 }
              }
              whileTap={press}
              className={cn(
                "rounded-2xl border border-border/80 bg-card/90 p-4 shadow-sm",
                "backdrop-blur-sm sm:p-5",
                "transition-transform duration-100 ease-out",
                "active:scale-[0.98] motion-reduce:active:scale-100"
              )}
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate text-base font-semibold tracking-tight text-foreground">
                    {app.position}
                  </h3>
                  <p className="mt-0.5 truncate text-sm text-muted-foreground">
                    {app.name}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleViewApplication(app.id)}
                  className="h-8 w-8 shrink-0 p-0 hover:bg-[#272156]/06"
                  aria-label={`View ${app.position}`}
                >
                  <Eye className="h-4 w-4" style={{ color: BRAND_NAVY }} />
                </Button>
              </div>

              <div className="space-y-3">
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset",
                    statusColor(app.status)
                  )}
                >
                  {statusIcon(app.status)}
                  {app.status}
                </span>

                <div className="space-y-1.5 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 shrink-0 opacity-60" />
                    <span>
                      Applied{" "}
                      {new Date(app.appliedDate).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 shrink-0 opacity-60" />
                    <span>
                      Updated{" "}
                      {new Date(
                        app.lastUpdated || app.appliedDate
                      ).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <Dialog open={!!selectedApp} onOpenChange={() => setSelectedApp(null)}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Application details</DialogTitle>
          </DialogHeader>
          {selectedApp && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">
                  Position
                </h3>
                <p className="mt-0.5 font-medium">{selectedApp.position}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">
                  Status
                </h3>
                <span
                  className={cn(
                    "mt-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset",
                    statusColor(selectedApp.status)
                  )}
                >
                  {statusIcon(selectedApp.status)}
                  {selectedApp.status}
                </span>
              </div>
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">
                  Applied
                </h3>
                <p className="mt-0.5">
                  {new Date(selectedApp.appliedDate).toLocaleDateString()}
                </p>
              </div>
              {selectedApp.resumeUrl && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">
                    Resume
                  </h3>
                  <a
                    href={selectedApp.resumeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-0.5 inline-flex text-sm font-medium hover:underline"
                    style={{ color: BRAND_CYAN }}
                  >
                    View resume
                  </a>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
