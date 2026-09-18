"use client";

import { Users, FileText, XCircle, ArrowRight, Briefcase, Activity, ChevronDown, Check } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { adminApi } from '@/lib/api-backend';
import { adminApplicationsApi } from '@/lib/admin-applications-api';
import { toast } from 'react-hot-toast';
import { ViewApplicationModal } from "@/components/admin/ViewApplicationModal";
import { Application } from "@/types/application";
import { getPositionDisplay } from "@/components/admin/utils/table-utils";
import { PremiumMetricCard } from "@/components/admin/premium-cards";
import { RecentApplicationsPanel } from "@/components/admin/RecentApplicationsPanel";
import { OverviewWelcomeBanner } from "@/components/admin/OverviewWelcomeBanner";
import { Version4WelcomeModal } from "@/components/admin/Version4WelcomeModal";
import { MyAgendaWidget } from "@/components/admin/overview/MyAgendaWidget";
import { MyTasksWidget } from "@/components/admin/overview/MyTasksWidget";
import { OverviewActionBar } from "@/components/admin/overview/OverviewActionBar";
import { JobPostCard } from "@/components/ui/job-post-card";
import { TourPageHelper } from "@/components/admin/tour/TourPageHelper";
import { useAuth } from "@/contexts/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  type PositionsFilter,
  type JobOwnershipMeta,
  type JobHiringTeamMember,
  POSITIONS_FILTER_OPTIONS,
  positionsFilterLabel,
  readPositionsFilter,
  writePositionsFilter,
  readStarredJobIds,
  writeStarredJobIds,
  isMyPosition,
  extractHiringTeamIds,
  extractHiringTeamMembers,
  filteredJobIdSet,
  recentApplicationsSubtitle,
  extractApplicationJobId,
} from "@/lib/overview-positions";
import {
  computeMomBadge,
  countInCalendarMonths,
  countDatesInLast7VsPriorMonth,
  daysNeededForMom,
  getCalendarMonthBounds,
  sumTrendCountsByCalendarMonth,
  sumTrendCountsLast7VsPriorMonth,
  type TrendDay,
} from "@/lib/mom-delta";

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
  users: {
    total: number;
  };
  status_breakdown: Array<{ status: string; count: number }>;
}

interface JobApplicationSummary {
  jobId?: string | null;
  position: string;
  totalApplications: number;
  isActive?: boolean | null;
}

interface ApplicationsByJob {
  applicationsByJob: Array<JobApplicationSummary & {
    statusBreakdown?: Record<string, number>;
  }>;
}

