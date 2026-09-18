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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, Link2, PlusCircle, Search, Sparkles } from "lucide-react"
import { ListRowSkeleton } from "@/components/ui/skeleton"
import { adminApplicationsApi } from "@/components/admin/utils/applications-api"
import { authService } from "@/lib/auth-backend"
import { BACKEND_URL } from "@/lib/config"
import type {
  CreateApplicationFromVaultResponse,
  CvVaultApplicationSuggestion,
  CvVaultEntry,
  LinkCvVaultResponse,
} from "@/types/cv-vault"
import { CV_VAULT_APPLICATION_STATUSES } from "@/types/cv-vault"
import type { Application } from "@/types/application"
import { format } from "date-fns"
import { toast } from "sonner"

const APPLICATION_STATUSES = [...CV_VAULT_APPLICATION_STATUSES]

const baseUrl = () =>
  (BACKEND_URL || process.env.NEXT_PUBLIC_PYTHON_API_URL || "http://localhost:9000").replace(
    /\/$/,
    ""
  )

interface JobPostingOption {
  id: string
  title: string
  isActive?: boolean
}
interface LinkApplicationDialogProps {
  entry: CvVaultEntry | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onLinked: (entry: CvVaultEntry) => void
}

type LinkApplicationOption = Pick<
  Application,
  "id" | "name" | "email" | "position" | "status" | "cvUrl"
> & {
  _id?: string
  appliedDate?: Date | string
}

function applicationLabel(app: Pick<Application, "name" | "email" | "position" | "status">) {
  const parts = [app.name || "Unknown"]
  if (app.email) parts.push(app.email)
  if (app.position) parts.push(app.position)
  return parts.join(" · ")
}

function formatApplied(value?: string | Date | null) {
  if (!value) return null
  try {
    return format(new Date(value), "MMM d, yyyy")
  } catch {
    return null
  }
}

async function fetchSuggestions(vaultId: string): Promise<CvVaultApplicationSuggestion[]> {
  const session = authService.getSession()
  if (!session) throw new Error("No authentication session")

  const res = await fetch(
    `${baseUrl()}/api/admin/cv-vault/${encodeURIComponent(vaultId)}/suggestions`,
    {
      credentials: "include",
      headers: {
        Authorization: `Bearer ${session.token}`,
        Accept: "application/json",
      },
    }
  )

  if (!res.ok) return []
  const data = (await res.json()) as { suggestions?: CvVaultApplicationSuggestion[] }
  return data.suggestions ?? []
}

async function linkVaultEntry(
  vaultId: string,
  applicationId: string
): Promise<CvVaultEntry> {
  const session = authService.getSession()
  if (!session) throw new Error("No authentication session")

  const res = await fetch(`${baseUrl()}/api/admin/cv-vault/link`, {
    method: "PUT",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.token}`,
      Accept: "application/json",
    },
    body: JSON.stringify({ vaultId, applicationId }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const detail =
      err && typeof err === "object" && "detail" in err
        ? String((err as { detail?: unknown }).detail)
        : "Failed to link application"
    throw new Error(detail)
  }

  const data = (await res.json()) as LinkCvVaultResponse
  return data.item
}

async function createApplicationFromVault(payload: {
  vaultId: string
  jobId: string
  status: string
  email?: string
  name?: string
}): Promise<CreateApplicationFromVaultResponse> {
  const session = authService.getSession()
  if (!session) throw new Error("No authentication session")

  const res = await fetch(`${baseUrl()}/api/admin/cv-vault/create-application`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.token}`,
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const detail =
      err && typeof err === "object" && "detail" in err
        ? String((err as { detail?: unknown }).detail)
        : "Failed to create application"
    throw new Error(detail)
  }

  return res.json() as Promise<CreateApplicationFromVaultResponse>
}

