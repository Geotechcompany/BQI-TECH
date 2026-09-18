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
import { CalendarCheck, Clock, Plane, Timer } from "lucide-react";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip
);

export function TimeAttendanceTab({ employee }: { employee: Employee }) {
  const chartData = useMemo(
    () => ({
      labels: employee.attendanceTrend.labels,
      datasets: [
        {
          label: "Attendance %",
          data: employee.attendanceTrend.values,
          borderColor: "#272156",
          backgroundColor: "rgba(49, 205, 255, 0.18)",
          fill: true,
          tension: 0.35,
          pointBackgroundColor: "#31CDFF",
          pointBorderColor: "#fff",
          pointBorderWidth: 2,
          pointRadius: 3,
        },
      ],
    }),
    [employee.attendanceTrend]
  );

  const options: ChartOptions<"line"> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: {
          min: 80,
          max: 100,
          grid: { color: "rgba(0,0,0,0.04)" },
        },
        x: { grid: { display: false } },
      },
    }),
    []
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <EmployeeMetricCard
          label="Present"
          value={employee.attendanceSummary.presentDays}
          hint="This period"
          icon={CalendarCheck}
          accent="navy"
        />
        <EmployeeMetricCard
          label="Leave"
          value={employee.attendanceSummary.leaveDays}
          icon={Plane}
          accent="cyan"
        />
        <EmployeeMetricCard
          label="Late"
          value={employee.attendanceSummary.lateDays}
          icon={Clock}
          accent="neutral"
        />
        <EmployeeMetricCard
          label="Overtime"
          value={`${employee.attendanceSummary.overtimeHours}h`}
          icon={Timer}
          accent="neutral"
        />
      </div>

      <section className="rounded-xl border bg-card p-5">
        <h3 className="mb-3 text-sm font-semibold">Attendance trend</h3>
        {employee.attendanceTrend.labels.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No attendance trend data.
          </p>
        ) : (
          <div className="h-56">
            <Line data={chartData} options={options} />
          </div>
        )}
      </section>

      <section className="rounded-xl border bg-card p-5">
        <h3 className="mb-3 text-sm font-semibold">Timesheet</h3>
        {employee.timesheet.length === 0 ? (
          <p className="text-sm text-muted-foreground">No timesheet entries.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 font-medium">Date</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium">Check in</th>
                  <th className="pb-2 font-medium">Check out</th>
                  <th className="pb-2 font-medium">OT</th>
                </tr>
              </thead>
              <tbody>
                {employee.timesheet.map((d) => (
                  <tr key={d.date} className="border-b border-border/60 last:border-0">
                    <td className="py-2.5">{d.date}</td>
                    <td className="py-2.5 capitalize">{d.status}</td>
                    <td className="py-2.5">{d.checkIn ?? "—"}</td>
                    <td className="py-2.5">{d.checkOut ?? "—"}</td>
                    <td className="py-2.5">
                      {d.overtimeHours ? `${d.overtimeHours}h` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl border bg-card p-5">
        <h3 className="mb-3 text-sm font-semibold">Leave history</h3>
        {employee.leaveHistory.length === 0 ? (
          <p className="text-sm text-muted-foreground">No leave history.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 font-medium">Type</th>
                  <th className="pb-2 font-medium">Dates</th>
                  <th className="pb-2 font-medium">Days</th>
                  <th className="pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {employee.leaveHistory.map((l) => (
                  <tr key={l.id} className="border-b border-border/60 last:border-0">
                    <td className="py-2.5">{l.type}</td>
                    <td className="py-2.5">
                      {l.startDate}
                      {l.endDate !== l.startDate ? ` → ${l.endDate}` : ""}
                    </td>
                    <td className="py-2.5">{l.days}</td>
                    <td className="py-2.5 capitalize">{l.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
