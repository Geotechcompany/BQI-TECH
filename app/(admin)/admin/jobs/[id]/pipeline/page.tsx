"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import { type PipelineStage } from "@/components/admin/pipeline/PipelineBoard";
import { PipelineSkeleton } from "@/components/ui/skeleton";
import { FailedStatusState } from "@/components/ui/failed-status-state";
import { Button } from "@/components/ui/button";
import { GenerateButton } from "@/components/ui/generate-button";
import { useAuth } from "@/contexts/AuthContext";
import { useAiRank } from "@/contexts/AiRankContext";
import { adminApplicationsApi } from "@/components/admin/utils/applications-api";
import { Application } from "@/types/application";
import { ArrowLeft, LayoutList, Plus, Settings2 } from "lucide-react";
import { resolveJobPipelineStages } from "@/components/admin/pipeline/pipeline-settings-config";
import { AddCandidateDialog } from "@/components/admin/pipeline/AddCandidateDialog";
import { authService } from "@/lib/auth-backend";
import { BACKEND_URL } from "@/lib/config";
import { toast } from "react-hot-toast";
import type { AppHotToastOptions } from "@/components/ui/app-toaster";
import { LAST_PIPELINE_JOB_KEY } from "@/components/admin/pipeline/pipeline-utils";
import { TourPageHelper } from "@/components/admin/tour/TourPageHelper";

const PipelineBoard = dynamic(
  () =>
    import("@/components/admin/pipeline/PipelineBoard").then(
      (mod) => mod.PipelineBoard
    ),
  {
    ssr: false,
    loading: () => <PipelineSkeleton />,
  }
);

interface JobPostingDetails {
  title: string;
  location?: string;
  department?: string;
  pipelineStages?: import("@/types/job-wizard").PipelineStageConfig[];
  pipelineSettings?: import("@/types/pipeline-settings").PipelineSettings;
}

