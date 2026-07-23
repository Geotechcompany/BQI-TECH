"use client"

import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2 } from "lucide-react"
import { adminApplicationsApi } from "@/components/admin/utils/applications-api"
import type { CvVaultEntry } from "@/types/cv-vault"
import { CV_VAULT_APPLICATION_STATUSES } from "@/types/cv-vault"
import { toast } from "sonner"

const APPLICATION_STATUSES = [...CV_VAULT_APPLICATION_STATUSES]

interface JobPostingOption {
  id: string
  title: string
  isActive?: boolean
}

interface UpdateCandidateDialogProps {
  entries: CvVaultEntry[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdated: () => void
}

export function UpdateCandidateDialog({
  entries,
  open,
  onOpenChange,
  onUpdated,
}: UpdateCandidateDialogProps) {
  const linked = useMemo(
    () => entries.filter((e) => Boolean(e.applicationId)),
    [entries]
  )
  const isBulk = linked.length > 1
  const primary = linked[0]

  const [status, setStatus] = useState("New")
  const [jobId, setJobId] = useState("")

  useEffect(() => {
    if (!open || !primary) return
    setStatus(primary.applicationStatus || "New")
    setJobId(primary.jobId || "")
  }, [open, primary])

  const { data: jobsData, isLoading: jobsLoading } = useQuery({
    queryKey: ["cv-vault-active-jobs"],
    queryFn: async () => {
      const response = await adminApplicationsApi.getJobPostings({ limit: 100 })
      return response as { jobPostings?: JobPostingOption[] }
    },
    enabled: open,
    staleTime: 60_000,
  })

  const activeJobs = useMemo(() => {
    const postings = jobsData?.jobPostings ?? []
    const mapped = postings
      .filter((job) => job.isActive !== false)
      .map((job) => ({
        id: job.id || (job as { _id?: string })._id || "",
        title: job.title || "Untitled role",
      }))
      .filter((job) => job.id)

    // Keep current assignment visible even if the posting is inactive
    if (primary?.jobId && !mapped.some((j) => j.id === primary.jobId)) {
      const fromAll = postings.find(
        (job) => (job.id || (job as { _id?: string })._id) === primary.jobId
      )
      mapped.unshift({
        id: primary.jobId,
        title: fromAll?.title || primary.position || "Current position",
      })
    }
    return mapped
  }, [jobsData, primary])

  const selectedJob = activeJobs.find((job) => job.id === jobId)

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!jobId || !selectedJob) {
        throw new Error("Select a job posting")
      }
      const payload = {
        status,
        jobId,
        position: selectedJob.title,
      }
      const results = await Promise.allSettled(
        linked.map((entry) =>
          adminApplicationsApi.updateApplication(entry.applicationId!, payload)
        )
      )
      const failed = results.filter((r) => r.status === "rejected").length
      const succeeded = results.length - failed
      if (succeeded === 0) {
        throw new Error("Failed to update applications")
      }
      return { succeeded, failed, total: results.length }
    },
    onSuccess: ({ succeeded, failed }) => {
      if (failed > 0) {
        toast.warning(`Updated ${succeeded} of ${succeeded + failed} candidate(s)`)
      } else if (isBulk) {
        toast.success(`Updated ${succeeded} candidate(s)`)
      } else {
        toast.success(`Updated to ${status} · ${selectedJob?.title}`)
      }
      onUpdated()
      onOpenChange(false)
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to update candidate")
    },
  })

  const canSave = Boolean(jobId) && linked.length > 0 && !updateMutation.isPending

  const description = !primary
    ? "No linked applications selected."
    : isBulk
      ? `Apply status and position to ${linked.length} linked candidates.`
      : `Update status and position for ${primary.name || "this candidate"}.`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Update status & position</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {linked.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            Link an application before changing status or position.
          </p>
        ) : (
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {APPLICATION_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label>Position</Label>
              <Select
                value={jobId}
                onValueChange={setJobId}
                disabled={jobsLoading}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={jobsLoading ? "Loading jobs…" : "Select a job posting"}
                  />
                </SelectTrigger>
                <SelectContent>
                  {activeJobs.map((job) => (
                    <SelectItem key={job.id} value={job.id}>
                      {job.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!isBulk && primary?.position && !jobId && (
                <p className="text-xs text-muted-foreground">
                  Current: {primary.position}
                </p>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => updateMutation.mutate()}
            disabled={!canSave}
          >
            {updateMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : null}
            {isBulk ? `Update ${linked.length}` : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
