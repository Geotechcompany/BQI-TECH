"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import { TourPageHelper } from "@/components/admin/tour/TourPageHelper";
import { PipelineSettingsForm } from "@/components/admin/pipeline/PipelineSettingsForm";
import { normalizePipelineSettings } from "@/components/admin/pipeline/pipeline-settings-config";
import { TableSkeleton } from "@/components/ui/skeleton";
import { FailedStatusState } from "@/components/ui/failed-status-state";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { authService } from "@/lib/auth-backend";
import { BACKEND_URL } from "@/lib/config";
import { adminApi } from "@/lib/api-backend";
import { PipelineSettings } from "@/types/pipeline-settings";
import {
  ApplicationQuestionnaire,
  HiringTeamMember,
  PipelineStageConfig,
} from "@/types/job-wizard";
import { ArrowLeft, Columns3 } from "lucide-react";
import { toast } from "react-hot-toast";

interface JobPostingRecord {
  id: string;
  title: string;
  pipelineSettings?: PipelineSettings;
  pipelineStages?: PipelineStageConfig[];
  questionnaires?: ApplicationQuestionnaire[];
  hiringTeam?: HiringTeamMember[];
}

function getUserDisplayName(user: {
  name?: string;
  firstName?: string;
  lastName?: string;
} | null | undefined): string {
  if (!user) return "";
  if (user.name?.trim()) return user.name.trim();
  return [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
}

export default function JobPipelineSettingsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, isAdmin, authLoading, user } = useAuth();
  const initialExpandedStageId = searchParams.get("stage");

  const [job, setJob] = useState<JobPostingRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    } else if (!authLoading && !isAdmin) {
      router.push("/dashboard");
    }
  }, [isAuthenticated, isAdmin, authLoading, router]);

  const displayName = getUserDisplayName(user);

  const loadJob = useCallback(async () => {
    if (!id) return;

    try {
      setIsLoading(true);
      setError(null);

      const session = authService.getSession();
      if (!session) {
        throw new Error("No authentication session");
      }

      const response = await fetch(`${BACKEND_URL}/api/admin/job-postings/${id}`, {
        headers: {
          Authorization: `Bearer ${session.token}`,
          Accept: "application/json",
        },
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to load position");
      }

      const jobData = await response.json();
      setJob({
        id: String(jobData.id || jobData._id),
        title: jobData.title || "Position",
        pipelineSettings: normalizePipelineSettings(
          jobData.pipelineSettings,
          displayName
        ),
        pipelineStages: Array.isArray(jobData.pipelineStages)
          ? jobData.pipelineStages
          : [],
        questionnaires: Array.isArray(jobData.questionnaires)
          ? jobData.questionnaires
          : [],
        hiringTeam: Array.isArray(jobData.hiringTeam)
          ? jobData.hiringTeam
          : [],
      });
    } catch (err) {
      console.error("Failed to load pipeline settings:", err);
      setError(err instanceof Error ? err.message : "Failed to load pipeline settings");
    } finally {
      setIsLoading(false);
    }
  }, [id, displayName]);

  useEffect(() => {
    if (!id || !isAuthenticated || !isAdmin) return;
    void loadJob();
  }, [id, isAuthenticated, isAdmin, loadJob]);

  const handleSave = useCallback(
    async (pipelineSettings: PipelineSettings) => {
      if (!id) return;

      setIsSaving(true);
      try {
        const updated = await adminApi.updateJobPosting(id, { pipelineSettings });
        setJob((current) => ({
          id: String(updated.id || updated._id || id),
          title: updated.title || current?.title || "Position",
          pipelineSettings: normalizePipelineSettings(
            updated.pipelineSettings ?? pipelineSettings,
            displayName
          ),
          pipelineStages: current?.pipelineStages,
          questionnaires: current?.questionnaires,
          hiringTeam: current?.hiringTeam,
        }));
        toast.success("Pipeline settings saved");
      } catch (err) {
        console.error("Failed to save pipeline settings:", err);
        toast.error(
          err instanceof Error ? err.message : "Failed to save pipeline settings"
        );
        throw err;
      } finally {
        setIsSaving(false);
      }
    },
    [id, job?.title, displayName]
  );

  if (isLoading || authLoading) {
    return (
      <AdminPageLayout title="Pipeline settings" showSearch={false}>
        <TableSkeleton rows={6} columns={4} />
      </AdminPageLayout>
    );
  }

  if (!isAuthenticated || !isAdmin) {
    return null;
  }

  if (error || !job) {
    return (
      <AdminPageLayout title="Pipeline settings" showSearch={false}>
        <FailedStatusState message={error || "Position not found"} />
      </AdminPageLayout>
    );
  }

  const pageTitle = job.title ? `${job.title} — Pipeline settings` : "Pipeline settings";

  return (
    <AdminPageLayout
      title={pageTitle}
      showSearch={false}
      tourId="pipeline-settings"
      headerActions={
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/admin/jobs/${id}/pipeline`}>
              <Columns3 className="mr-2 h-4 w-4" />
              Pipeline board
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/job-postings">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Positions
            </Link>
          </Button>
        </div>
      }
    >
      <TourPageHelper tourId="pipeline-settings" />
      <PipelineSettingsForm
        initialSettings={
          job.pipelineSettings ?? normalizePipelineSettings(null, displayName)
        }
        jobTitle={job.title}
        defaultEmailSenderName={displayName}
        initialExpandedStageId={initialExpandedStageId}
        pipelineStages={job.pipelineStages}
        questionnaires={job.questionnaires}
        hiringTeam={job.hiringTeam}
        previewHref={`/admin/jobs/${id}/pipeline`}
        onSave={handleSave}
        isSaving={isSaving}
      />
    </AdminPageLayout>
  );
}
