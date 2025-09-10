"use client";

import { useState, useEffect, useMemo } from "react";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import { ShortlistedTable } from "@/components/admin/ShortlistedTable";
import useSWR from "swr";
import { EditApplicationModal } from "@/components/admin/EditApplicationModal";
import { ViewApplicationModal } from "@/components/admin/ViewApplicationModal";
import { DeleteApplicationModal } from "@/components/admin/DeleteApplicationModal";
import { Application } from "@/types/application";
import { TableSkeleton } from "@/components/ui/skeleton";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { authService } from "@/lib/auth-backend";
import { adminApi } from "@/lib/api-backend";
import { toast } from "react-hot-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

const fetcher = async (url: string) => {
  const session = authService.getSession();
  if (!session) {
    throw new Error('No authentication session');
  }

  const baseUrl = process.env.NEXT_PUBLIC_PYTHON_API_URL || 'http://localhost:8000';
  const response = await fetch(`${baseUrl}/api${url}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.token}`,
      'Accept': 'application/json'
    }
  });
  
  if (response.status === 401) {
    // Token expired, try to refresh
    const refreshed = await authService.refreshToken();
    if (!refreshed) {
      window.location.href = '/login';
      throw new Error('Session expired');
    }

    // Retry with new token
    const retryResponse = await fetch(`${baseUrl}/api${url}`, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${refreshed.access_token}`,
        'Accept': 'application/json'
      }
    });

    if (!retryResponse.ok) {
      throw new Error('Failed to fetch data');
    }

    const data = await retryResponse.json();
    return data.applications;
  }

  if (!response.ok) {
    throw new Error('Failed to fetch data');
  }
  
  const data = await response.json();
  return data.applications;
};

export default function ShortlistedPage() {
  const router = useRouter();
  const { isAuthenticated, isAdmin, authLoading } = useAuth();
  const [viewApplication, setViewApplication] = useState<Application | null>(null);
  const [editApplication, setEditApplication] = useState<Application | null>(null);
  const [deleteApplicationId, setDeleteApplicationId] = useState<string | null>(null);
  const [jobTitles, setJobTitles] = useState<Record<string, string>>({});
  const [selectedPosition, setSelectedPosition] = useState<string>("all");
  const [jobFilterOptions, setJobFilterOptions] = useState<string[]>([]);

  const { data: applications = [], error, isLoading: isDataLoading, mutate } = useSWR<Application[]>(
    isAuthenticated && isAdmin ? '/applications/shortlisted' : null,
    fetcher
  );

  const isUUID = (str: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);

  const getApplicationPosition = (app: Application): string => {
    // Always use jobId references, never store position directly
    const jobId = app.jobId || (app as any).jobId;
    if (jobId && jobTitles[jobId]) {
      return normalize(jobTitles[jobId]);
    }
    
    return normalize('Position Not Available');
  };

  const normalize = (value: string): string => {
    return value.trim().replace(/\s+/g, " ");
  };

  const positionOptions = useMemo(() => {
    return ["all", ...jobFilterOptions];
  }, [jobFilterOptions]);

  const filteredApplications = useMemo(() => {
    if (selectedPosition === "all") return applications;
    return (applications || []).filter(app => normalize(getApplicationPosition(app)) === selectedPosition);
  }, [applications, selectedPosition, jobTitles]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    } else if (!authLoading && !isAdmin) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, isAdmin, authLoading, router]);

  

  useEffect(() => {
    const fetchJobTitles = async () => {
      try {
        const jobsResponse = await adminApi.getJobPostings();
        const jobs = Array.isArray(jobsResponse) ? jobsResponse : 
                    jobsResponse.jobPostings ? jobsResponse.jobPostings : [];
        
        const jobTitlesMap: Record<string, string> = {};
        
        // Build job titles mapping
        jobs.forEach((job: any) => {
          const jobId = job.id || (job._id ? String(job._id) : null);
          if (jobId && job.title) {
            jobTitlesMap[jobId] = job.title;
          }
        });
        
        setJobTitles(jobTitlesMap);
      } catch (error) {
        console.error('Failed to fetch job titles:', error);
        toast.error('Failed to fetch job titles');
      }
    };
    
    if (isAuthenticated && isAdmin) {
      fetchJobTitles();
    }
  }, [isAuthenticated, isAdmin]);

  // Build filter options when applications or jobTitles change
  useEffect(() => {
    if (applications && applications.length > 0 && Object.keys(jobTitles).length > 0) {
      const optionSet = new Set<string>();
      
      // Add positions from job titles
      Object.values(jobTitles).forEach(title => {
        if (title) optionSet.add(normalize(title));
      });
      
      // Add positions from actual applications
      applications.forEach((app: Application) => {
        const position = getApplicationPosition(app);
        if (position && position !== 'Position Not Available' && position !== 'N/A') {
          optionSet.add(normalize(position));
        }
      });
      
      setJobFilterOptions(Array.from(optionSet).sort((a, b) => a.localeCompare(b)));
    }
  }, [applications, jobTitles]);

  if (authLoading || isDataLoading) {
    return (
      <AdminPageLayout title="Shortlisted Applications" showSearch={false}>
        <TableSkeleton rows={10} columns={6} />
      </AdminPageLayout>
    );
  }

  if (!isAuthenticated || !isAdmin) {
    return null; // Router will handle the redirect
  }

  if (error) return <div>Failed to load shortlisted applications</div>;

  function handleView(id: string) {
    const application = applications.find((app) => app.id === id);
    setViewApplication(application || null);
  }

  function handleEdit(id: string) {
    const application = applications.find((app) => app.id === id);
    setEditApplication(application || null);
  }

  function handleDelete(id: string) {
    setDeleteApplicationId(id);
  }

  async function handleSaveEdit(updatedApplication: Application) {
    try {
      const session = authService.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_PYTHON_API_URL}/api/applications/${updatedApplication.id}`, {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          'Authorization': `Bearer ${session.token}`,
          'Accept': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(updatedApplication),
      });

      if (response.status === 401) {
        const refreshed = await authService.refreshToken();
        if (!refreshed) {
          router.push('/login');
          return;
        }

        // Retry with new token
        await fetch(`${process.env.NEXT_PUBLIC_PYTHON_API_URL}/api/applications/${updatedApplication.id}`, {
          method: "PUT",
          headers: { 
            "Content-Type": "application/json",
            'Authorization': `Bearer ${refreshed.access_token}`,
            'Accept': 'application/json'
          },
          credentials: 'include',
          body: JSON.stringify(updatedApplication),
        });
      }

      mutate();
      setEditApplication(null);
    } catch (error) {
      console.error("Failed to update application:", error);
    }
  }

  async function handleConfirmDelete(id: string) {
    try {
      const session = authService.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_PYTHON_API_URL}/api/applications/${id}`, {
        method: "DELETE",
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${session.token}`,
          'Accept': 'application/json'
        }
      });

      if (response.status === 401) {
        const refreshed = await authService.refreshToken();
        if (!refreshed) {
          router.push('/login');
          return;
        }

        // Retry with new token
        await fetch(`${process.env.NEXT_PUBLIC_PYTHON_API_URL}/api/applications/${id}`, {
          method: "DELETE",
          credentials: 'include',
          headers: {
            'Authorization': `Bearer ${refreshed.access_token}`,
            'Accept': 'application/json'
          }
        });
      }

      mutate();
      setDeleteApplicationId(null);
    } catch (error) {
      console.error("Failed to delete application:", error);
    }
  }

  return (
    <AdminPageLayout title="Shortlisted Applications" showSearch={false}>
      <div className="p-6">
        <div className="mb-4 flex items-end gap-4">
          <div className="w-64">
            <Label htmlFor="position-filter">Filter by position</Label>
            <Select value={selectedPosition} onValueChange={setSelectedPosition}>
              <SelectTrigger id="position-filter">
                <SelectValue placeholder="Select position" />
              </SelectTrigger>
              <SelectContent>
                {positionOptions.map(option => (
                  <SelectItem key={option} value={option}>
                    {option === "all" ? "All Positions" : option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <ShortlistedTable
            applications={filteredApplications}
            jobTitles={jobTitles}
            onView={handleView}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        </div>

        {/* Modals */}
        <ViewApplicationModal
          application={viewApplication}
          isOpen={!!viewApplication}
          onClose={() => setViewApplication(null)}
          jobTitles={jobTitles}
        />
        <EditApplicationModal
          application={editApplication}
          isOpen={!!editApplication}
          onClose={() => setEditApplication(null)}
          onSave={handleSaveEdit}
          jobTitles={jobTitles}
        />
        <DeleteApplicationModal
          applicationId={deleteApplicationId}
          isOpen={!!deleteApplicationId}
          onClose={() => setDeleteApplicationId(null)}
          onConfirm={handleConfirmDelete}
        />
      </div>
    </AdminPageLayout>
  );
}
