import type { Application } from "@/types/application";
import {
  getEmailDisplay,
  getNameDisplay,
  getPositionDisplay,
  getCvUrl,
} from "@/components/admin/utils/table-utils";

export type CandidateView =
  | "all-admin"
  | "all"
  | "new"
  | "my"
  | "starred"
  | "unseen";

export type CandidateColumnKey =
  | "photo"
  | "name"
  | "score"
  | "email"
  | "phone"
  | "address"
  | "salary"
  | "position"
  | "stage"
  | "source"
  | "aiScore"
  | "aiResumeAudit"
  | "headline"
  | "resume"
  | "tags"
  | "internalId"
  | "timeInStage"
  | "activity"
  | "star";

export const CANDIDATE_COLUMN_LABELS: Record<CandidateColumnKey, string> = {
  photo: "Photo",
  name: "Name",
  score: "Score",
  email: "Email Address",
  phone: "Phone Number",
  address: "Address",
  salary: "Desired Salary",
  position: "Position / Pool",
  stage: "Stage",
  source: "Source",
  aiScore: "AI Score",
  aiResumeAudit: "AI Resume Audit",
  headline: "Headline",
  resume: "Resume / CV",
  tags: "Tags",
  internalId: "Internal ID",
  timeInStage: "Time in Stage",
  activity: "Activity",
  star: "Star",
};

export const DEFAULT_CANDIDATE_COLUMNS: Record<CandidateColumnKey, boolean> = {
  photo: true,
  name: true,
  score: true,
  email: true,
  phone: false,
  address: false,
  salary: false,
  position: true,
  stage: false,
  source: false,
  aiScore: true,
  aiResumeAudit: false,
  headline: false,
  resume: false,
  tags: false,
  internalId: false,
  timeInStage: false,
  activity: true,
  star: true,
};

/** Columns removed from the Candidates list table (still used for CSV/export helpers). */
export const HIDDEN_CANDIDATE_TABLE_COLUMNS: CandidateColumnKey[] = [
  "source",
  "resume",
  "tags",
  "timeInStage",
  "stage",
];

export const CANDIDATE_VIEW_OPTIONS: Array<{
  value: CandidateView;
  label: string;
  adminOnly?: boolean;
}> = [
  { value: "all-admin", label: "All Candidates (Admin)", adminOnly: true },
  { value: "all", label: "All Candidates" },
  { value: "new", label: "New Candidates" },
  { value: "my", label: "My Candidates" },
  { value: "starred", label: "Starred Candidates" },
  { value: "unseen", label: "Unseen Candidates" },
];

export const COLUMNS_STORAGE_KEY = "bqi.candidates.columns.v4";

export function starredCandidatesStorageKey(userId: string) {
  return `bqi.starredCandidates.${userId}`;
}

export function seenCandidatesStorageKey(userId: string) {
  return `bqi.seenCandidates.${userId}`;
}

export function readIdSet(storageKey: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(
      parsed.filter((id): id is string => typeof id === "string" && id.length > 0)
    );
  } catch {
    return new Set();
  }
}

export function writeIdSet(storageKey: string, ids: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(Array.from(ids)));
  } catch {
    // Ignore quota / private-mode failures
  }
}

export function readColumnVisibility(): Record<CandidateColumnKey, boolean> {
  if (typeof window === "undefined") return { ...DEFAULT_CANDIDATE_COLUMNS };
  try {
    const raw = window.localStorage.getItem(COLUMNS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_CANDIDATE_COLUMNS };
    const parsed = JSON.parse(raw) as Partial<Record<string, boolean>>;
    const next = { ...DEFAULT_CANDIDATE_COLUMNS };
    (Object.keys(DEFAULT_CANDIDATE_COLUMNS) as CandidateColumnKey[]).forEach(
      (key) => {
        if (typeof parsed[key] === "boolean") next[key] = parsed[key];
      }
    );
    next.name = true;
    HIDDEN_CANDIDATE_TABLE_COLUMNS.forEach((key) => {
      next[key] = false;
    });
    return next;
  } catch {
    return { ...DEFAULT_CANDIDATE_COLUMNS };
  }
}

export function writeColumnVisibility(
  columns: Record<CandidateColumnKey, boolean>
) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      COLUMNS_STORAGE_KEY,
      JSON.stringify({ ...columns, name: true })
    );
  } catch {
    // Ignore quota / private-mode failures
  }
}

export function resolveApplicationId(app: Application): string {
  return String(app.id || app._id || "");
}

