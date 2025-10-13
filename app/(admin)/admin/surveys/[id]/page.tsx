"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { adminApi } from "@/lib/api-backend";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

export default function SurveyAnalyticsPage() {
  const params = useParams<{ id: string }>();
  const surveyId = params.id;
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<"csv" | "xlsx" | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await adminApi.getSurveyAnalytics(surveyId);
        setData(res);
      } catch (e) {
        // fallback: try direct fetch via backend client
        try {
          const backend = await fetch(
            `${
              process.env.NEXT_PUBLIC_PYTHON_API_URL || "http://localhost:9000"
            }/api/admin/surveys/${surveyId}/analytics`,
            { credentials: "include" }
          );
          const json = await backend.json();
          setData(json);
        } catch {}
      } finally {
        setLoading(false);
      }
    })();
  }, [surveyId]);

  if (loading) return <div className="p-6">Loading analytics...</div>;
  if (!data) return <div className="p-6">Failed to load analytics.</div>;

  const s = data.survey || {};

  return (
    <ProtectedRoute requireAdmin>
      <AdminPageLayout
        title={`Survey Analytics • ${s.title || "Survey"}`}
        showSearch={false}
      >
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div className="text-sm text-muted-foreground">
              Created:{" "}
              {s.createdAt ? new Date(s.createdAt).toLocaleString() : "-"}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => router.push("/admin/surveys")}
              >
                Back to Surveys
              </Button>
              <Button
                variant="secondary"
                disabled={!!exporting}
                onClick={async () => {
                  try {
                    setExporting("csv");
                    const blob = await adminApi.exportSurveyResponses(
                      s.id,
                      "csv"
                    );
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `survey_${s.id}_responses.csv`;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    URL.revokeObjectURL(url);
                  } finally {
                    setExporting(null);
                  }
                }}
              >
                {exporting === "csv" ? "Exporting..." : "Export CSV"}
              </Button>
              <Button
                variant="secondary"
                disabled={!!exporting}
                onClick={async () => {
                  try {
                    setExporting("xlsx");
                    const blob = await adminApi.exportSurveyResponses(
                      s.id,
                      "xlsx"
                    );
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `survey_${s.id}_responses.xlsx`;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    URL.revokeObjectURL(url);
                  } finally {
                    setExporting(null);
                  }
                }}
              >
                {exporting === "xlsx" ? "Exporting..." : "Export Excel"}
              </Button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Card className="p-4 bg-gradient-to-br from-[#31CDFF]/10 to-[#272055]/10 border border-[#31CDFF]/20 shadow-sm">
              <div className="text-xs uppercase tracking-wide text-[#272055] dark:text-[#31CDFF] mb-1">
                Total Responses
              </div>
              <div className="text-3xl font-extrabold bg-gradient-to-r from-[#272055] to-[#31CDFF] bg-clip-text text-transparent">
                {data.totalResponses}
              </div>
            </Card>
            <Card className="p-4 bg-gradient-to-br from-emerald-400/10 to-teal-500/10 border border-emerald-400/30 shadow-sm">
              <div className="text-xs uppercase tracking-wide text-emerald-700 dark:text-emerald-300 mb-1">
                Unique IPs
              </div>
              <div className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-300">
                {data.uniqueIPs}
              </div>
            </Card>
            <Card className="p-4 bg-gradient-to-br from-fuchsia-400/10 to-indigo-500/10 border border-fuchsia-400/30 shadow-sm">
              <div className="text-xs uppercase tracking-wide text-fuchsia-700 dark:text-fuchsia-300 mb-1">
                Last Response
              </div>
              <div className="text-lg font-semibold text-fuchsia-700 dark:text-fuchsia-300">
                {data.lastResponseAt
                  ? new Date(data.lastResponseAt).toLocaleString()
                  : "-"}
              </div>
            </Card>
          </div>

          <Card className="p-4 border border-[#31CDFF]/20 bg-gradient-to-br from-[#31CDFF]/5 to-transparent">
            <div className="font-medium mb-3 text-[#272055] dark:text-[#31CDFF]">
              Responses by Day
            </div>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-2 text-sm">
              {data.responsesByDay?.map((d: any) => (
                <div
                  key={d.date}
                  className="flex items-center justify-between rounded-md px-2 py-1 bg-white/70 dark:bg-zinc-900/40 border border-[#31CDFF]/20"
                >
                  <span>{d.date}</span>
                  <span className="font-semibold">{d.count}</span>
                </div>
              ))}
              {(!data.responsesByDay || data.responsesByDay.length === 0) && (
                <div className="text-sm text-muted-foreground">
                  No responses yet.
                </div>
              )}
            </div>
          </Card>

          <Card className="p-4 border border-[#31CDFF]/20 bg-gradient-to-br from-[#31CDFF]/5 to-transparent">
            <div className="font-medium mb-3 text-[#272055] dark:text-[#31CDFF]">
              Top User Agents
            </div>
            <div className="space-y-2 text-sm">
              {data.topUserAgents?.map((ua: any, idx: number) => (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded-md px-2 py-1 bg-white/70 dark:bg-zinc-900/40 border border-[#31CDFF]/20"
                >
                  <span className="truncate max-w-[70%]" title={ua.ua}>
                    {ua.ua}
                  </span>
                  <span className="font-semibold">{ua.count}</span>
                </div>
              ))}
              {(!data.topUserAgents || data.topUserAgents.length === 0) && (
                <div className="text-sm text-muted-foreground">
                  No data available.
                </div>
              )}
            </div>
          </Card>

          <div className="space-y-4">
            {data.questionStats?.map((q: any) => (
              <Card
                key={q.index}
                className="p-4 border border-[#31CDFF]/20 bg-gradient-to-br from-[#31CDFF]/5 to-transparent"
              >
                <div className="font-medium text-[#272055] dark:text-[#31CDFF]">
                  Q{q.index + 1}. {q.title}
                </div>
                {q.count !== undefined && (
                  <div className="text-sm text-muted-foreground mb-2">
                    {q.count} text responses
                  </div>
                )}
                {q.counts && (
                  <div className="grid gap-2 md:grid-cols-2">
                    {Object.entries(q.counts).map(([opt, count]: any) => (
                      <div
                        key={opt}
                        className="flex items-center justify-between rounded-md px-2 py-1 bg-white/70 dark:bg-zinc-900/40 border border-[#31CDFF]/20"
                      >
                        <span>{opt}</span>
                        <span className="font-semibold">{count as any}</span>
                      </div>
                    ))}
                  </div>
                )}
                {q.samples && q.samples.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {q.samples.map((s: string, i: number) => (
                      <div
                        key={i}
                        className="text-sm rounded-md p-2 bg-gradient-to-r from-[#31CDFF]/10 to-transparent border border-[#31CDFF]/20"
                      >
                        {s}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            ))}
          </div>

          {/* Raw Responses Table */}
          <ResponsesTable surveyId={s.id} />
        </div>
      </AdminPageLayout>
    </ProtectedRoute>
  );
}

function ResponsesTable({ surveyId }: { surveyId: string }) {
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [skip, setSkip] = useState(0);
  const limit = 20;

  const [questions, setQuestions] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      try {
        // fetch analytics once to get question headers
        const analytics = await adminApi.getSurveyAnalytics(surveyId);
        setQuestions(analytics?.survey?.questions || []);
      } catch {}
    })();
  }, [surveyId]);

  useEffect(() => {
    (async () => {
      try {
        const res = await adminApi.listSurveyResponses(surveyId, {
          skip,
          limit,
        });
        setRows(res.items || []);
        setTotal(res.total || 0);
      } catch (e) {
        // ignore
      }
    })();
  }, [surveyId, skip]);

  const pages = Math.max(1, Math.ceil(total / limit));

  return (
    <Card className="p-4">
      <div className="font-medium mb-3">Responses ({total})</div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b bg-gradient-to-r from-[#31CDFF]/10 to-transparent">
              <th className="py-2 pr-3">Submitted</th>
              {questions.map((q, idx) => (
                <th key={idx} className="py-2 pr-3">
                  Q{idx + 1}
                </th>
              ))}
              <th className="py-2 pr-3">IP</th>
              <th className="py-2 pr-3">User Agent</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                className="border-b last:border-0 align-top hover:bg-[#31CDFF]/5"
              >
                <td className="py-2 pr-3 whitespace-nowrap">
                  {r.submittedAt
                    ? new Date(r.submittedAt).toLocaleString()
                    : "-"}
                </td>
                {questions.map((_, idx) => {
                  const raw = r.answers?.[String(idx)] ?? r.answers?.[idx];
                  const val = Array.isArray(raw) ? raw.join(", ") : raw ?? "";
                  return (
                    <td key={idx} className="py-2 pr-3">
                      {val}
                    </td>
                  );
                })}
                <td className="py-2 pr-3 whitespace-nowrap">{r.ip || ""}</td>
                <td className="py-2 pr-3 min-w-[240px]">
                  <span className="block truncate" title={r.userAgent}>
                    {r.userAgent}
                  </span>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={3 + questions.length}
                  className="py-3 text-muted-foreground"
                >
                  No responses yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between mt-3 text-sm">
        <div>
          Page {Math.floor(skip / limit) + 1} of {pages}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={skip === 0}
            onClick={() => setSkip(Math.max(0, skip - limit))}
          >
            Prev
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={skip + limit >= total}
            onClick={() => setSkip(skip + limit)}
          >
            Next
          </Button>
        </div>
      </div>
    </Card>
  );
}
