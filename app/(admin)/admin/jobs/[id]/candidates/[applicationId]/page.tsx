"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { CandidateProfilePage } from "@/components/admin/candidate-profile/CandidateProfilePage";
import { sortSiblingApplications } from "@/components/admin/candidate-profile/application-helpers";
import { TableSkeleton } from "@/components/ui/skeleton";
import { FailedStatusState } from "@/components/ui/failed-status-state";
import { useAuth } from "@/contexts/AuthContext";
import { adminApplicationsApi } from "@/components/admin/utils/applications-api";
import { Application } from "@/types/application";
import { authService } from "@/lib/auth-backend";
import { BACKEND_URL } from "@/lib/config";
import { TourPageHelper } from "@/components/admin/tour/TourPageHelper";

interface JobPostingDetails {
  title: string;
  location?: string;
}

export default function CandidateProfileRoutePage() {
  const { id: jobId, applicationId } = useParams<{
    id: string;
    applicationId: string;
  }>();
  const router = useRouter();
  const { isAuthenticated, isAdmin, authLoading } = useAuth();

  const [application, setApplication] = useState<Application | null>(null);
  const [siblings, setSiblings] = useState<Application[]>([]);
  const [job, setJob] = useState<JobPostingDetails | null>(null);
  const [jobTitles, setJobTitles] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    } else if (!authLoading && !isAdmin) {
      router.push("/dashboard");
    }
  }, [isAuthenticated, isAdmin, authLoading, router]);

  const loadProfile = useCallback(async () => {
    if (!jobId || !applicationId) return;

    try {
      setIsLoading(true);
      setError(null);

      const session = authService.getSession();
      if (!session) {
        throw new Error("No authentication session");
      }

      const [jobResponse, applicationData, siblingsResponse] = await Promise.all([
        fetch(`${BACKEND_URL}/api/admin/job-postings/${jobId}`, {
          headers: {
            Authorization: `Bearer ${session.token}`,
            Accept: "application/json",
          },
          credentials: "include",
        }),
        adminApplicationsApi.getApplication(applicationId),
        adminApplicationsApi.getAllApplicationsPaginated({ jobId }),
      ]);

      if (!jobResponse.ok) {
        throw new Error("Failed to load position");
      }

      const jobData = await jobResponse.json();
      setJob({
        title: jobData.title || "Position",
        location: jobData.location || jobData.jobDetails?.location,
      });

      if (jobData.title) {
        setJobTitles({ [jobId]: jobData.title });
      }

      setApplication(applicationData as Application);
      setSiblings(
        sortSiblingApplications(siblingsResponse.applications || [])
      );
    } catch (err) {
      console.error("Failed to load candidate profile:", err);
      setError(err instanceof Error ? err.message : "Failed to load candidate profile");
    } finally {
      setIsLoading(false);
    }
  }, [applicationId, jobId]);

  useEffect(() => {
    if (!jobId || !applicationId || !isAuthenticated || !isAdmin) return;
    void loadProfile();
  }, [jobId, applicationId, isAuthenticated, isAdmin, loadProfile]);

  if (isLoading || authLoading) {
    return (
      <div className="flex h-full min-h-0 flex-col p-4">
        <TableSkeleton rows={8} columns={3} />
      </div>
    );
  }

  if (!isAuthenticated || !isAdmin) {
    return null;
  }

  if (error || !application || !job) {
    return (
      <div className="flex h-full min-h-0 items-center p-4">
        <FailedStatusState message={error || "Candidate not found"} />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <TourPageHelper tourId="candidate-profile" />
      <CandidateProfilePage
        jobId={jobId}
        applicationId={applicationId}
        initialApplication={application}
        siblings={siblings}
        job={job}
        jobTitles={jobTitles}
      />
    </div>
  );
}
