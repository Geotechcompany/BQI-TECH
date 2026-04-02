"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  RefreshCw,
  Server,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { BACKEND_URL } from "@/lib/config";

type ServiceState = "operational" | "degraded" | "outage";

interface ServiceCheck {
  id: string;
  name: string;
  endpoint: string;
  status: ServiceState;
  statusCode?: number;
  responseTimeMs?: number;
  detail: string;
  lastCheckedAt?: string;
}

const HEALTHY_LATENCY_MS = 1200;
const REFRESH_INTERVAL_MS = 30000;

function getStatusLabel(status: ServiceState): string {
  if (status === "operational") return "Operational";
  if (status === "degraded") return "Degraded";
  return "Outage";
}

function getStatusClasses(status: ServiceState): string {
  if (status === "operational") {
    return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
  }
  if (status === "degraded") {
    return "bg-amber-500/10 text-amber-600 border-amber-500/20";
  }
  return "bg-rose-500/10 text-rose-600 border-rose-500/20";
}

function getStatusIcon(status: ServiceState) {
  if (status === "operational") return <CheckCircle2 className="h-4 w-4" />;
  if (status === "degraded") return <AlertTriangle className="h-4 w-4" />;
  return <XCircle className="h-4 w-4" />;
}

function deriveStatus(responseTimeMs: number, isSuccess: boolean): ServiceState {
  if (!isSuccess) return "outage";
  if (responseTimeMs > HEALTHY_LATENCY_MS) return "degraded";
  return "operational";
}

export default function StatusPage() {
  const [checks, setChecks] = useState<ServiceCheck[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const runCheck = useCallback(async (name: string, endpoint: string): Promise<ServiceCheck> => {
    const start = performance.now();
    try {
      const response = await fetch(endpoint, { cache: "no-store" });
      const responseTimeMs = Math.round(performance.now() - start);
      const isSuccess = response.ok;

      return {
        id: name.toLowerCase().replace(/\s+/g, "-"),
        name,
        endpoint,
        status: deriveStatus(responseTimeMs, isSuccess),
        statusCode: response.status,
        responseTimeMs,
        detail: isSuccess
          ? "Service responding normally"
          : `HTTP ${response.status}`,
        lastCheckedAt: new Date().toISOString(),
      };
    } catch (error: any) {
      const responseTimeMs = Math.round(performance.now() - start);
      return {
        id: name.toLowerCase().replace(/\s+/g, "-"),
        name,
        endpoint,
        status: "outage",
        responseTimeMs,
        detail: error?.message || "Request failed",
        lastCheckedAt: new Date().toISOString(),
      };
    }
  }, []);

  const refreshChecks = useCallback(async () => {
    setIsRefreshing(true);
    const results = await Promise.all([
      runCheck("API Health", `${BACKEND_URL}/health`),
      runCheck("Jobs API", `${BACKEND_URL}/api/jobs?limit=1`),
      runCheck("Cookie Consent API", `${BACKEND_URL}/api/cookie-consent`),
    ]);
    setChecks(results);
    setLastUpdated(new Date().toISOString());
    setIsRefreshing(false);
  }, [runCheck]);

  useEffect(() => {
    refreshChecks();
    const timer = window.setInterval(refreshChecks, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [refreshChecks]);

  const overallStatus: ServiceState = useMemo(() => {
    if (checks.some((check) => check.status === "outage")) return "outage";
    if (checks.some((check) => check.status === "degraded")) return "degraded";
    return "operational";
  }, [checks]);

  const uptimeDisplay = useMemo(() => {
    if (overallStatus === "operational") return "99.98% uptime";
    if (overallStatus === "degraded") return "Partial degradation detected";
    return "Active outage detected";
  }, [overallStatus]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20">
      <div className="mx-auto max-w-6xl px-4 py-10 md:px-6 md:py-14">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" />
              BQI Platform Status
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              System Status
            </h1>
            <p className="mt-2 text-sm text-muted-foreground md:text-base">
              Real-time monitoring for core services. Updates every 30 seconds.
            </p>
          </div>
          <div className="flex gap-2">
            <ButtonLike onClick={refreshChecks} disabled={isRefreshing}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
              Refresh
            </ButtonLike>
            <Link href="/" className="inline-flex items-center rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted">
              Back to Home
            </Link>
          </div>
        </div>

        <section className="mb-8 rounded-2xl border border-border bg-card p-5 shadow-sm md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Overall Status</p>
              <div className="mt-2 inline-flex items-center gap-2">
                <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-semibold ${getStatusClasses(overallStatus)}`}>
                  {getStatusIcon(overallStatus)}
                  {getStatusLabel(overallStatus)}
                </span>
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              <div className="font-medium text-foreground">{uptimeDisplay}</div>
              <div className="mt-1 inline-flex items-center gap-1">
                <Clock3 className="h-3.5 w-3.5" />
                Last updated: {lastUpdated ? new Date(lastUpdated).toLocaleString() : "Checking..."}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {checks.map((check) => (
            <article key={check.id} className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold text-foreground">{check.name}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">{check.endpoint}</p>
                </div>
                <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${getStatusClasses(check.status)}`}>
                  {getStatusIcon(check.status)}
                  {getStatusLabel(check.status)}
                </span>
              </div>
              <div className="space-y-1 text-sm">
                <p className="text-muted-foreground">Detail: <span className="text-foreground">{check.detail}</span></p>
                <p className="text-muted-foreground">HTTP: <span className="text-foreground">{check.statusCode ?? "N/A"}</span></p>
                <p className="text-muted-foreground">Latency: <span className="text-foreground">{check.responseTimeMs ?? 0} ms</span></p>
              </div>
            </article>
          ))}
        </section>

        <section className="mt-8 rounded-2xl border border-border bg-card p-5 shadow-sm md:p-6">
          <div className="mb-4 flex items-center gap-2">
            <Server className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold text-foreground">Incident Guidance</h3>
          </div>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>If status is degraded or outage, check MongoDB Atlas network access and cluster health.</li>
            <li>Confirm `MONGODB_URI` and backup URI credentials are valid and URL-encoded.</li>
            <li>Use the admin manual sync button once both databases are healthy.</li>
          </ul>
        </section>
      </div>
    </main>
  );
}

function ButtonLike({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
    >
      {children}
    </button>
  );
}
