"use client";



import { Button } from "@/components/ui/button";

import { Checkbox } from "@/components/ui/checkbox";

import { Input } from "@/components/ui/input";

import { Label } from "@/components/ui/label";

import {

  Select,

  SelectContent,

  SelectItem,

  SelectTrigger,

  SelectValue,

} from "@/components/ui/select";

import { AI_SCORE_FILTER_OPTIONS } from "@/lib/ai-score-filter";

import { Skeleton } from "@/components/ui/skeleton";

import { cn } from "@/lib/utils";

import { Filter, RotateCcw } from "lucide-react";

import {

  type CandidatesDraftFilters,

  countActiveCandidateFilters,

} from "./candidates-utils";

import { PIPELINE_STAGES } from "@/components/admin/pipeline/pipeline-utils";



interface CandidatesFiltersProps {

  draft: CandidatesDraftFilters;

  onDraftChange: (patch: Partial<CandidatesDraftFilters>) => void;

  onApply: () => void;

  onReset: () => void;

  positions: string[];

  categories: string[];

  sources: string[];

  locations: string[];

  tags: string[];

  /** True while positions (and other filter option lists) are still loading. */
  isLoadingOptions?: boolean;

  className?: string;

}



function FilterSection({

  title,

  children,

  hint,

}: {

  title: string;

  children: React.ReactNode;

  hint?: string;

}) {

  return (

    <section className="space-y-2 border-b border-border px-4 py-3 last:border-0">

      <div>

        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">

          {title}

        </h3>

        {hint ? (

          <p className="mt-0.5 text-[11px] text-muted-foreground/80">{hint}</p>

        ) : null}

      </div>

      {children}

    </section>

  );

}



function toggleValue(list: string[], value: string): string[] {

  return list.includes(value)

    ? list.filter((item) => item !== value)

    : [...list, value];

}



