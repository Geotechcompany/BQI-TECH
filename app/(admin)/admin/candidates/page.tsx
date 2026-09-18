"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import {
  Columns3,
  Eye,
  Filter,
  Mail,
  MessageSquare,
  MoreHorizontal,
  Plus,
  Search,
  Star,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import { AdminPageWelcomeBanner } from "@/components/admin/AdminPageWelcomeBanner";
import { TourPageHelper } from "@/components/admin/tour/TourPageHelper";
import { CandidatesEmptyState } from "@/components/admin/candidates/CandidatesEmptyState";
import { CandidatesFilters } from "@/components/admin/candidates/CandidatesFilters";
import { CandidatePreviewModal } from "@/components/admin/candidates/CandidatePreviewModal";
import { AddCandidateGlobalDialog } from "@/components/admin/candidates/AddCandidateGlobalDialog";
import {
  MergeCandidatesDialog,
  SendQuestionnaireDialog,
  TagCandidatesDialog,
  type QuestionnaireOption,
} from "@/components/admin/candidates/CandidateBulkDialogs";
import {
  CANDIDATE_COLUMN_LABELS,
  CANDIDATE_VIEW_OPTIONS,
  HIDDEN_CANDIDATE_TABLE_COLUMNS,
  type CandidateColumnKey,
  type CandidateView,
  type CandidatesDraftFilters,
  applicationHeadline,
  applicationTags,
  candidateInitials,
  countActiveCandidateFilters,
  defaultCandidatesDraft,
  exportCandidatesCsv,
  matchesSalaryFilter,
  readColumnVisibility,
  readIdSet,
  resolveApplicationId,
  resolveJobId,
  resumeAuditLabel,
  seenCandidatesStorageKey,
  starredCandidatesStorageKey,
  viewLabel,
  writeColumnVisibility,
  writeIdSet,
} from "@/components/admin/candidates/candidates-utils";
import { candidateActionsApi } from "@/components/admin/utils/candidate-actions-api";
import { adminApi } from "@/lib/api-backend";
import { AiRankScoreCell } from "@/components/admin/AiRankCell";
import { Pagination } from "@/components/Pagination";
import { adminApplicationsApi } from "@/components/admin/utils/applications-api";
import {
  getEmailDisplay,
  getNameDisplay,
  getPositionDisplay,
} from "@/components/admin/utils/table-utils";
import { normalizeToPipelineStage } from "@/components/admin/pipeline/pipeline-utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { TableSkeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useAiRank } from "@/contexts/AiRankContext";
import { useAiStatus, AI_UNCONFIGURED_MESSAGE } from "@/contexts/AiStatusContext";
import { useBqiIntelligence } from "@/contexts/BqiIntelligenceContext";
import { useDebounce } from "@/hooks/useDebounce";
import { PIPELINE_STAGES } from "@/components/admin/pipeline/pipeline-utils";
import type { Application } from "@/types/application";
import { cn } from "@/lib/utils";
import { matchesAiScoreFilter } from "@/lib/ai-score-filter";

const PAGE_SIZE = 25;

