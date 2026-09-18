import type { Application } from "@/types/application";
import { getExperienceDisplay } from "@/components/admin/candidate-profile/application-helpers";
import {
  normalizeToPipelineStage,
  type PipelineStage,
} from "@/components/admin/pipeline/pipeline-utils";
import {
  extractApplicationJobId,
  isMyPosition,
  type JobOwnershipMeta,
} from "@/lib/overview-positions";

/** Hiring stages only — Disqualify is a separate action. */
export const FORWARD_PIPELINE_STAGES: PipelineStage[] = [
  "New",
  "Shortlisted",
  "Technical Assessment",
  "Interviewing",
  "Hired",
];

export type ApplicantsPositionTab = "all" | "mine";

export interface PositionListItem {
  jobId: string;
  title: string;
  location: string;
  applicantCount: number;
  createdBy: string | null;
  hiringTeamIds: string[];
  isActive: boolean;
}

export interface WorkExperienceEntry {
  title: string;
  company?: string;
  dates?: string;
  bullets: string[];
}

export interface ExperienceViewModel {
  summary: string;
  jobs: WorkExperienceEntry[];
  rawExperience: string;
}

const DATE_LINE_RE =
  /^(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{4}\s*[-–—]\s*(?:present|current|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{4}|\d{4})/i;

const TITLE_COMPANY_RE =
  /^(.+?)\s+(?:at|@|[-–—|])\s+(.+)$/i;

export function nextForwardStage(currentStatus?: string | null): PipelineStage | null {
  const stage = normalizeToPipelineStage(currentStatus);
  const index = FORWARD_PIPELINE_STAGES.indexOf(stage);
  if (index < 0 || index >= FORWARD_PIPELINE_STAGES.length - 1) return null;
  return FORWARD_PIPELINE_STAGES[index + 1];
}

export function sortApplicantsByAppliedDate(
  applications: Application[]
): Application[] {
  return [...applications].sort((a, b) => {
    const timeA = a.appliedDate ? new Date(a.appliedDate).getTime() : 0;
    const timeB = b.appliedDate ? new Date(b.appliedDate).getTime() : 0;
    if (timeA !== timeB) return timeA - timeB;
    return (a.id || "").localeCompare(b.id || "");
  });
}

export function applicationBelongsToJob(
  application: Application,
  jobId: string,
  jobTitle?: string
): boolean {
  const appJobId = extractApplicationJobId(application);
  if (appJobId && appJobId === jobId) return true;
  if (!appJobId && jobTitle) {
    return (
      (application.position || "").trim().toLowerCase() ===
      jobTitle.trim().toLowerCase()
    );
  }
  return false;
}

export function buildPositionList(params: {
  jobs: JobOwnershipMeta[];
  jobLocations: Record<string, string>;
  applications: Application[];
  tab: ApplicantsPositionTab;
  userId: string;
}): PositionListItem[] {
  const { jobs, jobLocations, applications, tab, userId } = params;

  const counts = new Map<string, number>();
  for (const application of applications) {
    const jobId = extractApplicationJobId(application);
    if (!jobId) continue;
    counts.set(jobId, (counts.get(jobId) || 0) + 1);
  }

  // Title fallback for apps missing jobId
  const titleToJobId = new Map<string, string>();
  for (const job of jobs) {
    const key = job.title.trim().toLowerCase();
    if (key && !titleToJobId.has(key)) titleToJobId.set(key, job.id);
  }
  for (const application of applications) {
    if (extractApplicationJobId(application)) continue;
    const key = (application.position || "").trim().toLowerCase();
    const jobId = titleToJobId.get(key);
    if (!jobId) continue;
    counts.set(jobId, (counts.get(jobId) || 0) + 1);
  }

  return jobs
    .filter((job) => {
      if (tab === "all") return true;
      return isMyPosition(job, userId);
    })
    .map((job) => ({
      jobId: job.id,
      title: job.title || "Untitled position",
      location: jobLocations[job.id] || "",
      applicantCount: counts.get(job.id) || 0,
      createdBy: job.createdBy ?? null,
      hiringTeamIds: job.hiringTeamIds,
      isActive: job.isActive,
    }))
    .sort((a, b) => {
      if (b.applicantCount !== a.applicantCount) {
        return b.applicantCount - a.applicantCount;
      }
      return a.title.localeCompare(b.title);
    });
}

function splitBulletLines(text: string): string[] {
  return text
    .split(/\n+/)
    .map((line) => line.replace(/^[-•*]\s+/, "").trim())
    .filter(Boolean);
}

function parseJobBlock(block: string): WorkExperienceEntry | null {
  const lines = block
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return null;

  let title = lines[0];
  let company: string | undefined;
  let dates: string | undefined;
  let bulletStart = 1;

  const titleMatch = TITLE_COMPANY_RE.exec(lines[0]);
  if (titleMatch) {
    title = titleMatch[1].trim();
    company = titleMatch[2].trim();
  }

  if (lines[1] && DATE_LINE_RE.test(lines[1])) {
    dates = lines[1];
    bulletStart = 2;
  } else if (lines[1] && !lines[1].startsWith("-") && !lines[1].startsWith("•")) {
    if (!company) company = lines[1];
    bulletStart = 2;
    if (lines[2] && DATE_LINE_RE.test(lines[2])) {
      dates = lines[2];
      bulletStart = 3;
    }
  }

  const bullets = lines
    .slice(bulletStart)
    .map((line) => line.replace(/^[-•*]\s+/, "").trim())
    .filter(Boolean);

  return { title, company, dates, bullets };
}

export function buildExperienceView(
  application: Application
): ExperienceViewModel {
  const rawExperience = getExperienceDisplay(application);
  const aiSummary = application.aiRankSummary?.trim() || "";
  const cvSummary = application.cvProfessionalSummary?.trim() || "";
  const cvJobs = (application.cvWorkExperience || [])
    .map((job) => ({
      title: (job.title || "").trim(),
      company: job.company?.trim() || undefined,
      dates: job.dates?.trim() || undefined,
      bullets: (job.bullets || []).map((b) => String(b).trim()).filter(Boolean),
    }))
    .filter((job) => job.title || job.company || job.bullets.length > 0);

  const blocks = rawExperience
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  const jobs: WorkExperienceEntry[] = [...cvJobs];
  if (jobs.length === 0) {
    for (const block of blocks) {
      const parsed = parseJobBlock(block);
      if (parsed && (parsed.company || parsed.dates || parsed.bullets.length > 0)) {
        jobs.push(parsed);
      }
    }
  }

  // Single-block free text without structure → treat as summary, not a job
  if (jobs.length === 1 && !jobs[0].company && !jobs[0].dates && jobs[0].bullets.length === 0) {
    jobs.length = 0;
  }

  let summary = aiSummary || cvSummary;
  if (!summary && rawExperience) {
    if (jobs.length === 0) {
      summary = rawExperience;
    } else {
      const firstParagraph = blocks[0] || "";
      const looksLikeJob = Boolean(
        TITLE_COMPANY_RE.test(firstParagraph.split("\n")[0] || "") ||
          DATE_LINE_RE.test(firstParagraph)
      );
      if (!looksLikeJob) summary = firstParagraph;
    }
  }

  if (!summary && application.aiRankStrengths?.length) {
    summary = application.aiRankStrengths.slice(0, 3).join(" · ");
  }

  if (jobs.length === 0 && application.aiRankStrengths?.length) {
    jobs.push({
      title: "Highlights",
      bullets: application.aiRankStrengths,
    });
  }

  if (jobs.length === 0 && rawExperience && !summary) {
    const lines = splitBulletLines(rawExperience);
    if (lines.length > 1) {
      summary = lines[0];
      jobs.push({ title: "Experience", bullets: lines.slice(1) });
    }
  }

  return { summary, jobs, rawExperience };
}

export function sourcedByLabel(application: Application): string {
  const source =
    application.hearAbout?.trim() ||
    application.otherSource?.trim() ||
    "Application";
  return source;
}
