/**
 * Client-side mirror of Backend/app/lib/job_activation.py.
 * Wizard basics required before a position can go active.
 */

export const ACTIVATION_FIELD_LABELS = {
  title: "Title",
  department: "Department",
  location: "Location",
  description: "Description",
  pipelineStages: "Pipeline stage",
} as const;

export type ActivationFieldKey = keyof typeof ACTIVATION_FIELD_LABELS;

const PLACEHOLDER_VALUES = new Set(["", "n/a", "na", "none", "-"]);

export type JobActivationInput = {
  title?: string | null;
  department?: string | null;
  location?: string | null;
  description?: string | null;
  pipelineStages?: Array<{ enabled?: boolean } | Record<string, unknown>> | null;
};

function plainText(value: unknown): string {
  const text = String(value ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\u00a0/g, " ")
    .replace(/&nbsp;/gi, " ");
  return text.replace(/\s+/g, " ").trim();
}

function isBlank(value: unknown): boolean {
  const text = plainText(value);
  return !text || PLACEHOLDER_VALUES.has(text.toLowerCase());
}

function hasEnabledPipelineStage(
  stages: JobActivationInput["pipelineStages"]
): boolean {
  if (!Array.isArray(stages) || stages.length === 0) return false;
  return stages.some((stage) => {
    if (!stage || typeof stage !== "object") return false;
    if ("enabled" in stage) return Boolean(stage.enabled);
    return true;
  });
}

/** Human-readable labels for fields blocking activation (wizard order). */
export function getMissingActivationFields(
  job: JobActivationInput
): string[] {
  const missing: string[] = [];
  if (isBlank(job.title)) missing.push(ACTIVATION_FIELD_LABELS.title);
  if (isBlank(job.department)) missing.push(ACTIVATION_FIELD_LABELS.department);
  if (isBlank(job.location)) missing.push(ACTIVATION_FIELD_LABELS.location);
  if (isBlank(job.description)) missing.push(ACTIVATION_FIELD_LABELS.description);
  if (!hasEnabledPipelineStage(job.pipelineStages)) {
    missing.push(ACTIVATION_FIELD_LABELS.pipelineStages);
  }
  return missing;
}

export function canActivateJob(job: JobActivationInput): boolean {
  return getMissingActivationFields(job).length === 0;
}

export function formatMissingActivationMessage(missing: string[]): string {
  if (missing.length === 0) return "";
  return `Cannot activate position. Missing required fields: ${missing.join(", ")}`;
}

/** Parse FastAPI activation_incomplete (or plain string) into a toast message. */
export function formatActivationApiError(detail: unknown): string {
  if (typeof detail === "string" && detail.trim()) return detail;
  if (detail && typeof detail === "object" && !Array.isArray(detail)) {
    const obj = detail as {
      message?: unknown;
      missingFields?: unknown;
    };
    if (typeof obj.message === "string" && obj.message.trim()) {
      return obj.message;
    }
    if (Array.isArray(obj.missingFields) && obj.missingFields.length) {
      return formatMissingActivationMessage(obj.missingFields.map(String));
    }
  }
  return "Cannot activate position. Required fields are missing.";
}
