"use client";

import { useMemo } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  type ChartOptions,
} from "chart.js";
import type { Employee } from "@/types/employee";
import { EmployeeMetricCard } from "../EmployeeMetricCard";
import { Progress } from "@/components/ui/progress";
import { Award, MessageSquare, Target } from "lucide-react";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip
);

const goalStatusLabel = {
  on_track: "On track",
  at_risk: "At risk",
  completed: "Completed",
  not_started: "Not started",
} as const;

export function PerformanceTab({ employee }: { employee: Employee }) {
  const chartData = useMemo(
    () => ({
      labels: employee.ratingHistory.labels,
      datasets: [
        {
          label: "Rating",
          data: employee.ratingHistory.values,
          borderColor: "#272156",
          backgroundColor: "rgba(49, 205, 255, 0.15)",
          fill: true,
          tension: 0.35,
          pointBackgroundColor: "#31CDFF",
          pointBorderColor: "#fff",
          pointBorderWidth: 2,
        },
      ],
    }),
    [employee.ratingHistory]
  );

  const options: ChartOptions<"line"> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { min: 1, max: 5, grid: { color: "rgba(0,0,0,0.04)" } },
        x: { grid: { display: false } },
      },
    }),
    []
  );

  const goalsOnTrack = employee.goals.filter((g) => g.status === "on_track").length;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <EmployeeMetricCard
          label="Current rating"
          value={
            employee.performanceRating
              ? employee.performanceRating.toFixed(1)
              : "—"
          }
          hint="Out of 5"
          icon={Award}
          accent="navy"
        />
        <EmployeeMetricCard
          label="Goals on track"
          value={`${goalsOnTrack}/${employee.goals.length}`}
          icon={Target}
          accent="cyan"
        />
        <EmployeeMetricCard
          label="Peer feedback"
          value={employee.peerFeedback.length}
          hint="Recent notes"
          icon={MessageSquare}
          accent="neutral"
        />
      </div>

      <section className="rounded-xl border bg-card p-5">
        <h3 className="mb-3 text-sm font-semibold">Rating trend</h3>
        {employee.ratingHistory.labels.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No rating history yet.
          </p>
        ) : (
          <div className="h-52">
            <Line data={chartData} options={options} />
          </div>
        )}
      </section>

      <section className="rounded-xl border bg-card p-5">
        <h3 className="mb-4 text-sm font-semibold">Current goals</h3>
        {employee.goals.length === 0 ? (
          <p className="text-sm text-muted-foreground">No goals set.</p>
        ) : (
        <ul className="space-y-4">
          {employee.goals.map((g) => (
            <li key={g.id}>
              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">{g.title}</p>
                <span className="text-xs text-muted-foreground">
                  {goalStatusLabel[g.status]} · due {g.dueDate}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Progress value={g.progress} className="h-2 flex-1" />
                <span className="w-10 text-right text-xs font-medium">
                  {g.progress}%
                </span>
              </div>
            </li>
          ))}
        </ul>
        )}
      </section>

      <section className="rounded-xl border bg-card p-5">
        <h3 className="mb-3 text-sm font-semibold">Peer feedback</h3>
        {employee.peerFeedback.length === 0 ? (
          <p className="text-sm text-muted-foreground">No peer feedback yet.</p>
        ) : (
        <ul className="space-y-3">
          {employee.peerFeedback.map((f) => (
            <li
              key={f.id}
              className="rounded-lg border border-border/70 bg-muted/30 p-3"
            >
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">{f.fromName}</p>
                <p className="text-xs text-muted-foreground">
                  {f.date} · {f.rating.toFixed(1)}/5
                </p>
              </div>
              <p className="text-sm text-muted-foreground">{f.summary}</p>
            </li>
          ))}
        </ul>
        )}
      </section>
    </div>
  );
}