export function resolveJobId(app: Application): string | null {
  const jobId = app.jobId as unknown;
  if (typeof jobId === "string" && jobId.trim()) return jobId.trim();
  if (jobId && typeof jobId === "object") {
    const objectId = (jobId as { _id?: string; id?: string })._id
      || (jobId as { id?: string }).id;
    if (objectId) return String(objectId);
  }
  const legacy = (app as { job?: { _id?: string; id?: string } }).job;
  if (legacy?._id) return String(legacy._id);
  if (legacy?.id) return String(legacy.id);
  return null;
}

export function candidateInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function viewLabel(view: CandidateView): string {
  return (
    CANDIDATE_VIEW_OPTIONS.find((option) => option.value === view)?.label ??
    "All Candidates"
  );
}

export function applicationHeadline(app: Application): string {
  const summary = app.aiRankSummary?.trim();
  if (summary) return summary;
  const recommendation = app.aiRankRecommendation?.trim();
  if (recommendation) return recommendation;
  const experience = app.experience?.trim();
  if (experience && experience !== "NOT SET") return experience;
  return "";
}

export function resumeAuditLabel(app: Application): string {
  if (app.aiRankScore == null) return "Not audited";
  const recommendation = app.aiRankRecommendation?.trim();
  if (recommendation) return recommendation;
  return "Audited";
}

export function matchesSalaryFilter(
  salary: string | undefined,
  min: string,
  max: string
): boolean {
  if (!min && !max) return true;
  const digits = (salary || "").replace(/[^0-9.]/g, "");
  if (!digits) return false;
  const value = Number(digits);
  if (Number.isNaN(value)) return false;
  if (min && value < Number(min)) return false;
  if (max && value > Number(max)) return false;
  return true;
}

export function exportCandidatesCsv(
  applications: Application[],
  jobTitles: Record<string, string>
) {
  const headers = [
    "Name",
    "Email",
    "Phone",
    "Address",
    "Desired Salary",
    "Position",
    "Stage",
    "Source",
    "AI Score",
    "Applied Date",
    "Internal ID",
    "CV URL",
  ];

  const rows = applications.map((app) => [
    getNameDisplay(app),
    getEmailDisplay(app),
    app.phoneNumber || "",
    app.location || "",
    app.salary || "",
    getPositionDisplay(app, jobTitles),
    app.status || "New",
    app.hearAbout || "",
    app.aiRankScore != null ? String(app.aiRankScore) : "",
    app.appliedDate ? new Date(app.appliedDate).toISOString() : "",
    resolveApplicationId(app),
    getCvUrl(app),
  ]);

  const escape = (value: string) => {
    if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
    return value;
  };

  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => escape(String(cell ?? ""))).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `candidates-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export interface CandidatesDraftFilters {
  positions: string[];
  categories: string[];
  stages: string[];
  dateFrom: string;
  dateTo: string;
  activityFrom: string;
  activityTo: string;
  sources: string[];
  locations: string[];
  tags: string[];
  salaryMin: string;
  salaryMax: string;
  aiScore: string;
  resumeAudit: "all" | "audited" | "not_audited";
  assignedToMe: boolean;
  starredOnly: boolean;
  unseenOnly: boolean;
  includeArchived: boolean;
}

export function defaultCandidatesDraft(): CandidatesDraftFilters {
  return {
    positions: [],
    categories: [],
    stages: [],
    dateFrom: "",
    dateTo: "",
    activityFrom: "",
    activityTo: "",
    sources: [],
    locations: [],
    tags: [],
    salaryMin: "",
    salaryMax: "",
    aiScore: "all",
    resumeAudit: "all",
    assignedToMe: false,
    starredOnly: false,
    unseenOnly: false,
    includeArchived: false,
  };
}

export function countActiveCandidateFilters(filters: CandidatesDraftFilters): number {
  let count = 0;
  if (filters.positions.length) count += 1;
  if (filters.categories.length) count += 1;
  if (filters.stages.length) count += 1;
  if (filters.dateFrom || filters.dateTo) count += 1;
  if (filters.activityFrom || filters.activityTo) count += 1;
  if (filters.sources.length) count += 1;
  if (filters.locations.length) count += 1;
  if (filters.tags.length) count += 1;
  if (filters.salaryMin || filters.salaryMax) count += 1;
  if (filters.aiScore !== "all") count += 1;
  if (filters.resumeAudit !== "all") count += 1;
  if (filters.assignedToMe) count += 1;
  if (filters.starredOnly) count += 1;
  if (filters.unseenOnly) count += 1;
  if (filters.includeArchived) count += 1;
  return count;
}

export function applicationTags(app: Application): string[] {
  if (!Array.isArray(app.tags)) return [];
  return app.tags
    .map((tag) => String(tag || "").trim())
    .filter((tag) => tag.length > 0);
}
