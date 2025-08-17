"use client"

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"

type BackendHealthResponse = {
  status?: string
  database?: string
  message?: string
}

export function useBackendHealth({ refetchIntervalMs = 15000 } = {}) {
  const baseUrl = process.env.NEXT_PUBLIC_PYTHON_API_URL || "http://localhost:10000"

  const query = useQuery({
    queryKey: ["backend-health"],
    queryFn: async () => {
      const startedAt = performance.now()
      let ok = false
      try {
        const res = await fetch(`${baseUrl}/health`, { cache: "no-store" })
        ok = res.ok
        const data = (await res.json().catch(() => ({}))) as BackendHealthResponse
        const latencyMs = Math.max(0, Math.round(performance.now() - startedAt))
        return {
          ok,
          latencyMs,
          data,
          fetchedAt: new Date(),
        }
      } catch (error) {
        const latencyMs = Math.max(0, Math.round(performance.now() - startedAt))
        return {
          ok: false,
          latencyMs,
          data: {} as BackendHealthResponse,
          fetchedAt: new Date(),
        }
      }
    },
    refetchInterval: refetchIntervalMs,
  })

  const computed = useMemo(() => {
    const payload = query.data
    const apiOk = !!payload?.ok
    const dbConnected = (payload?.data?.database || "").toLowerCase() === "connected"
    const status = !apiOk
      ? "down"
      : dbConnected
      ? "healthy"
      : "degraded"

    const label = status === "healthy" ? "Online" : status === "degraded" ? "Degraded" : "Offline"

    return {
      status, // healthy | degraded | down
      label,
      latencyMs: payload?.latencyMs ?? null,
      dbStatus: payload?.data?.database ?? "unknown",
      fetchedAt: payload?.fetchedAt ?? null,
    }
  }, [query.data])

  return {
    ...computed,
    isLoading: query.isLoading,
    refetch: query.refetch,
  }
}

export type BackendHealth = ReturnType<typeof useBackendHealth>


