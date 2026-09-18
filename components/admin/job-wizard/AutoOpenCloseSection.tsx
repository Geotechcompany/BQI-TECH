"use client";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { JobWizardState } from "@/types/job-wizard";

function toDatetimeLocalValue(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromDatetimeLocalValue(local: string): string | null {
  if (!local) return null;
  const date = new Date(local);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function EnabledToggle({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-[#272055]/15 bg-white p-0.5">
      {(
        [
          { label: "Enabled", value: true },
          { label: "Disabled", value: false },
        ] as const
      ).map((option) => (
        <button
          key={option.label}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            enabled === option.value
              ? "bg-[#272055] text-white"
              : "text-[#272055]/70 hover:bg-[#31CDFF]/10"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone: "active" | "closed";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium",
        tone === "active"
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-[#272055]/15 bg-[#f3f5f8] text-[#272055]/70"
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          tone === "active" ? "bg-emerald-500" : "bg-[#272055]/40"
        )}
      />
      {label}
    </span>
  );
}

interface AutoOpenCloseSectionProps {
  state: JobWizardState;
  onChange: (patch: Partial<JobWizardState>) => void;
}

export function AutoOpenCloseSection({
  state,
  onChange,
}: AutoOpenCloseSectionProps) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-base font-semibold text-[#272055]">
          Auto Open/Close Position
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Automatically open or close a position on specific dates.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#272055]/10 bg-white">
        <div className="space-y-3 border-b border-[#272055]/10 px-4 py-3.5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm text-[#272055]">
                Automatically mark this position
              </p>
              <StatusPill label="Active" tone="active" />
            </div>
            <EnabledToggle
              enabled={state.autoOpenEnabled}
              onChange={(enabled) =>
                onChange({
                  autoOpenEnabled: enabled,
                  autoOpenAt: enabled ? state.autoOpenAt : null,
                })
              }
            />
          </div>
          {state.autoOpenEnabled && (
            <div className="max-w-sm">
              <Label htmlFor="autoOpenAt" className="text-xs text-[#272055]/70">
                Open on
              </Label>
              <Input
                id="autoOpenAt"
                type="datetime-local"
                className="mt-1.5"
                value={toDatetimeLocalValue(state.autoOpenAt)}
                onChange={(e) =>
                  onChange({ autoOpenAt: fromDatetimeLocalValue(e.target.value) })
                }
              />
            </div>
          )}
        </div>

        <div className="space-y-3 px-4 py-3.5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm text-[#272055]">
                Automatically mark this position
              </p>
              <StatusPill label="Closed" tone="closed" />
            </div>
            <EnabledToggle
              enabled={state.autoCloseEnabled}
              onChange={(enabled) =>
                onChange({
                  autoCloseEnabled: enabled,
                  autoCloseAt: enabled ? state.autoCloseAt : null,
                })
              }
            />
          </div>
          {state.autoCloseEnabled && (
            <div className="max-w-sm">
              <Label htmlFor="autoCloseAt" className="text-xs text-[#272055]/70">
                Close on
              </Label>
              <Input
                id="autoCloseAt"
                type="datetime-local"
                className="mt-1.5"
                value={toDatetimeLocalValue(state.autoCloseAt)}
                onChange={(e) =>
                  onChange({
                    autoCloseAt: fromDatetimeLocalValue(e.target.value),
                  })
                }
              />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
