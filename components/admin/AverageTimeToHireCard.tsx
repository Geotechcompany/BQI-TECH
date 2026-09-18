"use client";

import { useMemo } from "react";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
  type ChartOptions,
} from "chart.js";
import { Clock } from "lucide-react";
import { HireTimingEmptyState } from "@/components/admin/HireTimingEmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  AverageTimeToHireReport,
  TimeToHireRangeDays,
} from "@/lib/reports-aggregates";
import { cn } from "@/lib/utils";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const RANGE_OPTIONS: Array<{ value: TimeToHireRangeDays; label: string }> = [
  { value: 7, label: "Last 7 Days" },
  { value: 30, label: "Last 30 Days" },
  { value: 90, label: "Last 90 Days" },
];

type AverageTimeToHireCardProps = {
  report: AverageTimeToHireReport;
  rangeDays: TimeToHireRangeDays;
  onRangeChange: (days: TimeToHireRangeDays) => void;
};

function formatDays(value: number | null): string {
  if (value == null) return "—";
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

export function AverageTimeToHireCard({
  report,
  rangeDays,
  onRangeChange,
}: AverageTimeToHireCardProps) {
  const chartData = useMemo(
    () => ({
      labels: report.labels,
      datasets: report.datasets.map((dataset) => ({
        label: dataset.label,
        data: dataset.values,
        backgroundColor: dataset.color,
        borderColor: dataset.color,
        borderWidth: 0,
        borderRadius: report.mode === "stage-days" ? 0 : 6,
        borderSkipped: false as const,
        barPercentage: 0.55,
        categoryPercentage: 0.7,
        stack: report.mode === "stage-days" ? "tth" : undefined,
      })),
    }),
    [report]
  );

  const yLabel =
    report.mode === "hire-counts" ? "Hires" : "Days";

  const options: ChartOptions<"bar"> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      scales: {
        x: {
          stacked: report.mode === "stage-days",
          grid: { display: false },
          ticks: {
            color: "hsl(var(--muted-foreground))",
            font: { size: 11 },
          },
          border: { display: false },
        },
        y: {
          stacked: report.mode === "stage-days",
          beginAtZero: true,
          ticks: {
            precision: 0,
            color: "hsl(var(--muted-foreground))",
            font: { size: 11 },
          },
          grid: {
            color: "hsl(var(--border) / 0.55)",
          },
          border: { display: false },
          title: {
            display: true,
            text: yLabel,
            color: "hsl(var(--muted-foreground))",
            font: { size: 11, weight: 500 },
          },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "hsl(var(--popover))",
          titleColor: "hsl(var(--popover-foreground))",
          bodyColor: "hsl(var(--popover-foreground))",
          borderColor: "hsl(var(--border))",
          borderWidth: 1,
          padding: 12,
          callbacks: {
            label: (context) => {
              const value = context.parsed.y ?? 0;
              if (report.mode === "hire-counts") {
                return `${context.dataset.label}: ${value}`;
              }
              return `${context.dataset.label}: ${value} day${value === 1 ? "" : "s"}`;
            },
          },
        },
      },
    }),
    [report.mode, yLabel]
  );

  const legendItems = useMemo(() => {
    if (report.mode === "stage-days") {
      return report.stages
        .filter((stage) => stage.avgDays != null)
        .map((stage) => ({
          key: stage.key,
          label: stage.label,
          color: stage.color,
          pill: `${formatDays(stage.avgDays)}d`,
        }));
    }

    return report.datasets.map((dataset) => ({
      key: dataset.key,
      label: dataset.label,
      color: dataset.color,
      pill:
        report.mode === "overall-days"
          ? report.overallAvgDays != null
            ? `${formatDays(report.overallAvgDays)}d`
            : null
          : String(report.hireCount),
    }));
  }, [report]);

  const hasChartActivity = report.datasets.some((dataset) =>
    dataset.values.some((value) => value > 0)
  );

  const banner = (() => {
    if (
      report.industryComparisonPercent != null &&
      report.overallAvgDays != null
    ) {
      const pct = Math.abs(report.industryComparisonPercent);
      if (report.industryComparisonPercent > 0) {
        return {
          tone: "faster" as const,
          text: `${pct}% faster than industry avg`,
        };
      }
      if (report.industryComparisonPercent < 0) {
        return {
          tone: "slower" as const,
          text: `${pct}% slower than industry avg`,
        };
      }
      return {
        tone: "neutral" as const,
        text: `On pace with industry avg (${report.industryBenchmarkDays}d)`,
      };
    }
    if (report.overallAvgDays != null) {
      return {
        tone: "neutral" as const,
        text: `Average ${formatDays(report.overallAvgDays)} days to hire`,
      };
    }
    return {
      tone: "empty" as const,
      text: "No hires with dates in this range",
    };
  })();

  return (
    <Card
      className="shadow-sm border-border/70 overflow-hidden"
      data-tour="reports-time-to-hire"
    >
      <CardHeader className="pb-4 border-b border-border/50 bg-muted/20">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <CardTitle className="flex items-center gap-3 text-lg">
            <div className="p-2.5 rounded-xl bg-[#272156]/10 ring-1 ring-[#272156]/20">
              <Clock className="h-5 w-5 text-[#272156] dark:text-teal-300" />
            </div>
            <div>
              <div>Average Time To Hire</div>
              <p className="text-sm font-normal text-muted-foreground mt-0.5">
                {report.hasStageBreakdown
                  ? "Stage durations from application milestones"
                  : report.mode === "overall-days"
                    ? "Overall days from applied to hired"
                    : "Hire volume when milestone dates are limited"}
              </p>
            </div>
          </CardTitle>

          <Select
            value={String(rangeDays)}
            onValueChange={(value) =>
              onRangeChange(Number(value) as TimeToHireRangeDays)
            }
          >
            <SelectTrigger
              className="w-full sm:w-[150px] bg-background"
              aria-label="Time range for average time to hire"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RANGE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={String(option.value)}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent className="pt-5 space-y-5">
        {hasChartActivity ? (
          <div className="h-64 sm:h-72">
            <Bar data={chartData} options={options} />
          </div>
        ) : (
          <div className="h-64 sm:h-72">
            <HireTimingEmptyState />
          </div>
        )}

        {legendItems.length > 0 ? (
          <ul className="flex flex-wrap gap-2.5">
            {legendItems.map((item) => (
              <li
                key={item.key}
                className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-muted/30 px-2.5 py-1 text-xs"
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-sm"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-muted-foreground">{item.label}</span>
                {item.pill ? (
                  <span className="rounded-full bg-background px-1.5 py-0.5 font-semibold tabular-nums text-foreground shadow-sm border border-border/60">
                    {item.pill}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}

        <div
          className={cn(
            "rounded-xl px-4 py-3 text-sm font-medium text-center",
            banner.tone === "faster" &&
              "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/20",
            banner.tone === "slower" &&
              "bg-amber-500/10 text-amber-800 dark:text-amber-200 ring-1 ring-amber-500/20",
            (banner.tone === "neutral" || banner.tone === "empty") &&
              "bg-[#272156]/08 text-[#272156] dark:bg-teal-500/10 dark:text-teal-200 ring-1 ring-[#272156]/15 dark:ring-teal-500/20"
          )}
        >
          {banner.text}
          {report.overallAvgDays != null &&
          banner.tone === "faster" ? (
            <span className="ml-1.5 font-normal opacity-80">
              ({formatDays(report.overallAvgDays)}d vs{" "}
              {report.industryBenchmarkDays}d)
            </span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
