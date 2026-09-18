"use client"

import { useEffect, useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import type { CvVaultSort } from "@/types/cv-vault"
import { Filter, X } from "lucide-react"

export type TriFilter = "all" | "yes" | "no"

const FALLBACK_APPLICATION_STATUSES = [
  "New",
  "Shortlisted",
  "Technical Assessment",
  "Interviewing",
  "Hired",
  "Rejected",
  "Disqualified",
] as const

export interface ApplicantsDraftFilters {
  sort: CvVaultSort
  contactFilter: "all" | "complete" | "missing"
  hasEmailFilter: TriFilter
  hasNameFilter: TriFilter
  linkedFilter: TriFilter
  sourceFilter: "all" | "application" | "dropbox"
  statusFilter: string
  dateFrom: string
  dateTo: string
}

export interface CvVaultFiltersProps {
  draft: ApplicantsDraftFilters
  onDraftChange: (patch: Partial<ApplicantsDraftFilters>) => void
  onApply: () => void
  onReset: () => void
  applicationStatuses: string[]
  hasActiveFilters: boolean
  activeFilterCount: number
  className?: string
}

function FilterSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-2.5 border-b border-border/70 px-4 py-3.5 last:border-b-0">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <div className="space-y-2">{children}</div>
    </section>
  )
}

function CheckboxRow({
  id,
  label,
  checked,
  onCheckedChange,
}: {
  id: string
  label: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-center gap-2.5 rounded-md px-1 py-1 text-sm text-foreground transition-colors duration-100 ease-out hover:bg-muted/60"
    >
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(value === true)}
        className="border-muted-foreground/40 data-[state=checked]:border-[#272055] data-[state=checked]:bg-[#272055]"
      />
      <span className="leading-none">{label}</span>
    </label>
  )
}

