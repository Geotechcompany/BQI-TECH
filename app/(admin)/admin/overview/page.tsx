"use client";

import { motion } from 'framer-motion';
import { Users, FileText, CheckCircle, XCircle, UserCheck, Code, MessageSquare, ArrowRight, ChevronDown, Clock, BarChart, Plus, ArrowUp, ArrowDown, TrendingUp, Briefcase, Target, Activity } from 'lucide-react';
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
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import { Skeleton } from "@/components/ui/skeleton";
import Link from 'next/link';
import { adminApi } from '@/lib/api-backend';
import { toast } from 'react-hot-toast';
import { ViewApplicationModal } from "@/components/admin/ViewApplicationModal";
import { Application } from "@/types/application";
import { getPositionDisplay } from "@/components/admin/utils/table-utils";

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

interface JobOption {
  id: string;
  title: string;
  isActive: boolean;
}

const statusColors = {
  New: 'bg-blue-100 text-blue-800',
  Shortlisted: 'bg-green-100 text-green-800',
  Interviewing: 'bg-purple-100 text-purple-800',
  Hired: 'bg-emerald-100 text-emerald-800',
  Rejected: 'bg-rose-100 text-rose-800',
  'Technical Assessment': 'bg-yellow-100 text-yellow-800',
  Disqualified: 'bg-red-100 text-red-800',
};

