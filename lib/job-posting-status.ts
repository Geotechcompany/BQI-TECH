export type JobPostingLifecycleStatus = "draft" | "active" | "inactive";

type JobStatusInput = {
  title?: string | null;
  isActive?: boolean | null;
  status?: string | null;
};

/**
 * Resolve admin-facing lifecycle status from API fields.
 * Prefer explicit `status`; fall back to isActive. Incomplete rows wrongly saved
 * as active (empty title) surface as draft without a DB migration.
 */
export function resolveJobPostingStatus(
  job: JobStatusInput
): JobPostingLifecycleStatus {
  const raw = String(job.status || "")
    .trim()
    .toLowerCase();

  if (raw === "draft") return "draft";
  if (raw === "inactive" || raw === "closed") return "inactive";
  if (raw === "active") {
    if (job.isActive === false) return "inactive";
    if (!String(job.title || "").trim()) return "draft";
    return "active";
  }

  if (job.isActive === true) {
    if (!String(job.title || "").trim()) return "draft";
    return "active";
  }

  if (job.isActive === false) return "inactive";

  return "draft";
}

export function statusFromIsActive(
  isActive: boolean,
  previous?: JobPostingLifecycleStatus | null
): JobPostingLifecycleStatus {
  if (isActive) return "active";
  if (previous === "active" || previous === "inactive") return "inactive";
  return "draft";
}

export function formatJobPostedDate(value: string | Date | null | undefined): string {
  if (value == null || value === "") return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