export function CvVaultFilters({
  draft,
  onDraftChange,
  onApply,
  onReset,
  applicationStatuses,
  hasActiveFilters,
  activeFilterCount,
  className,
}: CvVaultFiltersProps) {
  const statusOptions =
    applicationStatuses.length > 0
      ? applicationStatuses
      : [...FALLBACK_APPLICATION_STATUSES]

  return (
    <aside
      className={cn(
        "flex h-full min-h-0 w-full flex-col border-r border-border bg-card",
        className
      )}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Filter className="h-4 w-4 text-[#272055]" />
          Filtering Options
          {activeFilterCount > 0 && (
            <span className="rounded-full bg-[#272055]/10 px-2 py-0.5 text-[11px] font-medium text-[#272055]">
              {activeFilterCount}
            </span>
          )}
        </div>
        {hasActiveFilters && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground active:scale-[0.97]"
          >
            <X className="mr-1 h-3.5 w-3.5" />
            Clear
          </Button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <FilterSection title="Pipeline / Stages">
          <CheckboxRow
            id="stage-all"
            label="All stages"
            checked={draft.statusFilter === "all"}
            onCheckedChange={() => onDraftChange({ statusFilter: "all" })}
          />
          {statusOptions.map((status) => (
            <CheckboxRow
              key={status}
              id={`stage-${status}`}
              label={status}
              checked={draft.statusFilter === status}
              onCheckedChange={(checked) =>
                onDraftChange({ statusFilter: checked ? status : "all" })
              }
            />
          ))}
        </FilterSection>

        <FilterSection title="Applied Date">
          <div className="space-y-2">
            <div className="space-y-1">
              <Label htmlFor="applicants-date-from" className="text-xs text-muted-foreground">
                From
              </Label>
              <Input
                id="applicants-date-from"
                type="date"
                value={draft.dateFrom}
                max={draft.dateTo || undefined}
                onChange={(e) => onDraftChange({ dateFrom: e.target.value })}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="applicants-date-to" className="text-xs text-muted-foreground">
                To
              </Label>
              <Input
                id="applicants-date-to"
                type="date"
                value={draft.dateTo}
                min={draft.dateFrom || undefined}
                onChange={(e) => onDraftChange({ dateTo: e.target.value })}
                className="h-8 text-sm"
              />
            </div>
          </div>
        </FilterSection>

        <FilterSection title="Contact">
          <CheckboxRow
            id="contact-all"
            label="All profiles"
            checked={draft.contactFilter === "all"}
            onCheckedChange={() => onDraftChange({ contactFilter: "all" })}
          />
          <CheckboxRow
            id="contact-complete"
            label="Name + email"
            checked={draft.contactFilter === "complete"}
            onCheckedChange={(checked) =>
              onDraftChange({ contactFilter: checked ? "complete" : "all" })
            }
          />
          <CheckboxRow
            id="contact-missing"
            label="Missing info"
            checked={draft.contactFilter === "missing"}
            onCheckedChange={(checked) =>
              onDraftChange({ contactFilter: checked ? "missing" : "all" })
            }
          />
          <CheckboxRow
            id="has-email-yes"
            label="Has email"
            checked={draft.hasEmailFilter === "yes"}
            onCheckedChange={(checked) =>
              onDraftChange({ hasEmailFilter: checked ? "yes" : "all" })
            }
          />
          <CheckboxRow
            id="has-name-yes"
            label="Has name"
            checked={draft.hasNameFilter === "yes"}
            onCheckedChange={(checked) =>
              onDraftChange({ hasNameFilter: checked ? "yes" : "all" })
            }
          />
        </FilterSection>

        <FilterSection title="Source">
          <CheckboxRow
            id="source-all"
            label="All sources"
            checked={draft.sourceFilter === "all"}
            onCheckedChange={() => onDraftChange({ sourceFilter: "all" })}
          />
          <CheckboxRow
            id="source-application"
            label="Application"
            checked={draft.sourceFilter === "application"}
            onCheckedChange={(checked) =>
              onDraftChange({ sourceFilter: checked ? "application" : "all" })
            }
          />
          <CheckboxRow
            id="source-dropbox"
            label="Dropbox"
            checked={draft.sourceFilter === "dropbox"}
            onCheckedChange={(checked) =>
              onDraftChange({ sourceFilter: checked ? "dropbox" : "all" })
            }
          />
        </FilterSection>

        <FilterSection title="Linked application">
          <CheckboxRow
            id="linked-all"
            label="Any"
            checked={draft.linkedFilter === "all"}
            onCheckedChange={() => onDraftChange({ linkedFilter: "all" })}
          />
          <CheckboxRow
            id="linked-yes"
            label="Linked"
            checked={draft.linkedFilter === "yes"}
            onCheckedChange={(checked) =>
              onDraftChange({ linkedFilter: checked ? "yes" : "all" })
            }
          />
          <CheckboxRow
            id="linked-no"
            label="Unlinked"
            checked={draft.linkedFilter === "no"}
            onCheckedChange={(checked) =>
              onDraftChange({ linkedFilter: checked ? "no" : "all" })
            }
          />
        </FilterSection>
      </div>

      <div className="shrink-0 border-t border-border p-3">
        <Button
          type="button"
          onClick={onApply}
          className="h-9 w-full bg-[#31CDFF] text-sm font-semibold text-white hover:bg-[#31CDFF]/90 active:scale-[0.97]"
        >
          Apply Filter
        </Button>
      </div>
    </aside>
  )
}

/** Keeps draft in sync when applied filters reset from outside the pane. */
export function useApplicantsDraftFilters(applied: ApplicantsDraftFilters) {
  const [draft, setDraft] = useState(applied)

  useEffect(() => {
    setDraft(applied)
  }, [applied])

  const patchDraft = (patch: Partial<ApplicantsDraftFilters>) => {
    setDraft((prev) => ({ ...prev, ...patch }))
  }

  return { draft, setDraft, patchDraft }
}
