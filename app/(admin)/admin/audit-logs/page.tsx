"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useQuery, keepPreviousData } from "@tanstack/react-query"
import { format, parseISO } from "date-fns"
import { adminApi } from "@/lib/api-backend"
import { AdminPageLayout } from "@/components/admin/AdminPageLayout"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, RefreshCw, ExternalLink } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"

type ActivityAction =
  | "ALL"
  | "created"
  | "updated"
  | "deleted"
  | "published"
  | "unpublished"
  | "invited"
  | "revoked"
  | "resent"
  | "activated"
  | "deactivated"
  | "archived"
  | "restored"
  | "sent"
  | "executed"
  | "synced"
  | "reordered"
  | "ranked"

interface AdminActivity {
  id: string
  timestamp: string
  actorEmail: string
  actorName: string
  action: string
  resourceType: string
  resourceId: string
  resourceTitle: string
  resourcePath: string
  changes: string[]
  summary: string
}

function actionBadgeVariant(action: string) {
  switch (action) {
    case "created":
    case "published":
    case "activated":
    case "invited":
    case "sent":
      return "default"
    case "updated":
    case "reordered":
    case "ranked":
    case "resent":
      return "secondary"
    case "deleted":
    case "revoked":
    case "deactivated":
      return "destructive"
    case "unpublished":
    case "archived":
      return "outline"
    case "restored":
    case "synced":
    case "executed":
      return "default"
    default:
      return "outline"
  }
}

function formatTimestamp(ts: string) {
  if (!ts) return "—"
  try {
    return format(parseISO(ts), "MMM d, yyyy · h:mm a")
  } catch {
    return ts
  }
}

export default function AuditLogsPage() {
  const router = useRouter()
  const { isAuthenticated, isAdmin, authLoading } = useAuth()

  const [search, setSearch] = useState("")
  const [action, setAction] = useState<ActivityAction>("ALL")
  const [date, setDate] = useState("")
  const [page, setPage] = useState(0)
  const pageSize = 50

  const params = useMemo(() => {
    const p: Record<string, string | number> = {
      skip: page * pageSize,
      limit: pageSize,
    }
    if (search.trim()) p.search = search.trim()
    if (date.trim()) p.date = date.trim()
    if (action !== "ALL") p.action = action
    return p
  }, [search, action, date, page])

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["admin-activities", params],
    queryFn: () => adminApi.getAuditLogs(params),
    placeholderData: keepPreviousData,
    staleTime: 10_000,
  })

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !isAdmin)) {
      router.push("/login")
    }
  }, [authLoading, isAuthenticated, isAdmin, router])

  if (authLoading) {
    return (
      <AdminPageLayout title="Admin Activity">
        <div className="flex items-center justify-center py-10 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </AdminPageLayout>
    )
  }

  if (!isAuthenticated || !isAdmin) return null

  const activities: AdminActivity[] = data?.activities ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <AdminPageLayout title="Admin Activity">
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Track every change admins make — blog posts, job postings, candidates,
          users, settings, backups, emails, and more. New actions are recorded
          from now on.
        </p>

        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="Search by admin, email, or activity..."
            value={search}
            onChange={(e) => {
              setPage(0)
              setSearch(e.target.value)
            }}
            className="max-w-sm"
          />
          <Select
            value={action}
            onValueChange={(v) => {
              setPage(0)
              setAction(v as ActivityAction)
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All actions</SelectItem>
              <SelectItem value="created">Created</SelectItem>
              <SelectItem value="updated">Updated</SelectItem>
              <SelectItem value="deleted">Deleted</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="unpublished">Unpublished</SelectItem>
              <SelectItem value="invited">Invited</SelectItem>
              <SelectItem value="revoked">Revoked</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
              <SelectItem value="restored">Restored</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="synced">Synced</SelectItem>
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={date}
            onChange={(e) => {
              setPage(0)
              setDate(e.target.value)
            }}
            className="w-[180px]"
          />
          <Button onClick={() => refetch()} disabled={isFetching} variant="outline">
            <RefreshCw
              className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>

        <div className="border rounded-md overflow-hidden">
          <div className="grid grid-cols-[160px_200px_100px_1fr_100px] gap-2 px-3 py-2 bg-muted text-xs font-medium">
            <div>When</div>
            <div>Admin</div>
            <div>Action</div>
            <div>Activity</div>
            <div>Link</div>
          </div>
          {isLoading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : activities.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              <p>No admin activity recorded yet.</p>
              <p className="mt-2">
                Make a change in the admin dashboard — edits to posts, jobs,
                candidates, users, or settings will appear here with the
                admin&apos;s email and what changed.
              </p>
            </div>
          ) : (
            <div className="max-h-[70vh] overflow-auto">
              {activities.map((item) => (
                <div
                  key={item.id}
                  className="grid grid-cols-[160px_200px_100px_1fr_100px] gap-2 px-3 py-3 border-t text-sm items-start"
                >
                  <div className="text-muted-foreground text-xs whitespace-nowrap">
                    {formatTimestamp(item.timestamp)}
                  </div>
                  <div className="min-w-0">
                    <div
                      className="font-medium truncate"
                      title={item.actorEmail}
                    >
                      {item.actorEmail}
                    </div>
                    {item.actorName && item.actorName !== item.actorEmail && (
                      <div className="text-xs text-muted-foreground truncate">
                        {item.actorName}
                      </div>
                    )}
                  </div>
                  <div>
                    <Badge
                      variant={actionBadgeVariant(item.action)}
                      className="capitalize"
                    >
                      {item.action || "—"}
                    </Badge>
                  </div>
                  <div className="min-w-0">
                    <p className="leading-snug">{item.summary}</p>
                    {item.changes?.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Fields: {item.changes.join(", ")}
                      </p>
                    )}
                  </div>
                  <div>
                    {item.resourcePath ? (
                      <Link
                        href={item.resourcePath}
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        View
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between text-sm">
          <div>
            Showing {activities.length} of {total} activities
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              Prev
            </Button>
            <span>
              Page {page + 1} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page + 1 >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </AdminPageLayout>
  )
}