const MetricCard = ({ 
  title, 
  value, 
  icon: Icon, 
  trend, 
  color, 
  path, 
  subtitle,
  isLarge = false 
}: {
  title: string;
  value: number;
  icon: any;
  trend?: number;
  color: string;
  path: string;
  subtitle?: string;
  isLarge?: boolean;
}) => (
  <Link href={path} className="hover:opacity-90 transition-opacity">
    <motion.div
      whileHover={{ y: -2, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={`rounded-2xl border border-border bg-card p-6 shadow-sm hover:shadow-lg transition-all duration-300 cursor-pointer backdrop-blur-sm ${
        isLarge ? 'lg:col-span-2' : ''
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-3">
            <div className={`p-3 rounded-xl ${color} shadow-sm`}>
              <Icon className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">{title}</p>
              {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
            </div>
          </div>
          <div className="space-y-2">
            <h3 className="text-3xl font-bold text-foreground">{value.toLocaleString()}</h3>
            {trend !== undefined && (
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                  trend > 0 ? 'bg-emerald-500/10 text-emerald-500' : trend < 0 ? 'bg-rose-500/10 text-rose-500' : 'bg-muted text-muted-foreground'
                }`}>
                  {trend > 0 ? (
                  <ArrowUp className="h-3 w-3 mr-1" />
                  ) : trend < 0 ? (
                  <ArrowDown className="h-3 w-3 mr-1" />
                  ) : null}
                  {trend === 0 ? 'No change' : `${Math.abs(trend)}%`}
                </span>
                <span className="text-xs text-muted-foreground">vs last month</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  </Link>
);

const StatusCard = ({ 
  title, 
  count, 
  percentage, 
  icon: Icon, 
  color, 
  path 
}: {
  title: string;
  count: number;
  percentage: number;
  icon: any;
  color: string;
  path: string;
}) => (
  <Link href={path}>
    <motion.div
      whileHover={{ scale: 1.02 }}
      className="bg-card rounded-xl border border-border p-5 shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer backdrop-blur-sm"
    >
      <div className="flex items-center justify-between mb-4">
        <div className={`p-2.5 rounded-lg ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <span className="text-2xl font-bold text-foreground">{count}</span>
      </div>
      <div className="space-y-2">
        <h4 className="font-semibold text-foreground">{title}</h4>
        <Progress value={percentage} className="h-2" />
        <p className="text-xs text-muted-foreground">{percentage.toFixed(1)}% of total</p>
      </div>
    </motion.div>
  </Link>
);

export default function OverviewPage() {
  const [overviewData, setOverviewData] = useState<OverviewData | null>(null);
  const [allApplications, setAllApplications] = useState<Application[]>([]);
  const [jobs, setJobs] = useState<JobOption[]>([]);
  const [jobTitles, setJobTitles] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewApplication, setViewApplication] = useState<Application | null>(null);
  const [overviewFilter, setOverviewFilter] = useState<string>("all");

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Load all data in parallel
      const [overviewResponse, appsResponse, jobsResponse] = await Promise.allSettled([
        adminApi.getOverview(),
        adminApi.getApplications({ limit: 2000 }),
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

      // Build a job title lookup for robust position rendering
      if (jobsResponse.status === 'fulfilled') {
        const jobs = Array.isArray(jobsResponse.value)
          ? jobsResponse.value
          : jobsResponse.value?.jobPostings || [];
        const jobTitlesMap: Record<string, string> = {};
        const normalizedJobs: JobOption[] = [];
        jobs.forEach((job: any) => {
          const jobId = job?.id || (job?._id ? String(job._id) : null);
          if (jobId && job?.title) {
            jobTitlesMap[String(jobId)] = String(job.title);
            normalizedJobs.push({
              id: String(jobId),
              title: String(job.title),
              isActive: Boolean(job?.isActive),
            });
          }
        });
        setJobs(normalizedJobs);
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

  const extractJobId = (application: any): string | undefined => {
    const rawJobId = application?.jobId;
    if (typeof rawJobId === "string" && rawJobId.trim()) return rawJobId.trim();
    if (rawJobId && typeof rawJobId === "object") {
      const objectId = rawJobId._id || rawJobId.id;
      if (objectId) return String(objectId);
    }
    const detailsId = application?.jobDetails?._id || application?.jobDetails?.id;
    return detailsId ? String(detailsId) : undefined;
  };

  const filteredApplications = useMemo(() => {
    if (overviewFilter === "all") return allApplications;

    if (overviewFilter === "active") {
      const activeJobIds = new Set(
        jobs.filter((job) => job.isActive).map((job) => job.id)
      );

      return allApplications.filter((application) => {
        const jobId = extractJobId(application);
        return jobId ? activeJobIds.has(jobId) : false;
      });
    }

    if (overviewFilter.startsWith("job:")) {
      const selectedJobId = overviewFilter.replace("job:", "");
      return allApplications.filter(
        (application) => extractJobId(application) === selectedJobId
      );
    }

    return allApplications;
  }, [allApplications, jobs, overviewFilter]);

  const computedStats = useMemo(() => {
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    const stats = {
      total: filteredApplications.length,
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

    filteredApplications.forEach((application) => {
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
      recentApplications: [...filteredApplications]
        .sort(
          (a, b) =>
            new Date(b.appliedDate).getTime() - new Date(a.appliedDate).getTime()
        )
        .slice(0, 8),
    };
  }, [filteredApplications, jobTitles]);

  // Chart configurations
  const trendChartData = {
    labels: computedStats.trendLabels,
    datasets: [
      {
        label: 'Applications',
        data: computedStats.trendCounts,
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

  const pieChartData = {
    labels: computedStats.applicationsByJobData.map(item => {
      const position = item.position || 'Unknown Position';
      return position.length > 20 ? `${position.substring(0, 20)}...` : position;
    }) || [],
    datasets: [
      {
        data: computedStats.applicationsByJobData.map(item => item.totalApplications || 0) || [],
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
        <div className="space-y-8 p-4 md:p-6 w-full max-w-none">
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

  const totalApplications = computedStats.stats.total || 1;

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
        <div className="space-y-8 p-4 md:p-6 w-full max-w-none">
          <Card className="border-border shadow-sm">
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-foreground">Overview Filter</h3>
                  <p className="text-sm text-muted-foreground">
                    Filter dashboard stats by active jobs or a selected job posting.
                  </p>
                </div>
                <select
                  value={overviewFilter}
                  onChange={(e) => setOverviewFilter(e.target.value)}
                  className="w-full sm:w-[320px] h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="all">All Jobs</option>
                  <option value="active">Active Jobs Only</option>
                  {jobs
                    .slice()
                    .sort((a, b) => a.title.localeCompare(b.title))
                    .map((job) => (
                      <option key={job.id} value={`job:${job.id}`}>
                        {job.title}
                        {job.isActive ? " (Active)" : " (Inactive)"}
                      </option>
                    ))}
                </select>
              </div>
            </CardContent>
          </Card>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCard
              title="Total Applications"
              value={computedStats.stats.total}
              icon={FileText}
              color="bg-blue-100 text-blue-600"
              path="/admin/applications"
              subtitle={overviewFilter === "all" ? "All time applications" : "Filtered applications"}
              trend={12}
            />
            <MetricCard
              title="Active Jobs"
              value={overviewData.jobs.active}
              icon={Briefcase}
              color="bg-green-100 text-green-600"
              path="/admin/job-postings"
              subtitle="Currently hiring"
              trend={8}
            />
            <MetricCard
              title="Recent Applications"
              value={computedStats.stats.recent}
              icon={Activity}
              color="bg-purple-100 text-purple-600"
              path="/admin/applications"
              subtitle="Last 7 days"
              trend={25}
            />
            <MetricCard
              title="Total Users"
              value={overviewData.users.total}
              icon={Users}
              color="bg-orange-100 text-orange-600"
              path="/admin/user-management"
              subtitle="Registered users"
              trend={5}
            />
          </div>

          {/* Application Status Overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <StatusCard
              title="New"
              count={computedStats.stats.new}
              percentage={(computedStats.stats.new / totalApplications) * 100}
              icon={FileText}
              color="bg-blue-100 text-blue-600"
              path="/admin/applications?status=new"
            />
            <StatusCard
              title="Shortlisted"
              count={computedStats.stats.shortlisted}
              percentage={(computedStats.stats.shortlisted / totalApplications) * 100}
              icon={UserCheck}
              color="bg-green-100 text-green-600"
              path="/admin/shortlisted"
            />
            <StatusCard
              title="Interviewing"
              count={computedStats.stats.interviewing}
              percentage={(computedStats.stats.interviewing / totalApplications) * 100}
              icon={MessageSquare}
              color="bg-purple-100 text-purple-600"
              path="/admin/interviewing"
            />
            <StatusCard
              title="Technical"
              count={computedStats.stats.technical_assessment}
              percentage={(computedStats.stats.technical_assessment / totalApplications) * 100}
              icon={Code}
              color="bg-yellow-100 text-yellow-600"
              path="/admin/technical-assessment"
            />
            <StatusCard
              title="Hired"
              count={computedStats.stats.hired}
              percentage={(computedStats.stats.hired / totalApplications) * 100}
              icon={CheckCircle}
              color="bg-emerald-100 text-emerald-600"
              path="/admin/hired"
            />
            <StatusCard
              title="Disqualified"
              count={computedStats.stats.disqualified}
              percentage={(computedStats.stats.disqualified / totalApplications) * 100}
              icon={XCircle}
              color="bg-red-100 text-red-600"
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
                {computedStats.trendCounts.length > 0 ? (
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
                {computedStats.applicationsByJobData.length > 0 ? (
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

          {/* Recent Applications */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Clock className="h-5 w-5 text-purple-600" />
                  </div>
                  Recent Applications
                </div>
                <Link href="/admin/applications" className="text-primary hover:opacity-90 text-sm font-medium">
                  View All →
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {computedStats.recentApplications.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {computedStats.recentApplications.map((app) => {
                    const firstName = app.answers?.find(a => 
                      a.questionText === "First Name"
                    )?.answer || "Unknown";
                    
                    return (
                      <motion.div
                        key={app.id}
                        whileHover={{ scale: 1.02 }}
                        className="bg-card rounded-lg p-4 border border-border shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer"
                        onClick={() => handleViewApplication(app)}
                      >
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h2 className="text-xl font-semibold text-foreground line-clamp-1">
                              {getPositionDisplay(app, jobTitles)}
                            </h2>
                            <p className="text-sm text-muted-foreground mt-1">
                              {firstName}
                            </p>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewApplication(app);
                            }}
                            className="hover:bg-muted p-1 rounded-full transition-colors"
                          >
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          </button>
                        </div>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between text-sm">
                            <Badge
                              className={`${
                                statusColors[app.status as keyof typeof statusColors] || 
                                "bg-gray-100 text-gray-800"
                              }`}
                            >
                              {app.status}
                            </Badge>
                            <span className="text-muted-foreground">
                              {new Date(app.appliedDate).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  No recent applications
                </div>
              )}
            </CardContent>
          </Card>
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
