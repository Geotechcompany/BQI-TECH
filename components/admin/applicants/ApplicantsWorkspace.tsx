"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import Lottie from "lottie-react";
import { useReducedMotion } from "framer-motion";
import {
  Briefcase,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileText,
  MapPin,
  Settings,
  Star,
  Tag,
  UserMinus,
} from "lucide-react";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import { AdminPageWelcomeBanner } from "@/components/admin/AdminPageWelcomeBanner";
import { TourPageHelper } from "@/components/admin/tour/TourPageHelper";
import { ResumeCvPanel } from "@/components/admin/candidate-profile/ResumeCvPanel";
import {
  getCandidateInitials,
  getAddedByDisplay,
  getExperienceDisplay,
} from "@/components/admin/candidate-profile/application-helpers";
import { TagCandidatesDialog } from "@/components/admin/candidates/CandidateBulkDialogs";
import { DEFAULT_PIPELINE_STAGE_DEFINITIONS } from "@/components/admin/pipeline/pipeline-settings-config";
import {
  normalizeToPipelineStage,
  PIPELINE_STAGES,
} from "@/components/admin/pipeline/pipeline-utils";
import { adminApplicationsApi } from "@/components/admin/utils/applications-api";
import { candidateActionsApi } from "@/components/admin/utils/candidate-actions-api";
import {
  getCvUrl,
  getNameDisplay,
  getPositionDisplay,
} from "@/components/admin/utils/table-utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ListRowSkeleton,
  Skeleton,
} from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import {
  extractHiringTeamIds,
  extractHiringTeamMembers,
  type JobOwnershipMeta,
} from "@/lib/overview-positions";
import type { Application } from "@/types/application";
import { cn } from "@/lib/utils";
import {
  applicationBelongsToJob,
  buildExperienceView,
  buildPositionList,
  nextForwardStage,
  sortApplicantsByAppliedDate,
  sourcedByLabel,
  type ApplicantsPositionTab,
} from "./applicants-utils";
import { ApplicantsEmptyState } from "./ApplicantsEmptyState";

const BRAND_NAVY = "#272156";
const BRAND_CYAN = "#31CDFF";
const EMPTY_APPLICANTS_LOTTIE_SRC = "/lottie/empty-applicants.json";

let emptyExperienceLottieCache: object | null | undefined;
let emptyExperienceLottiePromise: Promise<object | null> | null = null;

function loadEmptyExperienceLottie(): Promise<object | null> {
  if (emptyExperienceLottieCache !== undefined) {
    return Promise.resolve(emptyExperienceLottieCache);
  }
  if (!emptyExperienceLottiePromise) {
    emptyExperienceLottiePromise = fetch(EMPTY_APPLICANTS_LOTTIE_SRC)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: object | null) => {
        emptyExperienceLottieCache = data;
        return data;
      })
      .catch(() => {
        emptyExperienceLottieCache = null;
        return null;
      });
  }
  return emptyExperienceLottiePromise;
}

function StaticEmptyFolderMark() {
  return (
    <svg
      viewBox="0 0 120 120"
      className="h-full w-full"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="60" cy="62" r="42" fill="#272156" fillOpacity="0.06" />
      <path
        d="M34 48h16l6-7h14l6 7h16v36H34V48z"
        fill="#272156"
        fillOpacity="0.55"
      />
      <path d="M30 54h60l-4 34H34L30 54z" fill="#272156" />
      <path d="M34 58h52l-1.5 6H35.5L34 58z" fill="#31CDFF" />
      <rect
        x="48"
        y="36"
        width="24"
        height="30"
        rx="2"
        fill="#F8F8FA"
        stroke="#272156"
        strokeOpacity="0.35"
      />
    </svg>
  );
}

