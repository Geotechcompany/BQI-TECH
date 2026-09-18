"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import {
  ArrowRight,
  Briefcase,
  CheckCircle,
  Clock,
  Code,
  Download,
  FileText,
  MessageSquare,
  Printer,
  Target,
  TrendingUp,
  UserCheck,
  Users,
  XCircle,
} from "lucide-react";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import { AdminPageWelcomeBanner } from "@/components/admin/AdminPageWelcomeBanner";
import { TourPageHelper } from "@/components/admin/tour/TourPageHelper";
import { AdminTrendChart } from "@/components/admin/AdminTrendChart";
import { AverageTimeToHireCard } from "@/components/admin/AverageTimeToHireCard";
import { ByJobEmptyState } from "@/components/admin/ByJobEmptyState";
import { TrendsEmptyState } from "@/components/admin/TrendsEmptyState";
import {
  PremiumMetricCard,
  PremiumStatusCard,
} from "@/components/admin/premium-cards";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { adminApi } from "@/lib/api-backend";
import { adminApplicationsApi } from "@/components/admin/utils/applications-api";
import {
  normalizeTrendSeries,
  trendSeriesHasActivity,
} from "@/lib/normalize-trend-data";
import {
  SOURCE_CHART_COLORS,
  buildApplicationsByJob,
  buildAverageTimeToHireReport,
  buildPipelineFunnel,
  buildSourceBreakdown,
  buildStatusCountsFromApplications,
  buildTrendFromApplications,
  computeAverageTimeToHireDays,
  computeHireRate,
  filterApplicationsByJobId,
  type JobApplicationCount,
  type SourceBreakdownItem,
  type TimeToHireRangeDays,
} from "@/lib/reports-aggregates";
import {
  downloadReportsCsv,
  printReportsPdf,
  type ReportsExportPayload,
} from "@/lib/reports-export";
import type { Application } from "@/types/application";
import { cn } from "@/lib/utils";
import { toast } from "react-hot-toast";

ChartJS.register(ArcElement, Tooltip, Legend);

const ALL_POSITIONS = "all";

type JobOption = {
  id: string;
  title: string;
  isActive: boolean;
};

interface OverviewData {
  applications: {
    total: number;
    new: number;
    shortlisted: number;
    interviewing: number;
    hired: number;
    rejected: number;
    technical_assessment: number;
    disqualified: number;
    recent: number;
  };
  jobs: {
    total: number;
    active: number;
  };
}

