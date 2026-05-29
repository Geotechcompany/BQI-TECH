"use client";

import { useMemo } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  type ChartOptions,
} from "chart.js";
import type { TrendSeries } from "@/lib/normalize-trend-data";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

type AdminTrendChartProps = {
  series: TrendSeries;
  className?: string;
};

export function AdminTrendChart({ series, className = "h-80" }: AdminTrendChartProps) {
  const chartData = useMemo(() => {
    return {
      labels: series.labels,
      datasets: [
        {
          label: "Applications",
          data: series.counts,
          borderColor: "rgb(37, 99, 235)",
          backgroundColor: (context: { chart: ChartJS }) => {
            const { chart } = context;
            const { ctx, chartArea } = chart;
            if (!chartArea) return "rgba(37, 99, 235, 0.12)";
            const gradient = ctx.createLinearGradient(
              0,
              chartArea.top,
              0,
              chartArea.bottom
            );
            gradient.addColorStop(0, "rgba(37, 99, 235, 0.28)");
            gradient.addColorStop(1, "rgba(37, 99, 235, 0.02)");
            return gradient;
          },
          fill: true,
          tension: 0.35,
          pointBackgroundColor: "rgb(37, 99, 235)",
          pointBorderColor: "#ffffff",
          pointBorderWidth: 2,
          pointRadius: 3,
          pointHoverRadius: 6,
          pointHitRadius: 12,
        },
      ],
    };
  }, [series]);

  const options: ChartOptions<"line"> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "index",
        intersect: false,
      },
      scales: {
        x: {
          grid: {
            display: false,
          },
          ticks: {
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 8,
            color: "hsl(var(--muted-foreground))",
            font: { size: 11 },
          },
          border: {
            display: false,
          },
        },
        y: {
          beginAtZero: true,
          ticks: {
            precision: 0,
            color: "hsl(var(--muted-foreground))",
            font: { size: 11 },
          },
          grid: {
            color: "hsl(var(--border) / 0.6)",
          },
          border: {
            display: false,
          },
        },
      },
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          backgroundColor: "hsl(var(--popover))",
          titleColor: "hsl(var(--popover-foreground))",
          bodyColor: "hsl(var(--popover-foreground))",
          borderColor: "hsl(var(--border))",
          borderWidth: 1,
          padding: 12,
          displayColors: false,
          callbacks: {
            title: (items) => items[0]?.label ?? "",
            label: (item) => `${item.parsed.y} application${item.parsed.y === 1 ? "" : "s"}`,
          },
        },
      },
    }),
    []
  );

  return (
    <div className={className}>
      <Line data={chartData} options={options} />
    </div>
  );
}
