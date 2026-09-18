"use client";

import type { DraggableProvidedDragHandleProps, DraggableProvidedDraggableProps } from "@hello-pangea/dnd";
import { Application } from "@/types/application";
import {
  getNameDisplay,
  getEmailDisplay,
  getPositionDisplay,
  getCvUrl,
} from "@/components/admin/utils/table-utils";
import { AiRankScoreCell } from "@/components/admin/AiRankCell";
import { formatDaysInStage, getDaysInCurrentStage } from "./pipeline-utils";
import { cn } from "@/lib/utils";
import { FileText, GripVertical, Mail } from "lucide-react";

interface CandidateCardProps {
  application: Application;
  jobTitles?: Record<string, string>;
  onClick?: () => void;
  isDragging?: boolean;
  isUpdating?: boolean;
  innerRef?: (element: HTMLElement | null) => void;
  draggableProps?: DraggableProvidedDraggableProps;
  dragHandleProps?: DraggableProvidedDragHandleProps | null;
  className?: string;
}

export function CandidateCard({
  application,
  jobTitles = {},
  onClick,
  isDragging = false,
  isUpdating = false,
  innerRef,
  draggableProps,
  dragHandleProps,
  className,
}: CandidateCardProps) {
  const name = getNameDisplay(application);
  const email = getEmailDisplay(application);
  const position = getPositionDisplay(application, jobTitles);
  const cvUrl = getCvUrl(application);
  const daysInStage = getDaysInCurrentStage(application);

  return (
    <article
      ref={innerRef}
      {...draggableProps}
      {...(dragHandleProps ?? {})}
      onClick={onClick}
      onKeyDown={(event) => {
        if (onClick && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          onClick();
        }
      }}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={cn(
        "group relative rounded-lg border border-border bg-white p-3 shadow-sm transition-shadow",
        "hover:border-[#31CDFF]/50 hover:shadow-md",
        dragHandleProps && "cursor-grab touch-none active:cursor-grabbing",
        isDragging && "border-[#31CDFF] shadow-lg ring-2 ring-[#31CDFF]/30",
        isUpdating && "pointer-events-none opacity-60",
        onClick && !dragHandleProps && "cursor-pointer",
        className
      )}
    >
      <div className="flex items-start gap-2">
        <span
          className={cn(
            "mt-0.5 shrink-0 text-muted-foreground/40 transition-colors group-hover:text-[#31CDFF]/70",
            dragHandleProps && "cursor-grab active:cursor-grabbing"
          )}
          aria-hidden
        >
          <GripVertical className="h-4 w-4" />
        </span>

        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <p className="truncate text-sm font-semibold text-[#272055]">{name}</p>
            <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
              <Mail className="h-3 w-3 shrink-0" aria-hidden />
              <span className="truncate" title={email}>
                {email}
              </span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <AiRankScoreCell
              score={application.aiRankScore}
              recommendation={application.aiRankRecommendation}
              summary={application.aiRankSummary}
              scoreReason={application.aiRankScoreReason}
              requirements={application.aiRankRequirements}
            />
            {cvUrl && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#272055]/5 px-2 py-0.5 text-[10px] font-medium text-[#272055]">
                <FileText className="h-3 w-3" aria-hidden />
                CV
              </span>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
            <span className="truncate" title={position}>
              {position}
            </span>
            <span className="shrink-0 whitespace-nowrap text-[#272055]/70">
              {formatDaysInStage(daysInStage)}
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}
