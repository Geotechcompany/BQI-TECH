"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Briefcase,
  ClipboardList,
  Power,
  PowerOff,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import { AdminPageWelcomeBanner } from "@/components/admin/AdminPageWelcomeBanner";
import { TourPageHelper } from "@/components/admin/tour/TourPageHelper";
import { DeleteJobPostingModal } from "@/components/admin/DeleteJobPostingModal";
import {
  JobPostingManageCard,
  type JobPostingManageItem,
} from "@/components/admin/job-postings/JobPostingManageCard";
import { CardSkeleton } from "@/components/ui/skeleton";
import toast from "react-hot-toast";
import { useAuth } from "@/contexts/AuthContext";
import { authService } from "@/lib/auth-backend";
import { adminApi } from "@/lib/api-backend";
import {
  canActivateJob,
  formatActivationApiError,
  formatMissingActivationMessage,
  getMissingActivationFields,
} from "@/lib/job-activation";
import { type JobPostingLifecycleStatus } from "@/lib/job-posting-status";
import { cn } from "@/lib/utils";

interface JobPosting {
  id: string;
  title: string;
  department: string;
  location: string;
  description: string;
  pipelineStages?: Array<{ enabled?: boolean } | Record<string, unknown>>;
  postedDate: string;
  isActive: boolean;
  status?: JobPostingLifecycleStatus | "closed";
}

async function runSettledMutations(
  ids: string[],
  mutate: (id: string) => Promise<unknown>
): Promise<{ succeeded: number; failed: number }> {
  let succeeded = 0;
  let failed = 0;
  for (const id of ids) {
    try {
      await mutate(id);
      succeeded += 1;
    } catch (err) {
      console.error(`Bulk mutation failed for ${id}:`, err);
      failed += 1;
    }
  }
  return { succeeded, failed };
}

