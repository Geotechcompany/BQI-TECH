import { Application } from "@/types/application";

export const PIPELINE_STAGES = [
  "New",
  "Shortlisted",
  "Technical Assessment",
  "Interviewing",
  "Hired",
  "Disqualified",
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

const STAGE_LOOKUP: Record<string, PipelineStage> = {
  new: "New",
  shortlisted: "Shortlisted",
  "technical assessment": "Technical Assessment",
  interviewing: "Interviewing",
  hired: "Hired",
  disqualified: "Disqualified",
  rejected: "Disqualified",
};

export function normalizeToPipelineStage(status?: string | null): PipelineStage {
  if (!status?.trim()) return "New";
  const key = status.trim().toLowerCase();
  return STAGE_LOOKUP[key] ?? "New";
}

export function getApplicationPipelineStage(application: Application): PipelineStage {
  return normalizeToPipelineStage(application.status);
}

export function groupApplicationsByStage(
  applications: Application[],
  stageLabels: readonly string[] = PIPELINE_STAGES
): Record<string, Application[]> {
  const grouped = stageLabels.reduce(
    (acc, stage) => {
      acc[stage] = [];
      return acc;
    },
    {} as Record<string, Application[]>
  );

  const fallbackStage = stageLabels[0] ?? "New";

  for (const application of applications) {
    const stage = getApplicationPipelineStage(application);
    if (stageLabels.includes(stage)) {
      grouped[stage].push(application);
    } else {
      grouped[fallbackStage].push(application);
    }
  }

  return grouped;
}

const LEGACY_STAGE_DATE_FIELDS: Partial<Record<PipelineStage, keyof Application>> = {
  New: "appliedDate",
  Shortlisted: "shortlistedDate",
  "Technical Assessment": "assessmentDate",
  Interviewing: "interviewDate",
  Hired: "hireDate",
  Disqualified: "disqualifiedDate",
};

export function getDaysInCurrentStage(application: Application): number {
  const stage = getApplicationPipelineStage(application);
  const status = application.status || stage;

  if (application.statusHistory?.length) {
    const matches = application.statusHistory
      .filter(
        (entry) =>
          entry.date &&
          entry.status?.trim().toLowerCase() === status.trim().toLowerCase()
      )
      .map((entry) => new Date(entry.date).getTime())
      .filter((time) => !Number.isNaN(time));

    if (matches.length) {
      const latest = Math.max(...matches);
      return Math.max(
        0,
        Math.floor((Date.now() - latest) / (1000 * 60 * 60 * 24))
      );
    }
  }

  const legacyField = LEGACY_STAGE_DATE_FIELDS[stage];
  if (legacyField) {
    const value = application[legacyField];
    if (value) {
      const parsed = new Date(value as string | Date).getTime();
      if (!Number.isNaN(parsed)) {
        return Math.max(
          0,
          Math.floor((Date.now() - parsed) / (1000 * 60 * 60 * 24))
        );
      }
    }
  }

  if (application.appliedDate) {
    const applied = new Date(application.appliedDate).getTime();
    if (!Number.isNaN(applied)) {
      return Math.max(
        0,
        Math.floor((Date.now() - applied) / (1000 * 60 * 60 * 24))
      );
    }
  }

  return 0;
}

export function formatDaysInStage(days: number): string {
  if (days <= 0) return "Today in stage";
  if (days === 1) return "1 day in stage";
  return `${days} days in stage`;
}

export const LAST_PIPELINE_JOB_KEY = "bqi-last-pipeline-job-id";