export default function OverviewPage() {
  const { user } = useAuth();
  const userId = user?.id || "";
  const [overviewData, setOverviewData] = useState<OverviewData | null>(null);
  const [allApplications, setAllApplications] = useState<Application[]>([]);
  const [applicationsByJob, setApplicationsByJob] = useState<ApplicationsByJob | null>(null);
  const [recentApplications, setRecentApplications] = useState<Application[]>([]);
  const [jobTitles, setJobTitles] = useState<Record<string, string>>({});
  const [jobMetaById, setJobMetaById] = useState<Record<string, JobOwnershipMeta>>({});
  const [jobCreatedDates, setJobCreatedDates] = useState<string[]>([]);
  const [userCreatedDates, setUserCreatedDates] = useState<string[]>([]);
  const [trendDays, setTrendDays] = useState<TrendDay[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewApplication, setViewApplication] = useState<Application | null>(null);
  const [positionsFilter, setPositionsFilter] = useState<PositionsFilter>("mine");
  const [starredJobIds, setStarredJobIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setPositionsFilter(readPositionsFilter());
  }, []);

  useEffect(() => {
    if (!userId) {
      setStarredJobIds(new Set());
      return;
    }
    setStarredJobIds(readStarredJobIds(userId));
  }, [userId]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const handlePositionsFilterChange = (filter: PositionsFilter) => {
    setPositionsFilter(filter);
    writePositionsFilter(filter);
  };

  const handleStarToggle = (jobId: string, starred: boolean) => {
    if (!userId) {
      toast.error("Sign in to star positions");
      return;
    }
    setStarredJobIds((previous) => {
      const next = new Set(previous);
      if (starred) next.add(jobId);
      else next.delete(jobId);
      writeStarredJobIds(userId, next);
      return next;
    });
  };

  const handleJobStatusChange = (jobId: string, isActive: boolean) => {
    setJobMetaById((previous) => {
      const existing = previous[jobId];
      if (!existing) return previous;
      return { ...previous, [jobId]: { ...existing, isActive } };
    });
    setApplicationsByJob((previous) => {
      if (!previous) return previous;
      return {
        applicationsByJob: previous.applicationsByJob.map((entry) =>
          entry.jobId === jobId ? { ...entry, isActive } : entry
        ),
      };
    });
  };

  const handleHiringTeamChange = (jobId: string, hiringTeam: JobHiringTeamMember[]) => {
    setJobMetaById((previous) => {
      const existing = previous[jobId];
      if (!existing) return previous;
      return {
        ...previous,
        [jobId]: {
          ...existing,
          hiringTeam,
          hiringTeamIds: hiringTeam.map((member) => member.id),
        },
      };
    });
  };

  const fetchUserCreatedDatesForMom = async (): Promise<string[]> => {
    const { lastMonthStart } = getCalendarMonthBounds();
    const dates: string[] = [];
    let skip = 0;
    const pageSize = 100;

    while (true) {
      const response = await adminApi.getUsers({ skip, limit: pageSize });
      const users = response?.users || [];
      if (users.length === 0) break;

      let reachedOlderThanWindow = false;
      for (const user of users) {
        const createdAt = user?.createdAt;
        if (!createdAt) continue;
        const created = new Date(createdAt);
        if (Number.isNaN(created.getTime())) continue;
        if (created >= lastMonthStart) {
          dates.push(String(createdAt));
        } else {
          reachedOlderThanWindow = true;
          break;
        }
      }

      if (users.length < pageSize || reachedOlderThanWindow) break;
      skip += pageSize;
    }

    return dates;
  };

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const trendDaysNeeded = daysNeededForMom();

      const [
        overviewResponse,
        appsResponse,
        recentAppsResponse,
        jobApplicationsResponse,
        jobsResponse,
        trendsResponse,
        usersMomResponse,
      ] = await Promise.allSettled([
        adminApi.getOverview(),
        adminApplicationsApi.getAllApplications({ limit: 100 }),
        adminApi.getApplications({ limit: 10 }),
        adminApi.getApplicationsByJob(),
        adminApi.getJobPostings({ limit: 100 }),
        adminApi.getTrends(trendDaysNeeded),
        fetchUserCreatedDatesForMom(),
      ]);

      if (overviewResponse.status === 'fulfilled') {
        setOverviewData(overviewResponse.value);
      }

      if (appsResponse.status === 'fulfilled') {
        const apps = appsResponse.value?.applications || [];
        setAllApplications(apps);
      }

      if (recentAppsResponse.status === 'fulfilled') {
        const apps = recentAppsResponse.value?.applications || [];
        setRecentApplications(apps.slice(0, 4));
      }

      if (jobApplicationsResponse.status === 'fulfilled') {
        setApplicationsByJob(jobApplicationsResponse.value);
      }

      if (jobsResponse.status === 'fulfilled') {
        const jobs = Array.isArray(jobsResponse.value)
          ? jobsResponse.value
          : jobsResponse.value?.jobPostings || [];
        const jobTitlesMap: Record<string, string> = {};
        const jobMetaMap: Record<string, JobOwnershipMeta> = {};
        const createdDates: string[] = [];
        jobs.forEach((job: any) => {
          const jobId = job?.id || (job?._id ? String(job._id) : null);
          if (!jobId) return;
          const id = String(jobId);
          if (job?.title) {
            jobTitlesMap[id] = String(job.title);
          }
          jobMetaMap[id] = {
            id,
            title: String(job?.title || ""),
            createdBy: job?.createdBy ? String(job.createdBy) : null,
            hiringTeam: extractHiringTeamMembers(job?.hiringTeam),
            hiringTeamIds: extractHiringTeamIds(job?.hiringTeam),
            isActive: Boolean(job?.isActive),
          };
          const createdAt = job?.createdAt || job?.postedDate;
          if (createdAt) createdDates.push(String(createdAt));
        });
        setJobTitles(jobTitlesMap);
        setJobMetaById(jobMetaMap);
        setJobCreatedDates(createdDates);
      }

      if (trendsResponse.status === 'fulfilled') {
        setTrendDays(trendsResponse.value?.trends || []);
      }

      if (usersMomResponse.status === 'fulfilled') {
        setUserCreatedDates(usersMomResponse.value);
      }

    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      setError('Failed to load dashboard data');
      toast.error('Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  const computedStats = useMemo(() => {
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

    const stats = {
      total: allApplications.length,
      new: 0,
      shortlisted: 0,
      interviewing: 0,
      hired: 0,
      rejected: 0,
      technical_assessment: 0,
      disqualified: 0,
      recent: 0,
    };

    const byJobMap = new Map<string, { position: string; totalApplications: number; jobId: string | null }>();

    allApplications.forEach((application) => {
      const status = String(application.status || "").toLowerCase();
      if (status === "new") stats.new += 1;
      else if (status === "shortlisted") stats.shortlisted += 1;
      else if (status === "interviewing") stats.interviewing += 1;
      else if (status === "hired") stats.hired += 1;
      else if (status === "rejected") stats.rejected += 1;
      else if (status === "technical_assessment" || status === "technical-assessment") stats.technical_assessment += 1;
      else if (status === "disqualified") stats.disqualified += 1;

      const appliedDate = new Date(application.appliedDate).getTime();
      if (!Number.isNaN(appliedDate) && appliedDate >= sevenDaysAgo) {
        stats.recent += 1;
      }

      const position = getPositionDisplay(application, jobTitles) || "Unknown Position";
      const rawJobId = application.jobId;
      const appJobId =
        typeof rawJobId === "string"
          ? rawJobId
          : rawJobId && typeof rawJobId === "object" && "_id" in rawJobId
            ? String((rawJobId as { _id: string })._id)
            : null;
      const groupKey = appJobId || position;
      const existing = byJobMap.get(groupKey);
      if (existing) {
        existing.totalApplications += 1;
        if (!existing.jobId && appJobId) existing.jobId = appJobId;
      } else {
        byJobMap.set(groupKey, {
          position,
          totalApplications: 1,
          jobId: appJobId,
        });
      }
    });

    const applicationsByJobData: JobApplicationSummary[] = Array.from(byJobMap.values()).map(
      (entry) => ({
        jobId: entry.jobId,
        position: entry.position,
        totalApplications: entry.totalApplications,
        isActive: null,
      })
    );

    return {
      stats,
      applicationsByJobData,
      recentApplications: [...allApplications]
        .sort(
          (a, b) =>
            new Date(b.appliedDate).getTime() - new Date(a.appliedDate).getTime()
        )
        .slice(0, 4),
    };
  }, [allApplications, jobTitles]);

  const pieByJobData: JobApplicationSummary[] =
    applicationsByJob?.applicationsByJob && applicationsByJob.applicationsByJob.length > 0
      ? applicationsByJob.applicationsByJob
      : computedStats.applicationsByJobData;

  const isResolvableJobPosition = (position?: string | null) => {
    const normalized = (position || "").trim();
    return (
      normalized.length > 0 &&
      normalized !== "Unknown Position" &&
      normalized !== "Position Not Available"
    );
  };

  const titleToJobId = useMemo(() => {
    const map = new Map<string, string>();
    Object.values(jobMetaById).forEach((job) => {
      const key = job.title.trim().toLowerCase();
      if (key && !map.has(key)) {
        map.set(key, job.id);
      }
    });
    return map;
  }, [jobMetaById]);

  const resolveJobId = (item: JobApplicationSummary): string | null => {
    if (item.jobId) return String(item.jobId);
    const fromTitle = titleToJobId.get((item.position || "").trim().toLowerCase());
    return fromTitle || null;
  };

  const visibleJobIds = useMemo(
    () =>
      filteredJobIdSet(
        Object.values(jobMetaById),
        positionsFilter,
        userId,
        starredJobIds
      ),
    [jobMetaById, positionsFilter, userId, starredJobIds]
  );

  const applicationBelongsToVisibleJobs = (application: Application): boolean => {
    if (visibleJobIds === null) return true;
    const jobId = extractApplicationJobId(application);
    if (jobId && visibleJobIds.has(jobId)) return true;
    const titleKey = (application.position || "").trim().toLowerCase();
    if (!titleKey) return false;
    const fromTitle = titleToJobId.get(titleKey);
    return Boolean(fromTitle && visibleJobIds.has(fromTitle));
  };

  const jobPostBreakdown = useMemo(() => {
    const rows = [...pieByJobData]
      .filter((item) => isResolvableJobPosition(item.position))
      .map((item) => {
        const jobId = resolveJobId(item);
        const meta = jobId ? jobMetaById[jobId] : undefined;
        const isActive =
          meta?.isActive ??
          item.isActive ??
          null;
        return {
          jobId,
          position: item.position || "Unknown Position",
          totalApplications: item.totalApplications || 0,
          isActive,
          createdBy: meta?.createdBy ?? null,
          hiringTeam: meta?.hiringTeam ?? [],
          hiringTeamIds: meta?.hiringTeamIds ?? [],
        };
      })
      .sort((a, b) => b.totalApplications - a.totalApplications);

    return rows.filter((row) => {
      if (positionsFilter === "all") return true;
      if (!row.jobId) return false;
      if (positionsFilter === "starred") {
        return starredJobIds.has(row.jobId);
      }
      return isMyPosition(
        { createdBy: row.createdBy, hiringTeamIds: row.hiringTeamIds },
        userId
      );
    });
  }, [
    pieByJobData,
    jobMetaById,
    titleToJobId,
    positionsFilter,
    starredJobIds,
    userId,
  ]);

  const scopedApplications = useMemo(() => {
    if (visibleJobIds === null) return allApplications;
    return allApplications.filter(applicationBelongsToVisibleJobs);
  }, [allApplications, visibleJobIds, titleToJobId]);

  const scopedStats = useMemo(() => {
    if (visibleJobIds === null) return null;

    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const stats = {
      total: scopedApplications.length,
      new: 0,
      shortlisted: 0,
      interviewing: 0,
      hired: 0,
      rejected: 0,
      technical_assessment: 0,
      disqualified: 0,
      recent: 0,
    };

    scopedApplications.forEach((application) => {
      const status = String(application.status || "").toLowerCase();
      if (status === "new") stats.new += 1;
      else if (status === "shortlisted") stats.shortlisted += 1;
      else if (status === "interviewing") stats.interviewing += 1;
      else if (status === "hired") stats.hired += 1;
      else if (status === "rejected") stats.rejected += 1;
      else if (status === "technical_assessment" || status === "technical-assessment") {
        stats.technical_assessment += 1;
      } else if (status === "disqualified") stats.disqualified += 1;

      const appliedDate = new Date(application.appliedDate).getTime();
      if (!Number.isNaN(appliedDate) && appliedDate >= sevenDaysAgo) {
        stats.recent += 1;
      }
    });

    return stats;
  }, [visibleJobIds, scopedApplications]);

  const filteredRecentApplications = useMemo(() => {
    const fromAll = [...scopedApplications].sort(
      (a, b) =>
        new Date(b.appliedDate).getTime() - new Date(a.appliedDate).getTime()
    );
    if (fromAll.length > 0) return fromAll.slice(0, 4);

    const fallback = recentApplications.filter(applicationBelongsToVisibleJobs);
    return fallback.slice(0, 4);
  }, [scopedApplications, recentApplications, visibleJobIds, titleToJobId]);

  const recentViewAllHref = useMemo(() => {
    if (visibleJobIds === null || visibleJobIds.size !== 1) {
      return "/admin/applications";
    }
    const [onlyJobId] = Array.from(visibleJobIds);
    return `/admin/applications?jobId=${encodeURIComponent(onlyJobId)}`;
  }, [visibleJobIds]);

  const applicationEventDate = (application: Application): string | Date | null =>
    application.appliedDate || application.createdAt || null;

  const metricMomBadges = useMemo(() => {
    const useTrendsForApps = visibleJobIds === null && trendDays.length > 0;

    const totalAppsPeriod = useTrendsForApps
      ? sumTrendCountsByCalendarMonth(trendDays)
      : countInCalendarMonths(scopedApplications.map(applicationEventDate));

    const recentAppsPeriod = useTrendsForApps
      ? sumTrendCountsLast7VsPriorMonth(trendDays)
      : countDatesInLast7VsPriorMonth(scopedApplications.map(applicationEventDate));

    const jobsPeriod = countInCalendarMonths(jobCreatedDates);
    const usersPeriod = countInCalendarMonths(userCreatedDates);

    return {
      totalApplications: computeMomBadge(
        totalAppsPeriod.thisMonth,
        totalAppsPeriod.lastMonth
      ),
      activeJobs: computeMomBadge(jobsPeriod.thisMonth, jobsPeriod.lastMonth),
      recentApplications: computeMomBadge(
        recentAppsPeriod.thisMonth,
        recentAppsPeriod.lastMonth
      ),
      totalUsers: computeMomBadge(usersPeriod.thisMonth, usersPeriod.lastMonth),
    };
  }, [
    visibleJobIds,
    trendDays,
    scopedApplications,
    jobCreatedDates,
    userCreatedDates,
  ]);

  const handleViewApplication = (app: Application) => {
    setViewApplication(app);
  };

  if (isLoading) return (
    <AdminPageLayout title="Dashboard Overview" showSearch={false}>
      <div className="min-h-screen">
        <div className="space-y-3 px-4 md:px-6 pb-6 pt-2 w-full max-w-none">
          <Skeleton className="h-36 sm:h-40 rounded-xl" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <Skeleton className="h-72 lg:col-span-2 rounded-xl" />
            <div className="space-y-3">
              <Skeleton className="h-36 rounded-xl" />
              <Skeleton className="h-36 rounded-xl" />
            </div>
          </div>
        </div>
      </div>
      <OverviewActionBar />
    </AdminPageLayout>
  );

  if (error) return (
    <AdminPageLayout title="Dashboard Overview" showSearch={false}>
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center py-12">
          <div className="bg-destructive/10 rounded-full p-4 w-16 h-16 mx-auto mb-4">
            <XCircle className="h-8 w-8 text-destructive" />
          </div>
          <h2 className="text-2xl font-bold mb-4 text-foreground">Something went wrong</h2>
          <p className="text-muted-foreground mb-6">{error}</p>
          <Button onClick={loadDashboardData}>
            <ArrowRight className="mr-2 h-4 w-4" />
            Try Again
          </Button>
        </div>
      </div>
      <OverviewActionBar />
    </AdminPageLayout>
  );

  if (!overviewData) return null;

  // All Positions: backend overview counts. Mine/Starred: client counts for visible jobs.
  const effectiveStats = scopedStats ?? overviewData.applications;

  return (
    <AdminPageLayout
      title="Dashboard Overview"
      showSearch={false}
      tourId="overview"
      guideInBanner
    >
      <TourPageHelper tourId="overview" />
      <div className="min-h-screen bg-background">
        <div className="space-y-3 px-4 md:px-6 pb-6 pt-2 w-full max-w-none">
          <Version4WelcomeModal tourId="overview" />

          <OverviewWelcomeBanner
            tourId="overview"
            recentApplications={overviewData.applications.recent}
            activeJobs={overviewData.jobs.active}
            newApplications={overviewData.applications.new}
          />

          {/* Key Metrics Grid */}
          <div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3"
            data-tour="overview-metrics"
          >
            <PremiumMetricCard
              title="Total Applications"
              value={effectiveStats.total}
              icon={FileText}
              variant="blue"
              path="/admin/applications"
              subtitle={
                positionsFilter === "all"
                  ? "All time applications"
                  : positionsFilter === "mine"
                    ? "For your positions"
                    : "For starred positions"
              }
              mom={metricMomBadges.totalApplications}
            />
            <PremiumMetricCard
              title="Active Jobs"
              value={overviewData.jobs.active}
              icon={Briefcase}
              variant="green"
              path="/admin/job-postings"
              subtitle="Currently hiring"
              mom={metricMomBadges.activeJobs}
            />
            <PremiumMetricCard
              title="Recent Applications"
              value={effectiveStats.recent}
              icon={Activity}
              variant="brand"
              path="/admin/applications"
              subtitle={
                positionsFilter === "all"
                  ? "Last 7 days"
                  : positionsFilter === "mine"
                    ? "Last 7 days · your positions"
                    : "Last 7 days · starred"
              }
              mom={metricMomBadges.recentApplications}
            />
            <PremiumMetricCard
              title="Total Users"
              value={overviewData.users.total}
              icon={Users}
              variant="orange"
              path="/admin/user-management"
              subtitle="Registered users"
              mom={metricMomBadges.totalUsers}
            />
          </div>

          {/* Applications per Job Post Breakdown */}
          <div className="space-y-2.5" data-tour="overview-jobs-breakdown">
            <div
              className="flex items-center gap-2"
              data-tour="overview-positions-filter"
            >
              <div className="rounded-md bg-[#272156]/[0.08] p-1.5 ring-1 ring-[#272156]/15">
                <Briefcase className="h-3.5 w-3.5 text-[#272156]" />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="group inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 text-left transition hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label="Filter positions"
                  >
                    <span className="text-sm font-semibold text-foreground">
                      {positionsFilterLabel(positionsFilter)}
                    </span>
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition group-data-[state=open]:rotate-180" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56 bg-white shadow-md">
                  {POSITIONS_FILTER_OPTIONS.map((option) => (
                    <DropdownMenuItem
                      key={option.value}
                      onSelect={() => handlePositionsFilterChange(option.value)}
                      className="flex items-center justify-between gap-2"
                    >
                      <span>{option.label}</span>
                      {positionsFilter === option.value && (
                        <Check className="h-4 w-4 text-[#272156]" />
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            {jobPostBreakdown.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {jobPostBreakdown.map((item, index) => (
                  <JobPostCard
                    key={item.jobId || item.position}
                    title={item.position}
                    count={item.totalApplications}
                    subtitle={item.totalApplications === 1 ? "application" : "applications"}
                    index={index}
                    isActive={item.isActive}
                    jobId={item.jobId}
                    isStarred={item.jobId ? starredJobIds.has(item.jobId) : false}
                    hiringTeam={item.hiringTeam}
                    onStatusChange={handleJobStatusChange}
                    onStarToggle={handleStarToggle}
                    onHiringTeamChange={handleHiringTeamChange}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-border/60 bg-card py-5 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <Briefcase className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                  <p className="text-sm">
                    {positionsFilter === "starred"
                      ? "No starred positions yet"
                      : positionsFilter === "mine"
                        ? "No positions assigned to you"
                        : "No job application data"}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 xl:grid-cols-5">
            <div className="xl:col-span-3">
              <RecentApplicationsPanel
                applications={filteredRecentApplications}
                jobTitles={jobTitles}
                onView={handleViewApplication}
                maxItems={4}
                subtitle={recentApplicationsSubtitle(positionsFilter)}
                viewAllHref={recentViewAllHref}
              />
            </div>
            <div
              className="flex flex-col gap-3 xl:col-span-2"
              data-tour="overview-personal-widgets"
            >
              <MyAgendaWidget />
              <MyTasksWidget />
            </div>
          </div>
        </div>
      </div>

      {/* Application View Modal */}
      <ViewApplicationModal
        application={viewApplication}
        isOpen={!!viewApplication}
        onClose={() => setViewApplication(null)}
        jobTitles={jobTitles}
      />
      <OverviewActionBar />
    </AdminPageLayout>
  );
}