export function CandidatesFilters({

  draft,

  onDraftChange,

  onApply,

  onReset,

  positions,

  categories,

  sources,

  locations,

  tags,

  isLoadingOptions = false,

  className,

}: CandidatesFiltersProps) {

  const activeCount = countActiveCandidateFilters(draft);



  return (

    <aside

      className={cn(

        "flex h-full min-h-0 w-full flex-col border-r border-border bg-card",

        className

      )}

    >

      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-3">

        <div className="flex items-center gap-2 text-sm font-medium">

          <Filter className="h-3.5 w-3.5 text-muted-foreground" />

          Filters

          {activeCount > 0 ? (

            <span className="rounded-full bg-[#272055]/10 px-1.5 text-[11px] font-medium text-[#272055]">

              {activeCount}

            </span>

          ) : null}

        </div>

        <Button

          type="button"

          variant="ghost"

          size="sm"

          className="h-8 gap-1 px-2 text-xs"

          onClick={onReset}

        >

          <RotateCcw className="h-3 w-3" />

          Reset

        </Button>

      </div>



      <div className="min-h-0 flex-1 overflow-y-auto">

        <FilterSection title="Positions / Pools">

          <div className="max-h-40 space-y-2 overflow-y-auto pr-1">

            {isLoadingOptions ? (

              <div className="space-y-2" aria-busy="true" aria-label="Loading positions">

                {Array.from({ length: 5 }).map((_, index) => (

                  <div key={index} className="flex items-center gap-2">

                    <Skeleton className="h-4 w-4 shrink-0 rounded" />

                    <Skeleton className="h-3.5 w-[70%]" />

                  </div>

                ))}

              </div>

            ) : positions.length === 0 ? (

              <p className="text-xs text-muted-foreground">No positions found</p>

            ) : (

              positions.map((position) => (

                <label

                  key={position}

                  className="flex cursor-pointer items-start gap-2 text-sm"

                >

                  <Checkbox

                    checked={draft.positions.includes(position)}

                    onCheckedChange={() =>

                      onDraftChange({

                        positions: toggleValue(draft.positions, position),

                      })

                    }

                    className="mt-0.5"

                  />

                  <span className="leading-snug">{position}</span>

                </label>

              ))

            )}

          </div>

        </FilterSection>



        <FilterSection

          title="Position Category"

          hint="Uses job department"

        >

          <div className="max-h-32 space-y-2 overflow-y-auto pr-1">

            {categories.length === 0 ? (

              <p className="text-xs text-muted-foreground">No departments found</p>

            ) : (

              categories.map((category) => (

                <label

                  key={category}

                  className="flex cursor-pointer items-start gap-2 text-sm"

                >

                  <Checkbox

                    checked={draft.categories.includes(category)}

                    onCheckedChange={() =>

                      onDraftChange({

                        categories: toggleValue(draft.categories, category),

                      })

                    }

                    className="mt-0.5"

                  />

                  <span className="leading-snug">{category}</span>

                </label>

              ))

            )}

          </div>

        </FilterSection>



        <FilterSection title="Position Locations">

          <div className="max-h-32 space-y-2 overflow-y-auto pr-1">

            {locations.length === 0 ? (

              <p className="text-xs text-muted-foreground">No locations found</p>

            ) : (

              locations.map((location) => (

                <label

                  key={location}

                  className="flex cursor-pointer items-start gap-2 text-sm"

                >

                  <Checkbox

                    checked={draft.locations.includes(location)}

                    onCheckedChange={() =>

                      onDraftChange({

                        locations: toggleValue(draft.locations, location),

                      })

                    }

                    className="mt-0.5"

                  />

                  <span className="leading-snug">{location}</span>

                </label>

              ))

            )}

          </div>

        </FilterSection>



        <FilterSection title="Pipeline / Stages">

          <div className="space-y-2">

            {PIPELINE_STAGES.map((stage) => (

              <label

                key={stage}

                className="flex cursor-pointer items-center gap-2 text-sm"

              >

                <Checkbox

                  checked={draft.stages.includes(stage)}

                  onCheckedChange={() =>

                    onDraftChange({

                      stages: toggleValue(draft.stages, stage),

                    })

                  }

                />

                {stage}

              </label>

            ))}

          </div>

        </FilterSection>



        <FilterSection title="Added Date">

          <div className="grid grid-cols-1 gap-2">

            <div className="space-y-1">

              <Label htmlFor="candidates-date-from" className="text-xs">

                From

              </Label>

              <Input

                id="candidates-date-from"

                type="date"

                value={draft.dateFrom}

                max={draft.dateTo || undefined}

                onChange={(event) =>

                  onDraftChange({ dateFrom: event.target.value })

                }

                className="h-8"

              />

            </div>

            <div className="space-y-1">

              <Label htmlFor="candidates-date-to" className="text-xs">

                To

              </Label>

              <Input

                id="candidates-date-to"

                type="date"

                value={draft.dateTo}

                min={draft.dateFrom || undefined}

                onChange={(event) =>

                  onDraftChange({ dateTo: event.target.value })

                }

                className="h-8"

              />

            </div>

          </div>

        </FilterSection>



        <FilterSection title="Last Activity">

          <div className="grid grid-cols-1 gap-2">

            <Input

              type="date"

              value={draft.activityFrom}

              onChange={(event) =>

                onDraftChange({ activityFrom: event.target.value })

              }

              className="h-8"

              aria-label="Activity from"

            />

            <Input

              type="date"

              value={draft.activityTo}

              onChange={(event) =>

                onDraftChange({ activityTo: event.target.value })

              }

              className="h-8"

              aria-label="Activity to"

            />

          </div>

        </FilterSection>



        <FilterSection title="Tags">

          <div className="max-h-32 space-y-2 overflow-y-auto pr-1">

            {tags.length === 0 ? (

              <p className="text-xs text-muted-foreground">

                No tags yet. Tag candidates from the More menu.

              </p>

            ) : (

              tags.map((tag) => (

                <label

                  key={tag}

                  className="flex cursor-pointer items-start gap-2 text-sm"

                >

                  <Checkbox

                    checked={draft.tags.includes(tag)}

                    onCheckedChange={() =>

                      onDraftChange({

                        tags: toggleValue(draft.tags, tag),

                      })

                    }

                    className="mt-0.5"

                  />

                  <span className="leading-snug">{tag}</span>

                </label>

              ))

            )}

          </div>

        </FilterSection>



        <FilterSection title="Desired Salary">

          <div className="grid grid-cols-2 gap-2">

            <Input

              type="number"

              placeholder="Min"

              value={draft.salaryMin}

              onChange={(event) =>

                onDraftChange({ salaryMin: event.target.value })

              }

              className="h-8"

            />

            <Input

              type="number"

              placeholder="Max"

              value={draft.salaryMax}

              onChange={(event) =>

                onDraftChange({ salaryMax: event.target.value })

              }

              className="h-8"

            />

          </div>

        </FilterSection>



        <FilterSection title="AI Score">

          <Select

            value={draft.aiScore}

            onValueChange={(value) => onDraftChange({ aiScore: value })}

          >

            <SelectTrigger className="h-8">

              <SelectValue />

            </SelectTrigger>

            <SelectContent>

              {AI_SCORE_FILTER_OPTIONS.map((option) => (

                <SelectItem key={option.value} value={option.value}>

                  {option.label}

                </SelectItem>

              ))}

            </SelectContent>

          </Select>

        </FilterSection>



        <FilterSection title="Resume Audit Status">

          <Select

            value={draft.resumeAudit}

            onValueChange={(value) =>

              onDraftChange({

                resumeAudit: value as CandidatesDraftFilters["resumeAudit"],

              })

            }

          >

            <SelectTrigger className="h-8">

              <SelectValue />

            </SelectTrigger>

            <SelectContent>

              <SelectItem value="all">All</SelectItem>

              <SelectItem value="audited">Audited</SelectItem>

              <SelectItem value="not_audited">Not audited</SelectItem>

            </SelectContent>

          </Select>

        </FilterSection>



        <FilterSection title="Candidate Source">

          <div className="max-h-32 space-y-2 overflow-y-auto pr-1">

            {sources.length === 0 ? (

              <p className="text-xs text-muted-foreground">No sources found</p>

            ) : (

              sources.map((source) => (

                <label

                  key={source}

                  className="flex cursor-pointer items-start gap-2 text-sm"

                >

                  <Checkbox

                    checked={draft.sources.includes(source)}

                    onCheckedChange={() =>

                      onDraftChange({

                        sources: toggleValue(draft.sources, source),

                      })

                    }

                    className="mt-0.5"

                  />

                  <span className="leading-snug">{source}</span>

                </label>

              ))

            )}

          </div>

        </FilterSection>



        <FilterSection title="Assigned To">

          <label className="flex cursor-pointer items-center gap-2 text-sm">

            <Checkbox

              checked={draft.assignedToMe}

              onCheckedChange={(checked) =>

                onDraftChange({ assignedToMe: checked === true })

              }

            />

            Assigned to me

          </label>

        </FilterSection>



        <FilterSection title="Starred">

          <label className="flex cursor-pointer items-center gap-2 text-sm">

            <Checkbox

              checked={draft.starredOnly}

              onCheckedChange={(checked) =>

                onDraftChange({ starredOnly: checked === true })

              }

            />

            Starred only

          </label>

        </FilterSection>



        <FilterSection title="Unseen">

          <label className="flex cursor-pointer items-center gap-2 text-sm">

            <Checkbox

              checked={draft.unseenOnly}

              onCheckedChange={(checked) =>

                onDraftChange({ unseenOnly: checked === true })

              }

            />

            Unseen only

          </label>

        </FilterSection>



        <FilterSection title="Include Archived">

          <label className="flex cursor-pointer items-center gap-2 text-sm">

            <Checkbox

              checked={draft.includeArchived}

              onCheckedChange={(checked) =>

                onDraftChange({ includeArchived: checked === true })

              }

            />

            Include archived candidates

          </label>

        </FilterSection>

      </div>



      <div className="shrink-0 border-t border-border p-4">

        <Button

          type="button"

          className="w-full bg-[#31CDFF] font-semibold text-white hover:bg-[#31CDFF]/90"

          onClick={onApply}

        >

          Apply Filter

        </Button>

      </div>

    </aside>

  );

}


