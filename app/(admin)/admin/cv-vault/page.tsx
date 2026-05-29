"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { AdminPageLayout } from "@/components/admin/AdminPageLayout"
import { useAuth } from "@/contexts/AuthContext"
import { authService } from "@/lib/auth-backend"
import { CVCell } from "@/components/admin/CVCell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import {
  ExternalLink,
  FileArchive,
  Filter,
  Loader2,
  Mail,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react"
import type {
  CvVaultFilterOptions,
  CvVaultListParams,
  CvVaultResponse,
  CvVaultSort,
} from "@/types/cv-vault"
import { format, formatDistanceToNow } from "date-fns"
import { BACKEND_URL } from "@/lib/config"
import { toast } from "sonner"

const baseUrl = () =>
  (BACKEND_URL || process.env.NEXT_PUBLIC_PYTHON_API_URL || "http://localhost:9000").replace(
    /\/$/,
    ""
  )

const DEFAULT_SORT: CvVaultSort = "complete_first"

const SORT_LABELS: Record<CvVaultSort, string> = {
  complete_first: "Complete profiles first",
  dropbox_newest: "Newest on Dropbox",
  dropbox_oldest: "Oldest on Dropbox",
  applied_newest: "Latest application date",
  applied_oldest: "Earliest application date",
  name_asc: "Name (A–Z)",
  name_desc: "Name (Z–A)",
}

function parseApiError(body: unknown, status: number): string {
  if (body && typeof body === "object" && "detail" in body) {
    const detail = (body as { detail?: unknown }).detail
    if (typeof detail === "string" && detail) return detail
    if (Array.isArray(detail) && detail[0] && typeof detail[0] === "object") {
      const msg = (detail[0] as { msg?: string }).msg
      if (msg) return msg
    }
  }
  if (status === 404) {
    return "CV Vault API not found. Restart the Python backend (python run.py) and refresh."
  }
  return "Failed to load CV vault"
}

function buildQueryParams(params: CvVaultListParams): string {
  const qs = new URLSearchParams()
  if (params.search) qs.set("search", params.search)
  if (params.sort) qs.set("sort", params.sort)
  if (params.has_email === true) qs.set("has_email", "true")
  if (params.has_email === false) qs.set("has_email", "false")
  if (params.has_name === true) qs.set("has_name", "true")
  if (params.has_name === false) qs.set("has_name", "false")
  if (params.linked_application === true) qs.set("linked_application", "true")
  if (params.linked_application === false) qs.set("linked_application", "false")
  if (params.source && params.source !== "all") qs.set("source", params.source)
  if (params.contact_filter && params.contact_filter !== "all") {
    qs.set("contact_filter", params.contact_filter)
  }
  if (params.application_status && params.application_status !== "all") {
    qs.set("application_status", params.application_status)
  }
  return qs.toString()
}

async function fetchWithAuth(url: string): Promise<CvVaultResponse> {
  const session = authService.getSession()
  if (!session) throw new Error("No authentication session")

  const res = await fetch(url, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.token}`,
      Accept: "application/json",
    },
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(parseApiError(err, res.status))
  }
  return res.json()
}

async function fetchCvVault(params: CvVaultListParams): Promise<CvVaultResponse> {
  const qs = buildQueryParams(params)
  return fetchWithAuth(`${baseUrl()}/api/admin/cv-vault${qs ? `?${qs}` : ""}`)
}

async function fetchFilterOptions(): Promise<CvVaultFilterOptions> {
  const session = authService.getSession()
  if (!session) throw new Error("No authentication session")

  const res = await fetch(`${baseUrl()}/api/admin/cv-vault/filters`, {
    credentials: "include",
    headers: {
      Authorization: `Bearer ${session.token}`,
      Accept: "application/json",
    },
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(parseApiError(err, res.status))
  }
  return res.json() as Promise<CvVaultFilterOptions>
}

async function syncCvVault(
  params: CvVaultListParams,
  extractPdf: boolean
): Promise<CvVaultResponse> {
  const query = new URLSearchParams(buildQueryParams(params))
  if (extractPdf) query.set("extract_pdf", "true")
  const session = authService.getSession()
  if (!session) throw new Error("No authentication session")

  const res = await fetch(
    `${baseUrl()}/api/admin/cv-vault/sync?${query.toString()}`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.token}`,
        Accept: "application/json",
      },
    }
  )

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(parseApiError(err, res.status))
  }
  return res.json()
}

type TriFilter = "all" | "yes" | "no"

function triToBool(value: TriFilter): boolean | null {
  if (value === "yes") return true
  if (value === "no") return false
  return null
}

