"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Lottie from "lottie-react";
import { useReducedMotion } from "framer-motion";
import {
  Briefcase,
  Calendar,
  ChevronLeft,
  ChevronRight,
  FileText,
  Loader2,
  Lock,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Sparkles,
  Tag,
  User,
  UserMinus,
  UserPlus,
  Share2,
  Video,
  X,
} from "lucide-react";
import { Application } from "@/types/application";
import { Button } from "@/components/ui/button";
import { GenerateButton } from "@/components/ui/generate-button";
import { GlowBorderCard } from "@/components/ui/glow-border-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { StatusHistoryTimeline } from "@/components/admin/StatusHistoryTimeline";
import { AiRankInlineProgress } from "@/components/admin/AiRankProgress";
import { APPLICATION_STATUS_OPTIONS, getStatusColor } from "@/components/admin/application-status";
import {
  getAnswerByKeywords,
  getCvUrl,
  getEmailDisplay,
  getNameDisplay,
  getPositionDisplay,
} from "@/components/admin/utils/table-utils";
import { cn, formatDate } from "@/lib/utils";
import { useAiRank } from "@/contexts/AiRankContext";
import { useAiStatus, AI_UNCONFIGURED_MESSAGE } from "@/contexts/AiStatusContext";
import { useBqiIntelligence } from "@/contexts/BqiIntelligenceContext";
import { adminApplicationsApi } from "@/components/admin/utils/applications-api";
import {
  candidateActionsApi,
  type ApplicationAssignee,
} from "@/components/admin/utils/candidate-actions-api";
import { toast } from "react-hot-toast";
import type { AppHotToastOptions } from "@/components/ui/app-toaster";
import { TourHelpButton } from "@/components/admin/tour/TourHelpButton";
import { DeleteApplicationModal } from "@/components/admin/DeleteApplicationModal";
import { buildExperienceView } from "@/components/admin/applicants/applicants-utils";
import { ApplicationResponses } from "./ApplicationResponses";
import { ApplicantInsightPanel } from "./ApplicantInsightPanel";
import { CandidateContentMoreMenu } from "./CandidateContentMoreMenu";
import {
  AddTaskDialog,
  AssignHiringTeamDialog,
  SetReminderDialog,
} from "./CandidateActionDialogs";
import { TeamDiscussion } from "./TeamDiscussion";
import { CandidateEmailSms } from "./CandidateEmailSms";
import { CandidateMoreMenu } from "./CandidateMoreMenu";
import { CandidateScorecards } from "./CandidateScorecards";
import { CandidateTasksPanel } from "./CandidateTasksPanel";
import { ResumeCvPanel } from "./ResumeCvPanel";
import {
  aiMatchBadgeClass,
  aiMatchLabel,
  CANDIDATE_NOTES_KEY,
  CANDIDATE_QUICK_NOTE_KEY,
  getAddedByDisplay,
  getApplicationAnswer,
  getCandidateInitials,
  getExperienceDisplay,
} from "./application-helpers";
import {
  InlineEditableField,
  InlineTagsField,
} from "./InlineEditableField";
import { publicAdminHref } from "@/lib/admin-path";

const PLACEHOLDER_NAMES = new Set([
  "Incomplete Application",
  "No Application Data",
  "NOT SET",
]);

const PLACEHOLDER_EMAILS = new Set([
  "No Email Provided",
  "No Contact Info",
  "NOT SET",
]);

function isValidEmail(value: string): boolean {
  if (!value) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/** Strong violet → BQI cyan ring — high contrast on white admin panels */
const BQI_RANKING_GLOW_COLORS = [
  "#1a1540",
  "#272055",
  "#5b4b9a",
  "#8b5cf6",
  "#c4b5fd",
  "#31CDFF",
  "#7ddfff",
  "#a78bfa",
  "#5b4b9a",
  "#272055",
];

interface JobContext {
  title: string;
  location?: string;
}

interface CandidateProfilePageProps {
  jobId: string;
  applicationId: string;
  initialApplication: Application;
  siblings: Application[];
  job: JobContext;
  jobTitles: Record<string, string>;
  /** When set (e.g. preview modal), close instead of navigating to the pipeline. */
  onClose?: () => void;
  /** When set, sibling prev/next updates the parent instead of routing. */
  onNavigateSibling?: (targetId: string) => void;
}

function RankingGlowFrame({
  active,
  paused,
  children,
}: {
  active: boolean;
  paused: boolean;
  children: React.ReactNode;
}) {
  if (!active) {
    return <div className="flex min-h-0 flex-1 flex-col">{children}</div>;
  }

  return (
    <GlowBorderCard
      fill
      width="100%"
      height="100%"
      borderRadius="0"
      animationDuration={3}
      gradientColors={BQI_RANKING_GLOW_COLORS}
      borderWidth="12px"
      blurAmount="18px"
      inset="0"
      paused={paused}
      className="min-h-0 flex-1 bg-transparent shadow-none"
    >
      {children}
    </GlowBorderCard>
  );
}

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

function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  showAnimation = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action?: React.ReactNode;
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
    <div className="relative flex flex-col items-center justify-center overflow-hidden px-4 py-16 text-center">
      {showAnimation ? (
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
          <Icon className="mb-4 h-12 w-12 text-[#272055]/25" aria-hidden />
        )}
        <p className="text-sm font-medium text-[#272055]">{title}</p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
        {action ? <div className="mt-4">{action}</div> : null}
      </div>
    </div>
  );
}

