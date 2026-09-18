"use client";

import { Droppable } from "@hello-pangea/dnd";
import { Gift, MessagesSquare, Trash2, Trophy, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ResolvedPipelineStage } from "./pipeline-settings-config";

export const QUICKDROP_DISCUSSION = "quickdrop:discussion";
export const QUICKDROP_ARCHIVE = "quickdrop:archive";
export const QUICKDROP_OFFER = "quickdrop:offer";
export const QUICKDROP_HIRED = "quickdrop:hired";

export type QuickdropActionId =
  | typeof QUICKDROP_DISCUSSION
  | typeof QUICKDROP_ARCHIVE
  | typeof QUICKDROP_OFFER
  | typeof QUICKDROP_HIRED;

interface QuickdropTarget {
  id: QuickdropActionId;
  label: string;
  icon: LucideIcon;
}

function stageMatchesKeywords(
  stage: ResolvedPipelineStage,
  keywords: string[]
): boolean {
  const haystack = `${stage.id} ${stage.label}`.toLowerCase();
  return keywords.some((keyword) => haystack.includes(keyword));
}

export function resolveQuickdropTargets(
  stages: ResolvedPipelineStage[],
  options: {
    canOpenDiscussion?: boolean;
    canArchive?: boolean;
  } = {}
): QuickdropTarget[] {
  const { canOpenDiscussion = false, canArchive = false } = options;
  const targets: QuickdropTarget[] = [];

  if (canOpenDiscussion) {
    targets.push({
      id: QUICKDROP_DISCUSSION,
      label: "Open discussion",
      icon: MessagesSquare,
    });
  }

  const offerStage = stages.find((stage) =>
    stageMatchesKeywords(stage, ["offer", "made offer"])
  );
  if (offerStage) {
    targets.push({
      id: QUICKDROP_OFFER,
      label: `Move to ${offerStage.label}`,
      icon: Gift,
    });
  }

  if (canArchive) {
    targets.push({
      id: QUICKDROP_ARCHIVE,
      label: "Archive candidate",
      icon: Trash2,
    });
  }

  const hiredStage = stages.find((stage) =>
    stageMatchesKeywords(stage, ["hired", "won"])
  );
  if (hiredStage) {
    targets.push({
      id: QUICKDROP_HIRED,
      label: `Move to ${hiredStage.label}`,
      icon: Trophy,
    });
  }

  return targets;
}

export function findQuickdropStageLabel(
  stages: ResolvedPipelineStage[],
  actionId: typeof QUICKDROP_OFFER | typeof QUICKDROP_HIRED
): string | null {
  const keywords =
    actionId === QUICKDROP_OFFER
      ? ["offer", "made offer"]
      : ["hired", "won"];
  return (
    stages.find((stage) => stageMatchesKeywords(stage, keywords))?.label ?? null
  );
}

interface QuickdropPipelineProps {
  isVisible: boolean;
  stages: ResolvedPipelineStage[];
  canOpenDiscussion?: boolean;
  canArchive?: boolean;
}

export function QuickdropPipeline({
  isVisible,
  stages,
  canOpenDiscussion = false,
  canArchive = false,
}: QuickdropPipelineProps) {
  const targets = resolveQuickdropTargets(stages, {
    canOpenDiscussion,
    canArchive,
  });

  if (targets.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-24 z-[9980] flex justify-center px-4 transition-opacity duration-150",
        isVisible
          ? "pointer-events-auto opacity-100"
          : "pointer-events-none opacity-0"
      )}
      aria-hidden={!isVisible}
      data-tour="quickdrop-pipeline"
    >
      <div className="flex flex-col items-center gap-1.5">
        <p className="text-xs font-medium tracking-wide text-[#272055]/70">
          Quickdrop Pipeline
        </p>
        <div
          className="flex overflow-hidden rounded-xl border border-[#272055]/12 bg-white shadow-[0_8px_30px_rgba(39,32,85,0.12)]"
          role="toolbar"
          aria-label="Quickdrop Pipeline"
        >
          {targets.map((target) => {
            const Icon = target.icon;
            return (
              <Droppable key={target.id} droppableId={target.id}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    title={target.label}
                    aria-label={target.label}
                    className={cn(
                      "flex h-12 w-12 items-center justify-center border-r border-[#272055]/10 text-[#272055] transition-colors last:border-r-0",
                      snapshot.isDraggingOver
                        ? "bg-[#31CDFF]/15 text-[#272055]"
                        : "bg-white hover:bg-[#272055]/[0.03]"
                    )}
                  >
                    <Icon className="h-5 w-5" aria-hidden />
                    <span className="sr-only">{target.label}</span>
                    <div className="h-0 w-0 overflow-hidden">{provided.placeholder}</div>
                  </div>
                )}
              </Droppable>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function isQuickdropDroppableId(droppableId: string): boolean {
  return droppableId.startsWith("quickdrop:");
}
