import type { Application } from "@/types/application";

export type SourceBreakdownItem = {
  name: string;
  count: number;
  percentage: number;
  color: string;
};

export type FunnelStage = {
  key: string;
  label: string;
  count: number;
  percentage: number;
  href: string;
};

export type JobApplicationCount = {
  jobId: string | null;
  position: string;
  totalApplications: number;
  color: string;
};

export type ApplicationStatusCounts = {
  total: number;
  new: number;
  shortlisted: number;
  interviewing: number;
  hired: number;
  rejected: number;
  technical_assessment: number;
  disqualified: number;
};

export type TrendSeries = {
  labels: string[];
  counts: number[];
};

export const SOURCE_CHART_COLORS = [
  "#3B82F6",
  "#10B981",
  "#8B5CF6",
  "#F59E0B",
  "#EF4444",
  "#EC4899",
  "#0EA5E9",
  "#22C55E",
  "#A855F7",
  "#FB923C",
  "#64748B",
  "#14B8A6",
];

const UNSPECIFIED_LABELS = new Set([
  "",
  "unknown",
  "not specified",
  "n/a",
  "na",
  "none",
]);

export function resolveApplicationSource(application: Application): string {
  const hearAbout = String(application.hearAbout ?? "").trim();
  const normalized = hearAbout.toLowerCase();

  if (UNSPECIFIED_LABELS.has(normalized)) {
    return "Unspecified";
  }

  if (normalized === "other") {
    return "Other";
  }

  return hearAbout;
}

export function resolveApplicationJobId(
  application: Application
): string | null {
  const jobId = application.jobId as unknown;
  if (!jobId) return null;
  if (typeof jobId === "string") return jobId;
  if (typeof jobId === "object" && jobId !== null) {
    const objectId = (jobId as { _id?: string; id?: string })._id
      ?? (jobId as { id?: string }).id;
    return objectId ? String(objectId) : null;
  }
  return null;
}

export function filterApplicationsByJobId(
  applications: Application[],
  jobId: string | null
): Application[] {
  if (!jobId) return applications;
  return applications.filter(
    (application) => resolveApplicationJobId(application) === jobId
  );
}

export function buildSourceBreakdown(
  applications: Application[]
): SourceBreakdownItem[] {
  if (!applications.length) return [];

  const counts = new Map<string, number>();
  for (const application of applications) {
    const source = resolveApplicationSource(application);
    counts.set(source, (counts.get(source) || 0) + 1);
  }

  const total = applications.length;
  return Array.from(counts.entries())
    .map(([name, count], index) => ({
      name,
      count,
      percentage: total > 0 ? (count / total) * 100 : 0,
      color: SOURCE_CHART_COLORS[index % SOURCE_CHART_COLORS.length],
    }))
    .sort((a, b) => b.count - a.count);
}

export function buildApplicationsByJob(
  applications: Application[],
  jobTitles: Record<string, string> = {}
): JobApplicationCount[] {
  if (!applications.length) return [];

  const byJob = new Map<
    string,
    { jobId: string | null; position: string; totalApplications: number }
  >();

  for (const application of applications) {
    const jobId = resolveApplicationJobId(application);
    const fromTitles = jobId ? jobTitles[jobId] : undefined;
    const fromJobObject =
      application.jobId &&
      typeof application.jobId === "object" &&
      (application.jobId as { title?: string }).title
        ? String((application.jobId as { title?: string }).title)
        : null;
    const fromDetails = application.jobDetails?.title?.trim() || null;
    const fromPosition =
      application.position &&
      application.position.trim() !== "" &&
      application.position !== "NOT SET"
        ? application.position.trim()
        : null;

    const position =
      fromTitles ||
      fromJobObject ||
      fromDetails ||
      fromPosition ||
      "Unknown Position";

    const groupKey = jobId || position.toLowerCase();
    const existing = byJob.get(groupKey);
    if (existing) {
      existing.totalApplications += 1;
      if (!existing.jobId && jobId) existing.jobId = jobId;
      if (
        existing.position === "Unknown Position" &&
        position !== "Unknown Position"
      ) {
        existing.position = position;
      }
    } else {
      byJob.set(groupKey, {
        jobId,
        position,
        totalApplications: 1,
      });
    }
  }

  return Array.from(byJob.values())
    .filter((entry) => {
      const normalized = entry.position.trim();
      return (
        normalized.length > 0 &&
        normalized !== "Unknown Position" &&
        normalized !== "Position Not Available"
      );
    })
    .sort((a, b) => b.totalApplications - a.totalApplications)
    .map((entry, index) => ({
      ...entry,
      color: SOURCE_CHART_COLORS[index % SOURCE_CHART_COLORS.length],
    }));
}