export default function JobPipelinePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { isAuthenticated, isAdmin, authLoading } = useAuth();
  const [job, setJob] = useState<JobPostingDetails | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [jobTitles, setJobTitles] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingApplicationId, setUpdatingApplicationId] = useState<string | null>(null);
  const [addCandidateOpen, setAddCandidateOpen] = useState(false);
  const [addCandidateStage, setAddCandidateStage] = useState<string>("New");
  const { rankApplications, isRanking, isBackground, sendToBackground } =
    useAiRank();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    } else if (!authLoading && !isAdmin) {
      router.push("/dashboard");
    }
  }, [isAuthenticated, isAdmin, authLoading, router]);

  // Keep scoring chrome in the header chip / pill — not the full top banner.
  useEffect(() => {
    if (isRanking && !isBackground) {
      sendToBackground();
    }
  }, [isRanking, isBackground, sendToBackground]);

  const loadPipeline = useCallback(async () => {
    if (!id) return;

    try {
      setIsLoading(true);
      setError(null);

      const session = authService.getSession();
      if (!session) {
        throw new Error("No authentication session");
      }

      const jobResponse = await fetch(
        `${BACKEND_URL}/api/admin/job-postings/${id}`,
        {
          headers: {
            Authorization: `Bearer ${session.token}`,
            Accept: "application/json",
          },
          credentials: "include",
        }
      );

      if (!jobResponse.ok) {
        throw new Error("Failed to load position");
      }

      const jobData = await jobResponse.json();
      setJob({
        title: jobData.title || "Position",
        location: jobData.location || jobData.jobDetails?.location,
        department: jobData.department,
        pipelineStages: jobData.pipelineStages,
        pipelineSettings: jobData.pipelineSettings,
      });

      if (jobData.title) {
        setJobTitles((current) => ({ ...current, [id]: jobData.title }));
      }

      const response = await adminApplicationsApi.getAllApplicationsPaginated({
        jobId: id,
      });
      setApplications(response.applications || []);
    } catch (err) {
      console.error("Failed to load pipeline:", err);
      setError(err instanceof Error ? err.message : "Failed to load pipeline");
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!id || !isAuthenticated || !isAdmin) return;
    void loadPipeline();
    try {
      localStorage.setItem(LAST_PIPELINE_JOB_KEY, id);
    } catch {
      // localStorage may be unavailable in private browsing
    }
  }, [id, isAuthenticated, isAdmin, loadPipeline]);

  const handleStatusChange = useCallback(
    async (
      applicationId: string,
      newStatus: PipelineStage,
      previousStatus: string
    ) => {
      const previousApplications = applications;
      const target = applications.find((app) => app.id === applicationId);
      if (!target) return;

      const optimisticApplication: Application = {
        ...target,
        status: newStatus,
        statusHistory: [
          ...(target.statusHistory || []),
          {
            status: newStatus,
            date: new Date().toISOString(),
            metadata: { previousStatus },
          },
        ],
      };

      setApplications((current) =>
        current.map((app) =>
          app.id === applicationId ? optimisticApplication : app
        )
      );
      setUpdatingApplicationId(applicationId);

      try {
        const saved = (await adminApplicationsApi.updateApplication(
          applicationId,
          { status: newStatus }
        )) as Application;

        setApplications((current) =>
          current.map((app) =>
            app.id === applicationId ? { ...app, ...saved, status: newStatus } : app
          )
        );

        toast.success(`Moved to ${newStatus}`, {
          duration: 20000,
          action: {
            label: "Undo",
            onClick: () => {
              void (async () => {
                setApplications(previousApplications);
                setUpdatingApplicationId(applicationId);
                try {
                  await adminApplicationsApi.updateApplication(applicationId, {
                    status: previousStatus,
                  });
                } catch (undoErr) {
                  console.error("Failed to undo status change:", undoErr);
                  setApplications((current) =>
                    current.map((app) =>
                      app.id === applicationId
                        ? { ...app, ...saved, status: newStatus }
                        : app
                    )
                  );
                  toast.error(
                    undoErr instanceof Error
                      ? undoErr.message
                      : "Failed to undo stage change"
                  );
                } finally {
                  setUpdatingApplicationId(null);
                }
              })();
            },
          },
        } as AppHotToastOptions);
      } catch (err) {
        setApplications(previousApplications);
        console.error("Failed to update status:", err);
        toast.error(
          err instanceof Error ? err.message : "Failed to update candidate status"
        );
      } finally {
        setUpdatingApplicationId(null);
      }
    },
    [applications]
  );

  const handleCardClick = useCallback(
    (application: Application) => {
      router.push(`/manage/jobs/${id}/candidates/${application.id}`);
    },
    [id, router]
  );

  const handleOpenDiscussion = useCallback(
    (application: Application) => {
      router.push(
        `/manage/jobs/${id}/candidates/${application.id}?tab=discussion`
      );
    },
    [id, router]
  );

  const handleArchive = useCallback(
    async (applicationId: string) => {
      const previousApplications = applications;
      const target = applications.find((app) => app.id === applicationId);
      if (!target) return;

      setApplications((current) =>
        current.filter((app) => app.id !== applicationId)
      );
      setUpdatingApplicationId(applicationId);

      try {
        await adminApplicationsApi.bulkArchiveApplications([applicationId]);
        toast.success("Candidate archived");
      } catch (err) {
        setApplications(previousApplications);
        console.error("Failed to archive candidate:", err);
        toast.error(
          err instanceof Error ? err.message : "Failed to archive candidate"
        );
      } finally {
        setUpdatingApplicationId(null);
      }
    },
    [applications]
  );

  const handleAddCandidate = useCallback((stageLabel: string) => {
    setAddCandidateStage(stageLabel);
    setAddCandidateOpen(true);
  }, []);

  const handleBulkMoveToStage = useCallback(
    async (applicationIds: string[], targetStageLabel: string) => {
      if (applicationIds.length === 0) return;

      const previousApplications = applications;
      const idSet = new Set(applicationIds);

      setApplications((current) =>
        current.map((app) =>
          idSet.has(app.id) ? { ...app, status: targetStageLabel } : app
        )
      );
      setUpdatingApplicationId(applicationIds[0] ?? null);

      try {
        await adminApplicationsApi.bulkUpdateStatus({
          ids: applicationIds,
          status: targetStageLabel,
        });
        toast.success(
          `Moved ${applicationIds.length} candidate${applicationIds.length === 1 ? "" : "s"} to ${targetStageLabel}`,
          {
            duration: 20000,
            action: {
              label: "Undo",
              onClick: () => {
                void (async () => {
                  setApplications(previousApplications);
                  setUpdatingApplicationId(applicationIds[0] ?? null);
                  try {
                    const byPreviousStatus = new Map<string, string[]>();
                    for (const applicationId of applicationIds) {
                      const previous = previousApplications.find(
                        (app) => app.id === applicationId
                      );
                      const previousStatus = previous?.status || "New";
                      const group = byPreviousStatus.get(previousStatus) ?? [];
                      group.push(applicationId);
                      byPreviousStatus.set(previousStatus, group);
                    }
                    await Promise.all(
                      Array.from(byPreviousStatus.entries()).map(
                        ([status, ids]) =>
                          adminApplicationsApi.bulkUpdateStatus({ ids, status })
                      )
                    );
                  } catch (undoErr) {
                    console.error("Failed to undo bulk move:", undoErr);
                    setApplications((current) =>
                      current.map((app) =>
                        idSet.has(app.id)
                          ? { ...app, status: targetStageLabel }
                          : app
                      )
                    );
                    toast.error(
                      undoErr instanceof Error
                        ? undoErr.message
                        : "Failed to undo stage change"
                    );
                  } finally {
                    setUpdatingApplicationId(null);
                  }
                })();
              },
            },
          } as AppHotToastOptions
        );
      } catch (err) {
        setApplications(previousApplications);
        console.error("Failed to bulk move candidates:", err);
        toast.error(
          err instanceof Error ? err.message : "Failed to move candidates"
        );
      } finally {
        setUpdatingApplicationId(null);
      }
    },
    [applications]
  );

  const handleBulkRunIntelligence = useCallback(
    async (applicationIds: string[]) => {
      if (applicationIds.length === 0) return;

      const resolveName = (applicationId: string) => {
        const application = applications.find((app) => app.id === applicationId);
        return application?.name || "Candidate";
      };

      try {
        await rankApplications(applicationIds, resolveName, {
          mode: "batch",
          onComplete: ({ results: ranked }) => {
            const byId = new Map(ranked.map((item) => [item.id, item]));
            setApplications((current) =>
              current.map((app) => {
                const rankedItem = byId.get(app.id);
                if (!rankedItem) return app;
                return {
                  ...app,
                  aiRankScore: rankedItem.aiRankScore,
                  aiRankSummary: rankedItem.aiRankSummary,
                  aiRankStrengths: rankedItem.aiRankStrengths,
                  aiRankGaps: rankedItem.aiRankGaps,
                  aiRankRequirements:
                    rankedItem.aiRankRequirements as Application["aiRankRequirements"],
                  aiRankScoreReason: rankedItem.aiRankScoreReason,
                  aiRankRecommendation: rankedItem.aiRankRecommendation,
                  aiRankedAt: rankedItem.aiRankedAt,
                };
              })
            );
          },
        });
      } catch (err) {
        console.error("Failed to run BQI Intelligence:", err);
        toast.error(
          err instanceof Error ? err.message : "Failed to run BQI Intelligence"
        );
      }
    },
    [applications, rankApplications]
  );

  const handleBulkDeleteCandidates = useCallback(
    async (applicationIds: string[]) => {
      if (applicationIds.length === 0) return;

      const previousApplications = applications;
      const idSet = new Set(applicationIds);

      setApplications((current) =>
        current.filter((app) => !idSet.has(app.id))
      );
      setUpdatingApplicationId(applicationIds[0] ?? null);

      try {
        const result =
          await adminApplicationsApi.bulkArchiveApplications(applicationIds);
        toast.success(
          result.message ||
            `Archived ${applicationIds.length} candidate${applicationIds.length === 1 ? "" : "s"}`
        );
      } catch (err) {
        setApplications(previousApplications);
        console.error("Failed to delete candidates:", err);
        toast.error(
          err instanceof Error ? err.message : "Failed to delete candidates"
        );
      } finally {
        setUpdatingApplicationId(null);
      }
    },
    [applications]
  );

  if (isLoading || authLoading) {
    return (
      <AdminPageLayout title="Pipeline" showSearch={false}>
        <div className="px-4 pb-6 pt-2">
          <PipelineSkeleton />
        </div>
      </AdminPageLayout>
    );
  }

  if (!isAuthenticated || !isAdmin) {
    return null;
  }

  if (error) {
    return (
      <AdminPageLayout title="Pipeline" showSearch={false}>
        <FailedStatusState message={error} />
      </AdminPageLayout>
    );
  }

  const pageTitle = job?.title ? `${job.title} — Pipeline` : "Pipeline";
  const pipelineStages = job
    ? resolveJobPipelineStages({
        pipelineSettings: job.pipelineSettings,
        pipelineStages: job.pipelineStages,
      })
    : undefined;

  return (
    <AdminPageLayout
      title={pageTitle}
      showSearch={false}
      fillViewport
      tourId="pipeline"
      headerActions={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            className="bg-[#31CDFF] text-white hover:bg-[#31CDFF]/90"
            onClick={() => {
              setAddCandidateStage(pipelineStages?.[0]?.label ?? "New");
              setAddCandidateOpen(true);
            }}
            data-tour="pipeline-add-candidate"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Candidates
          </Button>
          <GenerateButton
            label="Source Candidates"
            isGenerating={false}
            onClick={() => router.push("/manage/applicants")}
            className="text-sm"
          />
          <Button variant="outline" size="sm" asChild>
            <Link
              href={`/manage/jobs/${id}/pipeline/settings`}
              data-tour="pipeline-settings"
            >
              <Settings2 className="mr-2 h-4 w-4" />
              Pipeline settings
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link
              href={`/manage/candidates?jobId=${id}`}
              data-tour="pipeline-list-view"
            >
              <LayoutList className="mr-2 h-4 w-4" />
              List view
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/manage/job-postings">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Positions
            </Link>
          </Button>
        </div>
      }
    >
      <TourPageHelper tourId="pipeline" />
      <PipelineBoard
        applications={applications}
        stages={pipelineStages}
        jobId={id}
        jobTitles={jobTitles}
        jobTitle={job?.title}
        jobLocation={job?.location}
        onStatusChange={handleStatusChange}
        onCardClick={handleCardClick}
        onArchive={handleArchive}
        onOpenDiscussion={handleOpenDiscussion}
        onAddCandidate={handleAddCandidate}
        onBulkMoveToStage={handleBulkMoveToStage}
        onBulkRunIntelligence={handleBulkRunIntelligence}
        onBulkDeleteCandidates={handleBulkDeleteCandidates}
        updatingApplicationId={updatingApplicationId}
        className="min-h-0 flex-1"
      />

      <AddCandidateDialog
        jobId={id}
        open={addCandidateOpen}
        onOpenChange={setAddCandidateOpen}
        defaultStage={addCandidateStage}
        onCreated={(application) => {
          setApplications((current) => [...current, application]);
        }}
      />

    </AdminPageLayout>
  );
}
