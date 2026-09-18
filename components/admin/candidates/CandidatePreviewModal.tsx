"use client";

import { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";
import { CandidateProfilePage } from "@/components/admin/candidate-profile/CandidateProfilePage";
import { sortSiblingApplications } from "@/components/admin/candidate-profile/application-helpers";
import { MENTION_LIST_ATTR } from "@/components/admin/candidate-profile/TeamDiscussion";
import { adminShellOffset } from "@/components/admin/DashboardSidebar";
import { adminApplicationsApi } from "@/components/admin/utils/applications-api";
import { TableSkeleton } from "@/components/ui/skeleton";
import { FailedStatusState } from "@/components/ui/failed-status-state";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSettings } from "@/contexts/SettingsContext";
import { authService } from "@/lib/auth-backend";
import { BACKEND_URL } from "@/lib/config";
import type { Application } from "@/types/application";

function isTeamMentionListTarget(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest(`[${MENTION_LIST_ATTR}]`));
}

interface JobPostingDetails {
  title: string;
  location?: string;
}

export interface CandidatePreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string | null;
  applicationId: string | null;
  /** Called after the modal closes so the list can refresh. */
  onAfterClose?: () => void;
}

/** Desktop shell width only — dual-rail is `hidden` below md. */
function useDesktopShellOffset(shellOffsetPx: number) {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const sync = () => setOffset(mq.matches ? shellOffsetPx : 0);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [shellOffsetPx]);

  return offset;
}

export function CandidatePreviewModal({
  open,
  onOpenChange,
  jobId,
  applicationId,
  onAfterClose,
}: CandidatePreviewModalProps) {
  const { sidebarCollapsed } = useSettings();
  const shellOffsetPx = adminShellOffset(sidebarCollapsed);
  const desktopShellOffset = useDesktopShellOffset(shellOffsetPx);

  const [activeApplicationId, setActiveApplicationId] = useState<string | null>(
    applicationId
  );
  const [application, setApplication] = useState<Application | null>(null);
  const [siblings, setSiblings] = useState<Application[]>([]);
  const [job, setJob] = useState<JobPostingDetails | null>(null);
  const [jobTitles, setJobTitles] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && applicationId) {
      setActiveApplicationId(applicationId);
    }
    if (!open) {
      setApplication(null);
      setSiblings([]);
      setJob(null);
      setError(null);
      setActiveApplicationId(null);
    }
  }, [open, applicationId]);

  const loadProfile = useCallback(async () => {
    if (!jobId || !activeApplicationId) return;

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
        adminApplicationsApi.getApplication(activeApplicationId),
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
      setSiblings(sortSiblingApplications(siblingsResponse.applications || []));
    } catch (err) {
      console.error("Failed to load candidate preview:", err);
      setError(
        err instanceof Error ? err.message : "Failed to load candidate profile"
      );
      setApplication(null);
      setJob(null);
    } finally {
      setIsLoading(false);
    }
  }, [activeApplicationId, jobId]);

  useEffect(() => {
    if (!open || !jobId || !activeApplicationId) return;
    void loadProfile();
  }, [open, jobId, activeApplicationId, loadProfile]);

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      onAfterClose?.();
    }
  };

  const handleClose = () => {
    handleOpenChange(false);
  };

  // Center over the content column: (viewport + shell) / 2, not full viewport.
  const contentLeft =
    desktopShellOffset > 0
      ? `calc(50% + ${desktopShellOffset / 2}px)`
      : "50%";
  const contentWidth =
    desktopShellOffset > 0
      ? `min(1400px, calc(100vw - ${desktopShellOffset}px - 24px))`
      : "min(1400px, 96vw)";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        overlayClassName="bg-black/55"
        overlayStyle={
          desktopShellOffset > 0
            ? { left: desktopShellOffset }
            : undefined
        }
        className="flex h-[92vh] max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:rounded-lg"
        style={{
          left: contentLeft,
          width: contentWidth,
          maxWidth: contentWidth,
        }}
        onPointerDownOutside={(event) => {
          if (isTeamMentionListTarget(event.target)) {
            event.preventDefault();
          }
        }}
        onInteractOutside={(event) => {
          if (isTeamMentionListTarget(event.target)) {
            event.preventDefault();
          }
        }}
        onFocusOutside={(event) => {
          if (isTeamMentionListTarget(event.target)) {
            event.preventDefault();
          }
        }}
      >
        <DialogTitle className="sr-only">Candidate preview</DialogTitle>
        <DialogDescription className="sr-only">
          Review and update this candidate without leaving the list.
        </DialogDescription>

        {/* Chrome close — always visible (loading / error / profile). */}
        <DialogClose
          type="button"
          className="absolute right-3 top-3 z-[60] inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/25 bg-[#272156]/85 text-white shadow-md transition-colors hover:bg-[#272156] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#31CDFF] focus-visible:ring-offset-2"
          aria-label="Close candidate preview"
        >
          <X className="h-5 w-5" strokeWidth={2.25} />
          <span className="sr-only">Close</span>
        </DialogClose>

        <div className="relative z-0 flex min-h-0 flex-1 flex-col overflow-hidden">
          {!jobId || !activeApplicationId ? (
            <div className="flex flex-1 items-center p-6">
              <FailedStatusState message="This candidate is not linked to a position." />
            </div>
          ) : isLoading ? (
            <div className="flex flex-1 flex-col p-4">
              <TableSkeleton rows={8} columns={3} />
            </div>
          ) : error || !application || !job ? (
            <div className="flex flex-1 items-center p-6">
              <FailedStatusState message={error || "Candidate not found"} />
            </div>
          ) : (
            <CandidateProfilePage
              key={activeApplicationId}
              jobId={jobId}
              applicationId={activeApplicationId}
              initialApplication={application}
              siblings={siblings}
              job={job}
              jobTitles={jobTitles}
              onClose={handleClose}
              onNavigateSibling={setActiveApplicationId}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