function activityDate(app: Application): Date | null {
  const raw = app.updatedAt || app.lastUpdated || app.appliedDate;
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function inDateRange(
  value: Date | string | undefined | null,
  from: string,
  to: string
): boolean {
  if (!from && !to) return true;
  if (!value) return false;
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return false;
  if (from) {
    const start = new Date(`${from}T00:00:00`).getTime();
    if (time < start) return false;
  }
  if (to) {
    const end = new Date(`${to}T23:59:59`).getTime();
    if (time > end) return false;
  }
  return true;
}

function isAssignedToUser(app: Application, userId: string, userEmail?: string) {
  if (!userId && !userEmail) return false;
  if (app.privateOwnerId && String(app.privateOwnerId) === userId) return true;
  const team = app.assignedHiringTeam || [];
  return team.some(
    (member) =>
      (member.id && member.id === userId) ||
      (userEmail &&
        member.email &&
        member.email.toLowerCase() === userEmail.toLowerCase())
  );
}

export default function CandidatesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const jobIdFilter = searchParams.get("jobId") ?? undefined;
  const highlightId = searchParams.get("highlight") ?? undefined;
  const statusParam = searchParams.get("status");
  const searchParam = searchParams.get("search");

  const { isAuthenticated, isAdmin, authLoading, user } = useAuth();
  const userId = user?.id || "";
  const { isUnconfigured: aiUnconfigured } = useAiStatus();
  const { applicantInsights } = useBqiIntelligence();
  const {
    rankApplication: rankApplicationById,
    rankApplications: rankApplicationsByIds,
    isRanking: isAiRanking,
    isBackground: isAiBackground,
    sendToBackground: sendAiToBackground,
    inFlightApplicationIds,
  } = useAiRank();

  // Keep scoring chrome in the header chip / floating pill — not the glowing top banner.
  useEffect(() => {
    if (isAiRanking && !isAiBackground) {
      sendAiToBackground();
    }
  }, [isAiRanking, isAiBackground, sendAiToBackground]);

  const [applications, setApplications] = useState<Application[]>([]);
  const [serverTotal, setServerTotal] = useState(0);
  const [jobTitles, setJobTitles] = useState<Record<string, string>>({});
  const [jobDepartments, setJobDepartments] = useState<Record<string, string>>(
    {}
  );
  const [positionOptions, setPositionOptions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState(searchParam || "");
  const debouncedSearch = useDebounce(search, 400);
  const [view, setView] = useState<CandidateView>("all-admin");
  const [showFilters, setShowFilters] = useState(true);
  const [columns, setColumns] = useState(readColumnVisibility);
  const [draft, setDraft] = useState<CandidatesDraftFilters>(defaultCandidatesDraft);
  const [appliedFilters, setAppliedFilters] = useState<CandidatesDraftFilters>(
    defaultCandidatesDraft
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set());
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());
  const [addOpen, setAddOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [tagOpen, setTagOpen] = useState(false);
  const [questionnaireOpen, setQuestionnaireOpen] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [moveStage, setMoveStage] = useState<string>("New");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [questionnaireOptions, setQuestionnaireOptions] = useState<
    QuestionnaireOption[]
  >([]);
  const [questionnaireLoading, setQuestionnaireLoading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewJobId, setPreviewJobId] = useState<string | null>(null);
  const [previewApplicationId, setPreviewApplicationId] = useState<string | null>(
    null
  );

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }
    if (!isAdmin) {
      router.push("/dashboard");
    }
  }, [authLoading, isAuthenticated, isAdmin, router]);

  useEffect(() => {
    setColumns(readColumnVisibility());
  }, []);

  useEffect(() => {
    writeColumnVisibility(columns);
  }, [columns]);

  useEffect(() => {
    if (!userId) return;
    setStarredIds(readIdSet(starredCandidatesStorageKey(userId)));
    setSeenIds(readIdSet(seenCandidatesStorageKey(userId)));
  }, [userId]);

  useEffect(() => {
    if (statusParam?.toLowerCase() === "new") {
      setView("new");
    }
  }, [statusParam]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, view, appliedFilters, jobIdFilter]);

  const patchDraft = useCallback((patch: Partial<CandidatesDraftFilters>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  }, []);

  const applyDraftFilters = useCallback(() => {
    setAppliedFilters({ ...draft });
  }, [draft]);

  const resetFilters = useCallback(() => {
    const next = defaultCandidatesDraft();
    setDraft(next);
    setAppliedFilters(next);
  }, []);

  const needsClientHeavyPass = useMemo(() => {
    return (
      view === "my" ||
      view === "starred" ||
      view === "unseen" ||
      appliedFilters.positions.length > 0 ||
      appliedFilters.categories.length > 0 ||
      appliedFilters.stages.length > 0 ||
      appliedFilters.sources.length > 0 ||
      appliedFilters.locations.length > 0 ||
      appliedFilters.tags.length > 0 ||
      Boolean(appliedFilters.salaryMin || appliedFilters.salaryMax) ||
      Boolean(appliedFilters.activityFrom || appliedFilters.activityTo) ||
      appliedFilters.resumeAudit !== "all" ||
      appliedFilters.assignedToMe ||
      appliedFilters.starredOnly ||
      appliedFilters.unseenOnly ||
      appliedFilters.includeArchived
    );
  }, [view, appliedFilters]);

  const pageForFetch = needsClientHeavyPass ? 1 : currentPage;

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Backend GET /job-postings enforces limit le=100 (422 above that).
      const pageSize = 100;
      const titles: Record<string, string> = {};
      const departments: Record<string, string> = {};
      let jobsSkip = 0;
      let jobsTotal = Infinity;

      while (jobsSkip < jobsTotal) {
        const jobsResponse = await adminApplicationsApi.getJobPostings({
          limit: pageSize,
          skip: jobsSkip,
        });
        const jobsPayload = jobsResponse as {
          jobPostings?: Array<{
            id?: string;
            _id?: string;
            title?: string;
            department?: string;
          }>;
          total?: number;
        };
        const jobs = Array.isArray(jobsResponse)
          ? jobsResponse
          : jobsPayload?.jobPostings || [];
        jobsTotal =
          typeof jobsPayload?.total === "number" ? jobsPayload.total : jobs.length;

        for (const job of jobs) {
          const id = job.id || (job._id ? String(job._id) : "");
          if (id && job.title) titles[id] = job.title;
          const department = String(job.department || "").trim();
          if (id && department && department !== "N/A") {
            departments[id] = department;
          }
        }

        if (jobs.length < pageSize) break;
        jobsSkip += pageSize;
      }
      setJobTitles(titles);
      setJobDepartments(departments);

      // Positions endpoint returns { value, label, count } objects (not bare strings).
      const positionSet = new Set<string>();
      try {
        const positionsResponse =
          await adminApplicationsApi.getApplicationPositions("all");
        const rawPositions = Array.isArray(positionsResponse)
          ? positionsResponse
          : (positionsResponse as { positions?: unknown[] })?.positions || [];

        for (const entry of rawPositions) {
          if (typeof entry === "string") {
            const trimmed = entry.trim();
            if (trimmed && trimmed !== "Position Not Available") {
              positionSet.add(trimmed);
            }
            continue;
          }
          if (entry && typeof entry === "object") {
            const pos = entry as { value?: string; label?: string };
            const title = (pos.value || pos.label || "").trim();
            if (title && title !== "Position Not Available") {
              positionSet.add(title);
            }
          }
        }
      } catch (positionsError) {
        console.error("Failed to load application positions:", positionsError);
      }

      // Always merge job titles so the filter stays populated if the
      // positions endpoint fails or returns an unexpected shape.
      Object.values(titles).forEach((title) => {
        const trimmed = title?.trim();
        if (trimmed && trimmed !== "Position Not Available") {
          positionSet.add(trimmed);
        }
      });

      const statusForApi =
        view === "new" && appliedFilters.stages.length === 0
          ? "New"
          : appliedFilters.stages.length === 1
            ? appliedFilters.stages[0]
            : undefined;

      const baseFilters = {
        search: debouncedSearch || undefined,
        jobId: jobIdFilter,
        position:
          appliedFilters.positions.length === 1
            ? appliedFilters.positions[0]
            : undefined,
        aiScoreFilter:
          appliedFilters.aiScore !== "all" ? appliedFilters.aiScore : undefined,
        dateFrom: appliedFilters.dateFrom || undefined,
        dateTo: appliedFilters.dateTo || undefined,
        sortBy: "appliedDate",
        sortOrder: "desc" as const,
      };

      let loaded: Application[] = [];
      let total = 0;

      if (needsClientHeavyPass) {
        const active = await adminApplicationsApi.getAllApplicationsPaginated(
          baseFilters,
          statusForApi
        );
        loaded = active.applications || [];
        if (appliedFilters.includeArchived) {
          const archived = await adminApplicationsApi.getArchivedApplications({
            ...baseFilters,
            limit: 100,
          });
          loaded = [...loaded, ...(archived.applications || [])];
        }
        total = loaded.length;
      } else {
        const skip = (pageForFetch - 1) * PAGE_SIZE;
        const response = await adminApplicationsApi.getAllApplicationsWithStatusFilter(
          { ...baseFilters, skip, limit: PAGE_SIZE },
          statusForApi
        );
        loaded = response.applications || [];
        total = response.total ?? loaded.length;
      }

      for (const app of loaded) {
        const position = getPositionDisplay(app, titles);
        if (position && position !== "Position Not Available") {
          positionSet.add(position);
        }
      }

      setPositionOptions(
        Array.from(positionSet).sort((a, b) => a.localeCompare(b))
      );

      setServerTotal(total);
      setApplications(loaded);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load candidates");
      setApplications([]);
      setServerTotal(0);
    } finally {
      setIsLoading(false);
    }
  }, [
    appliedFilters,
    debouncedSearch,
    jobIdFilter,
    needsClientHeavyPass,
    pageForFetch,
    view,
    reloadToken,
  ]);

  useEffect(() => {
    if (!isAuthenticated || !isAdmin) return;
    void loadData();
  }, [isAuthenticated, isAdmin, loadData]);

  const sourceOptions = useMemo(() => {
    const set = new Set<string>();
    applications.forEach((app) => {
      const source = (app.hearAbout || app.otherSource || "").trim();
      if (source) set.add(source);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [applications]);

  const locationOptions = useMemo(() => {
    const set = new Set<string>();
    applications.forEach((app) => {
      const location = (app.location || app.jobDetails?.location || "").trim();
      if (location) set.add(location);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [applications]);

  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    Object.values(jobDepartments).forEach((department) => {
      if (department.trim()) set.add(department.trim());
    });
    applications.forEach((app) => {
      const department = String(app.jobDetails?.department || "").trim();
      if (department && department !== "N/A") set.add(department);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [applications, jobDepartments]);

  const tagOptions = useMemo(() => {
    const set = new Set<string>();
    applications.forEach((app) => {
      applicationTags(app).forEach((tag) => set.add(tag));
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [applications]);

  const filteredApplications = useMemo(() => {
    return applications.filter((app) => {
      const id = resolveApplicationId(app);
      const stage = normalizeToPipelineStage(app.status);
      const position = getPositionDisplay(app, jobTitles);
      const jobId = resolveJobId(app);
      const category =
        (jobId && jobDepartments[jobId]) ||
        String(app.jobDetails?.department || "").trim();
      const source = (app.hearAbout || app.otherSource || "").trim();
      const location = (app.location || "").trim();
      const tags = applicationTags(app);
      const activity = activityDate(app);

      if (view === "new" && stage !== "New") return false;
      if (view === "starred" && !starredIds.has(id)) return false;
      if (view === "unseen" && seenIds.has(id)) return false;
      if (
        view === "my" &&
        !isAssignedToUser(app, userId, user?.email)
      ) {
        return false;
      }

      if (
        appliedFilters.positions.length > 0 &&
        !appliedFilters.positions.includes(position)
      ) {
        return false;
      }
      if (
        appliedFilters.categories.length > 0 &&
        !appliedFilters.categories.includes(category)
      ) {
        return false;
      }
      if (
        appliedFilters.stages.length > 0 &&
        !appliedFilters.stages.includes(stage)
      ) {
        return false;
      }
      if (
        appliedFilters.sources.length > 0 &&
        !appliedFilters.sources.includes(source)
      ) {
        return false;
      }
      if (
        appliedFilters.locations.length > 0 &&
        !appliedFilters.locations.some(
          (loc) => location.toLowerCase() === loc.toLowerCase()
        )
      ) {
        return false;
      }
      if (
        appliedFilters.tags.length > 0 &&
        !appliedFilters.tags.some((tag) =>
          tags.some((item) => item.toLowerCase() === tag.toLowerCase())
        )
      ) {
        return false;
      }
      if (
        !matchesSalaryFilter(
          app.salary,
          appliedFilters.salaryMin,
          appliedFilters.salaryMax
        )
      ) {
        return false;
      }
      if (
        !inDateRange(
          app.appliedDate,
          appliedFilters.dateFrom,
          appliedFilters.dateTo
        )
      ) {
        return false;
      }
      if (
        !inDateRange(
          activity,
          appliedFilters.activityFrom,
          appliedFilters.activityTo
        )
      ) {
        return false;
      }
      if (
        appliedFilters.aiScore !== "all" &&
        !matchesAiScoreFilter(app.aiRankScore, appliedFilters.aiScore)
      ) {
        return false;
      }
      if (appliedFilters.resumeAudit === "audited" && app.aiRankScore == null) {
        return false;
      }
      if (
        appliedFilters.resumeAudit === "not_audited" &&
        app.aiRankScore != null
      ) {
        return false;
      }
      if (
        appliedFilters.assignedToMe &&
        !isAssignedToUser(app, userId, user?.email)
      ) {
        return false;
      }
      if (appliedFilters.starredOnly && !starredIds.has(id)) return false;
      if (appliedFilters.unseenOnly && seenIds.has(id)) return false;

      return true;
    });
  }, [
    applications,
    appliedFilters,
    jobDepartments,
    jobTitles,
    seenIds,
    starredIds,
    user?.email,
    userId,
    view,
  ]);

  const totalCount = needsClientHeavyPass
    ? filteredApplications.length
    : serverTotal;

  const pageRows = useMemo(() => {
    if (!needsClientHeavyPass) return filteredApplications;
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredApplications.slice(start, start + PAGE_SIZE);
  }, [filteredApplications, currentPage, needsClientHeavyPass]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const activeFilterCount = countActiveCandidateFilters(appliedFilters);
  const selectedList = useMemo(
    () =>
      filteredApplications.filter((app) =>
        selectedIds.has(resolveApplicationId(app))
      ),
    [filteredApplications, selectedIds]
  );
  const selectedEmails = useMemo(
    () =>
      selectedList
        .map((app) => getEmailDisplay(app))
        .filter((email) => email.includes("@")),
    [selectedList]
  );

  const openCandidate = useCallback(
    (app: Application) => {
      const id = resolveApplicationId(app);
      if (userId && id) {
        setSeenIds((prev) => {
          const next = new Set(prev);
          next.add(id);
          writeIdSet(seenCandidatesStorageKey(userId), next);
          return next;
        });
      }
      const jobId = resolveJobId(app);
      if (jobId && id) {
        router.push(`/manage/jobs/${jobId}/candidates/${id}`);
        return;
      }
      toast.message("Open from pipeline after linking this candidate to a position.");
    },
    [router, userId]
  );

  const markCandidateSeen = useCallback(
    (id: string) => {
      if (!userId || !id) return;
      setSeenIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        writeIdSet(seenCandidatesStorageKey(userId), next);
        return next;
      });
    },
    [userId]
  );

  const openCandidatePreview = useCallback(
    (app: Application) => {
      const id = resolveApplicationId(app);
      const jobId = resolveJobId(app);
      if (!id || !jobId) {
        toast.message(
          "Open from pipeline after linking this candidate to a position."
        );
        return;
      }
      markCandidateSeen(id);
      setPreviewJobId(jobId);
      setPreviewApplicationId(id);
      setPreviewOpen(true);
    },
    [markCandidateSeen]
  );

  const toggleStar = useCallback(
    (id: string) => {
      if (!userId) {
        toast.error("Sign in to star candidates");
        return;
      }
      setStarredIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        writeIdSet(starredCandidatesStorageKey(userId), next);
        return next;
      });
    },
    [userId]
  );

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(pageRows.map((app) => resolveApplicationId(app))));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const refresh = () => setReloadToken((value) => value + 1);

  const handleBulkArchive = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBulkBusy(true);
    try {
      const result = await adminApplicationsApi.bulkArchiveApplications(ids);
      toast.success(result.message || `Archived ${ids.length} candidate(s)`);
      setSelectedIds(new Set());
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to archive");
    } finally {
      setBulkBusy(false);
    }
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBulkBusy(true);
    try {
      await adminApplicationsApi.bulkDeleteApplications(ids);
      toast.success(`Deleted ${ids.length} candidate(s)`);
      setSelectedIds(new Set());
      setDeleteOpen(false);
      refresh();
    } catch (err) {
      // Fallback: delete one-by-one if bulk endpoint unavailable
      try {
        await Promise.all(
          ids.map((id) => adminApplicationsApi.deleteApplication(id))
        );
        toast.success(`Deleted ${ids.length} candidate(s)`);
        setSelectedIds(new Set());
        setDeleteOpen(false);
        refresh();
      } catch (fallbackErr) {
        toast.error(
          fallbackErr instanceof Error
            ? fallbackErr.message
            : err instanceof Error
              ? err.message
              : "Failed to delete"
        );
      }
    } finally {
      setBulkBusy(false);
    }
  };

  const handleBulkMove = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const previousById = new Map(
      filteredApplications
        .filter((app) => selectedIds.has(resolveApplicationId(app)))
        .map((app) => [resolveApplicationId(app), app.status || "New"] as const)
    );
    setBulkBusy(true);
    try {
      await adminApplicationsApi.bulkUpdateStatus({ ids, status: moveStage });
      toast.success(`Moved ${ids.length} candidate(s) to ${moveStage}`, {
        duration: 20000,
        action: {
          label: "Undo",
          onClick: () => {
            void (async () => {
              try {
                const byPreviousStatus = new Map<string, string[]>();
                for (const applicationId of ids) {
                  const previousStatus =
                    previousById.get(applicationId) || "New";
                  const group = byPreviousStatus.get(previousStatus) ?? [];
                  group.push(applicationId);
                  byPreviousStatus.set(previousStatus, group);
                }
                await Promise.all(
                  Array.from(byPreviousStatus.entries()).map(([status, groupIds]) =>
                    adminApplicationsApi.bulkUpdateStatus({
                      ids: groupIds,
                      status,
                    })
                  )
                );
                refresh();
              } catch (undoErr) {
                toast.error(
                  undoErr instanceof Error
                    ? undoErr.message
                    : "Failed to undo stage change"
                );
              }
            })();
          },
        },
      });
      setMoveOpen(false);
      setSelectedIds(new Set());
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to move candidates");
    } finally {
      setBulkBusy(false);
    }
  };

  const selectedExistingTags = useMemo(() => {
    const set = new Set<string>();
    selectedList.forEach((app) => {
      applicationTags(app).forEach((tag) => set.add(tag));
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [selectedList]);

  const openTagDialog = () => {
    if (selectedIds.size === 0) {
      toast.error("Select at least one candidate");
      return;
    }
    setTagOpen(true);
  };

  const handleTagCandidates = async (payload: {
    add: string[];
    remove: string[];
  }) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBulkBusy(true);
    try {
      const result = await candidateActionsApi.bulkUpdateTags({
        ids,
        add: payload.add,
        remove: payload.remove,
      });
      toast.success(result.message || "Tags updated");
      setTagOpen(false);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update tags");
    } finally {
      setBulkBusy(false);
    }
  };

  const openQuestionnaireDialog = async () => {
    if (selectedIds.size === 0) {
      toast.error("Select at least one candidate");
      return;
    }
    setQuestionnaireOpen(true);
    setQuestionnaireLoading(true);
    setQuestionnaireOptions([]);
    try {
      const jobIds = Array.from(
        new Set(
          selectedList
            .map((app) => resolveJobId(app))
            .filter((id): id is string => Boolean(id))
        )
      );
      if (jobIds.length === 0) {
        toast.error("Selected candidates are not linked to a position");
        setQuestionnaireOpen(false);
        return;
      }
      const jobs = await Promise.all(
        jobIds.map(async (jobId) => {
          try {
            const job = (await adminApi.getJobPosting(jobId)) as {
              id?: string;
              _id?: string;
              title?: string;
              questionnaires?: Array<{ id?: string; title?: string }>;
            };
            return { jobId, job };
          } catch {
            return null;
          }
        })
      );
      const options: QuestionnaireOption[] = [];
      jobs.forEach((entry) => {
        if (!entry) return;
        const { jobId, job } = entry;
        const jobTitle = String(job.title || jobTitles[jobId] || "Position");
        const questionnaires = Array.isArray(job.questionnaires)
          ? job.questionnaires
          : [];
        questionnaires.forEach((questionnaire) => {
          const questionnaireId = String(questionnaire.id || "").trim();
          if (!questionnaireId) return;
          options.push({
            key: `${jobId}:${questionnaireId}`,
            jobId,
            jobTitle,
            questionnaireId,
            title:
              String(questionnaire.title || "").trim() ||
              "Untitled questionnaire",
          });
        });
      });
      setQuestionnaireOptions(options);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to load questionnaires"
      );
    } finally {
      setQuestionnaireLoading(false);
    }
  };

  const handleSendQuestionnaire = async (payload: {
    jobId: string;
    questionnaireId: string;
  }) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBulkBusy(true);
    try {
      const result = await candidateActionsApi.sendQuestionnaire({
        ids,
        jobId: payload.jobId,
        questionnaireId: payload.questionnaireId,
      });
      toast.success(result.message || "Questionnaire sent");
      if (result.skipped_ids?.length) {
        toast.message(
          `Skipped ${result.skipped_ids.length} without a valid email`
        );
      }
      setQuestionnaireOpen(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to send questionnaire"
      );
    } finally {
      setBulkBusy(false);
    }
  };

  const openMergeDialog = () => {
    if (selectedIds.size < 2) {
      toast.error("Select at least two candidates to merge");
      return;
    }
    setMergeOpen(true);
  };

  const handleMergeCandidates = async (primaryId: string) => {
    const sourceIds = Array.from(selectedIds).filter((id) => id !== primaryId);
    if (!primaryId || sourceIds.length === 0) return;
    setBulkBusy(true);
    try {
      const result = await candidateActionsApi.mergeApplications({
        primaryId,
        sourceIds,
      });
      toast.success(result.message || "Candidates merged");
      setMergeOpen(false);
      setSelectedIds(new Set([primaryId]));
      refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to merge candidates"
      );
    } finally {
      setBulkBusy(false);
    }
  };

  const handleOpenMessaging = () => {
    if (selectedList.length === 1) {
      const app = selectedList[0];
      const id = resolveApplicationId(app);
      const jobId = resolveJobId(app);
      if (jobId && id) {
        router.push(`/manage/jobs/${jobId}/candidates/${id}?tab=email`);
        return;
      }
    }
    router.push("/manage/inbox");
  };

  const handleCandidateEmail = () => {
    if (selectedEmails.length === 0) {
      toast.error("Select candidates with email addresses");
      return;
    }
    window.location.href = `mailto:${selectedEmails.join(",")}`;
  };

  const handleExport = () => {
    const rows =
      selectedList.length > 0 ? selectedList : filteredApplications;
    if (rows.length === 0) {
      toast.error("No candidates to export");
      return;
    }
    exportCandidatesCsv(rows, jobTitles);
    toast.success(`Exported ${rows.length} candidate(s)`);
  };

  const handleRankOne = async (app: Application) => {
    const id = resolveApplicationId(app);
    try {
      await rankApplicationById(id, {
        candidateName: getNameDisplay(app),
        mode: "single",
      });
      refresh();
    } catch {
      // AiRank context already toasts
    }
  };

  if (authLoading || (!isAuthenticated && !error)) {
    return (
      <AdminPageLayout title="Candidates" showSearch={false} fillViewport>
        <div className="flex min-h-0 flex-1 flex-col px-4 py-3">
          <TableSkeleton rows={10} columns={6} showCheckbox />
        </div>
      </AdminPageLayout>
    );
  }

  if (!isAuthenticated || !isAdmin) return null;

  return (
    <AdminPageLayout
      title="Candidates"
      showSearch={false}
      fillViewport
      contentClassName="max-w-none px-0 py-0"
      tourId="candidates"
      guideInBanner
    >
      <TourPageHelper tourId="candidates" />
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="shrink-0 px-4 pt-3">
          <AdminPageWelcomeBanner bannerKey="candidates" compact tourId="candidates" />
        </div>
        <div className="flex shrink-0 flex-col gap-3 border-b border-border bg-card px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <div
              className="relative min-w-[200px] max-w-sm flex-1"
              data-tour="candidates-search"
            >
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Filter by text"
                className="h-9 pl-8 pr-8 text-sm"
              />
              {search ? (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>

            <Button
              type="button"
              variant={showFilters ? "secondary" : "outline"}
              size="sm"
              className="h-9 gap-1.5"
              onClick={() => setShowFilters((value) => !value)}
              aria-pressed={showFilters}
            >
              <Filter className="h-3.5 w-3.5" />
              {activeFilterCount > 0 ? (
                <span className="rounded-full bg-[#272055]/10 px-1.5 text-[11px] font-medium text-[#272055]">
                  {activeFilterCount}
                </span>
              ) : null}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 gap-1.5">
                  <UserRound className="h-3.5 w-3.5" />
                  {viewLabel(view)}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel>Views</DropdownMenuLabel>
                {CANDIDATE_VIEW_OPTIONS.map((option) => (
                  <DropdownMenuItem
                    key={option.value}
                    onClick={() => setView(option.value)}
                  >
                    {option.label}
                    {view === option.value ? " ✓" : ""}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 gap-1.5">
                  <Columns3 className="h-3.5 w-3.5" />
                  Columns
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="max-h-[70vh] w-56 overflow-y-auto"
              >
                {(Object.keys(CANDIDATE_COLUMN_LABELS) as CandidateColumnKey[])
                  .filter((key) => !HIDDEN_CANDIDATE_TABLE_COLUMNS.includes(key))
                  .map((key) => (
                    <DropdownMenuCheckboxItem
                      key={key}
                      checked={columns[key]}
                      disabled={key === "name"}
                      onCheckedChange={(checked) =>
                        setColumns((prev) => ({
                          ...prev,
                          [key]: checked === true,
                          name: true,
                        }))
                      }
                    >
                      {CANDIDATE_COLUMN_LABELS[key]}
                    </DropdownMenuCheckboxItem>
                  ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <span className="text-sm tabular-nums text-muted-foreground">
              {totalCount} candidate{totalCount === 1 ? "" : "s"}
              {selectedIds.size > 0 ? ` · ${selectedIds.size} selected` : ""}
            </span>

            <div
              className="ml-auto flex flex-wrap items-center gap-2"
              data-tour="candidates-actions"
            >
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9">
                    More
                    <MoreHorizontal className="ml-1 h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Communicate</DropdownMenuLabel>
                  <DropdownMenuItem
                    disabled={selectedIds.size === 0}
                    onClick={() => void openQuestionnaireDialog()}
                  >
                    Send Questionnaire
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Candidate Actions</DropdownMenuLabel>
                  <DropdownMenuItem
                    disabled={selectedIds.size === 0}
                    onClick={openTagDialog}
                  >
                    Tag Candidates
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={selectedIds.size === 0}
                    onClick={() => setMoveOpen(true)}
                  >
                    Move Candidates
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={selectedIds.size < 2}
                    onClick={openMergeDialog}
                  >
                    Merge Candidates
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExport}>
                    Export Candidates
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={selectedIds.size === 0 || bulkBusy}
                    onClick={() => void handleBulkArchive()}
                  >
                    Archive Candidates
                  </DropdownMenuItem>
                  {applicantInsights ? (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        disabled={
                          selectedIds.size === 0 ||
                          isAiRanking ||
                          aiUnconfigured
                        }
                        title={
                          aiUnconfigured ? AI_UNCONFIGURED_MESSAGE : undefined
                        }
                        onClick={() =>
                          void rankApplicationsByIds(
                            Array.from(selectedIds),
                            (id) => {
                              const app = applications.find(
                                (row) => resolveApplicationId(row) === id
                              );
                              return app ? getNameDisplay(app) : id;
                            }
                          ).then(() => refresh())
                        }
                      >
                        Score with BQI Intelligence
                      </DropdownMenuItem>
                    </>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9"
                disabled={selectedIds.size === 0}
                onClick={() => setDeleteOpen(true)}
                title="Delete selected"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>

              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={handleOpenMessaging}
                title={
                  selectedIds.size === 1
                    ? "Open candidate messages"
                    : "Open inbox"
                }
              >
                <MessageSquare className="h-3.5 w-3.5" />
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 gap-1.5"
                onClick={handleCandidateEmail}
                disabled={selectedEmails.length === 0}
              >
                <Mail className="h-3.5 w-3.5" />
                <span className="hidden lg:inline">Candidate Email</span>
              </Button>

              <Button
                type="button"
                size="sm"
                className="h-9 gap-1.5 bg-[#31CDFF] font-semibold text-white hover:bg-[#31CDFF]/90"
                onClick={() => setAddOpen(true)}
                data-tour="candidates-add"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Candidate
              </Button>
            </div>
          </div>

          {jobIdFilter ? (
            <p className="text-xs text-muted-foreground">
              Filtered to position{" "}
              <span className="font-medium text-foreground">
                {jobTitles[jobIdFilter] || jobIdFilter}
              </span>
              {" · "}
              <button
                type="button"
                className="text-[#272055] underline-offset-2 hover:underline"
                onClick={() => router.push("/manage/candidates")}
              >
                Clear job filter
              </button>
            </p>
          ) : null}
        </div>

        {error ? (
          <div className="mx-4 mt-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <div className="flex min-h-0 flex-1">
          {showFilters ? (
            <>
              <div className="hidden w-[280px] shrink-0 md:flex md:flex-col">
                <CandidatesFilters
                  draft={draft}
                  onDraftChange={patchDraft}
                  onApply={applyDraftFilters}
                  onReset={resetFilters}
                  positions={positionOptions}
                  categories={categoryOptions}
                  sources={sourceOptions}
                  locations={locationOptions}
                  tags={tagOptions}
                  isLoadingOptions={isLoading}
                  className="min-h-0 flex-1"
                />
              </div>
              <div className="fixed inset-0 z-40 flex md:hidden">
                <button
                  type="button"
                  className="absolute inset-0 bg-black/40"
                  aria-label="Close filters"
                  onClick={() => setShowFilters(false)}
                />
                <div className="relative z-10 flex h-full w-[300px] max-w-[85vw] flex-col bg-card shadow-xl">
                  <CandidatesFilters
                    draft={draft}
                    onDraftChange={patchDraft}
                    onApply={() => {
                      applyDraftFilters();
                      setShowFilters(false);
                    }}
                    onReset={resetFilters}
                    positions={positionOptions}
                    categories={categoryOptions}
                    sources={sourceOptions}
                    locations={locationOptions}
                    tags={tagOptions}
                    isLoadingOptions={isLoading}
                    className="min-h-0 flex-1"
                  />
                </div>
              </div>
            </>
          ) : null}

          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            {isLoading ? (
              <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
                <TableSkeleton rows={10} columns={6} showCheckbox />
              </div>
            ) : (
              <>
                <div
                  className="min-h-0 flex-1 overflow-auto"
                  data-tour="candidates-table"
                >
                  {pageRows.length === 0 ? (
                    <CandidatesEmptyState
                      className="min-h-[420px] py-24"
                      title="No candidates"
                      description={
                        activeFilterCount > 0 ||
                        debouncedSearch ||
                        view !== "all-admin"
                          ? "No candidates match your criteria."
                          : "Add a candidate or wait for new applications to land here."
                      }
                      onClearFilters={
                        activeFilterCount > 0 || debouncedSearch
                          ? () => {
                              setSearch("");
                              resetFilters();
                              setView("all-admin");
                            }
                          : undefined
                      }
                      onAddCandidate={
                        activeFilterCount > 0 || debouncedSearch
                          ? undefined
                          : () => setAddOpen(true)
                      }
                    />
                  ) : (
                    <table className="w-full min-w-[1100px] border-collapse text-sm">
                      <thead className="sticky top-0 z-10 bg-muted/95 backdrop-blur-sm">
                        <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground">
                          <th className="w-10 p-3">
                            <Checkbox
                              checked={
                                pageRows.length > 0 &&
                                pageRows.every((app) =>
                                  selectedIds.has(resolveApplicationId(app))
                                )
                              }
                              onCheckedChange={(checked) =>
                                handleSelectAll(checked === true)
                              }
                              aria-label="Select all on page"
                            />
                          </th>
                          {columns.photo ? <th className="w-12 p-3">Photo</th> : null}
                          {columns.name ? (
                            <th className="p-3 font-medium text-foreground">Name</th>
                          ) : null}
                          {columns.score || columns.aiScore ? (
                            <th className="p-3 font-medium text-foreground">Score</th>
                          ) : null}
                          {columns.email ? (
                            <th className="p-3 font-medium text-foreground">
                              Email Address
                            </th>
                          ) : null}
                          {columns.phone ? (
                            <th className="hidden p-3 font-medium text-foreground lg:table-cell">
                              Phone Number
                            </th>
                          ) : null}
                          {columns.address ? (
                            <th className="hidden p-3 font-medium text-foreground xl:table-cell">
                              Address
                            </th>
                          ) : null}
                          {columns.salary ? (
                            <th className="hidden p-3 font-medium text-foreground xl:table-cell">
                              Desired Salary
                            </th>
                          ) : null}
                          {columns.position ? (
                            <th className="hidden p-3 font-medium text-foreground md:table-cell">
                              Position / Pool
                            </th>
                          ) : null}
                          {columns.stage ? (
                            <th className="p-3 font-medium text-foreground">Stage</th>
                          ) : null}
                          {columns.aiResumeAudit ? (
                            <th className="hidden p-3 font-medium text-foreground xl:table-cell">
                              AI Resume Audit
                            </th>
                          ) : null}
                          {columns.headline ? (
                            <th className="hidden p-3 font-medium text-foreground xl:table-cell">
                              Headline
                            </th>
                          ) : null}
                          {columns.internalId ? (
                            <th className="hidden p-3 font-medium text-foreground xl:table-cell">
                              Internal ID
                            </th>
                          ) : null}
                          {columns.activity ? (
                            <th className="hidden p-3 font-medium text-foreground xl:table-cell">
                              Activity
                            </th>
                          ) : null}
                          <th className="w-10 p-3 text-center">
                            <span className="sr-only">Preview</span>
                          </th>
                          {columns.star ? (
                            <th className="w-10 p-3 text-center">★</th>
                          ) : null}
                        </tr>
                      </thead>
                      <tbody>
                        {pageRows.map((app) => {
                          const id = resolveApplicationId(app);
                          const name = getNameDisplay(app);
                          const email = getEmailDisplay(app);
                          const position = getPositionDisplay(app, jobTitles);
                          const activity = activityDate(app);
                          const isHighlighted = highlightId === id;
                          const showScore = columns.score || columns.aiScore;

                          return (
                            <tr
                              key={id}
                              role="link"
                              tabIndex={0}
                              onClick={() => openCandidate(app)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                  event.preventDefault();
                                  openCandidate(app);
                                }
                              }}
                              className={cn(
                                "cursor-pointer border-b border-border/80 transition-colors last:border-0 hover:bg-muted/40",
                                selectedIds.has(id) && "bg-[#31CDFF]/5",
                                isHighlighted && "bg-amber-50 dark:bg-amber-950/20",
                                !seenIds.has(id) && "font-medium"
                              )}
                            >
                              <td
                                className="p-3"
                                onClick={(event) => event.stopPropagation()}
                              >
                                <Checkbox
                                  checked={selectedIds.has(id)}
                                  onCheckedChange={() => handleSelectRow(id)}
                                  aria-label={`Select ${name}`}
                                />
                              </td>
                              {columns.photo ? (
                                <td className="p-3">
                                  <Avatar className="h-8 w-8">
                                    <AvatarFallback className="bg-[#272055] text-[11px] font-semibold text-white">
                                      {candidateInitials(name || "?")}
                                    </AvatarFallback>
                                  </Avatar>
                                </td>
                              ) : null}
                              {columns.name ? (
                                <td className="p-3">
                                  <div className="flex max-w-[220px] items-center gap-1.5">
                                    <span className="truncate text-foreground">
                                      {name}
                                    </span>
                                    {!seenIds.has(id) ? (
                                      <Badge
                                        variant="outline"
                                        className="shrink-0 px-1.5 py-0 text-[10px]"
                                      >
                                        New
                                      </Badge>
                                    ) : null}
                                  </div>
                                </td>
                              ) : null}
                              {showScore ? (
                                <td
                                  className="p-3 align-middle"
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  <AiRankScoreCell
                                    score={app.aiRankScore}
                                    recommendation={app.aiRankRecommendation}
                                    summary={app.aiRankSummary}
                                    scoreReason={app.aiRankScoreReason}
                                    requirements={app.aiRankRequirements}
                                    onRank={
                                      applicantInsights
                                        ? () => void handleRankOne(app)
                                        : undefined
                                    }
                                    isRanking={inFlightApplicationIds.includes(id)}
                                    disabledReason={
                                      aiUnconfigured
                                        ? AI_UNCONFIGURED_MESSAGE
                                        : undefined
                                    }
                                  />
                                </td>
                              ) : null}
                              {columns.email ? (
                                <td className="p-3">
                                  {email.includes("@") ? (
                                    <a
                                      href={`mailto:${email}`}
                                      className="max-w-[220px] truncate text-[#272055] hover:text-[#31CDFF]"
                                      onClick={(event) => event.stopPropagation()}
                                    >
                                      {email}
                                    </a>
                                  ) : (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                                </td>
                              ) : null}
                              {columns.phone ? (
                                <td className="hidden p-3 text-muted-foreground lg:table-cell">
                                  {app.phoneNumber || "—"}
                                </td>
                              ) : null}
                              {columns.address ? (
                                <td className="hidden max-w-[160px] truncate p-3 text-muted-foreground xl:table-cell">
                                  {app.location || "—"}
                                </td>
                              ) : null}
                              {columns.salary ? (
                                <td className="hidden p-3 text-muted-foreground xl:table-cell">
                                  {app.salary || "—"}
                                </td>
                              ) : null}
                              {columns.position ? (
                                <td className="hidden max-w-[180px] truncate p-3 md:table-cell">
                                  {position || (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                                </td>
                              ) : null}
                              {columns.stage ? (
                                <td
                                  className="p-3"
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  <Select
                                    value={app.status || "New"}
                                    onValueChange={async (status) => {
                                      const previousStatus = app.status || "New";
                                      if (status === previousStatus) return;
                                      try {
                                        await adminApplicationsApi.bulkUpdateStatus({
                                          ids: [id],
                                          status,
                                        });
                                        toast.success(`Moved to ${status}`, {
                                          duration: 20000,
                                          action: {
                                            label: "Undo",
                                            onClick: () => {
                                              void (async () => {
                                                try {
                                                  await adminApplicationsApi.bulkUpdateStatus(
                                                    {
                                                      ids: [id],
                                                      status: previousStatus,
                                                    }
                                                  );
                                                  refresh();
                                                } catch (undoErr) {
                                                  toast.error(
                                                    undoErr instanceof Error
                                                      ? undoErr.message
                                                      : "Failed to undo stage change"
                                                  );
                                                }
                                              })();
                                            },
                                          },
                                        });
                                        refresh();
                                      } catch (err) {
                                        toast.error(
                                          err instanceof Error
                                            ? err.message
                                            : "Failed to update stage"
                                        );
                                      }
                                    }}
                                  >
                                    <SelectTrigger className="h-8 w-[150px] text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {PIPELINE_STAGES.map((stage) => (
                                        <SelectItem key={stage} value={stage}>
                                          {stage}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </td>
                              ) : null}
                              {columns.aiResumeAudit ? (
                                <td className="hidden max-w-[160px] truncate p-3 text-muted-foreground xl:table-cell">
                                  {resumeAuditLabel(app)}
                                </td>
                              ) : null}
                              {columns.headline ? (
                                <td className="hidden max-w-[200px] truncate p-3 text-muted-foreground xl:table-cell">
                                  {applicationHeadline(app) || "—"}
                                </td>
                              ) : null}
                              {columns.internalId ? (
                                <td className="hidden max-w-[120px] truncate p-3 font-mono text-xs text-muted-foreground xl:table-cell">
                                  {id.slice(-8)}
                                </td>
                              ) : null}
                              {columns.activity ? (
                                <td className="hidden p-3 text-muted-foreground xl:table-cell">
                                  {activity ? (
                                    <span title={format(activity, "PPpp")}>
                                      {formatDistanceToNow(activity, {
                                        addSuffix: true,
                                      })}
                                    </span>
                                  ) : (
                                    "—"
                                  )}
                                </td>
                              ) : null}
                              <td
                                className="p-3 text-center"
                                onClick={(event) => event.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                                  aria-label={`Preview ${name}`}
                                  title="Preview candidate"
                                  onClick={() => openCandidatePreview(app)}
                                >
                                  <Eye className="h-4 w-4" />
                                </button>
                              </td>
                              {columns.star ? (
                                <td
                                  className="p-3 text-center"
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  <button
                                    type="button"
                                    className="rounded p-1 hover:bg-muted"
                                    aria-label={
                                      starredIds.has(id)
                                        ? "Unstar candidate"
                                        : "Star candidate"
                                    }
                                    onClick={() => toggleStar(id)}
                                  >
                                    <Star
                                      className={cn(
                                        "h-4 w-4",
                                        starredIds.has(id)
                                          ? "fill-amber-400 text-amber-500"
                                          : "text-muted-foreground"
                                      )}
                                    />
                                  </button>
                                </td>
                              ) : null}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>

                {totalPages > 1 && pageRows.length > 0 ? (
                  <div className="shrink-0 border-t border-border px-4 py-3">
                    <Pagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      onPageChange={setCurrentPage}
                    />
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>

      <AddCandidateGlobalDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        initialJobId={jobIdFilter}
        onCreated={() => refresh()}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete candidates?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes {selectedIds.size} selected candidate
              {selectedIds.size === 1 ? "" : "s"}. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={bulkBusy}
              onClick={(event) => {
                event.preventDefault();
                void handleBulkDelete();
              }}
            >
              {bulkBusy ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={moveOpen} onOpenChange={setMoveOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Move Candidates</DialogTitle>
            <DialogDescription>
              Move {selectedIds.size} selected candidate
              {selectedIds.size === 1 ? "" : "s"} to a pipeline stage.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="move-stage">Stage</Label>
            <Select value={moveStage} onValueChange={setMoveStage}>
              <SelectTrigger id="move-stage">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PIPELINE_STAGES.map((stage) => (
                  <SelectItem key={stage} value={stage}>
                    {stage}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setMoveOpen(false)}
              disabled={bulkBusy}
            >
              Cancel
            </Button>
            <Button
              className="bg-[#31CDFF] text-white hover:bg-[#31CDFF]/90"
              disabled={bulkBusy}
              onClick={() => void handleBulkMove()}
            >
              {bulkBusy ? "Moving…" : "Move"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TagCandidatesDialog
        open={tagOpen}
        onOpenChange={setTagOpen}
        selectedCount={selectedIds.size}
        existingTags={selectedExistingTags}
        catalogTags={tagOptions}
        isSubmitting={bulkBusy}
        onSubmit={handleTagCandidates}
      />

      <SendQuestionnaireDialog
        open={questionnaireOpen}
        onOpenChange={setQuestionnaireOpen}
        selectedCount={selectedIds.size}
        options={questionnaireOptions}
        isLoadingOptions={questionnaireLoading}
        isSubmitting={bulkBusy}
        onSubmit={handleSendQuestionnaire}
      />

      <MergeCandidatesDialog
        open={mergeOpen}
        onOpenChange={setMergeOpen}
        selected={selectedList}
        isSubmitting={bulkBusy}
        onSubmit={handleMergeCandidates}
      />

      <CandidatePreviewModal
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        jobId={previewJobId}
        applicationId={previewApplicationId}
        onAfterClose={refresh}
      />
    </AdminPageLayout>
  );
}
