"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  CompensationBreakdown,
  CompensationRecord,
  Employee,
  EquityGrant,
} from "@/types/employee";
import { EmployeeMetricCard } from "../EmployeeMetricCard";
import {
  AdjustPayDialog,
  type AdjustPayPayload,
} from "../AdjustPayDialog";
import {
  GrantEquityDialog,
  type GrantEquityPayload,
} from "../GrantEquityDialog";
import { formatMoney } from "@/lib/employees";
import { adminApi } from "@/lib/api-backend";
import { Button } from "@/components/ui/button";
import { Banknote, Coins, PieChart, TrendingUp } from "lucide-react";
import { toast } from "react-hot-toast";

function buildCompensationBreakdown({
  base,
  bonus,
  equity,
  signOn,
}: {
  base: number;
  bonus: number;
  equity: number;
  signOn: number;
}): CompensationBreakdown[] {
  const rows: CompensationBreakdown[] = [
    { label: "Base", amount: base, color: "#272156" },
    { label: "Bonus", amount: bonus, color: "#31CDFF" },
    { label: "Equity", amount: equity, color: "#5B8DEF" },
  ];
  if (signOn > 0) {
    rows.push({ label: "Sign-on", amount: signOn, color: "#8B7EC8" });
  }
  return rows;
}

function vestedPercent(grant: EquityGrant): string {
  if (!grant.shares) return "—";
  return `${Math.round((grant.vestedShares / grant.shares) * 100)}%`;
}