function SourceLegend({ items }: { items: SourceBreakdownItem[] }) {
  return (
    <ul className="space-y-3 max-h-80 overflow-y-auto pr-1">
      {items.map((item) => (
        <li key={item.name} className="space-y-1.5">
          <div className="flex items-center justify-between gap-3 text-sm">
            <Link
              href={`/manage/candidates?search=${encodeURIComponent(item.name)}`}
              className="font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 truncate"
              title={`View applications from ${item.name}`}
            >
              {item.name}
            </Link>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {item.count}
              <span className="ml-2 text-foreground/80">
                {item.percentage.toFixed(1)}%
              </span>
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.max(item.percentage, 1.5)}%`,
                backgroundColor: item.color,
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function JobLegend({ items }: { items: JobApplicationCount[] }) {
  return (
    <ul className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
      {items.map((item) => (
        <li key={`${item.jobId ?? item.position}`} className="flex items-center gap-2 text-sm">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: item.color }}
          />
          <span className="truncate flex-1" title={item.position}>
            {item.position}
          </span>
          <span className="shrink-0 tabular-nums text-muted-foreground">
            {item.totalApplications}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function ReportsPage() {
  const [overviewData, setOverviewData] = useState<OverviewData | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [jobs, setJobs] = useState<JobOption[]>([]);
  const [apiByJob, setApiByJob] = useState<
    Array<{ jobId?: string | null; position: string; totalApplications: number }>
  >([]);
  const [trendData, setTrendData] = useState<{
    trends?: Array<{ date?: string; count?: number }>;
  } | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string>(ALL_POSITIONS);
  const [tthRangeDays, setTthRangeDays] =
    useState<TimeToHireRangeDays>(30);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedOnceRef = useRef(false);

  const loadReportsData = useCallback(async () => {
    try {
      if (hasLoadedOnceRef.current) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      const jobFilter =
        selectedJobId === ALL_POSITIONS ? undefined : selectedJobId;

      const [
        overviewResult,
        appsResult,
        trendsResult,
        jobsResult,
        byJobResult,
      ] = await Promise.allSettled([
        adminApi.getOverview(jobFilter),
        adminApplicationsApi.getAllApplicationsPaginated({
          limit: 100,
          ...(jobFilter ? { jobId: jobFilter } : {}),
        }),
        adminApi.getTrends(30, jobFilter),
        adminApi.getJobPostings({ limit: 100 }),
        adminApi.getApplicationsByJob(jobFilter),
      ]);

      if (overviewResult.status === "fulfilled") {
        setOverviewData(overviewResult.value);
      } else {
        throw overviewResult.reason;
      }

      if (appsResult.status === "fulfilled") {
        setApplications(appsResult.value?.applications || []);
      }

      if (trendsResult.status === "fulfilled") {
        setTrendData(trendsResult.value);
      }

      if (jobsResult.status === "fulfilled") {
        const rawJobs = Array.isArray(jobsResult.value)
          ? jobsResult.value
          : jobsResult.value?.jobPostings || [];
        const options: JobOption[] = rawJobs
          .map((job: { id?: string; _id?: string; title?: string; isActive?: boolean }) => {
            const id = job?.id || (job?._id ? String(job._id) : null);
            if (!id || !job?.title) return null;
            return {
              id: String(id),
              title: String(job.title),
              isActive: Boolean(job.isActive),
            };
          })
          .filter(Boolean) as JobOption[];
        options.sort((a, b) => a.title.localeCompare(b.title));
        setJobs(options);
      }

      if (byJobResult.status === "fulfilled") {
        const payload = byJobResult.value;
        setApiByJob(payload?.applicationsByJob || []);
      }

      hasLoadedOnceRef.current = true;
    } catch (err) {
      console.error("Failed to load reports data:", err);
      setError("Failed to load reports data");
      toast.error("Failed to load reports data");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedJobId]);

  useEffect(() => {
    loadReportsData();
  }, [loadReportsData]);

  const jobTitles = useMemo(() => {
    const map: Record<string, string> = {};
    for (const job of jobs) {
      map[job.id] = job.title;
    }
    return map;
  }, [jobs]);

  const selectedJob = useMemo(
    () => jobs.find((job) => job.id === selectedJobId) ?? null,
    [jobs, selectedJobId]
  );

  const scopeLabel =
    selectedJobId === ALL_POSITIONS
      ? "All Positions"
      : selectedJob?.title || "Selected Position";

  const scopedApplications = useMemo(
    () =>
      selectedJobId === ALL_POSITIONS
        ? applications
        : filterApplicationsByJobId(applications, selectedJobId),
    [applications, selectedJobId]
  );

  const statusCounts = useMemo(() => {
    if (selectedJobId === ALL_POSITIONS && overviewData) {
      return overviewData.applications;
    }
    return buildStatusCountsFromApplications(scopedApplications);
  }, [overviewData, scopedApplications, selectedJobId]);

  const sourceBreakdown = useMemo(
    () => buildSourceBreakdown(scopedApplications),
    [scopedApplications]
  );

  const avgTimeToHire = useMemo(
    () => computeAverageTimeToHireDays(scopedApplications),
    [scopedApplications]
  );

  const timeToHireReport = useMemo(
    () => buildAverageTimeToHireReport(scopedApplications, tthRangeDays),
    [scopedApplications, tthRangeDays]
  );

  const funnelStages = useMemo(
    () => buildPipelineFunnel(statusCounts),
    [statusCounts]
  );

  const hireRate = useMemo(
    () => computeHireRate(statusCounts),
    [statusCounts]
  );

  const fallbackTrend = useMemo(
    () => buildTrendFromApplications(scopedApplications, 30),
    [scopedApplications]
  );

  const trendSeries = useMemo(
    () => normalizeTrendSeries(trendData?.trends, fallbackTrend),
    [trendData?.trends, fallbackTrend]
  );

  const byJobBreakdown = useMemo(() => {
    if (
      selectedJobId === ALL_POSITIONS &&
      apiByJob.length > 0
    ) {
      return apiByJob
        .filter((entry) => {
          const position = (entry.position || "").trim();
          return (
            position.length > 0 &&
            position !== "Unknown Position" &&
            position !== "Position Not Available"
          );
        })
        .map((entry, index) => ({
          jobId: entry.jobId ? String(entry.jobId) : null,
          position: entry.position,
          totalApplications: entry.totalApplications || 0,
          color: SOURCE_CHART_COLORS[index % SOURCE_CHART_COLORS.length],
        }))
        .sort((a, b) => b.totalApplications - a.totalApplications);
    }
    return buildApplicationsByJob(scopedApplications, jobTitles);
  }, [apiByJob, scopedApplications, jobTitles, selectedJobId]);

  const activeJobsCount = useMemo(() => {
    if (selectedJobId === ALL_POSITIONS) {
      return overviewData?.jobs.active ?? jobs.filter((j) => j.isActive).length;
    }
    return selectedJob?.isActive ? 1 : 0;
  }, [selectedJobId, overviewData, jobs, selectedJob]);

  const sourceDoughnut = useMemo(
    () => ({
      labels: sourceBreakdown.map((item) => item.name),
      datasets: [
        {
          data: sourceBreakdown.map((item) => item.count),
          backgroundColor: sourceBreakdown.map((item) => item.color),
          borderColor: sourceBreakdown.map((item) => item.color),
          borderWidth: 2,
          hoverOffset: 6,
        },
      ],
    }),
    [sourceBreakdown]
  );

  const jobDoughnut = useMemo(
    () => ({
      labels: byJobBreakdown.map((item) => {
        const position = item.position;
        return position.length > 22
          ? `${position.substring(0, 22)}…`
          : position;
      }),
      datasets: [
        {
          data: byJobBreakdown.map((item) => item.totalApplications),
          backgroundColor: byJobBreakdown.map((item) => item.color),
          borderColor: byJobBreakdown.map((item) => item.color),
          borderWidth: 2,
          hoverOffset: 6,
        },
      ],
    }),
    [byJobBreakdown]
  );

  const doughnutOptions = useMemo(
    () => ({
      cutout: "68%",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "hsl(var(--popover))",
          titleColor: "hsl(var(--popover-foreground))",
          bodyColor: "hsl(var(--popover-foreground))",
          borderColor: "hsl(var(--border))",
          borderWidth: 1,
          callbacks: {
            label: (context: { dataIndex: number; parsed: number }) => {
              const count = context.parsed ?? 0;
              return `${count} application${count === 1 ? "" : "s"}`;
            },
          },
        },
      },
    }),
    []
  );

  const sourceDoughnutOptions = useMemo(
    () => ({
      ...doughnutOptions,
      plugins: {
        ...doughnutOptions.plugins,
        tooltip: {
          ...doughnutOptions.plugins.tooltip,
          callbacks: {
            label: (context: { dataIndex: number; parsed: number }) => {
              const item = sourceBreakdown[context.dataIndex];
              const count = item?.count ?? context.parsed ?? 0;
              const pct = item?.percentage?.toFixed(1) ?? "0.0";
              return `${count} application${count === 1 ? "" : "s"} (${pct}%)`;
            },
          },
        },
      },
    }),
    [doughnutOptions, sourceBreakdown]
  );

  const buildExportPayload = useCallback((): ReportsExportPayload => {
    return {
      scopeLabel,
      generatedAt: new Date(),
      summary: {
        totalApplications: statusCounts.total,
        activeJobs: activeJobsCount,
        avgTimeToHireDays: avgTimeToHire,
        hireRatePercent: hireRate,
      },
      sources: sourceBreakdown,
      byJob: byJobBreakdown,
      trends: trendSeries,
      funnel: funnelStages,
    };
  }, [
    scopeLabel,
    statusCounts.total,
    activeJobsCount,
    avgTimeToHire,
    hireRate,
    sourceBreakdown,
    byJobBreakdown,
    trendSeries,
    funnelStages,
  ]);

  const handleExportCsv = () => {
    try {
      downloadReportsCsv(buildExportPayload());
      toast.success("Report CSV downloaded");
    } catch (err) {
      console.error(err);
      toast.error("Failed to export CSV");
    }
  };

  const handleExportPdf = () => {
    try {
      printReportsPdf(buildExportPayload());
    } catch (err) {
      console.error(err);
      toast.error(
        err instanceof Error ? err.message : "Failed to open print dialog"
      );
    }
  };

  if (isLoading) {
    return (
      <AdminPageLayout title="Reports" showSearch={false}>
        <div className="space-y-5 px-4 md:px-6 pb-6 pt-2 w-full max-w-none">
          <Skeleton className="h-24 rounded-2xl" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
            <Skeleton className="h-96 lg:col-span-3 rounded-2xl" />
            <Skeleton className="h-96 lg:col-span-2 rounded-2xl" />
          </div>
        </div>
      </AdminPageLayout>
    );
  }

  if (error || !overviewData) {
    return (
      <AdminPageLayout title="Reports" showSearch={false}>
        <div className="min-h-[50vh] flex items-center justify-center px-4">
          <div className="text-center py-12">
            <div className="bg-destructive/10 rounded-full p-4 w-16 h-16 mx-auto mb-4">
              <XCircle className="h-8 w-8 text-destructive" />
            </div>
            <h2 className="text-2xl font-bold mb-4 text-foreground">
              Something went wrong
            </h2>
            <p className="text-muted-foreground mb-6">
              {error || "Reports data is unavailable"}
            </p>
            <Button onClick={loadReportsData}>
              <ArrowRight className="mr-2 h-4 w-4" />
              Try Again
            </Button>
          </div>
        </div>
      </AdminPageLayout>
    );
  }

  const hasApplications = statusCounts.total > 0;

  return (
    <AdminPageLayout
      title="Reports"
      showSearch={false}
      tourId="reports"
      guideInBanner
      headerActions={
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="secondary"
              className="flex items-center gap-2"
              data-tour="reports-export"
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel>Export Options</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleExportCsv}>
              <FileText className="h-4 w-4 mr-2" />
              Download CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportPdf}>
              <Printer className="h-4 w-4 mr-2" />
              Print / Save PDF
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      }
    >
      <TourPageHelper tourId="reports" />
      <div className="min-h-screen bg-background">
        <div className="space-y-5 px-4 md:px-6 pb-6 pt-2 w-full max-w-none">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
            <AdminPageWelcomeBanner
              tourId="reports"
              bannerKey="reports"
              className="flex-1"
              subtitle={
                isRefreshing
                  ? "Updating metrics from live hiring data…"
                  : undefined
              }
            />
            <div
              className="flex flex-col justify-center gap-1.5 w-full sm:w-72 shrink-0 rounded-xl border border-border/60 bg-card/80 px-4 py-3"
              data-tour="reports-position-filter"
            >
              <Label htmlFor="reports-position-filter" className="text-xs font-medium text-muted-foreground">
                Position scope
              </Label>
              <Select value={selectedJobId} onValueChange={setSelectedJobId}>
                <SelectTrigger id="reports-position-filter" className="w-full bg-background">
                  <SelectValue placeholder="All Positions" />
                </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_POSITIONS}>All Positions</SelectItem>
                    {jobs.map((job) => (
                      <SelectItem key={job.id} value={job.id}>
                        {job.title}
                        {!job.isActive ? " (inactive)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

          <div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
            data-tour="reports-metrics"
          >
            <PremiumMetricCard
              title="Total Applications"
              value={statusCounts.total}
              icon={FileText}
              variant="blue"
              path="/manage/candidates"
              subtitle={scopeLabel}
            />
            {selectedJobId === ALL_POSITIONS ? (
              <PremiumMetricCard
                title="Active Jobs"
                value={activeJobsCount}
                icon={Briefcase}
                variant="green"
                path="/manage/job-postings"
                subtitle="Currently hiring"
              />
            ) : (
              <Link
                href={`/manage/jobs/${selectedJobId}/pipeline`}
                className="block group"
              >
                <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-emerald-50/90 via-white to-white dark:from-emerald-950/40 dark:via-card dark:to-card shadow-sm p-4 h-full transition-shadow group-hover:shadow-xl">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-md shadow-emerald-500/30">
                      <Briefcase className="h-5 w-5 text-white" strokeWidth={2} />
                    </div>
                    <div className="min-w-0 flex-1 text-right sm:text-left">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                        Position Status
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                        {selectedJob?.title || "Selected position"}
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 text-2xl font-bold tracking-tight">
                    {selectedJob?.isActive ? "Active" : "Inactive"}
                  </p>
                </div>
              </Link>
            )}
            <Link href="/manage/hired" className="block group">
              <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-violet-50/90 via-white to-white dark:from-violet-950/40 dark:via-card dark:to-card shadow-sm p-4 h-full transition-shadow group-hover:shadow-xl">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-md shadow-violet-500/30">
                    <Clock className="h-5 w-5 text-white" strokeWidth={2} />
                  </div>
                  <div className="min-w-0 flex-1 text-right sm:text-left">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                      Avg. Time to Hire
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                      {avgTimeToHire == null
                        ? "No hires with dates yet"
                        : "Days from applied to hired"}
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-2xl font-bold tracking-tight tabular-nums">
                  {avgTimeToHire == null ? "N/A" : `${avgTimeToHire}d`}
                </p>
              </div>
            </Link>
            <Link href="/manage/hired" className="block group">
              <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-orange-50/90 via-white to-white dark:from-orange-950/40 dark:via-card dark:to-card shadow-sm p-4 h-full transition-shadow group-hover:shadow-xl">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 shadow-md shadow-orange-500/30">
                    <Users className="h-5 w-5 text-white" strokeWidth={2} />
                  </div>
                  <div className="min-w-0 flex-1 text-right sm:text-left">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                      Hire Rate
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                      {hireRate == null
                        ? "No applications yet"
                        : "% of applications hired"}
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-2xl font-bold tracking-tight tabular-nums">
                  {hireRate == null ? "N/A" : `${hireRate.toFixed(1)}%`}
                </p>
              </div>
            </Link>
          </div>

          <div
            className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3"
            data-tour="reports-status-metrics"
          >
            <PremiumStatusCard
              title="New"
              count={statusCounts.new}
              percentage={
                statusCounts.total > 0
                  ? (statusCounts.new / statusCounts.total) * 100
                  : 0
              }
              icon={FileText}
              variant="blue"
              clickable={false}
            />
            <PremiumStatusCard
              title="Shortlisted"
              count={statusCounts.shortlisted}
              percentage={
                statusCounts.total > 0
                  ? (statusCounts.shortlisted / statusCounts.total) * 100
                  : 0
              }
              icon={UserCheck}
              variant="green"
              clickable={false}
            />
            <PremiumStatusCard
              title="Interviewing"
              count={statusCounts.interviewing}
              percentage={
                statusCounts.total > 0
                  ? (statusCounts.interviewing / statusCounts.total) * 100
                  : 0
              }
              icon={MessageSquare}
              variant="purple"
              clickable={false}
            />
            <PremiumStatusCard
              title="Technical"
              count={statusCounts.technical_assessment}
              percentage={
                statusCounts.total > 0
                  ? (statusCounts.technical_assessment / statusCounts.total) * 100
                  : 0
              }
              icon={Code}
              variant="yellow"
              clickable={false}
            />
            <PremiumStatusCard
              title="Hired"
              count={statusCounts.hired}
              percentage={
                statusCounts.total > 0
                  ? (statusCounts.hired / statusCounts.total) * 100
                  : 0
              }
              icon={CheckCircle}
              variant="emerald"
              clickable={false}
            />
            <PremiumStatusCard
              title="Disqualified"
              count={statusCounts.disqualified}
              percentage={
                statusCounts.total > 0
                  ? (statusCounts.disqualified / statusCounts.total) * 100
                  : 0
              }
              icon={XCircle}
              variant="red"
              clickable={false}
            />
          </div>

          <div
            className="grid grid-cols-1 lg:grid-cols-5 gap-5"
            data-tour="reports-charts"
          >
            <Card className="lg:col-span-3 shadow-sm border-border/70 overflow-hidden">
              <CardHeader className="pb-4 border-b border-border/50 bg-muted/20">
                <CardTitle className="flex items-center gap-3 text-lg">
                  <div className="p-2.5 bg-blue-500/10 rounded-xl ring-1 ring-blue-500/20">
                    <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <div>Application Trends</div>
                    <p className="text-sm font-normal text-muted-foreground mt-0.5">
                      Daily submissions over the last 30 days
                    </p>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                {trendSeriesHasActivity(trendSeries) ? (
                  <AdminTrendChart series={trendSeries} />
                ) : (
                  <TrendsEmptyState
                    scopedToPosition={selectedJobId !== ALL_POSITIONS}
                  />
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2 shadow-sm border-border/70 overflow-hidden">
              <CardHeader className="pb-4 border-b border-border/50 bg-muted/20">
                <CardTitle className="flex items-center gap-3 text-lg">
                  <div className="p-2.5 bg-emerald-500/10 rounded-xl ring-1 ring-emerald-500/20">
                    <Target className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <div>Applications by Job</div>
                    <p className="text-sm font-normal text-muted-foreground mt-0.5">
                      {selectedJobId === ALL_POSITIONS
                        ? "Share of applications per position"
                        : "Scoped to selected position"}
                    </p>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                {byJobBreakdown.length > 0 ? (
                  <div className="grid grid-cols-1 gap-4">
                    <div className="h-56">
                      <Doughnut data={jobDoughnut} options={doughnutOptions} />
                    </div>
                    <JobLegend items={byJobBreakdown} />
                  </div>
                ) : (
                  <ByJobEmptyState />
                )}
              </CardContent>
            </Card>
          </div>

          <AverageTimeToHireCard
            report={timeToHireReport}
            rangeDays={tthRangeDays}
            onRangeChange={setTthRangeDays}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card className="shadow-sm border-border/70 overflow-hidden">
              <CardHeader className="pb-4 border-b border-border/50 bg-muted/20">
                <CardTitle className="flex items-center gap-3 text-lg">
                  <div className="p-2.5 bg-emerald-500/10 rounded-xl ring-1 ring-emerald-500/20">
                    <Target className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <div>Recruitment Sources</div>
                    <p className="text-sm font-normal text-muted-foreground mt-0.5">
                      Where applicants say they found you
                    </p>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                {sourceBreakdown.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-center">
                    <div className="h-64 sm:h-72">
                      <Doughnut data={sourceDoughnut} options={sourceDoughnutOptions} />
                    </div>
                    <SourceLegend items={sourceBreakdown} />
                  </div>
                ) : (
                  <div className="h-72 flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <Target className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                      <p className="font-medium">No applications yet</p>
                      <p className="text-sm mt-1">
                        Source mix appears once candidates start applying.
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-sm border-border/70 overflow-hidden">
              <CardHeader className="pb-4 border-b border-border/50 bg-muted/20">
                <CardTitle className="flex items-center gap-3 text-lg">
                  <div className="p-2.5 bg-violet-500/10 rounded-xl ring-1 ring-violet-500/20">
                    <Users className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                  </div>
                  <div>
                    <div>Pipeline Funnel</div>
                    <p className="text-sm font-normal text-muted-foreground mt-0.5">
                      Active applications by stage
                    </p>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                {hasApplications ? (
                  <ul className="space-y-3">
                    {funnelStages.map((stage) => (
                      <li key={stage.key}>
                        <div className="flex items-center justify-between gap-3 text-sm mb-1.5">
                          <Link
                            href={stage.href}
                            className="font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                          >
                            {stage.label}
                          </Link>
                          <span className="tabular-nums text-muted-foreground">
                            {stage.count}
                            <span className="ml-2 text-foreground/80">
                              {stage.percentage.toFixed(1)}%
                            </span>
                          </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              stage.key === "hired" && "bg-emerald-500",
                              stage.key === "disqualified" && "bg-rose-500",
                              stage.key === "new" && "bg-blue-500",
                              stage.key === "shortlisted" && "bg-teal-500",
                              stage.key === "technical" && "bg-amber-500",
                              stage.key === "interviewing" && "bg-violet-500"
                            )}
                            style={{
                              width: `${Math.max(stage.percentage, stage.count > 0 ? 2 : 0)}%`,
                            }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="h-72 flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                      <p className="font-medium">No applications yet</p>
                      <p className="text-sm mt-1">
                        Pipeline stages fill in as candidates move through hiring.
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AdminPageLayout>
  );
}