export function LinkApplicationDialog({
  entry,
  open,
  onOpenChange,
  onLinked,
}: LinkApplicationDialogProps) {
  const [mode, setMode] = useState<"link" | "create">("link")
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [jobId, setJobId] = useState("")
  const [status, setStatus] = useState("New")
  const [email, setEmail] = useState("")
  const [name, setName] = useState("")

  const initialSearch = useMemo(() => {
    if (!entry) return ""
    if (entry.email?.includes("@")) return entry.email
    if (entry.name && entry.name !== "Unknown") return entry.name
    return entry.fileName || ""
  }, [entry])

  const cvEmail = entry?.email?.includes("@") ? entry.email : ""
  const cvName =
    entry?.name && entry.name !== "Unknown" && entry.name !== "Incomplete Application"
      ? entry.name
      : ""

  useEffect(() => {
    if (!open || !entry) return
    setMode("link")
    setSearch(initialSearch)
    setDebouncedSearch(initialSearch)
    setSelectedId(null)
    setJobId("")
    setStatus("New")
    setEmail(cvEmail)
    setName(cvName)
  }, [open, entry, initialSearch, cvEmail, cvName])

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  const { data: suggestions = [], isLoading: suggestionsLoading } = useQuery({
    queryKey: ["cv-vault-suggestions", entry?.id],
    queryFn: () => fetchSuggestions(entry!.id),
    enabled: open && Boolean(entry?.id),
    staleTime: 30_000,
  })

  const { data: searchResults, isFetching: searchLoading } = useQuery({
    queryKey: ["cv-vault-app-search", debouncedSearch],
    queryFn: () =>
      adminApplicationsApi.getApplicationsByStatus("all", {
        search: debouncedSearch,
        limit: 20,
      }),
    enabled: open && debouncedSearch.trim().length >= 2,
    staleTime: 15_000,
  })

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
    return postings
      .filter((job) => job.isActive !== false)
      .map((job) => ({
        id: job.id || (job as { _id?: string })._id || "",
        title: job.title || "Untitled position",
      }))
      .filter((job) => job.id)
  }, [jobsData])

  const applications = useMemo((): LinkApplicationOption[] => {
    const fromSearch = (searchResults?.applications ?? []) as LinkApplicationOption[]
    if (fromSearch.length > 0) return fromSearch

    return suggestions.map(
      (s): LinkApplicationOption => ({
        id: s.id,
        name: s.name,
        email: s.email,
        position: s.position,
        status: s.status,
        appliedDate: s.appliedDate ?? undefined,
        cvUrl: s.hasCvUrl ? "linked" : "",
      })
    )
  }, [searchResults, suggestions])

  const linkMutation = useMutation({
    mutationFn: ({ vaultId, applicationId }: { vaultId: string; applicationId: string }) =>
      linkVaultEntry(vaultId, applicationId),
    onSuccess: (item) => {
      toast.success(`Linked to ${item.name || "application"}`)
      onLinked(item)
      onOpenChange(false)
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to link application")
    },
  })

  const createMutation = useMutation({
    mutationFn: createApplicationFromVault,
    onSuccess: (result) => {
      const parts = [`Application created as ${status}`]
      if (result.userCreated) parts.push("new account created")
      if (result.passwordSetupEmailSent) parts.push("password setup email sent")
      toast.success(parts.join(" · "))
      onLinked(result.item)
      onOpenChange(false)
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to create application")
    },
  })

  const handleLinkConfirm = () => {
    if (!entry || !selectedId) return
    linkMutation.mutate({ vaultId: entry.id, applicationId: selectedId })
  }

  const handleCreateConfirm = () => {
    if (!entry || !jobId) return
    const trimmedEmail = email.trim()
    if (!trimmedEmail.includes("@")) {
      toast.error("Enter a valid email address")
      return
    }
    createMutation.mutate({
      vaultId: entry.id,
      jobId,
      status,
      email: trimmedEmail,
      name: name.trim() || undefined,
    })
  }

  const showSuggestionsHint =
    !searchLoading && !suggestionsLoading && debouncedSearch.trim().length < 2 && suggestions.length > 0

  const emailMissing = !cvEmail

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Link application</DialogTitle>
          <DialogDescription>
            {entry ? (
              <>
                Connect <span className="font-medium text-foreground">{entry.fileName || entry.name}</span>{" "}
                to an existing application or create one from this CV.
              </>
            ) : (
              "Select an application to link."
            )}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(v) => setMode(v as "link" | "create")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="link">Link existing</TabsTrigger>
            <TabsTrigger value="create">Create from CV</TabsTrigger>
          </TabsList>

          <TabsContent value="link" className="space-y-3 mt-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, email, or position"
                className="pl-9"
                autoFocus
              />
            </div>

            {showSuggestionsHint && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Sparkles className="h-3.5 w-3.5" />
                Showing suggested matches from CV metadata
              </p>
            )}

            <div className="border rounded-lg max-h-64 overflow-y-auto divide-y">
              {(searchLoading || suggestionsLoading) && applications.length === 0 ? (
                <ListRowSkeleton rows={4} />
              ) : applications.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground text-center">
                  {debouncedSearch.trim().length < 2
                    ? "Type at least 2 characters to search"
                    : "No applications found"}
                </p>
              ) : (
                applications.map((app) => {
                  const appId = app.id || app._id || ""
                  const applied = formatApplied(app.appliedDate)
                  const isSelected = selectedId === appId
                  return (
                    <button
                      key={appId}
                      type="button"
                      onClick={() => setSelectedId(appId)}
                      className={`w-full text-left px-3 py-2.5 hover:bg-muted/60 transition-colors ${
                        isSelected ? "bg-primary/10 ring-1 ring-inset ring-primary/30" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{app.name || "Unknown"}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {applicationLabel(app)}
                          </p>
                          {applied && (
                            <p className="text-xs text-muted-foreground mt-0.5">Applied {applied}</p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          {app.status && (
                            <Badge variant="outline" className="text-[10px]">
                              {app.status}
                            </Badge>
                          )}
                          {!app.cvUrl && (
                            <span className="text-[10px] text-amber-600">No CV on file</span>
                          )}
                        </div>
                      </div>
                    </button>
                  )
                })
              )}
            </div>

            <DialogFooter className="px-0">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleLinkConfirm}
                disabled={!selectedId || linkMutation.isPending}
              >
                {linkMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Link2 className="h-4 w-4 mr-2" />
                )}
                Link application
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="create" className="space-y-4 mt-3">
            {emailMissing && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                No email was extracted from this CV. Enter one below to create the applicant account.
              </p>
            )}

            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="cv-vault-email">Email</Label>
                <Input
                  id="cv-vault-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="applicant@example.com"
                  required
                />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="cv-vault-name">Name</Label>
                <Input
                  id="cv-vault-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Applicant name"
                />
              </div>

              <div className="grid gap-1.5">
                <Label>Position</Label>
                <Select value={jobId} onValueChange={setJobId} disabled={jobsLoading}>
                  <SelectTrigger>
                    <SelectValue placeholder={jobsLoading ? "Loading jobs…" : "Select a job"} />
                  </SelectTrigger>
                  <SelectContent>
                    {activeJobs.map((job) => (
                      <SelectItem key={job.id} value={job.id}>
                        {job.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-1.5">
                <Label>Initial status</Label>
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
            </div>

            <p className="text-xs text-muted-foreground">
              Creates an applicant account if none exists and sends a password setup email for new accounts.
            </p>

            <DialogFooter className="px-0">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreateConfirm}
                disabled={!jobId || !email.trim().includes("@") || createMutation.isPending}
              >
                {createMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <PlusCircle className="h-4 w-4 mr-2" />
                )}
                Create application
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
