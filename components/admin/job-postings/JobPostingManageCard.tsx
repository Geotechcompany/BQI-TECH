"use client";

import type { KeyboardEvent, MouseEvent } from "react";
import {
  Building2,
  CalendarDays,
  Columns3,
  Edit,
  MapPin,
  Power,
  PowerOff,
  Trash2,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  canActivateJob,
  formatMissingActivationMessage,
  getMissingActivationFields,
} from "@/lib/job-activation";
import {
  formatJobPostedDate,
  resolveJobPostingStatus,
  type JobPostingLifecycleStatus,
} from "@/lib/job-posting-status";

export interface JobPostingManageItem {
  id: string;
  title: string;
  department: string;
  location: string;
  description?: string;
  pipelineStages?: Array<{ enabled?: boolean } | Record<string, unknown>>;
  postedDate: string;
  isActive: boolean;
  status?: JobPostingLifecycleStatus | "closed";
}

const STATUS_BADGE: Record<
  JobPostingLifecycleStatus,
  { label: string; className: string }
> = {
  draft: {
    label: "Draft",
    className:
      "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200/80 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-800/50",
  },
  active: {
    label: "Active",
    className:
      "bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-800/50",
  },
  inactive: {
    label: "Inactive",
    className:
      "bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200/80 dark:bg-slate-800/50 dark:text-slate-300 dark:ring-slate-700/60",
  },
};

type JobPostingManageCardProps = {
  job: JobPostingManageItem;
  selected?: boolean;
  onSelectChange?: (selected: boolean) => void;
  onOpenPipeline: (id: string) => void;
  onEdit: (id: string) => void;
  onToggleActive: (id: string, isLive: boolean) => void;
  onDelete: (job: { id: string; title: string }) => void;
  className?: string;
};

function MetaRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Building2;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2.5 min-w-0">
      <span
        className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#272055]/5 text-[#272055]/70 dark:bg-[#31CDFF]/10 dark:text-[#31CDFF]/80"
        aria-hidden
      >
        <Icon className="h-3.5 w-3.5" strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1 leading-snug">
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/80">
          {label}
        </p>
        <p
          className="truncate text-sm text-foreground/90"
          title={value || undefined}
        >
          {value || "—"}
        </p>
      </div>
    </div>
  );
}

function stopCardNavigation(event: MouseEvent | KeyboardEvent) {
  event.stopPropagation();
}

export function JobPostingManageCard({
  job,
  selected = false,
  onSelectChange,
  onOpenPipeline,
  onEdit,
  onToggleActive,
  onDelete,
  className,
}: JobPostingManageCardProps) {
  const status = resolveJobPostingStatus(job);
  const badge = STATUS_BADGE[status];
  const isLive = status === "active";
  const title = job.title?.trim() || "Untitled position";
  const missingFields = getMissingActivationFields(job);
  const activationBlocked = !isLive && !canActivateJob(job);
  const activateTitle = isLive
    ? "Deactivate"
    : activationBlocked
      ? formatMissingActivationMessage(missingFields)
      : "Activate";

  const openPipeline = () => onOpenPipeline(job.id);

  return (
    <article
      className={cn(
        "group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-xl border border-[#272055]/10 bg-card shadow-sm",
        "transition-[box-shadow,border-color,transform] duration-200",
        "hover:border-[#31CDFF]/35 hover:shadow-md",
        selected && "border-[#31CDFF]/50 ring-1 ring-[#31CDFF]/25",
        className
      )}
      data-tour="job-posting-card"
    >
      <button
        type="button"
        className="absolute inset-0 z-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#31CDFF]/55 focus-visible:ring-offset-2"
        onClick={openPipeline}
        aria-label={`Open pipeline for ${title}`}
      />

      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#31CDFF]/40 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100"
        aria-hidden
      />

      <div className="relative z-[1] flex items-start gap-3 p-4 pb-3 pointer-events-none">
        {onSelectChange && (
          <div
            className="pointer-events-auto"
            onClick={stopCardNavigation}
            onKeyDown={stopCardNavigation}
          >
            <Checkbox
              checked={selected}
              onCheckedChange={(checked) => onSelectChange(checked === true)}
              aria-label={`Select ${title}`}
              className="mt-1 border-[#272055]/30 data-[state=checked]:border-[#272055] data-[state=checked]:bg-[#272055]"
            />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3
              className="text-[15px] font-semibold leading-snug text-[#272055] dark:text-foreground line-clamp-2"
              title={title}
            >
              {title}
            </h3>
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide",
                badge.className
              )}
            >
              {badge.label}
            </span>
          </div>
        </div>
      </div>

      <div className="relative z-[1] flex flex-1 flex-col gap-2.5 px-4 pb-3 pointer-events-none">
        <MetaRow icon={Building2} label="Department" value={job.department} />
        <MetaRow icon={MapPin} label="Location" value={job.location} />
        <MetaRow
          icon={CalendarDays}
          label="Posted"
          value={formatJobPostedDate(job.postedDate)}
        />
      </div>

      <div className="relative z-[1] mt-auto flex items-center justify-end gap-0.5 border-t border-[#272055]/8 bg-[#fafbfd]/80 px-2 py-1.5 pointer-events-none dark:bg-muted/20">
        <Button
          size="sm"
          variant="ghost"
          onClick={(event) => {
            stopCardNavigation(event);
            openPipeline();
          }}
          className="pointer-events-auto h-8 w-8 p-0 text-[#31CDFF] hover:bg-[#31CDFF]/10 hover:text-[#272055]"
          title="Open pipeline"
          aria-label={`Open pipeline for ${title}`}
          data-tour="job-postings-pipeline"
        >
          <Columns3 className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={(event) => {
            stopCardNavigation(event);
            onEdit(job.id);
          }}
          className="pointer-events-auto h-8 w-8 p-0 text-[#272055]/70 hover:bg-[#272055]/5 hover:text-[#272055] dark:text-muted-foreground dark:hover:text-foreground"
          title={status === "draft" ? "Continue editing" : "Edit"}
          aria-label={
            status === "draft" ? `Continue editing ${title}` : `Edit ${title}`
          }
        >
          <Edit className="h-4 w-4" />
        </Button>
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className="pointer-events-auto inline-flex"
                onClick={stopCardNavigation}
              >
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={activationBlocked}
                  onClick={(event) => {
                    stopCardNavigation(event);
                    if (activationBlocked) return;
                    onToggleActive(job.id, isLive);
                  }}
                  className={cn(
                    "h-8 w-8 p-0",
                    isLive
                      ? "text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/30"
                      : "text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/30",
                    activationBlocked && "opacity-40"
                  )}
                  title={activateTitle}
                  aria-label={
                    isLive
                      ? `Deactivate ${title}`
                      : activationBlocked
                        ? `Cannot activate ${title}: incomplete`
                        : `Activate ${title}`
                  }
                >
                  {isLive ? (
                    <PowerOff className="h-4 w-4" />
                  ) : (
                    <Power className="h-4 w-4" />
                  )}
                </Button>
              </span>
            </TooltipTrigger>
            {activationBlocked && (
              <TooltipContent side="top" className="max-w-xs text-xs">
                {formatMissingActivationMessage(missingFields)}
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
        <Button
          size="sm"
          variant="ghost"
          onClick={(event) => {
            stopCardNavigation(event);
            onDelete({ id: job.id, title: job.title });
          }}
          className="pointer-events-auto h-8 w-8 p-0 text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/30"
          title="Delete"
          aria-label={`Delete ${title}`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </article>
  );
}
