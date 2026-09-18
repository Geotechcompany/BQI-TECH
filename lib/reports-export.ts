import type {
  FunnelStage,
  JobApplicationCount,
  SourceBreakdownItem,
  TrendSeries,
} from "@/lib/reports-aggregates";

export type ReportsExportPayload = {
  scopeLabel: string;
  generatedAt: Date;
  summary: {
    totalApplications: number;
    activeJobs: number;
    avgTimeToHireDays: number | null;
    hireRatePercent: number | null;
  };
  sources: SourceBreakdownItem[];
  byJob: JobApplicationCount[];
  trends: TrendSeries;
  funnel: FunnelStage[];
};

function csvEscape(value: string | number | null | undefined): string {
  const text = value == null ? "" : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function section(title: string, headers: string[], rows: Array<Array<string | number | null>>): string {
  const lines = [
    `# ${title}`,
    headers.map(csvEscape).join(","),
    ...rows.map((row) => row.map(csvEscape).join(",")),
    "",
  ];
  return lines.join("\n");
}

export function buildReportsCsv(payload: ReportsExportPayload): string {
  const { summary, sources, byJob, trends, funnel, scopeLabel, generatedAt } =
    payload;

  const parts = [
    section(
      "Summary",
      ["Metric", "Value"],
      [
        ["Scope", scopeLabel],
        ["Generated At", generatedAt.toISOString()],
        ["Total Applications", summary.totalApplications],
        ["Active Jobs", summary.activeJobs],
        [
          "Avg Time to Hire (days)",
          summary.avgTimeToHireDays == null ? "N/A" : summary.avgTimeToHireDays,
        ],
        [
          "Hire Rate (%)",
          summary.hireRatePercent == null
            ? "N/A"
            : summary.hireRatePercent.toFixed(1),
        ],
      ]
    ),
    section(
      "Recruitment Sources",
      ["Source", "Count", "Percentage"],
      sources.map((item) => [
        item.name,
        item.count,
        item.percentage.toFixed(1),
      ])
    ),
    section(
      "Applications by Job",
      ["Position", "Count"],
      byJob.map((item) => [item.position, item.totalApplications])
    ),
    section(
      "Application Trends (last 30 days)",
      ["Date", "Count"],
      trends.labels.map((label, index) => [label, trends.counts[index] ?? 0])
    ),
    section(
      "Pipeline Funnel",
      ["Stage", "Count", "Percentage"],
      funnel.map((stage) => [
        stage.label,
        stage.count,
        stage.percentage.toFixed(1),
      ])
    ),
  ];

  return parts.join("\n");
}

export function downloadTextFile({
  content,
  filename,
  mimeType,
}: {
  content: string;
  filename: string;
  mimeType: string;
}): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function downloadReportsCsv(payload: ReportsExportPayload): void {
  const stamp = payload.generatedAt.toISOString().slice(0, 10);
  const scopeSlug = payload.scopeLabel
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  downloadTextFile({
    content: buildReportsCsv(payload),
    filename: `bqi-reports-${scopeSlug || "all"}-${stamp}.csv`,
    mimeType: "text/csv;charset=utf-8",
  });
}

/** Opens a print-friendly HTML report (Save as PDF from the browser print dialog). */
export function printReportsPdf(payload: ReportsExportPayload): void {
  const { summary, sources, byJob, trends, funnel, scopeLabel, generatedAt } =
    payload;

  const table = (
    title: string,
    headers: string[],
    rows: Array<Array<string | number>>
  ) => {
    const head = headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("");
    const body = rows
      .map(
        (row) =>
          `<tr>${row
            .map((cell) => `<td>${escapeHtml(String(cell))}</td>`)
            .join("")}</tr>`
      )
      .join("");
    return `<h2>${escapeHtml(title)}</h2><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
  };

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>BQI Reports — ${escapeHtml(scopeLabel)}</title>
  <style>
    body { font-family: system-ui, sans-serif; color: #111; margin: 32px; }
    h1 { font-size: 20px; margin: 0 0 4px; }
    .meta { color: #555; font-size: 12px; margin-bottom: 24px; }
    h2 { font-size: 14px; margin: 24px 0 8px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 8px; }
    th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #eee; }
    th { background: #f5f5f5; font-weight: 600; }
    @media print { body { margin: 16px; } }
  </style>
</head>
<body>
  <h1>Reporting &amp; Analytics</h1>
  <p class="meta">Scope: ${escapeHtml(scopeLabel)} · Generated ${escapeHtml(generatedAt.toLocaleString())}</p>
  ${table("Summary", ["Metric", "Value"], [
    ["Total Applications", summary.totalApplications],
    ["Active Jobs", summary.activeJobs],
    ["Avg Time to Hire (days)", summary.avgTimeToHireDays ?? "N/A"],
    ["Hire Rate (%)", summary.hireRatePercent == null ? "N/A" : summary.hireRatePercent.toFixed(1)],
  ])}
  ${table(
    "Recruitment Sources",
    ["Source", "Count", "Percentage"],
    sources.map((s) => [s.name, s.count, `${s.percentage.toFixed(1)}%`])
  )}
  ${table(
    "Applications by Job",
    ["Position", "Count"],
    byJob.map((j) => [j.position, j.totalApplications])
  )}
  ${table(
    "Application Trends (last 30 days)",
    ["Date", "Count"],
    trends.labels.map((label, i) => [label, trends.counts[i] ?? 0])
  )}
  ${table(
    "Pipeline Funnel",
    ["Stage", "Count", "Percentage"],
    funnel.map((s) => [s.label, s.count, `${s.percentage.toFixed(1)}%`])
  )}
  <script>window.onload = function () { window.print(); };</script>
</body>
</html>`;

  const printWindow = window.open("", "_blank", "noopener,noreferrer,width=900,height=700");
  if (!printWindow) {
    throw new Error("Pop-up blocked. Allow pop-ups to export PDF.");
  }
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