function SidebarRow({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  href?: string;
}) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[#272156]/50" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        {href && typeof value === "string" ? (
          <Link
            href={href}
            className="break-all text-sm font-medium text-[#31CDFF] hover:underline"
          >
            {value}
          </Link>
        ) : (
          <p className="break-words text-sm font-medium text-[#272156]">{value}</p>
        )}
      </div>
    </div>
  );
}

export function CandidateProfilePage({
  jobId,
  applicationId,
  initialApplication,
  siblings,
  job,
  jobTitles,
  onClose,
  onNavigateSibling,
}: CandidateProfilePageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    rankApplication: rankApplicationById,
    progress: rankProgress,
    isBackground,
    inFlightApplicationIds,
    sendToBackground,
  } = useAiRank();
  const { isUnconfigured: aiUnconfigured } = useAiStatus();
  const { applicantInsights, resumeAudit } = useBqiIntelligence();
  const reduceMotion = useReducedMotion();

  const centerTabFromQuery = searchParams.get("tab");
  const initialCenterTab =
    centerTabFromQuery === "discussion" ||
    centerTabFromQuery === "notes" ||
    centerTabFromQuery === "email" ||
    centerTabFromQuery === "meetings" ||
    centerTabFromQuery === "scorecards" ||
    centerTabFromQuery === "tasks" ||
    centerTabFromQuery === "activity"
      ? centerTabFromQuery
      : "scorecards";
  const [centerTab, setCenterTab] = useState(initialCenterTab);
  const [leftTab, setLeftTab] = useState("resume");
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    if (!applicantInsights && leftTab === "applicant-insight") {
      setLeftTab("resume");
    }
  }, [applicantInsights, leftTab]);

  useEffect(() => {
    if (
      centerTabFromQuery === "discussion" ||
      centerTabFromQuery === "notes" ||
      centerTabFromQuery === "email" ||
      centerTabFromQuery === "meetings" ||
      centerTabFromQuery === "scorecards" ||
      centerTabFromQuery === "tasks" ||
      centerTabFromQuery === "activity"
    ) {
      setCenterTab(centerTabFromQuery);
    }
  }, [centerTabFromQuery]);

  const [application, setApplication] = useState(initialApplication);
  const [status, setStatus] = useState(initialApplication.status || "New");
  const [isSavingStatus, setIsSavingStatus] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [assignTeamOpen, setAssignTeamOpen] = useState(false);
  const [isActionBusy, setIsActionBusy] = useState(false);
  const [isFollowBusy, setIsFollowBusy] = useState(false);
  const [notes, setNotes] = useState("");
  const [quickNote, setQuickNote] = useState("");
  const [tasksRefreshKey, setTasksRefreshKey] = useState(0);
  const [isFollowed, setIsFollowed] = useState(
    Boolean(initialApplication.isFollowed)
  );

  const siblingIds = useMemo(
    () => siblings.map((item) => item.id),
    [siblings]
  );
  const currentIndex = siblingIds.indexOf(applicationId);
  const prevId = currentIndex > 0 ? siblingIds[currentIndex - 1] : null;
  const nextId =
    currentIndex >= 0 && currentIndex < siblingIds.length - 1
      ? siblingIds[currentIndex + 1]
      : null;

  const name = getNameDisplay(application);
  const email = getEmailDisplay(application);
  const phone =
    application.phoneNumber?.trim() ||
    getApplicationAnswer(application.answers, "Phone") ||
    "";
  const editableName = PLACEHOLDER_NAMES.has(name) ? "" : name;
  const editableEmail = PLACEHOLDER_EMAILS.has(email) ? "" : email;
  const candidateLocation =
    application.location?.trim() ||
    getAnswerByKeywords(application.answers || [], [
      "location",
      "address",
      "city",
      "where are you based",
    ]) ||
    "";
  const sourceValue =
    application.hearAbout?.trim() || application.otherSource?.trim() || "";
  const cvUrl = getCvUrl(application);
  const position = getPositionDisplay(application, jobTitles);
  const experienceView = buildExperienceView(application);
  const addedBy = getAddedByDisplay(application);

  const isRanking = inFlightApplicationIds.includes(application.id);
  const showInlineRankProgress =
    Boolean(rankProgress?.isActive) &&
    rankProgress?.applicationId === application.id;
  // inFlight survives sendToBackground(); progress match covers the active scoring session
  const showRankingGlow = isRanking || showInlineRankProgress;

  // Prefer the under-header panel on this screen; Host keeps a floating pill only.
  useEffect(() => {
    if (showInlineRankProgress && !isBackground) {
      sendToBackground();
    }
  }, [showInlineRankProgress, isBackground, sendToBackground]);

  useEffect(() => {
    setApplication(initialApplication);
    setStatus(initialApplication.status || "New");
    setIsFollowed(Boolean(initialApplication.isFollowed));
  }, [initialApplication]);

  // One-shot: fill empty contact + experience from CV when a resume exists.
  // Backend only stamps synced URLs after a successful text read, so a prior
  // empty/failed extract does not block retries on refresh.
  useEffect(() => {
    const hasPhone =
      Boolean(initialApplication.phoneNumber?.trim()) ||
      Boolean(getApplicationAnswer(initialApplication.answers, "Phone")?.trim());
    const resumeUrl = getCvUrl(initialApplication);
    if (!resumeUrl) return;

    const hasExperience =
      Boolean(getExperienceDisplay(initialApplication).trim()) ||
      Boolean(initialApplication.cvWorkExperience?.length) ||
      Boolean(initialApplication.cvProfessionalSummary?.trim()) ||
      Boolean(initialApplication.aiRankSummary?.trim());
    const experienceSynced =
      initialApplication.experienceSyncedCvUrl === resumeUrl;
    const needsExperience = !hasExperience && !experienceSynced;

    const contactSynced =
      initialApplication.contactSyncedCvUrl === resumeUrl;
    const needsContact = !hasPhone && !contactSynced;

    if (!needsExperience && !needsContact) return;

    let cancelled = false;
    void (async () => {
      try {
        const result = await adminApplicationsApi.extractContactFromCv(
          initialApplication.id
        );
        if (cancelled || !result?.application) return;
        setApplication((current) => ({
          ...current,
          ...result.application,
          ...result.filled,
        }));
      } catch {
        // Profile remains usable if CV sync fails
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initialApplication]);

  useEffect(() => {
    try {
      setNotes(localStorage.getItem(CANDIDATE_NOTES_KEY(applicationId)) || "");
      setQuickNote(
        localStorage.getItem(CANDIDATE_QUICK_NOTE_KEY(applicationId)) || ""
      );
    } catch {
      // localStorage unavailable
    }
  }, [applicationId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(CANDIDATE_NOTES_KEY(applicationId), notes);
      } catch {
        // ignore
      }
    }, 400);
    return () => window.clearTimeout(timer);
  }, [applicationId, notes]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(CANDIDATE_QUICK_NOTE_KEY(applicationId), quickNote);
      } catch {
        // ignore
      }
    }, 400);
    return () => window.clearTimeout(timer);
  }, [applicationId, quickNote]);

  const pipelineHref = publicAdminHref(`/manage/jobs/${jobId}/pipeline`);

  const leaveProfile = useCallback(() => {
    if (onClose) {
      onClose();
      return;
    }
    router.push(pipelineHref);
  }, [onClose, pipelineHref, router]);

  const navigateToSibling = useCallback(
    (targetId: string) => {
      if (onNavigateSibling) {
        onNavigateSibling(targetId);
        return;
      }
      router.push(publicAdminHref(`/manage/jobs/${jobId}/candidates/${targetId}`));
    },
    [jobId, onNavigateSibling, router]
  );

  const handleStatusChange = useCallback(
    async (newStatus: string) => {
      const previousStatus = application.status || "New";
      if (newStatus === previousStatus) return;

      const previousApplication = application;
      setStatus(newStatus);
      setIsSavingStatus(true);

      try {
        const saved = (await adminApplicationsApi.updateApplication(application.id, {
          status: newStatus,
        })) as Application;

        setApplication((current) => ({
          ...current,
          ...saved,
          status: newStatus,
          statusHistory: saved.statusHistory ?? [
            ...(current.statusHistory || []),
            {
              status: newStatus,
              date: new Date().toISOString(),
              metadata: { previousStatus },
            },
          ],
        }));
        toast.success(`Moved to ${newStatus}`, {
          duration: 20000,
          action: {
            label: "Undo",
            onClick: () => {
              void (async () => {
                setStatus(previousStatus);
                setApplication(previousApplication);
                setIsSavingStatus(true);
                try {
                  await adminApplicationsApi.updateApplication(application.id, {
                    status: previousStatus,
                  });
                } catch (undoErr) {
                  setStatus(newStatus);
                  setApplication((current) => ({
                    ...current,
                    ...saved,
                    status: newStatus,
                  }));
                  toast.error(
                    undoErr instanceof Error
                      ? undoErr.message
                      : "Failed to undo stage change"
                  );
                } finally {
                  setIsSavingStatus(false);
                }
              })();
            },
          },
        } as AppHotToastOptions);
      } catch (err) {
        setStatus(previousStatus);
        toast.error(
          err instanceof Error ? err.message : "Failed to update candidate status"
        );
      } finally {
        setIsSavingStatus(false);
      }
    },
    [application]
  );

  const handleDetailsFieldSave = useCallback(
    async (fields: Partial<Application>) => {
      const previous = application;
      setApplication((current) => ({ ...current, ...fields }));

      try {
        const saved = (await adminApplicationsApi.updateApplication(
          application.id,
          fields
        )) as Application;
        setApplication((current) => ({
          ...current,
          ...saved,
          ...fields,
        }));
      } catch (err) {
        setApplication(previous);
        const message =
          err instanceof Error ? err.message : "Failed to update details";
        toast.error(message);
        throw err instanceof Error ? err : new Error(message);
      }
    },
    [application]
  );

  const handleRank = useCallback(async () => {
    try {
      const { results } = await rankApplicationById(application.id, {
        candidateName: name,
        mode: "single",
      });

      const rankedItem = results?.find((item) => item.id === application.id);
      if (!rankedItem) return;

      setApplication((current) => ({
        ...current,
        aiRankScore: rankedItem.aiRankScore,
        aiRankSummary: rankedItem.aiRankSummary,
        aiRankStrengths: rankedItem.aiRankStrengths,
        aiRankGaps: rankedItem.aiRankGaps,
        aiRankRequirements:
          rankedItem.aiRankRequirements as Application["aiRankRequirements"],
        aiRankScoreReason: rankedItem.aiRankScoreReason,
        aiRankRecommendation: rankedItem.aiRankRecommendation,
        aiRankedAt: rankedItem.aiRankedAt,
      }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to rank application");
    }
  }, [application.id, name, rankApplicationById]);

  const getProfileUrl = useCallback(() => {
    const path = publicAdminHref(`/manage/jobs/${jobId}/candidates/${applicationId}`);
    if (typeof window === "undefined") {
      return path;
    }
    return `${window.location.origin}${path}`;
  }, [applicationId, jobId]);

  const copyProfileUrl = useCallback(
    async (successMessage: string) => {
      const url = getProfileUrl();
      try {
        await navigator.clipboard.writeText(url);
        toast.success(successMessage);
      } catch {
        toast.error("Could not copy link to clipboard");
      }
    },
    [getProfileUrl]
  );

  const handleArchive = useCallback(async () => {
    setIsArchiving(true);
    try {
      await adminApplicationsApi.bulkArchiveApplications([application.id]);
      setApplication((current) => ({
        ...current,
        isArchived: true,
        archivedAt: new Date().toISOString(),
      }));
      toast.success("Candidate archived");
      setArchiveDialogOpen(false);
      leaveProfile();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to archive candidate"
      );
    } finally {
      setIsArchiving(false);
    }
  }, [application.id, leaveProfile]);

  const handleReject = useCallback(async () => {
    setRejectDialogOpen(false);
    await handleStatusChange("Disqualified");
  }, [handleStatusChange]);

  const handleConfirmDelete = useCallback(
    async (id: string) => {
      setIsDeleting(true);
      try {
        await adminApplicationsApi.deleteApplication(id);
        toast.success("Application deleted");
        setDeleteModalOpen(false);
        leaveProfile();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to delete application"
        );
      } finally {
        setIsDeleting(false);
      }
    },
    [leaveProfile]
  );

  const handleToggleFollow = useCallback(async () => {
    const nextFollowed = !isFollowed;
    setIsFollowBusy(true);
    try {
      const result = await candidateActionsApi.setFollow(
        applicationId,
        nextFollowed
      );
      setIsFollowed(result.isFollowed);
      setApplication((current) => ({
        ...current,
        isFollowed: result.isFollowed,
        followedBy: result.followedBy,
      }));
      toast.success(nextFollowed ? "Following candidate" : "Unfollowed candidate");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update follow status"
      );
    } finally {
      setIsFollowBusy(false);
    }
  }, [applicationId, isFollowed]);

  const handleAddTask = useCallback(
    async (payload: { title: string; dueAt?: string }) => {
      setIsActionBusy(true);
      try {
        await candidateActionsApi.createTask(applicationId, payload);
        toast.success("Task created");
        setAddTaskOpen(false);
        setTasksRefreshKey((current) => current + 1);
        setCenterTab("tasks");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to create task");
      } finally {
        setIsActionBusy(false);
      }
    },
    [applicationId]
  );

  const handleRequestApplication = useCallback(async () => {
    setIsActionBusy(true);
    try {
      await candidateActionsApi.requestApplication(applicationId);
      toast.success("Application request emailed to candidate");
      setCenterTab("email");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to request application update"
      );
    } finally {
      setIsActionBusy(false);
    }
  }, [applicationId]);

  const handleSetReminder = useCallback(
    async (payload: { dueAt: string; note?: string }) => {
      setIsActionBusy(true);
      try {
        const result = await candidateActionsApi.setReminder(applicationId, payload);
        setApplication((current) => ({
          ...current,
          reminderAt: result.reminderAt,
          reminderNote: result.reminderNote ?? null,
        }));
        toast.success("Reminder set");
        setReminderOpen(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to set reminder");
      } finally {
        setIsActionBusy(false);
      }
    },
    [applicationId]
  );

  const handleTogglePrivate = useCallback(async () => {
    const nextPrivate = !application.isPrivate;
    setIsActionBusy(true);
    try {
      const result = await candidateActionsApi.setPrivacy(
        applicationId,
        nextPrivate
      );
      setApplication((current) => ({
        ...current,
        isPrivate: result.isPrivate,
        privateOwnerId: result.privateOwnerId ?? null,
      }));
      toast.success(nextPrivate ? "Marked private" : "Made visible to team");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update privacy");
    } finally {
      setIsActionBusy(false);
    }
  }, [application.isPrivate, applicationId]);

  const handleAssignHiringTeam = useCallback(
    async (assignees: ApplicationAssignee[]) => {
      setIsActionBusy(true);
      try {
        const result = await candidateActionsApi.setAssignees(
          applicationId,
          assignees
        );
        setApplication((current) => ({
          ...current,
          assignedHiringTeam: result.assignedHiringTeam,
        }));
        toast.success(
          assignees.length
            ? `Assigned ${assignees.length} team member${assignees.length === 1 ? "" : "s"}`
            : "Hiring team cleared"
        );
        setAssignTeamOpen(false);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to update hiring team"
        );
      } finally {
        setIsActionBusy(false);
      }
    },
    [applicationId]
  );

  const tabListClass =
    "h-auto w-full justify-start gap-0 rounded-none border-b border-[#272055]/10 bg-transparent p-0";

  const tabTriggerClass =
    "rounded-none border-b-2 border-transparent px-3 py-2.5 text-sm data-[state=active]:border-[#31CDFF] data-[state=active]:bg-transparent data-[state=active]:text-[#272055] data-[state=active]:shadow-none";

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#f4f5f7]" data-tour="candidate-profile">
      {/* Header */}
      <header
        className={cn(
          "flex shrink-0 flex-col gap-3 border-b border-[#272055]/20 bg-[#272055] px-3 py-3 text-white sm:flex-row sm:items-center sm:justify-between sm:px-4",
          // Leave room for CandidatePreviewModal chrome close (absolute top-right).
          onClose && "pr-14"
        )}
        data-tour="candidate-header"
      >
        <div className="flex min-w-0 items-center gap-3">
          <Avatar className="h-12 w-12 border-2 border-[#31CDFF]/40">
            <AvatarFallback className="bg-[#31CDFF]/20 text-sm font-semibold text-white">
              {getCandidateInitials(name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-semibold sm:text-2xl">{name}</h1>
              {application.aiRankScore != null ? (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-violet-500/25 px-2.5 py-0.5 text-xs font-semibold text-violet-100 ring-1 ring-violet-300/40">
                  <Sparkles className="h-3 w-3" aria-hidden />
                  AI Score {application.aiRankScore}
                  {application.aiRankRecommendation
                    ? ` · ${application.aiRankRecommendation}`
                    : ""}
                </span>
              ) : null}
            </div>
            <p className="truncate text-xs text-white/70 sm:text-sm">{position}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            disabled={isFollowBusy || isActionBusy}
            onClick={() => void handleToggleFollow()}
            aria-pressed={isFollowed}
            data-tour="candidate-follow"
            className={cn(
              "h-9 font-medium",
              isFollowed
                ? "bg-black text-white hover:bg-black/90"
                : "border border-white/70 bg-transparent text-white hover:bg-white/10"
            )}
          >
            {isFollowBusy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            {isFollowed ? "Unfollow Candidate" : "Follow Candidate"}
          </Button>

          {applicantInsights ? (
            <span title={aiUnconfigured ? AI_UNCONFIGURED_MESSAGE : undefined}>
              <GenerateButton
                label={
                  application.aiRankScore != null ? "Re-score" : "Generate Score"
                }
                generatingLabel="Scoring…"
                isGenerating={isRanking}
                onClick={() => void handleRank()}
                disabled={isRanking || aiUnconfigured}
                data-tour="candidate-ai-rank"
                className="text-sm"
              />
            </span>
          ) : null}

          <CandidateMoreMenu
            currentStatus={status}
            statusOptions={APPLICATION_STATUS_OPTIONS}
            isBusy={isSavingStatus || isArchiving || isDeleting || isActionBusy}
            isPrivate={Boolean(application.isPrivate)}
            onMove={handleStatusChange}
            onCopyLink={() => void copyProfileUrl("Candidate link copied")}
            onDelete={() => setDeleteModalOpen(true)}
            onArchive={() => setArchiveDialogOpen(true)}
            onAddTask={() => setAddTaskOpen(true)}
            onRequestApplication={() => void handleRequestApplication()}
            onShare={() => void copyProfileUrl("Share link copied")}
            onPrint={() => window.print()}
            onSetReminder={() => setReminderOpen(true)}
            onMarkPrivate={() => void handleTogglePrivate()}
          />

          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/10"
            onClick={() => setAssignTeamOpen(true)}
            aria-label="Assign hiring team"
            title="Assign hiring team"
            disabled={isActionBusy}
          >
            <UserPlus className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/10"
            onClick={() => router.push(publicAdminHref("/manage/calendar"))}
            aria-label="Open calendar"
            title="Calendar"
          >
            <Calendar className="h-4 w-4" />
          </Button>

          <div className="flex items-center gap-1" data-tour="candidate-status">
            <Select
              value={status}
              onValueChange={handleStatusChange}
              disabled={isSavingStatus}
            >
              <SelectTrigger className="h-9 w-[160px] border-[#31CDFF]/40 bg-[#31CDFF] text-white hover:bg-[#31CDFF]/90 sm:w-[180px]">
                <SelectValue placeholder="Change stage" />
              </SelectTrigger>
              <SelectContent>
                {APPLICATION_STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isSavingStatus ? (
              <Loader2 className="h-4 w-4 animate-spin text-white/70" />
            ) : null}
          </div>

          <Button
            size="icon"
            variant="destructive"
            className="h-9 w-9 bg-red-600 text-white hover:bg-red-700"
            onClick={() => setRejectDialogOpen(true)}
            disabled={isSavingStatus || isArchiving}
            aria-label="Archive or reject candidate"
            title="Archive / Reject"
          >
            <UserMinus className="h-4 w-4" />
          </Button>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/10"
              disabled={!prevId}
              onClick={() => prevId && navigateToSibling(prevId)}
              aria-label="Previous candidate"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/10"
              disabled={!nextId}
              onClick={() => nextId && navigateToSibling(nextId)}
              aria-label="Next candidate"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
            <TourHelpButton
              tourId="candidate-profile"
              label="Guide"
              className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"
            />
            {!onClose ? (
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/10"
                onClick={leaveProfile}
                aria-label="Back to pipeline"
              >
                <X className="h-5 w-5" />
              </Button>
            ) : null}
          </div>
        </div>
      </header>

      {showInlineRankProgress ? (
        <div className="shrink-0 border-b border-[#272055]/08">
          <AiRankInlineProgress progress={rankProgress} />
        </div>
      ) : null}

      {/* 3-column body — glow frames workspace while this candidate is scored */}
      <RankingGlowFrame
        active={showRankingGlow}
        paused={Boolean(reduceMotion)}
      >
      <div
        className={cn(
          "grid min-h-0 flex-1 gap-0 overflow-hidden",
          detailsOpen
            ? "grid-cols-1 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)_minmax(240px,280px)]"
            : "grid-cols-1 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)_48px]"
        )}
      >
        {/* Left column — content (Resume / CV fills this column only) */}
        <section className="flex min-h-0 flex-col border-b border-[#272055]/10 bg-white lg:border-b-0 lg:border-r">
          <Tabs
            value={leftTab}
            onValueChange={setLeftTab}
            className="flex min-h-0 flex-1 flex-col"
          >
            <TabsList className={cn(tabListClass, "overflow-x-auto")}>
              <TabsTrigger value="experience" className={tabTriggerClass}>
                Experience
              </TabsTrigger>
              <TabsTrigger value="resume" className={tabTriggerClass} data-tour="candidate-resume">
                Resume / CV
              </TabsTrigger>
              <TabsTrigger value="documents" className={tabTriggerClass}>
                Documents
              </TabsTrigger>
              <TabsTrigger value="questionnaires" className={tabTriggerClass}>
                Questionnaires
              </TabsTrigger>
              <CandidateContentMoreMenu
                activeValue={leftTab}
                onSelect={setLeftTab}
                showApplicantInsight={applicantInsights}
              />
            </TabsList>

            <TabsContent
              value="resume"
              className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden p-3 sm:p-4"
            >
              <ResumeCvPanel
                cvUrl={cvUrl}
                candidateName={name}
                showResumeAudit={resumeAudit}
                onRunResumeAudit={() => void handleRank()}
                isAuditing={isRanking}
                auditDisabled={aiUnconfigured}
                emptyState={
                  <EmptyState
                    icon={FileText}
                    title="No resume/CV attached"
                    description="This candidate did not upload a CV with their application."
                  />
                }
              />
            </TabsContent>

            <TabsContent value="experience" className="mt-0 min-h-0 flex-1 overflow-y-auto p-4">
              {!experienceView.summary &&
              !experienceView.jobs.length &&
              !experienceView.rawExperience ? (
                <EmptyState
                  icon={Briefcase}
                  title="No experience on file"
                  description="This applicant did not provide experience on the application, and nothing parseable was found on the resume."
                  showAnimation
                />
              ) : (
                <div className="mx-auto max-w-3xl space-y-6">
                  <section>
                    <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#31CDFF]">
                      Summary
                    </h3>
                    {experienceView.summary ? (
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
                    <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#31CDFF]">
                      Work Experience
                    </h3>
                    {experienceView.jobs.length ? (
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
                    ) : experienceView.rawExperience &&
                      experienceView.rawExperience !== experienceView.summary ? (
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                        {experienceView.rawExperience}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No structured work history parsed from this application.
                      </p>
                    )}
                  </section>
                </div>
              )}
            </TabsContent>

            <TabsContent value="questionnaires" className="mt-0 min-h-0 flex-1 overflow-y-auto p-4">
              <ApplicationResponses application={application} excludeResumeQuestions />
            </TabsContent>

            <TabsContent value="documents" className="mt-0 min-h-0 flex-1 overflow-y-auto p-4">
              {cvUrl ? (
                <div className="rounded-lg border border-[#272055]/10 p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-[#272055]/5 p-2">
                      <FileText className="h-5 w-5 text-[#272055]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[#272055]">Candidate CV</p>
                      <p className="text-xs text-muted-foreground">
                        Applied {formatDate(application.appliedDate)}
                      </p>
                    </div>
                    <Link
                      href={cvUrl}
                      target="_blank"
                      className="text-sm font-medium text-[#31CDFF] hover:underline"
                    >
                      View
                    </Link>
                  </div>
                </div>
              ) : (
                <EmptyState
                  icon={FileText}
                  title="No documents"
                  description="No files are attached to this application yet."
                />
              )}
            </TabsContent>

            {applicantInsights ? (
              <TabsContent
                value="applicant-insight"
                className="mt-0 min-h-0 flex-1 overflow-y-auto p-4"
              >
                <ApplicantInsightPanel
                  application={application}
                  isRanking={isRanking}
                  aiUnconfigured={aiUnconfigured}
                  onGenerateScore={() => void handleRank()}
                />
              </TabsContent>
            ) : null}
          </Tabs>
        </section>

        {/* Center column — collaboration tabs */}
        <section className="flex min-h-0 flex-col border-b border-[#272055]/10 bg-white lg:border-b-0 lg:border-r">
          <Tabs
            value={centerTab}
            onValueChange={setCenterTab}
            className="flex min-h-0 flex-1 flex-col"
          >
            <TabsList className={cn(tabListClass, "overflow-x-auto")}>
              <TabsTrigger value="discussion" className={tabTriggerClass}>
                Discussion
              </TabsTrigger>
              <TabsTrigger value="notes" className={tabTriggerClass}>
                Notes
              </TabsTrigger>
              <TabsTrigger value="email" className={tabTriggerClass}>
                Email
              </TabsTrigger>
              <TabsTrigger value="meetings" className={tabTriggerClass}>
                Meetings
              </TabsTrigger>
              <TabsTrigger value="scorecards" className={tabTriggerClass}>
                Scorecards
              </TabsTrigger>
              <TabsTrigger value="tasks" className={tabTriggerClass}>
                Tasks
              </TabsTrigger>
              <TabsTrigger value="activity" className={tabTriggerClass}>
                Activity
              </TabsTrigger>
            </TabsList>

            <TabsContent value="discussion" className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden p-4">
              <TeamDiscussion
                applicationId={applicationId}
                jobId={jobId}
                candidateName={name}
              />
            </TabsContent>

            <TabsContent value="notes" className="mt-0 min-h-0 flex-1 overflow-y-auto p-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-[#272055]/50" />
                  <h3 className="text-sm font-semibold text-[#272055]">Internal notes</h3>
                </div>
                <p className="text-xs text-muted-foreground">
                  Saved locally in this browser until team notes are synced to the server.
                </p>
                <Textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Add private notes about this candidate..."
                  className="min-h-[220px] resize-y"
                />
              </div>
            </TabsContent>

            <TabsContent
              value="email"
              className="mt-0 flex min-h-0 flex-1 flex-col justify-start overflow-hidden p-4"
            >
              <CandidateEmailSms
                applicationId={applicationId}
                candidateName={name}
                candidateEmail={email}
              />
            </TabsContent>

            <TabsContent
              value="meetings"
              className="mt-0 flex min-h-0 flex-1 flex-col overflow-y-auto p-4"
            >
              <EmptyState
                icon={Video}
                title="No meetings scheduled"
                description="Interviews and assessments for this candidate will show here."
                action={
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(publicAdminHref("/manage/calendar"))}
                  >
                    Open calendar
                  </Button>
                }
              />
            </TabsContent>

            <TabsContent
              value="scorecards"
              className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden p-4"
            >
              <CandidateScorecards
                applicationId={applicationId}
                candidateName={name}
              />
            </TabsContent>

            <TabsContent
              value="tasks"
              className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden p-4"
            >
              <CandidateTasksPanel
                applicationId={applicationId}
                refreshKey={tasksRefreshKey}
                onAddTask={() => setAddTaskOpen(true)}
              />
            </TabsContent>

            <TabsContent
              value="activity"
              className="mt-0 flex min-h-0 flex-1 flex-col justify-start overflow-y-auto p-4"
            >
              {application.statusHistory && application.statusHistory.length > 0 ? (
                <StatusHistoryTimeline
                  statusHistory={application.statusHistory}
                  showStats={false}
                  compact={false}
                  className="shrink-0 border-[#272055]/10 shadow-none"
                />
              ) : (
                <EmptyState
                  icon={Calendar}
                  title="No activity yet"
                  description="Status changes and pipeline moves will appear here."
                />
              )}
            </TabsContent>
          </Tabs>
        </section>

        {/* Far-right details rail */}
        <aside
          className={cn(
            "hidden min-h-0 flex-col border-l border-[#272055]/10 bg-[#eef0f3] lg:flex",
            detailsOpen ? "overflow-y-auto p-4" : "items-center gap-2 py-3"
          )}
        >
          {!detailsOpen ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-[#272055] hover:bg-white"
                aria-label="Show candidate details"
                title="Details"
                onClick={() => setDetailsOpen(true)}
              >
                <User className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-[#272055] hover:bg-white"
                aria-label="Open discussion"
                title="Discussion"
                onClick={() => setCenterTab("discussion")}
              >
                <MessageSquare className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-[#272055] hover:bg-white"
                aria-label="Open calendar"
                title="Calendar"
                onClick={() => router.push(publicAdminHref("/manage/calendar"))}
              >
                <Calendar className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-[#272055] hover:bg-white"
                aria-label="Open scorecards"
                title="Scorecards"
                onClick={() => setCenterTab("scorecards")}
              >
                <Sparkles className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Details
                </h2>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label="Collapse details"
                  onClick={() => setDetailsOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="rounded-lg border border-[#272156]/10 bg-white p-4">
              <InlineEditableField
                icon={User}
                label="Candidate"
                value={editableName}
                emptyLabel="+ Add name"
                onSave={(next) => handleDetailsFieldSave({ name: next })}
              />
              <SidebarRow
                icon={Briefcase}
                label="Job position"
                value={position}
                href={publicAdminHref(`/manage/jobs/${jobId}/pipeline`)}
              />
              <SidebarRow
                icon={Calendar}
                label="Applied"
                value={formatDate(application.appliedDate)}
              />
              <InlineEditableField
                icon={Phone}
                label="Phone"
                value={phone}
                emptyLabel="+ Add phone"
                type="tel"
                copyable
                onSave={(next) => handleDetailsFieldSave({ phoneNumber: next })}
              />
              <InlineEditableField
                icon={Mail}
                label="Email"
                value={editableEmail}
                emptyLabel="+ Add email"
                type="email"
                copyable
                validate={(next) =>
                  next && !isValidEmail(next)
                    ? "Enter a valid email"
                    : null
                }
                onSave={(next) => handleDetailsFieldSave({ email: next })}
              />
              <div className="flex items-start gap-3 py-2.5">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#272156]/50" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">Current stage</p>
                  <span
                    className={cn(
                      "mt-1 inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
                      getStatusColor(status)
                    )}
                  >
                    {status}
                  </span>
                </div>
              </div>
              {application.aiRankScore != null ? (
                <div className="flex items-start gap-3 py-2.5">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" />
                  <div>
                    <p className="text-xs text-muted-foreground">BQI Intelligence score</p>
                    <span className="mt-1 inline-flex rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-800">
                      {application.aiRankScore}/100
                      {application.aiRankRecommendation
                        ? ` · ${application.aiRankRecommendation}`
                        : ""}
                    </span>
                  </div>
                </div>
              ) : null}
              {addedBy ? (
                <SidebarRow icon={User} label="Added by" value={addedBy} />
              ) : null}
              <InlineEditableField
                icon={MapPin}
                label="Location"
                value={candidateLocation}
                emptyLabel="+ Add location"
                type="textarea"
                onSave={(next) => handleDetailsFieldSave({ location: next })}
              />
              <InlineEditableField
                icon={Share2}
                label="Source"
                value={sourceValue}
                emptyLabel="+ Add source"
                onSave={(next) =>
                  handleDetailsFieldSave({
                    hearAbout: next,
                    otherSource: "",
                  })
                }
              />
              <InlineTagsField
                icon={Tag}
                tags={application.tags || []}
                onChange={(tags) => handleDetailsFieldSave({ tags })}
              />
            </div>

            {application.aiRankScore != null ? (
              <div className="rounded-lg border border-violet-100 bg-violet-50/50 p-4">
                <h3 className="mb-2 text-sm font-semibold text-[#272055]">BQI Intelligence assessment</h3>
                {application.aiRankSummary ? (
                  <p className="text-sm text-foreground">{application.aiRankSummary}</p>
                ) : null}
                {application.aiRankRequirements?.length ? (
                  <div className="mt-3 max-h-48 space-y-2 overflow-y-auto">
                    {application.aiRankRequirements.slice(0, 5).map((req, index) => (
                      <div key={index} className="text-xs">
                        <span
                          className={cn(
                            "mr-1 inline-flex rounded-full border px-1.5 py-0.5 font-medium",
                            aiMatchBadgeClass(req.match)
                          )}
                        >
                          {aiMatchLabel(req.match)}
                        </span>
                        <span className="text-[#272055]">{req.requirement}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="rounded-lg border border-[#272055]/10 bg-white p-4">
              <div className="mb-2 flex items-center gap-2">
                <Lock className="h-4 w-4 text-[#272055]/50" />
                <h3 className="text-sm font-semibold text-[#272055]">Quick note</h3>
              </div>
              <Textarea
                value={quickNote}
                onChange={(event) => setQuickNote(event.target.value)}
                placeholder="Jot a quick note..."
                className="min-h-[80px] resize-none text-sm"
              />
            </div>

            {application.assignedHiringTeam &&
            application.assignedHiringTeam.length > 0 ? (
              <div className="rounded-lg border border-[#272055]/10 bg-white p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-[#272055]">
                    Hiring team
                  </h3>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => setAssignTeamOpen(true)}
                  >
                    Edit
                  </Button>
                </div>
                <ul className="space-y-1.5">
                  {application.assignedHiringTeam.map((member) => (
                    <li key={member.id} className="text-sm text-[#272055]">
                      <span className="font-medium">{member.name}</span>
                      {member.email ? (
                        <span className="block text-xs text-muted-foreground">
                          {member.email}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            </div>
          )}
        </aside>
      </div>
      </RankingGlowFrame>

      <AddTaskDialog
        open={addTaskOpen}
        onOpenChange={setAddTaskOpen}
        candidateName={name}
        isSubmitting={isActionBusy}
        onSubmit={handleAddTask}
      />

      <SetReminderDialog
        open={reminderOpen}
        onOpenChange={setReminderOpen}
        candidateName={name}
        isSubmitting={isActionBusy}
        onSubmit={handleSetReminder}
      />

      <AssignHiringTeamDialog
        open={assignTeamOpen}
        onOpenChange={setAssignTeamOpen}
        candidateName={name}
        initialAssignees={application.assignedHiringTeam || []}
        isSubmitting={isActionBusy}
        onSubmit={handleAssignHiringTeam}
      />

      <DeleteApplicationModal
        applicationId={application.id}
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
      />

      <AlertDialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive candidate?</AlertDialogTitle>
            <AlertDialogDescription>
              {name} will be moved to the archive. You can restore them later from
              Archived applications.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isArchiving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleArchive();
              }}
              disabled={isArchiving}
            >
              {isArchiving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Archiving...
                </>
              ) : (
                "Archive"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive or reject?</AlertDialogTitle>
            <AlertDialogDescription>
              Reject moves {name} to Disqualified. Archive removes them from the
              active pipeline but keeps the record.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              type="button"
              variant="outline"
              disabled={isArchiving || isSavingStatus}
              onClick={() => {
                setRejectDialogOpen(false);
                setArchiveDialogOpen(true);
              }}
            >
              Archive
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isSavingStatus || status === "Disqualified"}
              onClick={() => void handleReject()}
            >
              Reject
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