export function CompensationTab({ employee }: { employee: Employee }) {
  const queryClient = useQueryClient();
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [equityOpen, setEquityOpen] = useState(false);

  const total = employee.compensationBreakdown.reduce((s, b) => s + b.amount, 0);
  const bonusTarget = employee.bonusTarget ?? 0;
  const signOnBonus = employee.signOnBonus ?? 0;

  const invalidateEmployee = () => {
    void queryClient.invalidateQueries({
      queryKey: ["admin-employee", employee.id],
    });
    void queryClient.invalidateQueries({ queryKey: ["admin-employees"] });
  };

  const adjustPayMutation = useMutation({
    mutationFn: async (payload: AdjustPayPayload) => {
      const previousBase = employee.baseSalary;
      const historyEntry: CompensationRecord = {
        effectiveDate: payload.effectiveDate,
        type:
          payload.newBaseSalary > previousBase ? "raise" : "adjustment",
        previousBase,
        newBase: payload.newBaseSalary,
        note:
          payload.note ||
          (payload.newBaseSalary > previousBase
            ? "Base salary increase"
            : "Base salary adjustment"),
      };
      const compensationHistory = [
        historyEntry,
        ...(employee.compensationHistory || []),
      ];
      const compensationBreakdown = buildCompensationBreakdown({
        base: payload.newBaseSalary,
        bonus: bonusTarget,
        equity: employee.equityValue,
        signOn: signOnBonus,
      });
      const totalCompensation =
        payload.newBaseSalary +
        bonusTarget +
        employee.equityValue +
        signOnBonus;

      return adminApi.updateEmployee(employee.id, {
        baseSalary: payload.newBaseSalary,
        totalCompensation,
        compensationBreakdown,
        compensationHistory,
      });
    },
    onSuccess: () => {
      toast.success("Base salary updated");
      setAdjustOpen(false);
      invalidateEmployee();
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to adjust pay"
      );
    },
  });

  const grantEquityMutation = useMutation({
    mutationFn: async (payload: GrantEquityPayload) => {
      const nextEquity = employee.equityValue + payload.grantValue;
      const typeLabel = payload.grantType === "rsu" ? "RSU" : "Options";
      const vestSchedule =
        payload.vestNotes ||
        `${typeLabel} grant · ${formatMoney(payload.grantValue, employee.currency)}`;
      const grant: EquityGrant = {
        id: `eq-${Date.now()}`,
        grantDate: payload.effectiveDate,
        shares: payload.shares,
        vestedShares: 0,
        vestSchedule,
        cliffMonths: 12,
        status: "active",
        grantType: payload.grantType,
        grantValue: payload.grantValue,
      };
      const historyEntry: CompensationRecord = {
        effectiveDate: payload.effectiveDate,
        type: "equity_grant",
        note: `${typeLabel} grant of ${formatMoney(payload.grantValue, employee.currency)}${
          payload.shares > 0 ? ` · ${payload.shares.toLocaleString()} shares` : ""
        }${payload.vestNotes ? ` · ${payload.vestNotes}` : ""}`,
      };
      const equityGrants = [grant, ...(employee.equityGrants || [])];
      const compensationHistory = [
        historyEntry,
        ...(employee.compensationHistory || []),
      ];
      const compensationBreakdown = buildCompensationBreakdown({
        base: employee.baseSalary,
        bonus: bonusTarget,
        equity: nextEquity,
        signOn: signOnBonus,
      });
      const totalCompensation =
        employee.baseSalary + bonusTarget + nextEquity + signOnBonus;

      return adminApi.updateEmployee(employee.id, {
        equityValue: nextEquity,
        totalCompensation,
        compensationBreakdown,
        compensationHistory,
        equityGrants,
      });
    },
    onSuccess: () => {
      toast.success("Equity grant saved");
      setEquityOpen(false);
      invalidateEmployee();
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to grant equity"
      );
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Salary, equity, and pay breakdown for this employee.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setAdjustOpen(true)}
          >
            Adjust pay
          </Button>
          <Button
            size="sm"
            className="bg-[#272156] hover:bg-[#272156]/90 text-white"
            onClick={() => setEquityOpen(true)}
          >
            Grant equity
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <EmployeeMetricCard
          label="Total compensation"
          value={formatMoney(employee.totalCompensation, employee.currency)}
          icon={PieChart}
          accent="navy"
        />
        <EmployeeMetricCard
          label="Base salary"
          value={formatMoney(employee.baseSalary, employee.currency)}
          icon={Banknote}
          accent="cyan"
        />
        <EmployeeMetricCard
          label="Equity value"
          value={formatMoney(employee.equityValue, employee.currency)}
          icon={Coins}
          accent="neutral"
        />
      </div>

      <section className="rounded-xl border bg-card p-5">
        <h3 className="mb-4 text-sm font-semibold">Compensation mix</h3>
        <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
          {employee.compensationBreakdown.map((b) => (
            <div
              key={b.label}
              style={{
                width: `${total ? (b.amount / total) * 100 : 0}%`,
                backgroundColor: b.color,
              }}
              title={`${b.label}: ${formatMoney(b.amount, employee.currency)}`}
            />
          ))}
        </div>
        <ul className="mt-4 grid gap-2 sm:grid-cols-3">
          {employee.compensationBreakdown.map((b) => (
            <li key={b.label} className="flex items-center gap-2 text-sm">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: b.color }}
              />
              <span className="text-muted-foreground">{b.label}</span>
              <span className="ml-auto font-medium">
                {formatMoney(b.amount, employee.currency)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border bg-card p-5">
        <div className="mb-3 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-[#272156] dark:text-[#31CDFF]" />
          <h3 className="text-sm font-semibold">History</h3>
        </div>
        {employee.compensationHistory.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No compensation history yet.
          </p>
        ) : (
          <ol className="relative space-y-4 border-l border-border pl-5">
            {employee.compensationHistory.map((h, i) => (
              <li key={`${h.effectiveDate}-${i}`} className="relative">
                <span className="absolute -left-[1.4rem] top-1 h-2.5 w-2.5 rounded-full bg-[#31CDFF] ring-4 ring-background" />
                <p className="text-xs text-muted-foreground">{h.effectiveDate}</p>
                <p className="text-sm font-medium capitalize">
                  {h.type.replace("_", " ")}
                  {h.newBase
                    ? ` · ${formatMoney(h.newBase, employee.currency)}`
                    : ""}
                </p>
                <p className="text-sm text-muted-foreground">{h.note}</p>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="rounded-xl border bg-card p-5">
        <h3 className="mb-3 text-sm font-semibold">Equity grants</h3>
        {employee.equityGrants.length === 0 ? (
          <p className="text-sm text-muted-foreground">No equity grants on file.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 font-medium">Grant date</th>
                  <th className="pb-2 font-medium">Type</th>
                  <th className="pb-2 font-medium">Value</th>
                  <th className="pb-2 font-medium">Shares</th>
                  <th className="pb-2 font-medium">Vested</th>
                  <th className="pb-2 font-medium">Schedule</th>
                  <th className="pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {employee.equityGrants.map((g) => (
                  <tr key={g.id} className="border-b border-border/60 last:border-0">
                    <td className="py-2.5">{g.grantDate}</td>
                    <td className="py-2.5 uppercase">
                      {g.grantType ?? "—"}
                    </td>
                    <td className="py-2.5">
                      {g.grantValue != null
                        ? formatMoney(g.grantValue, employee.currency)
                        : "—"}
                    </td>
                    <td className="py-2.5">{g.shares.toLocaleString()}</td>
                    <td className="py-2.5">
                      {g.shares > 0
                        ? `${g.vestedShares.toLocaleString()} (${vestedPercent(g)})`
                        : "—"}
                    </td>
                    <td className="py-2.5">{g.vestSchedule}</td>
                    <td className="py-2.5 capitalize">{g.status.replace("_", " ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <AdjustPayDialog
        open={adjustOpen}
        onOpenChange={setAdjustOpen}
        currentBase={employee.baseSalary}
        currency={employee.currency}
        isSubmitting={adjustPayMutation.isPending}
        onSubmit={async (payload) => {
          await adjustPayMutation.mutateAsync(payload);
        }}
      />
      <GrantEquityDialog
        open={equityOpen}
        onOpenChange={setEquityOpen}
        currentEquityValue={employee.equityValue}
        currency={employee.currency}
        isSubmitting={grantEquityMutation.isPending}
        onSubmit={async (payload) => {
          await grantEquityMutation.mutateAsync(payload);
        }}
      />
    </div>
  );
}