function EmptyPanel({
  icon: Icon,
  title,
  description,
  compact = false,
  showAnimation = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  /** Tighter layout for the positions sidebar. */
  compact?: boolean;
  /** Premium Lottie (empty-applicants) with reduced-motion fallback. */
  showAnimation?: boolean;
}) {
  const prefersReducedMotion = useReducedMotion();
  const [animationData, setAnimationData] = useState<object | null>(
    () => emptyExperienceLottieCache ?? null
  );

  useEffect(() => {
    if (!showAnimation || prefersReducedMotion) return;
    let cancelled = false;
    loadEmptyExperienceLottie().then((data) => {
      if (!cancelled && data) setAnimationData(data);
    });
    return () => {
      cancelled = true;
    };
  }, [showAnimation, prefersReducedMotion]);

  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center overflow-hidden text-center",
        compact ? "px-4 py-12" : "flex-1 px-6 py-16"
      )}
    >
      {!compact ? (
        <>
          <div
            className="pointer-events-none absolute inset-0"
            aria-hidden
            style={{
              background:
                "radial-gradient(ellipse 70% 55% at 50% 42%, rgba(49,205,255,0.10) 0%, rgba(39,33,86,0.05) 45%, transparent 72%)",
            }}
          />
          <div
            className="pointer-events-none absolute left-1/2 top-[38%] h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#272156]/[0.04] blur-2xl"
            aria-hidden
          />
        </>
      ) : null}
      <div className="relative z-[1] flex flex-col items-center">
        {showAnimation ? (
          <div className="mb-1 h-[140px] w-[140px]" aria-hidden>
            {animationData && !prefersReducedMotion ? (
              <Lottie
                animationData={animationData}
                loop
                className="h-full w-full"
              />
            ) : (
              <StaticEmptyFolderMark />
            )}
          </div>
        ) : (
          <div
            className={cn(
              "mb-3 flex items-center justify-center rounded-xl bg-[#272156]/[0.06] ring-1 ring-[#272156]/8",
              compact ? "h-10 w-10" : "h-12 w-12"
            )}
            aria-hidden
          >
            <Icon
              className={cn(
                "text-[#272156]/45",
                compact ? "h-5 w-5" : "h-6 w-6"
              )}
            />
          </div>
        )}
        <p className="text-sm font-semibold tracking-tight text-[#272156]">
          {title}
        </p>
        <p className="mt-1 max-w-[240px] text-xs leading-relaxed text-muted-foreground sm:text-sm sm:max-w-sm">
          {description}
        </p>
      </div>
    </div>
  );
}

