"use client";

import { useMemo } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
  type ChartOptions,
} from "chart.js";
import type { LeaveUsageMonth } from "@/types/leave";
import { cn } from "@/lib/utils";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler
);

type LeaveUsageTrendProps = {
  months: LeaveUsageMonth[];
  className?: string;
};

export function LeaveUsageTrend({ months, className }: LeaveUsageTrendProps) {
  const chartData = useMemo(
    () => ({
      labels: months.map((m) => m.label),
      datasets: [
        {
          label: "Leave days",
          data: months.map((m) => m.days),
          borderColor: "#272156",
          backgroundColor: (context: { chart: ChartJS }) => {
            const { chart } = context;
            const { ctx, chartArea } = chart;
            if (!chartArea) return "rgba(49, 205, 255, 0.15)";
            const gradient = ctx.createLinearGradient(
              0,
              chartArea.top,
              0,
              chartArea.bottom
            );
            gradient.addColorStop(0, "rgba(49, 205, 255, 0.35)");
            gradient.addColorStop(1, "rgba(49, 205, 255, 0.02)");
            return gradient;
          },
          fill: true,
          tension: 0.35,
          pointBackgroundColor: "#31CDFF",
          pointBorderColor: "#ffffff",
          pointBorderWidth: 2,
          pointRadius: 3,
          pointHoverRadius: 5,
        },
      ],
    }),
    [months]
  );

  const options: ChartOptions<"line"> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            maxRotation: 0,
            color: "hsl(var(--muted-foreground))",
            font: { size: 11 },
          },
          border: { display: false },
        },
        y: {
          beginAtZero: true,
          ticks: {
            precision: 0,
            color: "hsl(var(--muted-foreground))",
            font: { size: 11 },
          },
          grid: { color: "hsl(var(--border) / 0.6)" },
          border: { display: false },
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
          padding: 10,
          displayColors: false,
          callbacks: {
            label: (item) =>
              `${item.parsed.y} day${item.parsed.y === 1 ? "" : "s"}`,
          },
        },
      },
    }),
    []
  );

  return (
    <div
      className={cn(
        "rounded-xl border border-[#272156]/10 bg-card p-4 shadow-sm",
        className
      )}
    >
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-[#272156] dark:text-foreground">
            Leave usage trend
          </h3>
          <p className="text-xs text-muted-foreground">
            Total approved leave days over the last 12 months
          </p>
        </div>
      </div>
      <div className="h-64">
        <Line data={chartData} options={options} />
      </div>
    </div>
  );
}