export default function JobPostingsPage() {
  const [jobPostings, setJobPostings] = useState<JobPosting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const router = useRouter();
  const { isAuthenticated, isAdmin, authLoading } = useAuth();
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    title?: string;
  } | null>(null);

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !isAdmin)) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, isAdmin, router]);

  const fetchJobPostings = useCallback(async () => {
    try {
      const session = authService.getSession();
      if (!session) {
        router.push("/login");
        return;
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_PYTHON_API_URL}/api/admin/job-postings`,
        {
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.token}`,
            Accept: "application/json",
          },
        }
      );

      if (response.status === 401) {
        const refreshed = await authService.refreshToken();
        if (!refreshed) {
          router.push("/login");
          return;
        }

        const retryResponse = await fetch(
          `${process.env.NEXT_PUBLIC_PYTHON_API_URL}/api/admin/job-postings`,
          {
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${refreshed.access_token}`,
              Accept: "application/json",
            },
          }
        );

        if (!retryResponse.ok) {
          throw new Error("Failed to fetch job postings");
        }

        const data = await retryResponse.json();
        setJobPostings(data.jobPostings || []);
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to fetch job postings");
      }

      const data = await response.json();
      setJobPostings(data.jobPostings || []);
    } catch (err) {
      console.error("Error fetching job postings:", err);
      setError("Failed to load positions. Please try again.");
    }
  }, [router]);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      await fetchJobPostings();
      setIsLoading(false);
    }

    if (isAuthenticated && isAdmin) {
      void load();
    }
  }, [isAuthenticated, isAdmin, fetchJobPostings]);

  const handleEdit = (id: string) => {
    router.push(`/manage/job-postings/${id}/wizard`);
  };

  const confirmDelete = async (id: string) => {
    try {
      const session = authService.getSession();
      if (!session) {
        router.push("/login");
        return;
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_PYTHON_API_URL}/api/admin/job-postings/${id}`,
        {
          method: "DELETE",
          credentials: "include",
          headers: {
            Authorization: `Bearer ${session.token}`,
            Accept: "application/json",
          },
        }
      );

      if (response.status === 401) {
        const refreshed = await authService.refreshToken();
        if (!refreshed) {
          router.push("/login");
          return;
        }

        await fetch(
          `${process.env.NEXT_PUBLIC_PYTHON_API_URL}/api/admin/job-postings/${id}`,
          {
            method: "DELETE",
            credentials: "include",
            headers: {
              Authorization: `Bearer ${refreshed.access_token}`,
              Accept: "application/json",
            },
          }
        );
      }

      setJobPostings((prev) => prev.filter((posting) => posting.id !== id));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      toast.success("Position deleted successfully");
    } catch (err) {
      console.error("Error deleting job posting:", err);
      toast.error("Failed to delete position");
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    const nextActive = !currentStatus;
    const job = jobPostings.find((posting) => posting.id === id);

    if (nextActive && job && !canActivateJob(job)) {
      toast.error(
        formatMissingActivationMessage(getMissingActivationFields(job))
      );
      return;
    }

    try {
      const session = authService.getSession();
      if (!session) {
        router.push("/login");
        return;
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_PYTHON_API_URL}/api/admin/job-postings/${id}/toggle-status`,
        {
          method: "PATCH",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.token}`,
            Accept: "application/json",
          },
          body: JSON.stringify({ isActive: nextActive }),
        }
      );

      let finalResponse = response;
      if (response.status === 401) {
        const refreshed = await authService.refreshToken();
        if (!refreshed) {
          router.push("/login");
          return;
        }

        finalResponse = await fetch(
          `${process.env.NEXT_PUBLIC_PYTHON_API_URL}/api/admin/job-postings/${id}/toggle-status`,
          {
            method: "PATCH",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${refreshed.access_token}`,
              Accept: "application/json",
            },
            body: JSON.stringify({ isActive: nextActive }),
          }
        );
      }

      if (!finalResponse.ok) {
        const body = await finalResponse.json().catch(() => ({}));
        toast.error(formatActivationApiError(body?.detail));
        return;
      }

      setJobPostings((prevPostings) =>
        prevPostings.map((posting) =>
          posting.id === id
            ? {
                ...posting,
                isActive: nextActive,
                status: nextActive ? "active" : "inactive",
              }
            : posting
        )
      );

      toast.success(
        `Position ${nextActive ? "activated" : "deactivated"} successfully`
      );
    } catch (err) {
      console.error("Error toggling job status:", err);
      toast.error("Failed to update job status");
    }
  };

  const finishBulk = async ({
    succeeded,
    failed,
    successLabel,
    failureLabel,
  }: {
    succeeded: number;
    failed: number;
    successLabel: string;
    failureLabel: string;
  }) => {
    if (failed === 0 && succeeded > 0) {
      toast.success(`${successLabel} ${succeeded} position${succeeded === 1 ? "" : "s"}`);
    } else if (succeeded === 0) {
      toast.error(failureLabel);
    } else {
      toast.error(
        `${successLabel} ${succeeded}, ${failed} failed`
      );
    }
    setSelectedIds(new Set());
    setBulkDeleteOpen(false);
    await fetchJobPostings();
  };

  const handleBulkSetActive = async (isActive: boolean) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0 || bulkBusy) return;

    let targetIds = ids;
    if (isActive) {
      const incomplete = jobPostings.filter(
        (job) => selectedIds.has(job.id) && !canActivateJob(job)
      );
      targetIds = ids.filter((id) => {
        const job = jobPostings.find((posting) => posting.id === id);
        return job ? canActivateJob(job) : false;
      });

      if (incomplete.length > 0) {
        const sample = getMissingActivationFields(incomplete[0]);
        toast.error(
          incomplete.length === 1
            ? formatMissingActivationMessage(sample)
            : `${incomplete.length} incomplete positions skipped. ${formatMissingActivationMessage(sample)}`
        );
      }

      if (targetIds.length === 0) return;
    }

    setBulkBusy(true);
    try {
      const result = await runSettledMutations(targetIds, (id) =>
        adminApi.toggleJobPostingStatus(id, { isActive })
      );
      await finishBulk({
        ...result,
        successLabel: isActive ? "Activated" : "Deactivated",
        failureLabel: `Failed to ${isActive ? "activate" : "deactivate"} positions`,
      });
    } finally {
      setBulkBusy(false);
    }
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0 || bulkBusy) return;

    setBulkBusy(true);
    try {
      const result = await runSettledMutations(ids, (id) =>
        adminApi.deleteJobPosting(id)
      );
      await finishBulk({
        ...result,
        successLabel: "Deleted",
        failureLabel: "Failed to delete positions",
      });
    } finally {
      setBulkBusy(false);
    }
  };

  const filteredData = useMemo(
    () =>
      jobPostings.filter((job) =>
        Object.values(job).some((value) =>
          String(value).toLowerCase().includes(searchTerm.toLowerCase())
        )
      ),
    [jobPostings, searchTerm]
  );

  const allFilteredSelected =
    filteredData.length > 0 &&
    filteredData.every((job) => selectedIds.has(job.id));

  const someFilteredSelected =
    !allFilteredSelected &&
    filteredData.some((job) => selectedIds.has(job.id));

  const toggleSelectAll = (checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        filteredData.forEach((job) => next.add(job.id));
      } else {
        filteredData.forEach((job) => next.delete(job.id));
      }
      return next;
    });
  };

  const toggleSelectOne = (id: string, selected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (selected) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  if (isLoading) {
    return (
      <AdminPageLayout title="Positions" showSearch={false}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      </AdminPageLayout>
    );
  }

  if (error) return <div className="text-red-500">{error}</div>;

  const selectedCount = selectedIds.size;
  const selectedActivatableCount = jobPostings.filter(
    (job) => selectedIds.has(job.id) && canActivateJob(job)
  ).length;
  const bulkActivateBlocked =
    selectedCount > 0 && selectedActivatableCount === 0;

  return (
    <AdminPageLayout
      title="Positions"
      searchPlaceholder="Search positions..."
      searchValue={searchTerm}
      onSearch={setSearchTerm}
      tourId="job-postings"
      guideInBanner
    >
      <TourPageHelper tourId="job-postings" />
      <div className="space-y-5">
        <AdminPageWelcomeBanner bannerKey="job-postings" tourId="job-postings" />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            {filteredData.length > 0 && (
              <>
                <Checkbox
                  checked={
                    allFilteredSelected
                      ? true
                      : someFilteredSelected
                        ? "indeterminate"
                        : false
                  }
                  onCheckedChange={(checked) =>
                    toggleSelectAll(checked === true)
                  }
                  aria-label="Select all positions"
                  disabled={bulkBusy}
                  className="border-[#272055]/30 data-[state=checked]:border-[#272055] data-[state=checked]:bg-[#272055]"
                />
                <span className="text-sm text-muted-foreground">
                  {selectedCount > 0
                    ? `${selectedCount} selected`
                    : `${filteredData.length} position${filteredData.length === 1 ? "" : "s"}`}
                </span>
                {selectedCount > 0 && (
                  <div
                    className={cn(
                      "flex flex-wrap items-center gap-1 rounded-lg border border-[#272055]/12 bg-[#272055]/[0.04] p-1",
                      "dark:border-[#31CDFF]/20 dark:bg-[#31CDFF]/[0.06]"
                    )}
                    role="toolbar"
                    aria-label="Bulk actions"
                  >
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={bulkBusy || bulkActivateBlocked}
                      onClick={() => void handleBulkSetActive(true)}
                      title={
                        bulkActivateBlocked
                          ? "Selected positions are missing required fields"
                          : undefined
                      }
                      className="h-8 gap-1.5 px-2.5 text-[#272055] hover:bg-emerald-50 hover:text-emerald-700 dark:text-[#31CDFF] dark:hover:bg-emerald-950/30 dark:hover:text-emerald-300"
                    >
                      <Power className="h-3.5 w-3.5" />
                      Activate
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={bulkBusy}
                      onClick={() => void handleBulkSetActive(false)}
                      className="h-8 gap-1.5 px-2.5 text-[#272055] hover:bg-slate-100 hover:text-slate-800 dark:text-[#31CDFF] dark:hover:bg-slate-800/60 dark:hover:text-slate-200"
                    >
                      <PowerOff className="h-3.5 w-3.5" />
                      Deactivate
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={bulkBusy}
                      onClick={() => setBulkDeleteOpen(true)}
                      className="h-8 gap-1.5 px-2.5 text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/30"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </Button>
                    <div
                      className="mx-0.5 h-5 w-px bg-[#272055]/15 dark:bg-[#31CDFF]/25"
                      aria-hidden
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={bulkBusy}
                      onClick={() => setSelectedIds(new Set())}
                      className="h-8 gap-1.5 px-2 text-muted-foreground hover:bg-[#272055]/5 hover:text-[#272055] dark:hover:bg-[#31CDFF]/10 dark:hover:text-[#31CDFF]"
                      title="Clear selection"
                    >
                      <X className="h-3.5 w-3.5" />
                      Clear
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
          <Button
            onClick={() => router.push("/manage/job-postings/wizard")}
            data-tour="job-postings-create"
          >
            Add New Position
          </Button>
        </div>

        <div data-tour="job-postings-table">
          {filteredData.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#272055]/15 bg-card px-6 py-16 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#272055]/5 text-[#272055]/70">
                {searchTerm ? (
                  <ClipboardList className="h-5 w-5" />
                ) : (
                  <Briefcase className="h-5 w-5" />
                )}
              </div>
              <p className="text-base font-semibold text-[#272055] dark:text-foreground">
                {searchTerm ? "No matching positions" : "No positions yet"}
              </p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                {searchTerm
                  ? "Try a different search term, or clear the search to see all positions."
                  : "Create a position to start building your hiring pipeline."}
              </p>
              {!searchTerm && (
                <Button
                  className="mt-5"
                  onClick={() => router.push("/manage/job-postings/wizard")}
                >
                  Add New Position
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filteredData.map((job) => (
                <JobPostingManageCard
                  key={job.id}
                  job={job as JobPostingManageItem}
                  selected={selectedIds.has(job.id)}
                  onSelectChange={(selected) =>
                    toggleSelectOne(job.id, selected)
                  }
                  onOpenPipeline={(id) =>
                    router.push(`/manage/jobs/${id}/pipeline`)
                  }
                  onEdit={handleEdit}
                  onToggleActive={handleToggleActive}
                  onDelete={(target) =>
                    setDeleteTarget({ id: target.id, title: target.title })
                  }
                />
              ))}
            </div>
          )}
        </div>

        <DeleteJobPostingModal
          jobTitle={deleteTarget?.title}
          isOpen={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => {
            if (deleteTarget) {
              const id = deleteTarget.id;
              setDeleteTarget(null);
              void confirmDelete(id);
            }
          }}
        />

        <DeleteJobPostingModal
          count={selectedCount}
          isOpen={bulkDeleteOpen}
          isBusy={bulkBusy}
          onClose={() => {
            if (!bulkBusy) setBulkDeleteOpen(false);
          }}
          onConfirm={() => void handleBulkDelete()}
        />
      </div>
    </AdminPageLayout>
  );
}
