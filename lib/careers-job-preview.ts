import { JobPosting } from "@/types/jobPosting";

/** Normalize admin or public job payloads into the careers JobPosting shape. */
export function normalizeCareersJobPosting(
  raw: Record<string, unknown>
): JobPosting {
  const id = String(raw.id || raw._id || "");
  return {
    ...(raw as unknown as JobPosting),
    id,
    _id: String(raw._id || raw.id || id),
    title: String(raw.title || "Untitled position"),
    department: raw.department ? String(raw.department) : undefined,
    location: String(raw.location || ""),
    description: String(raw.description || ""),
    postedDate: String(raw.postedDate || new Date().toISOString()),
    employmentType: String(raw.employmentType || "Full-time"),
    category: String(raw.category || "General"),
    isActive: Boolean(raw.isActive),
  };
}

export function isCareersPreviewQuery(search: string): boolean {
  const params = new URLSearchParams(search);
  const preview = params.get("preview");
  return preview === "1" || preview === "true";
}

export function getCareersDeepLinkJobId(search: string): string | null {
  const jobId = new URLSearchParams(search).get("job")?.trim();
  return jobId || null;
}

/**
 * True when careers should filter the normal page to the deep-linked job only
 * (preview=1 + job id). Does not switch to a separate layout.
 */
export function isCareersIsolatedPreview(search: string): boolean {
  return isCareersPreviewQuery(search) && !!getCareersDeepLinkJobId(search);
}
