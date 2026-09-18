/**
 * Careers preview URL for a job (same-origin relative path).
 * Always includes `preview=1` so the public careers page shows only this job
 * in the normal list + detail UI (drafts load for signed-in admins).
 */
export function getCareersJobPreviewPath(jobId?: string): string {
  if (!jobId?.trim()) {
    return "/careers/jobs";
  }

  const params = new URLSearchParams({
    job: jobId.trim(),
    preview: "1",
  });
  return `/careers/jobs?${params.toString()}`;
}

/**
 * Public careers deep-link without preview isolation (share / live listing).
 */
export function getCareersJobLivePath(jobId?: string): string {
  if (!jobId?.trim()) {
    return "/careers/jobs";
  }

  const params = new URLSearchParams({ job: jobId.trim() });
  return `/careers/jobs?${params.toString()}`;
}

/** Opens careers preview in a new tab. Returns false if there is no job id. */
export function openCareersJobPreviewTab(jobId?: string): boolean {
  const id = jobId?.trim();
  if (!id) return false;
  window.open(getCareersJobPreviewPath(id), "_blank", "noopener,noreferrer");
  return true;
}
