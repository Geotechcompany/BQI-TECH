"use client";

import { motion } from 'framer-motion';
import { Users, FileText, CheckCircle, XCircle, UserCheck, Code, MessageSquare, ArrowRight, BarChart, Plus, TrendingUp, Briefcase, Target, Activity } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { Line, Pie, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import { Skeleton } from "@/components/ui/skeleton";
import Link from 'next/link';
import { adminApi } from '@/lib/api-backend';
import { adminApplicationsApi } from '@/lib/admin-applications-api';
import { toast } from 'react-hot-toast';
import { ViewApplicationModal } from "@/components/admin/ViewApplicationModal";
import { Application } from "@/types/application";
import { getPositionDisplay } from "@/components/admin/utils/table-utils";
import {
  PremiumMetricCard,
  PremiumStatusCard,
} from "@/components/admin/premium-cards";
import { RecentApplicationsPanel } from "@/components/admin/RecentApplicationsPanel";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

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

interface ApplicationsByJob {
  applicationsByJob: Array<{
    position: string;
    totalApplications: number;
    statusBreakdown: Record<string, number>;
  }>;
}

export default function OverviewPage() {
  const [overviewData, setOverviewData] = useState<OverviewData | null>(null);
  const [allApplications, setAllApplications] = useState<Application[]>([]);
  const [applicationsByJob, setApplicationsByJob] = useState<ApplicationsByJob | null>(null);
  const [recentApplications, setRecentApplications] = useState<Application[]>([]);
  const [trendData, setTrendData] = useState<any>(null);
  const [jobTitles, setJobTitles] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewApplication, setViewApplication] = useState<Application | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Load all data in parallel
      const [overviewResponse, appsResponse, recentAppsResponse, trendsResponse, jobApplicationsResponse, jobsResponse] = await Promise.allSettled([
        adminApi.getOverview(),
        adminApplicationsApi.getAllApplications({ limit: 100 }),
        adminApi.getApplications({ limit: 10 }),
        adminApi.getTrends(30),
        adminApi.getApplicationsByJob(),
        adminApi.getJobPostings()
      ]);

      // Handle overview data
      if (overviewResponse.status === 'fulfilled') {
        setOverviewData(overviewResponse.value);
      }

      // Handle applications data
      if (appsResponse.status === 'fulfilled') {
        const apps = appsResponse.value?.applications || [];
        setAllApplications(apps);
      }

      // Handle recent applications
      if (recentAppsResponse.status === 'fulfilled') {
        const apps = recentAppsResponse.value?.applications || [];
        setRecentApplications(apps.slice(0, 8));
      }

      // Handle trends data
      if (trendsResponse.status === 'fulfilled') {
        setTrendData(trendsResponse.value);
      }

      // Handle applications by job data
      if (jobApplicationsResponse.status === 'fulfilled') {
        setApplicationsByJob(jobApplicationsResponse.value);
      }

      // Build a job title lookup for robust position rendering
      if (jobsResponse.status === 'fulfilled') {
        const jobs = Array.isArray(jobsResponse.value)
          ? jobsResponse.value
          : jobsResponse.value?.jobPostings || [];
        const jobTitlesMap: Record<string, string> = {};
        jobs.forEach((job: any) => {
          const jobId = job?.id || (job?._id ? String(job._id) : null);
          if (jobId && job?.title) {
            jobTitlesMap[String(jobId)] = String(job.title);
          }
        });
        setJobTitles(jobTitlesMap);
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
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

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

    const trendMap = new Map<string, number>();
    const byJobMap = new Map<string, number>();

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

      if (!Number.isNaN(appliedDate) && appliedDate >= thirtyDaysAgo) {
        const dayKey = new Date(appliedDate).toISOString().split("T")[0];
        trendMap.set(dayKey, (trendMap.get(dayKey) || 0) + 1);
      }

      const position = getPositionDisplay(application, jobTitles) || "Unknown Position";
      byJobMap.set(position, (byJobMap.get(position) || 0) + 1);
    });

    const trendLabels: string[] = [];
    const trendCounts: number[] = [];
    for (let i = 29; i >= 0; i -= 1) {
      const date = new Date(now - i * 24 * 60 * 60 * 1000);
      const dayKey = date.toISOString().split("T")[0];
      trendLabels.push(
        date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
      );
      trendCounts.push(trendMap.get(dayKey) || 0);
    }

    const applicationsByJobData = Array.from(byJobMap.entries()).map(([position, totalApplications]) => ({
      position,
      totalApplications,
    }));

    return {
      stats,
      trendLabels,
      trendCounts,
      applicationsByJobData,
      recentApplications: [...allApplications]
        .sort(
          (a, b) =>
            new Date(b.appliedDate).getTime() - new Date(a.appliedDate).getTime()
        )
        .slice(0, 8),
    };
  }, [allApplications, jobTitles]);

  // Chart configurations
  const trendChartData = {
    labels:
      trendData?.trends?.map((t: any) => {
        const date = new Date(t._id);
        return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      }) || computedStats.trendLabels,
    datasets: [
      {
        label: 'Applications',
        data: trendData?.trends?.map((t: any) => t.count) || computedStats.trendCounts,
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.4,
        pointBackgroundColor: 'rgb(59, 130, 246)',
        pointBorderColor: 'white',
        pointBorderWidth: 2,
        pointRadius: 4,
      },
    ],
  };

  const pieByJobData =
    applicationsByJob?.applicationsByJob && applicationsByJob.applicationsByJob.length > 0
      ? applicationsByJob.applicationsByJob
      : computedStats.applicationsByJobData;

  const pieChartData = {
    labels: pieByJobData.map(item => {
      const position = item.position || 'Unknown Position';
      return position.length > 20 ? `${position.substring(0, 20)}...` : position;
    }) || [],
    datasets: [
      {
        data: pieByJobData.map(item => item.totalApplications || 0) || [],
        backgroundColor: [
          'rgba(59, 130, 246, 0.8)',
          'rgba(16, 185, 129, 0.8)',
          'rgba(139, 92, 246, 0.8)',
          'rgba(245, 158, 11, 0.8)',
          'rgba(239, 68, 68, 0.8)',
          'rgba(236, 72, 153, 0.8)',
          'rgba(14, 165, 233, 0.8)',
          'rgba(34, 197, 94, 0.8)',
          'rgba(168, 85, 247, 0.8)',
          'rgba(251, 146, 60, 0.8)',
        ],
        borderColor: [
          'rgba(59, 130, 246, 1)',
          'rgba(16, 185, 129, 1)',
          'rgba(139, 92, 246, 1)',
          'rgba(245, 158, 11, 1)',
          'rgba(239, 68, 68, 1)',
          'rgba(236, 72, 153, 1)',
          'rgba(14, 165, 233, 1)',
          'rgba(34, 197, 94, 1)',
          'rgba(168, 85, 247, 1)',
          'rgba(251, 146, 60, 1)',
        ],
        borderWidth: 2,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          padding: 20,
          usePointStyle: true,
          font: {
            size: 12,
          },
        },
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: 'white',
        bodyColor: 'white',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
      },
    },
  };

  const pieChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right' as const,
        labels: {
          padding: 15,
          usePointStyle: true,
          font: {
            size: 11,
          },
          generateLabels: (chart: any) => {
            const data = chart.data;
            if (data.labels.length && data.datasets.length) {
              return data.labels.map((label: string, i: number) => {
                const value = data.datasets[0].data[i];
                const total = data.datasets[0].data.reduce((a: number, b: number) => a + b, 0);
                const percentage = ((value / total) * 100).toFixed(1);
                return {
                  text: `${label} (${percentage}%)`,
                  fillStyle: data.datasets[0].backgroundColor[i],
                  strokeStyle: data.datasets[0].borderColor[i],
                  lineWidth: 2,
                  pointStyle: 'circle',
                };
              });
            }
            return [];
          },
        },
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: 'white',
        bodyColor: 'white',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        callbacks: {
          label: function(context: any) {
            const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
            const percentage = ((context.parsed / total) * 100).toFixed(1);
            return `${context.label}: ${context.parsed} (${percentage}%)`;
          }
        }
      },
    },
  };

  const handleViewApplication = (app: Application) => {
    setViewApplication(app);
  };

  if (isLoading) return (
    <AdminPageLayout title="Dashboard Overview" showSearch={false}>
      <div className="min-h-screen">
        <div className="space-y-8 px-4 md:px-6 pb-6 pt-2 w-full max-w-none">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <Skeleton className="h-96 lg:col-span-2 rounded-2xl" />
            <Skeleton className="h-96 rounded-2xl" />
          </div>
        </div>
      </div>
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
          <Button onClick={loadDashboardData} className="bg-blue-600 hover:bg-blue-700">
            <ArrowRight className="mr-2 h-4 w-4" />
            Try Again
          </Button>
        </div>
      </div>
    </AdminPageLayout>
  );

  if (!overviewData) return null;

  const effectiveStats =
    allApplications.length > 0
      ? computedStats.stats
      : (overviewData?.applications || computedStats.stats);

  const totalApplications = effectiveStats.total || 1;

  return (
    <AdminPageLayout
      title="Dashboard Overview"
      showSearch={false}
      headerActions={
        <div className="flex gap-3">
          <Link href="/admin/applications">
            <Button variant="outline" size="sm" className="gap-2">
              <FileText className="h-4 w-4" />
              View Applications
            </Button>
          </Link>
          <Link href="/admin/job-postings/new">
            <Button size="sm" className="gap-2 bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4" />
              New Job
            </Button>
          </Link>
        </div>
      }
    >
      <div className="min-h-screen bg-background">
        <div className="space-y-8 px-4 md:px-6 pb-6 pt-2 w-full max-w-none">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <PremiumMetricCard
              title="Total Applications"
              value={effectiveStats.total}
              icon={FileText}
              variant="blue"
              path="/admin/applications"
              subtitle="All time applications"
              trend={12}
            />
            <PremiumMetricCard
              title="Active Jobs"
              value={overviewData.jobs.active}
              icon={Briefcase}
              variant="green"
              path="/admin/job-postings"
              subtitle="Currently hiring"
              trend={8}
            />
            <PremiumMetricCard
              title="Recent Applications"
              value={effectiveStats.recent}
              icon={Activity}
              variant="purple"
              path="/admin/applications"
              subtitle="Last 7 days"
              trend={25}
            />
            <PremiumMetricCard
              title="Total Users"
              value={overviewData.users.total}
              icon={Users}
              variant="orange"
              path="/admin/user-management"
              subtitle="Registered users"
              trend={5}
            />
          </div>

          {/* Application Status Overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <PremiumStatusCard
              title="New"
              count={effectiveStats.new}
              percentage={(effectiveStats.new / totalApplications) * 100}
              icon={FileText}
              variant="blue"
              path="/admin/applications?status=new"
            />
            <PremiumStatusCard
              title="Shortlisted"
              count={effectiveStats.shortlisted}
              percentage={(effectiveStats.shortlisted / totalApplications) * 100}
              icon={UserCheck}
              variant="green"
              path="/admin/shortlisted"
            />
            <PremiumStatusCard
              title="Interviewing"
              count={effectiveStats.interviewing}
              percentage={(effectiveStats.interviewing / totalApplications) * 100}
              icon={MessageSquare}
              variant="purple"
              path="/admin/interviewing"
            />
            <PremiumStatusCard
              title="Technical"
              count={effectiveStats.technical_assessment}
              percentage={(effectiveStats.technical_assessment / totalApplications) * 100}
              icon={Code}
              variant="yellow"
              path="/admin/technical-assessment"
            />
            <PremiumStatusCard
              title="Hired"
              count={effectiveStats.hired}
              percentage={(effectiveStats.hired / totalApplications) * 100}
              icon={CheckCircle}
              variant="emerald"
              path="/admin/hired"
            />
            <PremiumStatusCard
              title="Disqualified"
              count={effectiveStats.disqualified}
              percentage={(effectiveStats.disqualified / totalApplications) * 100}
              icon={XCircle}
              variant="red"
              path="/admin/disqualified"
            />
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
            {/* Application Trends Chart */}
            <Card className="lg:col-span-3 shadow-sm border-border">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-3 text-lg">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <TrendingUp className="h-5 w-5 text-blue-600" />
                  </div>
                  Application Trends
                  <span className="text-sm font-normal text-muted-foreground">(Last 30 Days)</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {(trendData?.trends?.length || computedStats.trendCounts.length) > 0 ? (
                  <div className="h-80">
                    <Line data={trendChartData} options={chartOptions} />
                  </div>
                ) : (
                  <div className="h-80 flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <BarChart className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                      <p>No trend data available</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Applications by Job Pie Chart */}
            <Card className="lg:col-span-2 shadow-sm border-border">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-3 text-lg">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Target className="h-5 w-5 text-green-600" />
                  </div>
                  Applications by Job
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {pieByJobData.length > 0 ? (
                  <div className="h-80">
                    <Doughnut data={pieChartData} options={pieChartOptions} />
                  </div>
                ) : (
                  <div className="h-80 flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <Target className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                      <p>No job application data</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <RecentApplicationsPanel
            applications={
              recentApplications.length > 0
                ? recentApplications
                : computedStats.recentApplications
            }
            jobTitles={jobTitles}
            onView={handleViewApplication}
          />
        </div>
      </div>

      {/* Application View Modal */}
      <ViewApplicationModal
        application={viewApplication}
        isOpen={!!viewApplication}
        onClose={() => setViewApplication(null)}
        jobTitles={jobTitles}
      />
    </AdminPageLayout>
  );
}
