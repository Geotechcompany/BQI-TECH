/** Pipeline-stage email broadcast template types and helpers. */

export type PipelineEmailStageKey =
  | "new"
  | "shortlisted"
  | "technical-assessment"
  | "interviewing"
  | "hired"
  | "disqualified";

export interface BroadcastEmailTemplate {
  id: string;
  stageKey: string;
  name: string;
  subject: string;
  /** HTML body (API also returns `body` as an alias). */
  html: string;
  body: string;
  isDefault?: boolean;
}

/** @deprecated Prefer `BroadcastEmailTemplate.id` from the API. */
export type BroadcastTemplateId = string;

export function stageKeyFromLabel(label?: string | null): PipelineEmailStageKey | string {
  const raw = (label || "").trim().toLowerCase();
  if (!raw) return "new";
  if (raw === "rejected" || raw === "disqualified") return "disqualified";
  return raw.replace(/\s+/g, "-");
}

export function findTemplateForStage(
  templates: BroadcastEmailTemplate[],
  stageLabelOrKey?: string | null
): BroadcastEmailTemplate | undefined {
  const key = stageKeyFromLabel(stageLabelOrKey);
  return (
    templates.find((t) => t.stageKey === key) ||
    templates.find(
      (t) => t.name.toLowerCase().includes((stageLabelOrKey || "").toLowerCase())
    )
  );
}

export function normalizeBroadcastTemplate(
  raw: Record<string, unknown>
): BroadcastEmailTemplate {
  const html = String(raw.html ?? raw.body ?? "");
  return {
    id: String(raw.id ?? ""),
    stageKey: String(raw.stageKey ?? ""),
    name: String(raw.name ?? "Untitled"),
    subject: String(raw.subject ?? ""),
    html,
    body: html,
    isDefault: Boolean(raw.isDefault ?? true),
  };
}
