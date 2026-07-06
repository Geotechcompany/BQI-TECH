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
import { Badge } from "@/components/ui/badge"
import { Loader2, Link2, Search, Sparkles } from "lucide-react"
import { adminApplicationsApi } from "@/components/admin/utils/applications-api"
import { authService } from "@/lib/auth-backend"
import { BACKEND_URL } from "@/lib/config"
import type {
  CvVaultApplicationSuggestion,
  CvVaultEntry,
  LinkCvVaultResponse,
} from "@/types/cv-vault"
import type { Application } from "@/types/application"
import { format } from "date-fns"
import { toast } from "sonner"

const baseUrl = () =>
  (BACKEND_URL || process.env.NEXT_PUBLIC_PYTHON_API_URL || "http://localhost:9000").replace(
    /\/$/,
    ""
  )

interface LinkApplicationDialogProps {
  entry: CvVaultEntry | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onLinked: (entry: CvVaultEntry) => void
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

export function LinkApplicationDialog({
  entry,
  open,
  onOpenChange,
  onLinked,
}: LinkApplicationDialogProps) {
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const initialSearch = useMemo(() => {
    if (!entry) return ""
    if (entry.email?.includes("@")) return entry.email
    if (entry.name && entry.name !== "Unknown") return entry.name
    return entry.fileName || ""
  }, [entry])

  useEffect(() => {
    if (!open || !entry) return
    setSearch(initialSearch)
    setDebouncedSearch(initialSearch)
    setSelectedId(null)
  }, [open, entry, initialSearch])

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

  const applications = useMemo(() => {
    const fromSearch = searchResults?.applications ?? []
    if (fromSearch.length > 0) return fromSearch

    return suggestions.map((s) => ({
      id: s.id,
      name: s.name,
      email: s.email,
      position: s.position,
      status: s.status,
      appliedDate: s.appliedDate,
      cvUrl: s.hasCvUrl ? "linked" : "",
    })) as Application[]
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

  const handleConfirm = () => {
    if (!entry || !selectedId) return
    linkMutation.mutate({ vaultId: entry.id, applicationId: selectedId })
  }

  const showSuggestionsHint =
    !searchLoading && !suggestionsLoading && debouncedSearch.trim().length < 2 && suggestions.length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Link application</DialogTitle>
          <DialogDescription>
            {entry ? (
              <>
                Connect <span className="font-medium text-foreground">{entry.fileName || entry.name}</span>{" "}
                to an existing application so you can update status and run AI ranking.
              </>
            ) : (
              "Select an application to link."
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
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
              <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Searching…
              </div>
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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
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
      </DialogContent>
    </Dialog>
  )
}
