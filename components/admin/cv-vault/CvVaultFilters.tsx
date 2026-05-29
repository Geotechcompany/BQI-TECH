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

const SORT_LABELS: Record<CvVaultSort, string> = {
  complete_first: "Complete profiles first",
  dropbox_newest: "Newest on Dropbox",
  dropbox_oldest: "Oldest on Dropbox",
  applied_newest: "Latest application date",
  applied_oldest: "Earliest application date",
  name_asc: "Name (A–Z)",
  name_desc: "Name (Z–A)",
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
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <div className="inline-flex rounded-lg border border-border/80 bg-muted/30 p-0.5">
        {options.map((opt) => (
          <button
            key={opt.v}
            type="button"
            onClick={() => onChange(opt.v)}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition-all",
              value === opt.v
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
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
  applicationStatuses: string[]
  sortOptions?: Array<{ value: CvVaultSort; label: string }>
  onReset: () => void
  hasActiveFilters: boolean
  activeFilterCount: number
}

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

  return (
    <div className="rounded-2xl border border-border/60 bg-card/80 shadow-sm backdrop-blur-sm overflow-hidden">
      <div className="border-b border-border/50 bg-gradient-to-r from-violet-500/5 via-transparent to-[#31CDFF]/5 px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10">
              <Filter className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            </div>
            Search & filters
            {activeFilterCount > 0 && (
              <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-xs font-medium text-violet-700 dark:text-violet-300">
                {activeFilterCount} active
              </span>
            )}
          </div>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={onReset} className="h-8 text-xs">
              <X className="h-3.5 w-3.5 mr-1" />
              Clear all
            </Button>
          )}
        </div>
      </div>

      <div className="p-4 sm:p-5 space-y-5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by name, email, filename, or Dropbox path…"
            className="h-11 pl-10 pr-10 rounded-xl border-border/80 bg-muted/20 focus-visible:ring-violet-500/30"
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs font-medium text-muted-foreground">Sort by</Label>
            <Select value={sort} onValueChange={(v) => onSortChange(v as CvVaultSort)}>
              <SelectTrigger className="h-10 rounded-xl">
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
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Contact</Label>
            <Select
              value={contactFilter}
              onValueChange={(v) =>
                onContactFilterChange(v as "all" | "complete" | "missing")
              }
            >
              <SelectTrigger className="h-10 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All profiles</SelectItem>
                <SelectItem value="complete">Name + email</SelectItem>
                <SelectItem value="missing">Missing info</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Source</Label>
            <Select
              value={sourceFilter}
              onValueChange={(v) =>
                onSourceChange(v as "all" | "application" | "dropbox")
              }
            >
              <SelectTrigger className="h-10 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sources</SelectItem>
                <SelectItem value="application">Application</SelectItem>
                <SelectItem value="dropbox">Dropbox only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <TriChip label="Has email" value={hasEmailFilter} onChange={onHasEmailChange} />
          <TriChip label="Has name" value={hasNameFilter} onChange={onHasNameChange} />
          <TriChip label="Linked to application" value={linkedFilter} onChange={onLinkedChange} />
        </div>

        {applicationStatuses.length > 0 && (
          <div className="space-y-1.5 max-w-md">
            <Label className="text-xs font-medium text-muted-foreground">
              Application status
            </Label>
            <Select value={statusFilter} onValueChange={onStatusChange}>
              <SelectTrigger className="h-10 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {applicationStatuses.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-1 border-t border-border/40">
          <span className="text-xs text-muted-foreground self-center mr-1">Quick:</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full h-8 text-xs"
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
            className="rounded-full h-8 text-xs"
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
            className="rounded-full h-8 text-xs"
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