export function buildStatusCountsFromApplications(
  applications: Application[]
): ApplicationStatusCounts {
  const counts: ApplicationStatusCounts = {
    total: applications.length,
    new: 0,
    shortlisted: 0,
    interviewing: 0,
    hired: 0,
    rejected: 0,
    technical_assessment: 0,
    disqualified: 0,
  };

  for (const application of applications) {
    const status = String(application.status || "").toLowerCase();
    if (status === "new") counts.new += 1;
    else if (status === "shortlisted") counts.shortlisted += 1;
    else if (status === "interviewing") counts.interviewing += 1;
    else if (status === "hired") counts.hired += 1;
    else if (status === "rejected") counts.rejected += 1;
    else if (
      status === "technical_assessment" ||
      status === "technical-assessment"
    ) {
      counts.technical_assessment += 1;
    } else if (status === "disqualified") counts.disqualified += 1;
  }

  return counts;
}

export function buildPipelineFunnel(stats: {
  new?: number;
  shortlisted?: number;
  technical_assessment?: number;
  interviewing?: number;
  hired?: number;
  disqualified?: number;
  total?: number;
}): FunnelStage[] {
  const total = Math.max(stats.total || 0, 1);
  const stages: FunnelStage[] = [
    {
      key: "new",
      label: "Applied",
      count: stats.new || 0,
      percentage: ((stats.new || 0) / total) * 100,
      href: "/manage/candidates?status=new",
    },
    {
      key: "shortlisted",
      label: "Shortlisted",
      count: stats.shortlisted || 0,
      percentage: ((stats.shortlisted || 0) / total) * 100,
      href: "/manage/shortlisted",
    },
    {
      key: "technical",
      label: "Technical",
      count: stats.technical_assessment || 0,
      percentage: ((stats.technical_assessment || 0) / total) * 100,
      href: "/manage/technical-assessment",
    },
    {
      key: "interviewing",
      label: "Interviewing",
      count: stats.interviewing || 0,
      percentage: ((stats.interviewing || 0) / total) * 100,
      href: "/manage/interviewing",
    },
    {
      key: "hired",
      label: "Hired",
      count: stats.hired || 0,
      percentage: ((stats.hired || 0) / total) * 100,
      href: "/manage/hired",
    },
    {
      key: "disqualified",
      label: "Disqualified",
      count: stats.disqualified || 0,
      percentage: ((stats.disqualified || 0) / total) * 100,
      href: "/manage/disqualified",
    },
  ];

  return stages;
}

export function buildTrendFromApplications(
  applications: Application[],
  days = 30
): TrendSeries {
  const now = Date.now();
  const windowMs = days * 24 * 60 * 60 * 1000;
  const trendMap = new Map<string, number>();

  for (const application of applications) {
    const applied = new Date(application.appliedDate).getTime();
    if (Number.isNaN(applied)) continue;
    if (applied < now - windowMs) continue;
    const dayKey = new Date(applied).toISOString().split("T")[0];
    trendMap.set(dayKey, (trendMap.get(dayKey) || 0) + 1);
  }

  const labels: string[] = [];
  const counts: number[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(now - i * 24 * 60 * 60 * 1000);
    const dayKey = date.toISOString().split("T")[0];
    labels.push(
      date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
    );
    counts.push(trendMap.get(dayKey) || 0);
  }

  return { labels, counts };
}