export default function CvVaultPage() {
  const router = useRouter()
  const { isAuthenticated, isAdmin, authLoading } = useAuth()
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [sort, setSort] = useState<CvVaultSort>(DEFAULT_SORT)
  const [contactFilter, setContactFilter] = useState<"all" | "complete" | "missing">("all")
  const [sourceFilter, setSourceFilter] = useState<"all" | "application" | "dropbox">("all")
  const [hasEmailFilter, setHasEmailFilter] = useState<TriFilter>("all")
  const [hasNameFilter, setHasNameFilter] = useState<TriFilter>("all")
  const [linkedFilter, setLinkedFilter] = useState<TriFilter>("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [extractPdf, setExtractPdf] = useState(false)
  const queryClient = useQueryClient()

  const listParams: CvVaultListParams = useMemo(
    () => ({
      search: debouncedSearch,
      sort,
      has_email: triToBool(hasEmailFilter),
      has_name: triToBool(hasNameFilter),
      linked_application: triToBool(linkedFilter),
      source: sourceFilter,
      contact_filter: contactFilter,
      application_status: statusFilter,
    }),
    [
      debouncedSearch,
      sort,
      hasEmailFilter,
      hasNameFilter,
      linkedFilter,
      sourceFilter,
      contactFilter,
      statusFilter,
    ]
  )

  const hasActiveFilters =
    contactFilter !== "all" ||
    sourceFilter !== "all" ||
    hasEmailFilter !== "all" ||
    hasNameFilter !== "all" ||
    linkedFilter !== "all" ||
    statusFilter !== "all" ||
    sort !== DEFAULT_SORT

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !isAdmin)) {
      router.push("/login")
    }
  }, [authLoading, isAuthenticated, isAdmin, router])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const { data: filterOptions } = useQuery({
    queryKey: ["cv-vault-filters"],
    queryFn: fetchFilterOptions,
    enabled: isAuthenticated && isAdmin,
    staleTime: 300_000,
  })

  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ["cv-vault", listParams],
    queryFn: () => fetchCvVault(listParams),
    enabled: isAuthenticated && isAdmin,
    staleTime: 60_000,
  })

  const syncMutation = useMutation({
    mutationFn: () => syncCvVault(listParams, extractPdf),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["cv-vault"] })
      toast.success(
        `Synced ${result.sync?.upserted ?? result.total} CV(s) from Dropbox`
      )
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to sync CV vault")
    },
  })

  const resetFilters = () => {
    setSort(DEFAULT_SORT)
    setContactFilter("all")
    setSourceFilter("all")
    setHasEmailFilter("all")
    setHasNameFilter("all")
    setLinkedFilter("all")
    setStatusFilter("all")
  }

  const items = data?.items ?? []
  const stats = data?.stats

  const formatDate = (value?: string | null) => {
    if (!value) return "—"
    try {
      return format(new Date(value), "MMM d, yyyy")
    } catch {
      return "—"
    }
  }

  const formatSize = (bytes?: number | null) => {
    if (!bytes) return "—"
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <AdminPageLayout
      title="CV Vault"
      searchPlaceholder="Search by name, email, or filename…"
      searchValue={search}
      onSearch={setSearch}
    >
      <div className="max-w-screen-2xl mx-auto px-4 py-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-xl border bg-card">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <FileArchive className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                Cached in MongoDB · sync from Dropbox to refresh
              </p>
              {stats && (
                <p className="text-sm font-medium mt-0.5">
                  Showing {data?.total ?? 0}
                  {data?.filteredTotal !== undefined &&
                    data.filteredTotal !== data.total &&
                    ` of ${data.filteredTotal} matched`}
                  {" · "}
                  {stats.withEmail} with email · {stats.withApplication} linked
                  {data?.lastSyncedAt && (
                    <span className="text-muted-foreground font-normal">
                      {" "}
                      · Synced{" "}
                      {formatDistanceToNow(new Date(data.lastSyncedAt), {
                        addSuffix: true,
                      })}
                    </span>
                  )}
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={extractPdf ? "default" : "outline"}
              size="sm"
              onClick={() => setExtractPdf((v) => !v)}
            >
              <Sparkles className="h-4 w-4 mr-1" />
              PDF extract {extractPdf ? "on" : "off"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending || isFetching}
            >
              {syncMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-1" />
              )}
              Sync from Dropbox
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="rounded-xl border bg-card p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Filter className="h-4 w-4 text-muted-foreground" />
              Sort & filter
            </div>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={resetFilters} className="h-8">
                <X className="h-3.5 w-3.5 mr-1" />
                Reset filters
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-3">
            <div className="space-y-1.5 sm:col-span-2 lg:col-span-2">
              <Label className="text-xs text-muted-foreground">Sort by</Label>
              <Select value={sort} onValueChange={(v) => setSort(v as CvVaultSort)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(filterOptions?.sorts ?? Object.entries(SORT_LABELS).map(([value, label]) => ({
                    value: value as CvVaultSort,
                    label,
                  }))).map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Contact</Label>
              <Select
                value={contactFilter}
                onValueChange={(v) =>
                  setContactFilter(v as "all" | "complete" | "missing")
                }
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="complete">Name + email</SelectItem>
                  <SelectItem value="missing">Missing info</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Has email</Label>
              <Select
                value={hasEmailFilter}
                onValueChange={(v) => setHasEmailFilter(v as TriFilter)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any</SelectItem>
                  <SelectItem value="yes">Yes</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Has name</Label>
              <Select
                value={hasNameFilter}
                onValueChange={(v) => setHasNameFilter(v as TriFilter)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any</SelectItem>
                  <SelectItem value="yes">Yes</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Application</Label>
              <Select
                value={linkedFilter}
                onValueChange={(v) => setLinkedFilter(v as TriFilter)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any</SelectItem>
                  <SelectItem value="yes">Linked</SelectItem>
                  <SelectItem value="no">Not linked</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Source</Label>
              <Select
                value={sourceFilter}
                onValueChange={(v) =>
                  setSourceFilter(v as "all" | "application" | "dropbox")
                }
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sources</SelectItem>
                  <SelectItem value="application">Application</SelectItem>
                  <SelectItem value="dropbox">Dropbox only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs text-muted-foreground">App status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {(filterOptions?.applicationStatuses ?? []).map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setSort("complete_first")
                setContactFilter("complete")
              }}
            >
              Best profiles first
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setSort("dropbox_newest")
                setContactFilter("all")
              }}
            >
              Latest on Dropbox
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setContactFilter("missing")
                setHasEmailFilter("no")
              }}
            >
              Missing email
            </Button>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive text-sm">
            {(error as Error).message}
          </div>
        )}

        {isLoading || syncMutation.isPending ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin mr-2" />
            {syncMutation.isPending
              ? "Syncing CVs from Dropbox into database…"
              : "Loading CV vault…"}
          </div>
        ) : (
          <div className="rounded-xl border overflow-hidden bg-card">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium">Name</th>
                    <th className="text-left p-3 font-medium">Email</th>
                    <th className="text-left p-3 font-medium hidden md:table-cell">
                      File
                    </th>
                    <th className="text-left p-3 font-medium hidden lg:table-cell">
                      Source
                    </th>
                    <th className="text-left p-3 font-medium hidden lg:table-cell">
                      Status
                    </th>
                    <th className="text-left p-3 font-medium hidden xl:table-cell">
                      Dropbox / Applied
                    </th>
                    <th className="text-right p-3 font-medium">CV</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="p-8 text-center text-muted-foreground"
                      >
                        No CVs match your filters
                        {debouncedSearch ? ` for "${debouncedSearch}"` : ""}.
                      </td>
                    </tr>
                  ) : (
                    items.map((entry) => (
                      <tr
                        key={entry.id}
                        className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                      >
                        <td className="p-3 font-medium">
                          <div className="flex items-center gap-2">
                            {entry.name}
                            {entry.name &&
                              entry.name !== "Unknown" &&
                              entry.email && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] px-1.5 py-0 text-emerald-600 border-emerald-500/30"
                                >
                                  complete
                                </Badge>
                              )}
                          </div>
                        </td>
                        <td className="p-3">
                          {entry.email ? (
                            <a
                              href={`mailto:${entry.email}`}
                              className="text-primary hover:underline inline-flex items-center gap-1"
                            >
                              <Mail className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate max-w-[200px]">
                                {entry.email}
                              </span>
                            </a>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="p-3 hidden md:table-cell text-muted-foreground truncate max-w-[180px]">
                          {entry.fileName || entry.dropboxPath || "—"}
                        </td>
                        <td className="p-3 hidden lg:table-cell">
                          <Badge variant="secondary" className="capitalize">
                            {entry.source}
                          </Badge>
                        </td>
                        <td className="p-3 hidden lg:table-cell">
                          {entry.applicationStatus ? (
                            <Badge variant="outline">
                              {entry.applicationStatus}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="p-3 hidden xl:table-cell text-muted-foreground">
                          {formatDate(entry.modifiedAt || entry.appliedDate)}
                          {entry.size ? (
                            <span className="block text-xs">
                              {formatSize(entry.size)}
                            </span>
                          ) : null}
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {entry.cvUrl ? (
                              <>
                                <CVCell
                                  cvUrl={entry.cvUrl}
                                  candidateName={entry.name}
                                />
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  asChild
                                >
                                  <a
                                    href={entry.cvUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title="Open in Dropbox"
                                  >
                                    <ExternalLink className="h-4 w-4" />
                                  </a>
                                </Button>
                              </>
                            ) : (
                              <span className="text-muted-foreground text-xs">
                                No link
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AdminPageLayout>
  )
}
