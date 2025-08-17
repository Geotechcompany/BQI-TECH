"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { adminApi } from "@/lib/api-backend"
import { AdminPageLayout } from "@/components/admin/AdminPageLayout"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Loader2, RefreshCw } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"

type LogLevel = "INFO" | "WARNING" | "ERROR" | "DEBUG" | "ALL"

export default function AuditLogsPage() {
  const router = useRouter()
  const { isAuthenticated, isAdmin, authLoading } = useAuth()

  const [search, setSearch] = useState("")
  const [level, setLevel] = useState<LogLevel>("ALL")
  const [date, setDate] = useState("") // YYYYMMDD
  const [page, setPage] = useState(0)
  const pageSize = 200

  const params = useMemo(() => {
    const p: Record<string, any> = {
      skip: page * pageSize,
      limit: pageSize,
    }
    if (search.trim()) p.search = search.trim()
    if (date.trim()) p.date = date.trim()
    if (level !== "ALL") p.level = level
    return p
  }, [search, level, date, page])

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["audit-logs", params],
    queryFn: () => adminApi.getAuditLogs(params),
    placeholderData: (prev) => prev,
    staleTime: 10_000,
  })

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !isAdmin)) {
      router.push("/login")
    }
  }, [authLoading, isAuthenticated, isAdmin, router])

  if (authLoading) {
    return (
      <AdminPageLayout title="Audit Logs">
        <div className="flex items-center justify-center py-10 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </AdminPageLayout>
    )
  }

  if (!isAuthenticated || !isAdmin) return null

  const logs = data?.logs ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <AdminPageLayout title="Audit Logs">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="Search message..."
            value={search}
            onChange={(e) => { setPage(0); setSearch(e.target.value) }}
            className="max-w-xs"
          />
          <Select value={level} onValueChange={(v) => { setPage(0); setLevel(v as LogLevel) }}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All levels</SelectItem>
              <SelectItem value="ERROR">Error</SelectItem>
              <SelectItem value="WARNING">Warning</SelectItem>
              <SelectItem value="INFO">Info</SelectItem>
              <SelectItem value="DEBUG">Debug</SelectItem>
            </SelectContent>
          </Select>
          <Input
            placeholder="Date YYYYMMDD (optional)"
            value={date}
            onChange={(e) => { setPage(0); setDate(e.target.value) }}
            className="w-[220px]"
          />
          <Button onClick={() => refetch()} disabled={isFetching} variant="outline">
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        <div className="border rounded-md overflow-hidden">
          <div className="grid grid-cols-[180px_120px_110px_1fr_140px] gap-2 px-3 py-2 bg-muted text-xs font-medium">
            <div>Timestamp</div>
            <div>Logger</div>
            <div>Level</div>
            <div>Message</div>
            <div>File</div>
          </div>
          {isLoading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : logs.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">No logs found.</div>
          ) : (
            <div className="max-h-[70vh] overflow-auto">
              {logs.map((log: any, idx: number) => (
                <div
                  key={`${log.timestamp}-${log.file}-${idx}`}
                  className="grid grid-cols-[180px_120px_110px_1fr_140px] gap-2 px-3 py-2 border-t text-sm"
                >
                  <div className="truncate" title={log.timestamp || ''}>{log.timestamp || '-'}</div>
                  <div className="truncate" title={log.logger || ''}>{log.logger || '-'}</div>
                  <div className={`truncate font-medium ${
                    log.level === 'ERROR' ? 'text-red-600' :
                    log.level === 'WARNING' ? 'text-yellow-600' :
                    log.level === 'INFO' ? 'text-blue-600' :
                    'text-muted-foreground'
                  }`}>
                    {log.level || '-'}
                  </div>
                  <div className="whitespace-pre-wrap break-words">{log.message}</div>
                  <div className="truncate" title={log.file || ''}>{log.file || '-'}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between text-sm">
          <div>
            Showing {logs.length} of {total} entries
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              Prev
            </Button>
            <span>
              Page {page + 1} / {totalPages}
            </span>
            <Button variant="outline" size="sm" disabled={(page + 1) >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      </div>
    </AdminPageLayout>
  )
}


