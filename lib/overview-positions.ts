export type PositionsFilter = "all" | "mine" | "starred";

export const POSITIONS_FILTER_STORAGE_KEY = "bqi.overview.positionsFilter";

export const POSITIONS_FILTER_OPTIONS: Array<{
  value: PositionsFilter;
  label: string;
}> = [
  { value: "all", label: "All Positions (Admin)" },
  { value: "mine", label: "My Positions" },
  { value: "starred", label: "Starred Positions" },
];

export function positionsFilterLabel(filter: PositionsFilter): string {
  return (
    POSITIONS_FILTER_OPTIONS.find((option) => option.value === filter)?.label ??
    "My Positions"
  );
}

export function parsePositionsFilter(value: string | null | undefined): PositionsFilter {
  if (value === "all" || value === "mine" || value === "starred") {
    return value;
  }
  return "mine";
}

export function readPositionsFilter(): PositionsFilter {
  if (typeof window === "undefined") return "mine";
  try {
    return parsePositionsFilter(window.localStorage.getItem(POSITIONS_FILTER_STORAGE_KEY));
  } catch {
    return "mine";
  }
}

export function writePositionsFilter(filter: PositionsFilter): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(POSITIONS_FILTER_STORAGE_KEY, filter);
  } catch {
    // Ignore quota / private-mode failures
  }
}

export function starredJobsStorageKey(userId: string): string {
  return `bqi.starredJobs.${userId}`;
}

export function readStarredJobIds(userId: string): Set<string> {
  if (typeof window === "undefined" || !userId) return new Set();
  try {
    const raw = window.localStorage.getItem(starredJobsStorageKey(userId));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is string => typeof id === "string" && id.length > 0));
  } catch {
    return new Set();
  }
}

export function writeStarredJobIds(userId: string, jobIds: Set<string>): void {
  if (typeof window === "undefined" || !userId) return;
  try {
    window.localStorage.setItem(
      starredJobsStorageKey(userId),
      JSON.stringify(Array.from(jobIds))
    );
  } catch {
    // Ignore quota / private-mode failures
  }
}

export interface JobHiringTeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface JobOwnershipMeta {
  id: string;
  title: string;
  createdBy?: string | null;
  hiringTeam: JobHiringTeamMember[];
  hiringTeamIds: string[];
  isActive: boolean;
}

export function isMyPosition(
  job: Pick<JobOwnershipMeta, "createdBy" | "hiringTeamIds">,
  userId: string
): boolean {
  if (!userId) return false;
  if (job.createdBy && String(job.createdBy) === userId) return true;
  return job.hiringTeamIds.some((memberId) => String(memberId) === userId);
}

export function extractHiringTeamMembers(hiringTeam: unknown): JobHiringTeamMember[] {
  if (!Array.isArray(hiringTeam)) return [];
  return hiringTeam
    .map((member) => {
      if (!member || typeof member !== "object") return null;
      const raw = member as {
        id?: unknown;
        name?: unknown;
        email?: unknown;
        role?: unknown;
      };
      const id = typeof raw.id === "string" && raw.id.length > 0 ? raw.id : null;
      if (!id) return null;
      const email = typeof raw.email === "string" ? raw.email : "";
      const name =
        typeof raw.name === "string" && raw.name.trim().length > 0
          ? raw.name.trim()
          : email || "Team member";
      const role = typeof raw.role === "string" && raw.role.length > 0 ? raw.role : "Reviewer";
      return { id, name, email, role };
    })
    .filter((member): member is JobHiringTeamMember => Boolean(member));
}

export function extractHiringTeamIds(hiringTeam: unknown): string[] {
  return extractHiringTeamMembers(hiringTeam).map((member) => member.id);
}

export function jobMatchesPositionsFilter(
  job: Pick<JobOwnershipMeta, "id" | "createdBy" | "hiringTeamIds">,
  filter: PositionsFilter,
  userId: string,
  starredJobIds: Set<string>
): boolean {
  if (filter === "all") return true;
  if (filter === "starred") return starredJobIds.has(job.id);
  return isMyPosition(job, userId);
}

/** Job IDs visible under the current positions filter. `null` means all positions. */
export function filteredJobIdSet(
  jobs: Iterable<JobOwnershipMeta>,
  filter: PositionsFilter,
  userId: string,
  starredJobIds: Set<string>
): Set<string> | null {
  if (filter === "all") return null;
  const ids = new Set<string>();
  for (const job of jobs) {
    if (jobMatchesPositionsFilter(job, filter, userId, starredJobIds)) {
      ids.add(job.id);
    }
  }
  return ids;
}

export function recentApplicationsSubtitle(filter: PositionsFilter): string {
  if (filter === "mine") return "Latest candidates for your positions";
  if (filter === "starred") return "Latest candidates for starred positions";
  return "Latest candidates across all positions";
}

export function extractApplicationJobId(application: {
  jobId?: string | { _id?: string } | null;
}): string | null {
  const raw = application.jobId;
  if (!raw) return null;
  if (typeof raw === "string" && raw.length > 0) return raw;
  if (typeof raw === "object" && raw._id) return String(raw._id);
  return null;
}
