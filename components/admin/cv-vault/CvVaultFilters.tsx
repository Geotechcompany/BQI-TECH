"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import type { CvVaultSort } from "@/types/cv-vault"
import { Filter, Search, X } from "lucide-react"

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

const SORT_LABELS: Record<CvVaultSort, string> = {
  complete_first: "Complete profiles first",
  dropbox_newest: "Newest on Dropbox",
  dropbox_oldest: "Oldest on Dropbox",
  applied_newest: "Latest application date",
  applied_oldest: "Earliest application date",
  name_asc: "Name (A–Z)",
  name_desc: "Name (Z–A)",
}

function FilterField({
  label,
  children,
  className,
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}

function TriChip({
  label,
  value,
  onChange,
}: {
  label: string
  value: TriFilter
  onChange: (v: TriFilter) => void
}) {
  const options: { v: TriFilter; label: string }[] = [
    { v: "all", label: "Any" },
    { v: "yes", label: "Yes" },
    { v: "no", label: "No" },
  ]

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <div
        className="flex w-full rounded-md border border-border bg-background p-0.5"
        role="group"
        aria-label={label}
      >
        {options.map((opt) => (
          <button
            key={opt.v}
            type="button"
            onClick={() => onChange(opt.v)}
            className={cn(
              "flex-1 rounded-sm px-2 py-1.5 text-xs font-medium transition-colors",
              value === opt.v
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export interface CvVaultFiltersProps {
  search: string
  onSearchChange: (v: string) => void
  sort: CvVaultSort
  onSortChange: (v: CvVaultSort) => void
  contactFilter: "all" | "complete" | "missing"
  onContactFilterChange: (v: "all" | "complete" | "missing") => void
  hasEmailFilter: TriFilter
  onHasEmailChange: (v: TriFilter) => void
  hasNameFilter: TriFilter
  onHasNameChange: (v: TriFilter) => void
  linkedFilter: TriFilter
  onLinkedChange: (v: TriFilter) => void
  sourceFilter: "all" | "application" | "dropbox"
  onSourceChange: (v: "all" | "application" | "dropbox") => void
  statusFilter: string
  onStatusChange: (v: string) => void
  dateFrom: string
  onDateFromChange: (v: string) => void
  dateTo: string
  onDateToChange: (v: string) => void
  applicationStatuses: string[]
  sortOptions?: Array<{ value: CvVaultSort; label: string }>
  onReset: () => void
  hasActiveFilters: boolean
  activeFilterCount: number
}

const selectTriggerClass = "h-9 w-full"

export function CvVaultFilters({
  search,
  onSearchChange,
  sort,
  onSortChange,
  contactFilter,
  onContactFilterChange,
  hasEmailFilter,
  onHasEmailChange,
  hasNameFilter,
  onHasNameChange,
  linkedFilter,
  onLinkedChange,
  sourceFilter,
  onSourceChange,
  statusFilter,
  onStatusChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  applicationStatuses,
  sortOptions,
  onReset,
  hasActiveFilters,
  activeFilterCount,
}: CvVaultFiltersProps) {
  const sorts =
    sortOptions ??
    Object.entries(SORT_LABELS).map(([value, label]) => ({
      value: value as CvVaultSort,
      label,
    }))

  const statusOptions =
    applicationStatuses.length > 0 ? applicationStatuses : [...FALLBACK_APPLICATION_STATUSES]

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <Filter className="h-4 w-4 text-primary" />
          </div>
          Search & filters
          {activeFilterCount > 0 && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              {activeFilterCount} active
            </span>
          )}
        </div>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={onReset} className="h-8 text-xs">
            <X className="mr-1 h-3.5 w-3.5" />
            Clear all
          </Button>
        )}
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        {/* Row 1: Search */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by name, email, filename, or Dropbox path…"
            className="h-10 w-full pl-10 pr-10"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Row 2: Sort, Contact, Source, Application status */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <FilterField label="Sort by">
            <Select value={sort} onValueChange={(v) => onSortChange(v as CvVaultSort)}>
              <SelectTrigger className={selectTriggerClass}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sorts.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>

          <FilterField label="Contact">
            <Select
              value={contactFilter}
              onValueChange={(v) =>
                onContactFilterChange(v as "all" | "complete" | "missing")
              }
            >
              <SelectTrigger className={selectTriggerClass}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All profiles</SelectItem>
                <SelectItem value="complete">Name + email</SelectItem>
                <SelectItem value="missing">Missing info</SelectItem>
              </SelectContent>
            </Select>
          </FilterField>

          <FilterField label="Source">
            <Select
              value={sourceFilter}
              onValueChange={(v) =>
                onSourceChange(v as "all" | "application" | "dropbox")
              }
            >
              <SelectTrigger className={selectTriggerClass}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sources</SelectItem>
                <SelectItem value="application">Application</SelectItem>
                <SelectItem value="dropbox">Dropbox only</SelectItem>
              </SelectContent>
            </Select>
          </FilterField>

          <FilterField label="Application status">
            <Select value={statusFilter} onValueChange={onStatusChange}>
              <SelectTrigger className={selectTriggerClass}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {statusOptions.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>
        </div>

        {/* Row 3: Profile attribute toggles */}
        <div className="rounded-lg border border-border/60 bg-muted/30 p-3 sm:p-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <TriChip label="Has email" value={hasEmailFilter} onChange={onHasEmailChange} />
            <TriChip label="Has name" value={hasNameFilter} onChange={onHasNameChange} />
            <TriChip label="Linked" value={linkedFilter} onChange={onLinkedChange} />
          </div>
        </div>

        {/* Row 4: Date range */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FilterField label="Applied from">
            <Input
              id="cv-vault-date-from"
              type="date"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={(e) => onDateFromChange(e.target.value)}
              className="h-9 w-full"
            />
          </FilterField>
          <FilterField label="Applied to">
            <Input
              id="cv-vault-date-to"
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(e) => onDateToChange(e.target.value)}
              className="h-9 w-full"
            />
          </FilterField>
        </div>

        {/* Row 5: Quick filter pills */}
        <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-4">
          <span className="mr-1 text-xs font-medium text-muted-foreground">Quick filters</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 rounded-full text-xs"
            onClick={() => {
              onSortChange("complete_first")
              onContactFilterChange("complete")
              onHasEmailChange("all")
              onHasNameChange("all")
            }}
          >
            Best profiles first
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 rounded-full text-xs"
            onClick={() => {
              onSortChange("dropbox_newest")
              onContactFilterChange("all")
            }}
          >
            Latest on Dropbox
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 rounded-full text-xs"
            onClick={() => {
              onContactFilterChange("missing")
              onHasEmailChange("no")
            }}
          >
            Missing email
          </Button>
        </div>
      </div>
    </div>
  )
}