function toValidDate(value: unknown): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Average calendar days from applied → hired for applications with both dates. */
export function computeAverageTimeToHireDays(
  applications: Application[]
): number | null {
  const durations: number[] = [];

  for (const application of applications) {
    const status = String(application.status || "").toLowerCase();
    if (status !== "hired") continue;

    const applied = toValidDate(application.appliedDate || application.createdAt);
    const hired = toValidDate(application.hireDate || application.updatedAt);
    if (!applied || !hired) continue;

    const days = Math.round(
      (hired.getTime() - applied.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (days >= 0 && days < 730) {
      durations.push(days);
    }
  }

  if (!durations.length) return null;
  return Math.round(
    durations.reduce((sum, days) => sum + days, 0) / durations.length
  );
}

export function computeHireRate(stats: {
  hired?: number;
  total?: number;
}): number | null {
  const total = stats.total || 0;
  if (total <= 0) return null;
  return ((stats.hired || 0) / total) * 100;
}

/** SHRM-style industry benchmark for average time-to-hire (calendar days). */
export const INDUSTRY_AVG_TIME_TO_HIRE_DAYS = 42;

export type TimeToHireRangeDays = 7 | 30 | 90;

export type TimeToHireStageKey =
  | "appliedToShortlisted"
  | "shortlistedToInterview"
  | "interviewToOffer"
  | "acceptance";

export type TimeToHireStageSummary = {
  key: TimeToHireStageKey;
  label: string;
  avgDays: number | null;
  color: string;
};

export type TimeToHireChartMode = "stage-days" | "overall-days" | "hire-counts";

export type AverageTimeToHireReport = {
  rangeDays: TimeToHireRangeDays;
  hireCount: number;
  overallAvgDays: number | null;
  industryBenchmarkDays: number;
  /** Positive = faster than industry; null when comparison is not meaningful. */
  industryComparisonPercent: number | null;
  hasStageBreakdown: boolean;
  mode: TimeToHireChartMode;
  stages: TimeToHireStageSummary[];
  labels: string[];
  datasets: Array<{
    key: string;
    label: string;
    color: string;
    values: number[];
  }>;
};

const TTH_STAGE_META: Array<{
  key: TimeToHireStageKey;
  label: string;
  color: string;
}> = [
  {
    key: "appliedToShortlisted",
    label: "Applied to Shortlisted",
    color: "#272156",
  },
  {
    key: "shortlistedToInterview",
    label: "Shortlisted to Interview",
    color: "#4A6FA5",
  },
  {
    key: "interviewToOffer",
    label: "Interview to Offer",
    color: "#0D9488",
  },
  {
    key: "acceptance",
    label: "Acceptance",
    color: "#5EEAD4",
  },
];

const OFFER_STATUS_ALIASES = new Set([
  "offer",
  "offer extended",
  "made offer",
  "offered",
]);

function daysBetween(start: Date, end: Date): number | null {
  const ms = end.getTime() - start.getTime();
  if (ms < 0) return null;
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

function averagePositive(values: number[]): number | null {
  if (!values.length) return null;
  return (
    Math.round(
      (values.reduce((sum, value) => sum + value, 0) / values.length) * 10
    ) / 10
  );
}

function normalizeStatusLabel(status: unknown): string {
  return String(status || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ");
}

function firstHistoryDate(
  application: Application,
  statusMatchers: (status: string) => boolean
): Date | null {
  const history = application.statusHistory;
  if (!history?.length) return null;

  const matches = history
    .map((entry) => {
      const date = toValidDate(entry.date);
      if (!date) return null;
      const status = normalizeStatusLabel(entry.status);
      if (!statusMatchers(status)) return null;
      return date;
    })
    .filter((date): date is Date => Boolean(date))
    .sort((a, b) => a.getTime() - b.getTime());

  return matches[0] ?? null;
}

function resolveHireMilestones(application: Application): {
  applied: Date | null;
  shortlisted: Date | null;
  interviewing: Date | null;
  offer: Date | null;
  hired: Date | null;
  start: Date | null;
} {
  const applied = toValidDate(application.appliedDate || application.createdAt);
  const shortlisted =
    toValidDate(application.shortlistedDate) ||
    firstHistoryDate(
      application,
      (status) => status === "shortlisted" || status === "in review"
    );
  const interviewing =
    toValidDate(application.interviewDate) ||
    firstHistoryDate(
      application,
      (status) => status === "interviewing" || status === "interview"
    );
  const offer = firstHistoryDate(application, (status) =>
    OFFER_STATUS_ALIASES.has(status)
  );
  const hired =
    toValidDate(application.hireDate) ||
    firstHistoryDate(application, (status) => status === "hired") ||
    (normalizeStatusLabel(application.status) === "hired"
      ? toValidDate(application.updatedAt || application.lastUpdated)
      : null);
  const start = toValidDate(application.startDate);

  return { applied, shortlisted, interviewing, offer, hired, start };
}

function stageDurationsForHire(application: Application): {
  totalDays: number;
  stages: Partial<Record<TimeToHireStageKey, number>>;
  hasAnyStage: boolean;
} | null {
  const status = normalizeStatusLabel(application.status);
  if (status !== "hired") return null;

  const { applied, shortlisted, interviewing, offer, hired, start } =
    resolveHireMilestones(application);
  if (!applied || !hired) return null;

  const totalDays = daysBetween(applied, hired);
  if (totalDays == null || totalDays < 0 || totalDays >= 730) return null;

  const stages: Partial<Record<TimeToHireStageKey, number>> = {};
  let accounted = 0;

  const appliedToShortlisted =
    shortlisted && daysBetween(applied, shortlisted);
  if (appliedToShortlisted != null) {
    stages.appliedToShortlisted = appliedToShortlisted;
    accounted += appliedToShortlisted;
  }

  const shortlistedAnchor = shortlisted || applied;
  const shortlistedToInterview =
    interviewing && daysBetween(shortlistedAnchor, interviewing);
  if (shortlistedToInterview != null) {
    stages.shortlistedToInterview = shortlistedToInterview;
    accounted += shortlistedToInterview;
  }

  const interviewAnchor = interviewing || shortlisted || applied;
  const offerOrHired = offer || hired;
  const interviewToOffer = daysBetween(interviewAnchor, offerOrHired);
  if (interviewing && interviewToOffer != null) {
    stages.interviewToOffer = interviewToOffer;
    accounted += interviewToOffer;
  }

  let acceptance: number | null = null;
  if (offer && hired) {
    acceptance = daysBetween(offer, hired);
  } else if (hired && start && start.getTime() >= hired.getTime()) {
    acceptance = daysBetween(hired, start);
  } else if (
    Object.keys(stages).length > 0 &&
    totalDays > accounted
  ) {
    acceptance = totalDays - accounted;
  }

  if (acceptance != null && acceptance >= 0) {
    stages.acceptance = acceptance;
  }

  return {
    totalDays,
    stages,
    hasAnyStage: Object.keys(stages).length > 0,
  };
}

function buildPeriodBuckets(
  rangeDays: TimeToHireRangeDays,
  now: Date
): Array<{ key: string; label: string; start: Date; end: Date }> {
  const endMs = now.getTime();
  const startMs = endMs - rangeDays * 24 * 60 * 60 * 1000;

  if (rangeDays === 90) {
    const buckets: Array<{ key: string; label: string; start: Date; end: Date }> =
      [];
    const cursor = new Date(now.getFullYear(), now.getMonth(), 1);
    for (let i = 0; i < 3; i += 1) {
      const monthStart = new Date(cursor.getFullYear(), cursor.getMonth() - i, 1);
      const monthEnd = new Date(
        cursor.getFullYear(),
        cursor.getMonth() - i + 1,
        0,
        23,
        59,
        59,
        999
      );
      if (monthEnd.getTime() < startMs) continue;
      buckets.unshift({
        key: `${monthStart.getFullYear()}-${monthStart.getMonth()}`,
        label: monthStart.toLocaleDateString("en-US", {
          month: "short",
          year: "2-digit",
        }),
        start: monthStart.getTime() < startMs ? new Date(startMs) : monthStart,
        end: monthEnd.getTime() > endMs ? new Date(endMs) : monthEnd,
      });
    }
    return buckets;
  }

  const weekCount = rangeDays === 7 ? 1 : 4;
  const buckets: Array<{ key: string; label: string; start: Date; end: Date }> =
    [];
  for (let i = weekCount - 1; i >= 0; i -= 1) {
    const weekEnd = new Date(endMs - i * 7 * 24 * 60 * 60 * 1000);
    const weekStart = new Date(
      Math.max(startMs, weekEnd.getTime() - 6 * 24 * 60 * 60 * 1000)
    );
    buckets.push({
      key: weekStart.toISOString().slice(0, 10),
      label: weekStart.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      start: weekStart,
      end: weekEnd,
    });
  }
  return buckets;
}

function isHiredInRange(
  application: Application,
  rangeStart: Date,
  rangeEnd: Date
): boolean {
  const status = normalizeStatusLabel(application.status);
  if (status !== "hired") return false;
  const hired =
    toValidDate(application.hireDate) ||
    firstHistoryDate(application, (s) => s === "hired") ||
    toValidDate(application.updatedAt || application.lastUpdated);
  if (!hired) return false;
  const t = hired.getTime();
  return t >= rangeStart.getTime() && t <= rangeEnd.getTime();
}

/**
 * Stage-aware average time-to-hire for Reports.
 * Uses hireDate / statusHistory / legacy milestone dates when present;
 * falls back to overall avg or hire counts so bars stay honest.
 */
export function buildAverageTimeToHireReport(
  applications: Application[],
  rangeDays: TimeToHireRangeDays = 30,
  now: Date = new Date()
): AverageTimeToHireReport {
  const rangeEnd = now;
  const rangeStart = new Date(
    now.getTime() - rangeDays * 24 * 60 * 60 * 1000
  );

  const hiredInRange = applications.filter((application) =>
    isHiredInRange(application, rangeStart, rangeEnd)
  );

  const hireDurations: Array<{
    hiredAt: Date;
    totalDays: number;
    stages: Partial<Record<TimeToHireStageKey, number>>;
    hasAnyStage: boolean;
  }> = [];

  for (const application of hiredInRange) {
    const parsed = stageDurationsForHire(application);
    if (!parsed) continue;
    const hiredAt =
      toValidDate(application.hireDate) ||
      firstHistoryDate(application, (s) => s === "hired") ||
      toValidDate(application.updatedAt || application.lastUpdated);
    if (!hiredAt) continue;
    hireDurations.push({
      hiredAt,
      totalDays: parsed.totalDays,
      stages: parsed.stages,
      hasAnyStage: parsed.hasAnyStage,
    });
  }

  const overallAvgDays = averagePositive(
    hireDurations.map((entry) => entry.totalDays)
  );

  const stageSampleCounts: Record<TimeToHireStageKey, number[]> = {
    appliedToShortlisted: [],
    shortlistedToInterview: [],
    interviewToOffer: [],
    acceptance: [],
  };

  for (const entry of hireDurations) {
    for (const meta of TTH_STAGE_META) {
      const value = entry.stages[meta.key];
      if (typeof value === "number" && value >= 0) {
        stageSampleCounts[meta.key].push(value);
      }
    }
  }

  const stages: TimeToHireStageSummary[] = TTH_STAGE_META.map((meta) => ({
    key: meta.key,
    label: meta.label,
    avgDays: averagePositive(stageSampleCounts[meta.key]),
    color: meta.color,
  }));

  const stagesWithData = stages.filter((stage) => stage.avgDays != null);
  const hasStageBreakdown = stagesWithData.length >= 2;

  let industryComparisonPercent: number | null = null;
  if (overallAvgDays != null && overallAvgDays > 0 && hireDurations.length > 0) {
    industryComparisonPercent = Math.round(
      ((INDUSTRY_AVG_TIME_TO_HIRE_DAYS - overallAvgDays) /
        INDUSTRY_AVG_TIME_TO_HIRE_DAYS) *
        100
    );
  }

  const buckets = buildPeriodBuckets(rangeDays, now);
  const labels = buckets.map((bucket) => bucket.label);

  let mode: TimeToHireChartMode = "hire-counts";
  let datasets: AverageTimeToHireReport["datasets"] = [];

  if (hasStageBreakdown) {
    mode = "stage-days";
    datasets = TTH_STAGE_META.map((meta) => ({
      key: meta.key,
      label: meta.label,
      color: meta.color,
      values: buckets.map((bucket) => {
        const inBucket = hireDurations.filter(
          (entry) =>
            entry.hiredAt.getTime() >= bucket.start.getTime() &&
            entry.hiredAt.getTime() <= bucket.end.getTime()
        );
        if (!inBucket.length) return 0;
        const values = inBucket
          .map((entry) => entry.stages[meta.key])
          .filter((value): value is number => typeof value === "number");
        return averagePositive(values) ?? 0;
      }),
    }));
  } else if (overallAvgDays != null) {
    mode = "overall-days";
    datasets = [
      {
        key: "overall",
        label: "Avg days to hire",
        color: "#0D9488",
        values: buckets.map((bucket) => {
          const inBucket = hireDurations.filter(
            (entry) =>
              entry.hiredAt.getTime() >= bucket.start.getTime() &&
              entry.hiredAt.getTime() <= bucket.end.getTime()
          );
          return (
            averagePositive(inBucket.map((entry) => entry.totalDays)) ?? 0
          );
        }),
      },
    ];
  } else {
    mode = "hire-counts";
    datasets = [
      {
        key: "hires",
        label: "Hires",
        color: "#4A6FA5",
        values: buckets.map((bucket) =>
          hiredInRange.filter((application) => {
            const hired =
              toValidDate(application.hireDate) ||
              firstHistoryDate(application, (s) => s === "hired") ||
              toValidDate(application.updatedAt || application.lastUpdated);
            if (!hired) return false;
            return (
              hired.getTime() >= bucket.start.getTime() &&
              hired.getTime() <= bucket.end.getTime()
            );
          }).length
        ),
      },
    ];
  }

  return {
    rangeDays,
    hireCount: hireDurations.length || hiredInRange.length,
    overallAvgDays,
    industryBenchmarkDays: INDUSTRY_AVG_TIME_TO_HIRE_DAYS,
    industryComparisonPercent,
    hasStageBreakdown,
    mode,
    stages,
    labels,
    datasets,
  };
}