export function ApplicantsWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { isAuthenticated, isAdmin, authLoading, user } = useAuth();
  const userId = user?.id || "";

  const [positionTab, setPositionTab] = useState<ApplicantsPositionTab>("all");
  const [selectedJobId, setSelectedJobId] = useState<string | null>(
    searchParams.get("jobId")
  );
  const [selectedApplicationId, setSelectedApplicationId] = useState<string | null>(
    searchParams.get("applicationId")
  );
  const [contentTab, setContentTab] = useState<"experience" | "resume">(
    "experience"
  );
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [disqualifyOpen, setDisqualifyOpen] = useState(false);
  const [tagOpen, setTagOpen] = useState(false);
  const [isFollowBusy, setIsFollowBusy] = useState(false);

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !isAdmin)) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, isAdmin, router]);

  const jobsQuery = useQuery({
    queryKey: ["applicants-jobs"],
    queryFn: async () => {
      // Backend GET /job-postings enforces limit le=100 (422 above that).
      const pageSize = 100;
      const metaById: Record<string, JobOwnershipMeta> = {};
      const locations: Record<string, string> = {};
      const titles: Record<string, string> = {};
      let skip = 0;
      let total = Infinity;

      while (skip < total) {
        const response = await adminApplicationsApi.getJobPostings({
          limit: pageSize,
          skip,
        });
        const payload = response as {
          jobPostings?: unknown[];
          total?: number;
        };
        const jobs = Array.isArray(response)
          ? response
          : payload?.jobPostings || [];
        total =
          typeof payload?.total === "number" ? payload.total : jobs.length;

        for (const job of jobs as Array<Record<string, unknown>>) {
          const rawId = job?.id || job?._id;
          if (!rawId) continue;
          const id = String(rawId);
          const title = String(job?.title || "");
          metaById[id] = {
            id,
            title,
            createdBy: job?.createdBy ? String(job.createdBy) : null,
            hiringTeam: extractHiringTeamMembers(job?.hiringTeam),
            hiringTeamIds: extractHiringTeamIds(job?.hiringTeam),
            isActive: Boolean(job?.isActive),
          };
          locations[id] = typeof job?.location === "string" ? job.location : "";
          if (title) titles[id] = title;
        }

        if (jobs.length < pageSize) break;
        skip += pageSize;
      }

      return { metaById, locations, titles };
    },
    enabled: isAuthenticated && isAdmin,
    staleTime: 60_000,
  });

  const applicationsQuery = useQuery({
    queryKey: ["applicants-applications"],
    queryFn: () => adminApplicationsApi.getAllApplicationsPaginated({}),
    enabled: isAuthenticated && isAdmin,
    staleTime: 30_000,
  });

  const applications = (applicationsQuery.data?.applications ||
    []) as Application[];
  const jobMetaList = useMemo(
    () => Object.values(jobsQuery.data?.metaById || {}),
    [jobsQuery.data?.metaById]
  );
  const jobTitles = jobsQuery.data?.titles || {};
  const jobLocations = jobsQuery.data?.locations || {};

  const positions = useMemo(
    () =>
      buildPositionList({
        jobs: jobMetaList,
        jobLocations,
        applications,
        tab: positionTab,
        userId,
      }),
    [jobMetaList, jobLocations, applications, positionTab, userId]
  );

  // Keep selection valid when tab / data changes
  useEffect(() => {
    if (!positions.length) {
      setSelectedJobId(null);
      setSelectedApplicationId(null);
      return;
    }
    if (!selectedJobId || !positions.some((p) => p.jobId === selectedJobId)) {
      setSelectedJobId(positions[0].jobId);
    }
  }, [positions, selectedJobId]);

  const selectedPosition = positions.find((p) => p.jobId === selectedJobId);

  const positionApplicants = useMemo(() => {
    if (!selectedJobId || !selectedPosition) return [];
    const matched = applications.filter((app) =>
      applicationBelongsToJob(app, selectedJobId, selectedPosition.title)
    );
    return sortApplicantsByAppliedDate(matched);
  }, [applications, selectedJobId, selectedPosition]);

  useEffect(() => {
    if (!positionApplicants.length) {
      setSelectedApplicationId(null);
      return;
    }
    if (
      !selectedApplicationId ||
      !positionApplicants.some((app) => app.id === selectedApplicationId)
    ) {
      setSelectedApplicationId(positionApplicants[0].id);
    }
  }, [positionApplicants, selectedApplicationId]);

  const selectedApplication = useMemo(
    () =>
      positionApplicants.find((app) => app.id === selectedApplicationId) || null,
    [positionApplicants, selectedApplicationId]
  );

  // Fill empty contact + experience from CV when opening an applicant with a resume.
  useEffect(() => {
    if (!selectedApplication) return;
    const resumeUrl = getCvUrl(selectedApplication);
    if (!resumeUrl) return;

    const hasExperience =
      Boolean(getExperienceDisplay(selectedApplication).trim()) ||
      Boolean(selectedApplication.cvWorkExperience?.length) ||
      Boolean(selectedApplication.cvProfessionalSummary?.trim()) ||
      Boolean(selectedApplication.aiRankSummary?.trim());
    const experienceSynced =
      selectedApplication.experienceSyncedCvUrl === resumeUrl;
    const needsExperience = !hasExperience && !experienceSynced;

    const hasPhone = Boolean(selectedApplication.phoneNumber?.trim());
    const contactSynced =
      selectedApplication.contactSyncedCvUrl === resumeUrl;
    const needsContact = !hasPhone && !contactSynced;

    if (!needsExperience && !needsContact) return;

    const applicationId = selectedApplication.id;
    let cancelled = false;
    void (async () => {
      try {
        const result = await adminApplicationsApi.extractContactFromCv(
          applicationId
        );
        if (cancelled || !result?.application) return;
        queryClient.setQueryData(
          ["applicants-applications"],
          (current: { applications?: Application[] } | undefined) => {
            if (!current?.applications) return current;
            return {
              ...current,
              applications: current.applications.map((app) =>
                app.id === applicationId
                  ? {
                      ...app,
                      ...result.application,
                      ...result.filled,
                    }
                  : app
              ),
            };
          }
        );
      } catch {
        // Profile remains usable if CV sync fails
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedApplication, queryClient]);

  const currentIndex = selectedApplication
    ? positionApplicants.findIndex((app) => app.id === selectedApplication.id)
    : -1;
  const prevApplicant =
    currentIndex > 0 ? positionApplicants[currentIndex - 1] : null;
  const nextApplicant =
    currentIndex >= 0 && currentIndex < positionApplicants.length - 1
      ? positionApplicants[currentIndex + 1]
      : null;

  useEffect(() => {
    const currentJob = searchParams.get("jobId");
    const currentApp = searchParams.get("applicationId");
    if (currentJob === selectedJobId && currentApp === selectedApplicationId) {
      return;
    }
    const params = new URLSearchParams();
    if (selectedJobId) params.set("jobId", selectedJobId);
    if (selectedApplicationId) params.set("applicationId", selectedApplicationId);
    const qs = params.toString();
    router.replace(qs ? `/manage/applicants?${qs}` : "/manage/applicants", {
      scroll: false,
    });
  }, [selectedJobId, selectedApplicationId, searchParams, router]);
  const statusMutation = useMutation({
    mutationFn: ({
      applicationId,
      status,
    }: {
      applicationId: string;
      status: string;
      previousStatus?: string;
    }) =>
      adminApplicationsApi.updateApplication(applicationId, { status }) as Promise<Application>,
    onSuccess: (saved, { applicationId, status, previousStatus }) => {
      queryClient.setQueryData(
        ["applicants-applications"],
        (current: { applications?: Application[] } | undefined) => {
          if (!current?.applications) return current;
          return {
            ...current,
            applications: current.applications.map((app) =>
              app.id === saved.id
                ? { ...app, ...saved, status: status || saved.status }
                : app
            ),
          };
        }
      );
      queryClient.invalidateQueries({ queryKey: ["applicants-applications"] });
      queryClient.invalidateQueries({ queryKey: ["admin-notifications"] });
      toast.success(`Moved to ${status}`, {
        duration: 20000,
        action: previousStatus
          ? {
              label: "Undo",
              onClick: () => {
                statusMutation.mutate({
                  applicationId,
                  status: previousStatus,
                  previousStatus: status,
                });
              },
            }
          : undefined,
      });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to update stage");
    },
  });

  const tagMutation = useMutation({
    mutationFn: (payload: { add: string[]; remove: string[] }) => {
      if (!selectedApplication) throw new Error("No applicant selected");
      return candidateActionsApi.bulkUpdateTags({
        ids: [selectedApplication.id],
        add: payload.add,
        remove: payload.remove,
      });
    },
    onSuccess: async (_, payload) => {
      if (!selectedApplication) return;
      queryClient.setQueryData(
        ["applicants-applications"],
        (current: { applications?: Application[] } | undefined) => {
          if (!current?.applications) return current;
          return {
            ...current,
            applications: current.applications.map((app) => {
              if (app.id !== selectedApplication.id) return app;
              const existing = new Set(app.tags || []);
              for (const tag of payload.remove) existing.delete(tag);
              for (const tag of payload.add) existing.add(tag);
              return { ...app, tags: Array.from(existing) };
            }),
          };
        }
      );
      toast.success("Tags updated");
      setTagOpen(false);
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to update tags");
    },
  });

  const handleSelectPosition = (jobId: string) => {
    setSelectedJobId(jobId);
    setSelectedApplicationId(null);
    setContentTab("experience");
  };

  const handleStatusChange = (status: string) => {
    if (!selectedApplication) return;
    if (normalizeToPipelineStage(selectedApplication.status) === status) return;
    statusMutation.mutate({
      applicationId: selectedApplication.id,
      status,
      previousStatus: selectedApplication.status || "New",
    });
  };

  const handleMoveNextStage = () => {
    if (!selectedApplication) return;
    const next = nextForwardStage(selectedApplication.status);
    if (!next) {
      toast.message("Already at the final hiring stage");
      return;
    }
    handleStatusChange(next);
  };

  const handleDisqualify = () => {
    if (!selectedApplication) return;
    setDisqualifyOpen(false);
    handleStatusChange("Disqualified");
  };

  const handleToggleFollow = async () => {
    if (!selectedApplication) return;
    const nextFollowed = !selectedApplication.isFollowed;
    setIsFollowBusy(true);
    try {
      const result = await candidateActionsApi.setFollow(
        selectedApplication.id,
        nextFollowed
      );
      queryClient.setQueryData(
        ["applicants-applications"],
        (current: { applications?: Application[] } | undefined) => {
          if (!current?.applications) return current;
          return {
            ...current,
            applications: current.applications.map((app) =>
              app.id === selectedApplication.id
                ? {
                    ...app,
                    isFollowed: result.isFollowed,
                    followedBy: result.followedBy,
                  }
                : app
            ),
          };
        }
      );
      toast.success(nextFollowed ? "Starred applicant" : "Removed star");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update star"
      );
    } finally {
      setIsFollowBusy(false);
    }
  };

  const isLoading = jobsQuery.isLoading || applicationsQuery.isLoading;
  const loadError =
    (jobsQuery.error as Error | null)?.message ||
    (applicationsQuery.error as Error | null)?.message;
  const hasLoadError = Boolean(loadError);

  const name = selectedApplication
    ? getNameDisplay(selectedApplication)
    : "";
  const cvUrl = selectedApplication ? getCvUrl(selectedApplication) : null;
  const experienceView = selectedApplication
    ? buildExperienceView(selectedApplication)
    : null;
  const profileHref =
    selectedApplication && selectedJobId
      ? `/manage/jobs/${selectedJobId}/candidates/${selectedApplication.id}`
      : null;
  const appliedRelative = selectedApplication?.appliedDate
    ? (() => {
        try {
          return formatDistanceToNow(new Date(selectedApplication.appliedDate), {
            addSuffix: true,
          });
        } catch {
          return null;
        }
      })()
    : null;
  const sourcedBy =
    selectedApplication != null
      ? getAddedByDisplay(selectedApplication) ||
        sourcedByLabel(selectedApplication)
      : null;
  const currentStage = selectedApplication
    ? normalizeToPipelineStage(selectedApplication.status)
    : "New";
  const nextStage = selectedApplication
    ? nextForwardStage(selectedApplication.status)
    : null;
  const stageDefinitions = DEFAULT_PIPELINE_STAGE_DEFINITIONS;
  const tagCatalog = useMemo(() => {
    const tags = new Set<string>();
    for (const app of applications) {
      for (const tag of app.tags || []) {
        if (tag.trim()) tags.add(tag.trim());
      }
    }
    return Array.from(tags).sort((a, b) => a.localeCompare(b));
  }, [applications]);

  return (
    <AdminPageLayout
      title="Applicants"
      showSearch={false}
      fillViewport
      contentClassName="max-w-none px-0 py-0"
      tourId="applicants"
      guideInBanner
    >
      <TourPageHelper tourId="applicants" />
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="shrink-0 px-4 pt-3">
          <AdminPageWelcomeBanner bannerKey="applicants" compact tourId="applicants" />
        </div>
      <div
        className="flex min-h-0 flex-1 overflow-hidden border-t border-border bg-background"
        data-tour="applicants-workspace"
      >
        {/* Left: positions */}
        <aside
          className="flex w-[300px] shrink-0 flex-col border-r border-border bg-card"
          data-tour="applicants-positions"
        >
          <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
            <h1 className="text-sm font-semibold tracking-tight text-[#272156]">
              Applicants
            </h1>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 px-2 text-xs text-muted-foreground hover:text-[#272156]"
              onClick={() => setPrefsOpen(true)}
              data-tour="applicants-preferences"
            >
              <Settings className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">My Preferences</span>
            </Button>
          </div>

          <div className="flex border-b border-border p-1.5">
            {(
              [
                ["all", "All Positions"],
                ["mine", "My Positions"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setPositionTab(value)}
                className={cn(
                  "flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                  positionTab === value
                    ? "bg-[#272156]/10 text-[#272156]"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {isLoading ? (
              <ListRowSkeleton rows={8} showAvatar={false} />
            ) : hasLoadError ? (
              <EmptyPanel
                compact
                icon={Briefcase}
                title="Could not load positions"
                description="Refresh the page or try again in a moment."
              />
            ) : positions.length === 0 ? (
              <EmptyPanel
                compact
                icon={Briefcase}
                title="No positions"
                description={
                  positionTab === "mine"
                    ? "You are not on the hiring team for any positions yet."
                    : "Create a job posting to start reviewing applicants."
                }
              />
            ) : (
              <ul className="divide-y divide-border/70">
                {positions.map((position) => {
                  const selected = position.jobId === selectedJobId;
                  return (
                    <li key={position.jobId}>
                      <button
                        type="button"
                        onClick={() => handleSelectPosition(position.jobId)}
                        className={cn(
                          "relative flex w-full flex-col gap-1 px-3 py-2.5 text-left transition-colors",
                          selected
                            ? "bg-[#272156]/[0.06] before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-[#31CDFF]"
                            : "hover:bg-muted/50"
                        )}
                      >
                        <span
                          className={cn(
                            "line-clamp-2 text-sm font-medium leading-snug",
                            selected ? "text-[#272156]" : "text-foreground"
                          )}
                        >
                          {position.title}
                        </span>
                        <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
                          {position.location ? (
                            <span className="inline-flex min-w-0 items-center gap-1 truncate">
                              <MapPin className="h-3 w-3 shrink-0" />
                              <span className="truncate">{position.location}</span>
                            </span>
                          ) : (
                            <span>No location</span>
                          )}
                          <Badge
                            variant="secondary"
                            className={cn(
                              "ml-auto h-5 shrink-0 px-1.5 text-[10px] font-semibold tabular-nums",
                              selected &&
                                "bg-[#31CDFF]/15 text-[#272156] hover:bg-[#31CDFF]/15"
                            )}
                          >
                            {position.applicantCount}
                          </Badge>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>

        {/* Main */}
        <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
          {loadError ? (
            <div className="m-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              Failed to load applicants: {loadError}
            </div>
          ) : null}

          {isLoading ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex items-center gap-3 border-b border-border/60 px-4 py-3">
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-44" />
                  <Skeleton className="h-3 w-56" />
                </div>
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-8 w-20" />
              </div>
              <div className="grid min-h-0 flex-1 gap-4 p-4 lg:grid-cols-2">
                <div className="space-y-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="space-y-1.5">
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-9 w-full" />
                    </div>
                  ))}
                </div>
                <div className="space-y-3 rounded-lg border border-border/60 p-3">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-[min(28rem,50vh)] w-full" />
                </div>
              </div>
            </div>
          ) : hasLoadError ? (
            <ApplicantsEmptyState
              title="Unable to load data"
              description="Positions and applications could not be loaded. Check the error above and refresh."
            />
          ) : !selectedPosition ? (
            <ApplicantsEmptyState
              title="Select a position"
              description="Choose a position on the left to review its applicants."
            />
          ) : !selectedApplication ? (
            <ApplicantsEmptyState
              showAnimation
              jobId={selectedPosition.jobId}
              title="No applicants"
              description={`${selectedPosition.title} has no applications yet.`}
            />
          ) : (
            <>
              {/* Action bar */}
              <div
                className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-border bg-card px-3 py-2"
                data-tour="applicants-action-bar"
              >
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1 text-xs"
                  disabled={!prevApplicant}
                  onClick={() =>
                    prevApplicant && setSelectedApplicationId(prevApplicant.id)
                  }
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Previous Applicant
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1 text-xs border-[#272156]/20 text-[#272156]"
                  disabled={!nextStage || statusMutation.isPending}
                  onClick={handleMoveNextStage}
                >
                  Move to next Stage
                  {nextStage ? (
                    <span className="hidden text-muted-foreground sm:inline">
                      ({nextStage})
                    </span>
                  ) : null}
                </Button>

                <Select
                  value={currentStage}
                  onValueChange={handleStatusChange}
                  disabled={statusMutation.isPending}
                >
                  <SelectTrigger className="h-8 w-[180px] text-xs">
                    <SelectValue placeholder="Select Stage" />
                  </SelectTrigger>
                  <SelectContent>
                    {PIPELINE_STAGES.map((stage) => {
                      const def = stageDefinitions.find((d) => d.label === stage);
                      const Icon = def?.icon;
                      return (
                        <SelectItem key={stage} value={stage}>
                          <span className="inline-flex items-center gap-2">
                            {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
                            {stage}
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1 border-red-200 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                  disabled={
                    statusMutation.isPending ||
                    currentStage === "Disqualified"
                  }
                  onClick={() => setDisqualifyOpen(true)}
                >
                  <UserMinus className="h-3.5 w-3.5" />
                  Disqualify
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="ml-auto h-8 gap-1 text-xs"
                  disabled={!nextApplicant}
                  onClick={() =>
                    nextApplicant && setSelectedApplicationId(nextApplicant.id)
                  }
                >
                  Next Applicant
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>

              {/* Profile header */}
              <div className="flex shrink-0 flex-wrap items-start gap-4 border-b border-border px-4 py-4">
                <Avatar className="h-16 w-16 shrink-0">
                  <AvatarFallback
                    className="text-lg font-semibold text-white"
                    style={{ backgroundColor: BRAND_NAVY }}
                  >
                    {getCandidateInitials(name)}
                  </AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-semibold tracking-tight text-[#272156]">
                      {name}
                    </h2>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      disabled={isFollowBusy}
                      onClick={() => void handleToggleFollow()}
                      aria-label={
                        selectedApplication.isFollowed
                          ? "Unstar applicant"
                          : "Star applicant"
                      }
                      aria-pressed={Boolean(selectedApplication.isFollowed)}
                    >
                      <Star
                        className={cn(
                          "h-4 w-4",
                          selectedApplication.isFollowed
                            ? "fill-[#31CDFF] text-[#31CDFF]"
                            : "text-muted-foreground"
                        )}
                      />
                    </Button>
                    {selectedApplication.tags?.length ? (
                      <div className="flex flex-wrap gap-1">
                        {selectedApplication.tags.map((tag) => (
                          <Badge
                            key={tag}
                            variant="outline"
                            className="h-5 border-[#31CDFF]/40 px-1.5 text-[10px] text-[#272156]"
                          >
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Sourced by {sourcedBy}
                    {appliedRelative ? ` · ${appliedRelative}` : ""}
                    {" · "}
                    {getPositionDisplay(selectedApplication, jobTitles)}
                  </p>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 text-xs"
                    onClick={() => setTagOpen(true)}
                  >
                    <Tag className="h-3.5 w-3.5" />
                    + Tag
                  </Button>
                  {profileHref ? (
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 gap-1.5 text-xs text-white hover:opacity-90"
                      style={{ backgroundColor: BRAND_NAVY }}
                      asChild
                    >
                      <Link href={profileHref}>
                        View Profile
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  ) : null}
                </div>
              </div>

              {/* Content tabs */}
              <Tabs
                value={contentTab}
                onValueChange={(value) =>
                  setContentTab(value as "experience" | "resume")
                }
                className="flex min-h-0 flex-1 flex-col"
              >
                <div className="shrink-0 border-b border-border px-4 pt-2">
                  <TabsList className="h-9 bg-transparent p-0">
                    <TabsTrigger
                      value="experience"
                      className="rounded-full px-4 text-xs data-[state=active]:bg-[#272156] data-[state=active]:text-white"
                    >
                      Experience
                    </TabsTrigger>
                    <TabsTrigger
                      value="resume"
                      className="rounded-full px-4 text-xs data-[state=active]:bg-[#272156] data-[state=active]:text-white"
                    >
                      Resume
                    </TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent
                  value="experience"
                  className="mt-0 min-h-0 flex-1 overflow-y-auto px-4 py-4"
                >
                  {!experienceView?.summary &&
                  !experienceView?.jobs.length &&
                  !experienceView?.rawExperience ? (
                    <EmptyPanel
                      icon={Briefcase}
                      title="No experience on file"
                      description="This applicant did not provide experience on the application, and nothing parseable was found on the resume."
                      showAnimation
                    />
                  ) : (
                    <div className="mx-auto max-w-3xl space-y-6">
                      <section>
                        <h3
                          className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em]"
                          style={{ color: BRAND_CYAN }}
                        >
                          Summary
                        </h3>
                        {experienceView?.summary ? (
                          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                            {experienceView.summary}
                          </p>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            No summary available.
                          </p>
                        )}
                      </section>

                      <section>
                        <h3
                          className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em]"
                          style={{ color: BRAND_CYAN }}
                        >
                          Work Experience
                        </h3>
                        {experienceView?.jobs.length ? (
                          <ul className="space-y-5">
                            {experienceView.jobs.map((job, index) => (
                              <li
                                key={`${job.title}-${index}`}
                                className="border-l-2 border-[#31CDFF]/40 pl-3"
                              >
                                <p className="text-sm font-semibold text-[#272156]">
                                  {job.title}
                                  {job.company ? (
                                    <span className="font-normal text-muted-foreground">
                                      {" "}
                                      · {job.company}
                                    </span>
                                  ) : null}
                                </p>
                                {job.dates ? (
                                  <p className="mt-0.5 text-xs text-muted-foreground">
                                    {job.dates}
                                  </p>
                                ) : null}
                                {job.bullets.length ? (
                                  <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-foreground">
                                    {job.bullets.map((bullet, bulletIndex) => (
                                      <li key={bulletIndex}>{bullet}</li>
                                    ))}
                                  </ul>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        ) : experienceView?.rawExperience &&
                          experienceView.rawExperience !==
                            experienceView.summary ? (
                          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                            {experienceView.rawExperience}
                          </p>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            No structured work history parsed from this
                            application.
                          </p>
                        )}
                      </section>
                    </div>
                  )}
                </TabsContent>

                <TabsContent
                  value="resume"
                  className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden px-4 py-3"
                >
                  <ResumeCvPanel
                    cvUrl={cvUrl}
                    candidateName={name}
                    emptyState={
                      <EmptyPanel
                        icon={FileText}
                        title="No resume attached"
                        description="This applicant did not upload a CV with their application."
                      />
                    }
                  />
                </TabsContent>
              </Tabs>
            </>
          )}
        </section>
      </div>
      </div>

      <Dialog open={prefsOpen} onOpenChange={setPrefsOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>My Preferences</DialogTitle>
            <DialogDescription>
              Applicant workspace preferences are coming soon.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>

      <AlertDialog open={disqualifyOpen} onOpenChange={setDisqualifyOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disqualify applicant?</AlertDialogTitle>
            <AlertDialogDescription>
              {name} will move to the Disqualified stage. You can change their
              stage again later from this page or the candidate profile.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={handleDisqualify}
            >
              Disqualify
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <TagCandidatesDialog
        open={tagOpen}
        onOpenChange={setTagOpen}
        selectedCount={1}
        existingTags={selectedApplication?.tags || []}
        catalogTags={tagCatalog}
        isSubmitting={tagMutation.isPending}
        onSubmit={async (payload) => {
          await tagMutation.mutateAsync(payload);
        }}
      />
    </AdminPageLayout>
  );
}
