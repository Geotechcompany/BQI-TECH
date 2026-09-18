"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
  type DroppableProvided,
  type DragStart,
} from "@hello-pangea/dnd";
import { useReducedMotion } from "framer-motion";
import { Application } from "@/types/application";
import { CandidateCard } from "./CandidateCard";
import {
  PIPELINE_STAGES,
  type PipelineStage,
  groupApplicationsByStage,
  getApplicationPipelineStage,
} from "./pipeline-utils";
import {
  DEFAULT_PIPELINE_STAGE_DEFINITIONS,
  type ResolvedPipelineStage,
} from "./pipeline-settings-config";
import {
  QuickdropPipeline,
  QUICKDROP_ARCHIVE,
  QUICKDROP_DISCUSSION,
  QUICKDROP_HIRED,
  QUICKDROP_OFFER,
  findQuickdropStageLabel,
  isQuickdropDroppableId,
} from "./QuickdropPipeline";
import { cn } from "@/lib/utils";
import { MapPin, Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlowBorderCard } from "@/components/ui/glow-border-card";
import { CandidatesEmptyState } from "@/components/admin/candidates/CandidatesEmptyState";
import { PipelineColumnMenu } from "./PipelineColumnMenu";
import { useAiRank } from "@/contexts/AiRankContext";
import { useBqiIntelligence } from "@/contexts/BqiIntelligenceContext";

/** Violet → BQI cyan — matches candidate ranking glow */
const BQI_RANKING_GLOW_COLORS = [
  "#1a1540",
  "#272055",
  "#5b4b9a",
  "#8b5cf6",
  "#c4b5fd",
  "#31CDFF",
  "#7ddfff",
  "#a78bfa",
  "#5b4b9a",
  "#272055",
];

/** Per-column ranking halo — slightly softer than full-board glow on ~280px stages. */
function ColumnRankingGlow({
  active,
  paused,
  className,
  children,
}: {
  active: boolean;
  paused: boolean;
  className?: string;
  children: ReactNode;
}) {
  if (!active) {
    return (
      <div className={cn("flex min-h-0 flex-col", className)}>{children}</div>
    );
  }

  return (
    <GlowBorderCard
      fill
      width="100%"
      height="100%"
      borderRadius="0.75rem"
      animationDuration={3}
      gradientColors={BQI_RANKING_GLOW_COLORS}
      borderWidth="12px"
      blurAmount="16px"
      inset="0"
      paused={paused}
      className={cn("relative z-0 min-h-0 bg-transparent shadow-none", className)}
      contentClassName="relative z-0 min-h-0 flex-1 overflow-hidden"
    >
      {children}
    </GlowBorderCard>
  );
}

interface PipelineBoardProps {
  applications: Application[];
  stages?: ResolvedPipelineStage[];
  jobId?: string;
  jobTitles?: Record<string, string>;
  jobTitle?: string;
  jobLocation?: string;
  onStatusChange: (
    applicationId: string,
    newStatus: PipelineStage,
    previousStatus: string
  ) => Promise<void>;
  onCardClick: (application: Application) => void;
  onArchive?: (applicationId: string) => Promise<void>;
  onOpenDiscussion?: (application: Application) => void;
  onAddCandidate?: (stageLabel: string) => void;
  onBulkMoveToStage?: (
    applicationIds: string[],
    targetStageLabel: string
  ) => Promise<void>;
  onBulkRunIntelligence?: (applicationIds: string[]) => Promise<void>;
  onBulkDeleteCandidates?: (applicationIds: string[]) => Promise<void>;
  updatingApplicationId?: string | null;
  className?: string;
}

export { PIPELINE_STAGES, type PipelineStage } from "./pipeline-utils";

function ColumnBody({
  stageApps,
  isDraggingOver,
  isFirstStage,
  jobTitles,
  onCardClick,
  updatingApplicationId,
  droppableProvided,
}: {
  stageApps: Application[];
  isDraggingOver: boolean;
  isFirstStage: boolean;
  jobTitles: Record<string, string>;
  onCardClick: (application: Application) => void;
  updatingApplicationId: string | null;
  droppableProvided: DroppableProvided;
}) {
  const { innerRef, droppableProps, placeholder } = droppableProvided;

  if (stageApps.length === 0) {
    return (
      <div
        ref={innerRef}
        {...droppableProps}
        className="flex min-h-0 flex-1 flex-col p-3"
        {...(isFirstStage ? { "data-tour": "pipeline-drag" } : {})}
      >
        <div
          className={cn(
            "relative flex flex-1 min-h-[160px] items-center justify-center overflow-hidden rounded-lg border border-dashed px-3 py-6 text-center transition-colors",
            isDraggingOver
              ? "border-[#31CDFF]/50 bg-[#31CDFF]/5 text-[#272055]"
              : "border-[#272055]/15 bg-[#272055]/[0.02]"
          )}
        >
          {!isDraggingOver ? (
            <div
              className="pointer-events-none absolute inset-0"
              aria-hidden
              style={{
                background:
                  "radial-gradient(ellipse 80% 70% at 50% 45%, rgba(49,205,255,0.08) 0%, rgba(39,33,86,0.04) 50%, transparent 75%)",
              }}
            />
          ) : null}
          {isDraggingOver ? (
            <p className="relative z-[1] text-xs font-medium text-[#272055]">
              Drop to move here
            </p>
          ) : (
            <CandidatesEmptyState
              compact
              className="relative z-[1] w-full"
              title="No candidates"
            />
          )}
        </div>
        {placeholder}
      </div>
    );
  }

  return (
    <div
      ref={innerRef}
      {...droppableProps}
      className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3"
      {...(isFirstStage ? { "data-tour": "pipeline-drag" } : {})}
    >
      {stageApps.map((application, index) => (
        <Draggable
          key={application.id}
          draggableId={String(application.id)}
          index={index}
        >
          {(dragProvided, dragSnapshot) => (
            <CandidateCard
              application={application}
              jobTitles={jobTitles}
              onClick={() => onCardClick(application)}
              isDragging={dragSnapshot.isDragging}
              isUpdating={updatingApplicationId === application.id}
              innerRef={dragProvided.innerRef}
              draggableProps={dragProvided.draggableProps}
              dragHandleProps={dragProvided.dragHandleProps}
            />
          )}
        </Draggable>
      ))}
      {placeholder}
    </div>
  );
}

function ColumnShell({
  sectionClassName,
  isFirstStage,
  stage,
  stageApps,
  otherStages,
  jobId,
  onAddCandidate,
  onBulkMoveToStage,
  onBulkRunIntelligence,
  onBulkDeleteCandidates,
  isBusy,
  body,
}: {
  sectionClassName: string;
  isFirstStage: boolean;
  stage: ResolvedPipelineStage;
  stageApps: Application[];
  otherStages: ResolvedPipelineStage[];
  jobId?: string;
  onAddCandidate?: (stageLabel: string) => void;
  onBulkMoveToStage?: (
    applicationIds: string[],
    targetStageLabel: string
  ) => Promise<void>;
  onBulkRunIntelligence?: (applicationIds: string[]) => Promise<void>;
  onBulkDeleteCandidates?: (applicationIds: string[]) => Promise<void>;
  isBusy: boolean;
  body: ReactNode;
}) {
  const StageIcon = stage.icon;
  const candidateIds = stageApps.map((app) => app.id);
  const recipientEmails = collectStageRecipientEmails(stageApps);
  const { applicantInsights } = useBqiIntelligence();

  return (
    <section
      className={sectionClassName}
      {...(isFirstStage ? { "data-tour": "pipeline-stage" } : {})}
    >
      <header className="group/header flex-shrink-0 rounded-t-xl border-b border-[#31CDFF]/20 bg-white/95 px-3 py-2.5 backdrop-blur-sm sm:px-4 sm:py-3">
        <div className="flex items-center gap-1.5">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#31CDFF]/15 text-[#272055]">
              <StageIcon className="h-3.5 w-3.5" aria-hidden />
            </span>
            <h3 className="truncate text-sm font-semibold text-[#272055]">
              {stage.label}
            </h3>
            <span className="rounded-full bg-[#31CDFF]/15 px-2 py-0.5 text-xs font-semibold text-[#272055]">
              {stageApps.length}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            {onAddCandidate ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-[#272055]/70 hover:bg-[#272055]/8 hover:text-[#272055]"
                aria-label={`Add candidate to ${stage.label}`}
                onClick={() => onAddCandidate(stage.label)}
                disabled={isBusy}
              >
                <Plus className="h-4 w-4" />
              </Button>
            ) : null}
            {jobId && onBulkMoveToStage && onBulkDeleteCandidates ? (
              <PipelineColumnMenu
                jobId={jobId}
                stage={stage}
                candidateCount={stageApps.length}
                recipientEmails={recipientEmails}
                otherStages={otherStages}
                isBusy={isBusy}
                onMoveToStage={(targetStageLabel) =>
                  onBulkMoveToStage(candidateIds, targetStageLabel)
                }
                onRunIntelligence={
                  applicantInsights && onBulkRunIntelligence
                    ? () => onBulkRunIntelligence(candidateIds)
                    : undefined
                }
                onDeleteCandidates={() => onBulkDeleteCandidates(candidateIds)}
              />
            ) : null}
          </div>
        </div>
      </header>
      {body}
    </section>
  );
}

/** Unique applicant emails for candidates currently in a stage column. */
function collectStageRecipientEmails(stageApps: Application[]): string[] {
  const emails = new Set<string>();
  for (const application of stageApps) {
    const email = (application.email || application.user?.email || "")
      .trim()
      .toLowerCase();
    if (email) emails.add(email);
  }
  return Array.from(emails);
}

export function PipelineBoard({
  applications,
  stages,
  jobId,
  jobTitles = {},
  jobTitle,
  jobLocation,
  onStatusChange,
  onCardClick,
  onArchive,
  onOpenDiscussion,
  onAddCandidate,
  onBulkMoveToStage,
  onBulkRunIntelligence,
  onBulkDeleteCandidates,
  updatingApplicationId = null,
  className,
}: PipelineBoardProps) {
  const [isDraggingCard, setIsDraggingCard] = useState(false);
  const { inFlightApplicationIds } = useAiRank();
  const reduceMotion = useReducedMotion();

  const boardStages = useMemo(
    () =>
      stages?.length
        ? stages
        : DEFAULT_PIPELINE_STAGE_DEFINITIONS.map((stage) => ({
            ...stage,
            actionsCount: 0,
          })),
    [stages]
  );

  const stageLabels = useMemo(
    () => boardStages.map((stage) => stage.label),
    [boardStages]
  );

  const grouped = useMemo(
    () => groupApplicationsByStage(applications, stageLabels),
    [applications, stageLabels]
  );

  /** Stage labels that currently hold at least one in-flight ranking candidate. */
  const rankingStageLabels = useMemo(() => {
    if (!inFlightApplicationIds.length) return new Set<string>();
    const inFlight = new Set(inFlightApplicationIds);
    const labels = new Set<string>();
    for (const label of stageLabels) {
      const stageApps = grouped[label] ?? [];
      if (stageApps.some((app) => inFlight.has(app.id))) {
        labels.add(label);
      }
    }
    return labels;
  }, [grouped, inFlightApplicationIds, stageLabels]);

  const totalCandidates = applications.length;

  const handleDragStart = useCallback((_start: DragStart) => {
    setIsDraggingCard(true);
  }, []);

  const handleDragEnd = useCallback(
    async (result: DropResult) => {
      setIsDraggingCard(false);

      const { destination, source, draggableId } = result;
      if (!destination) return;

      const sourceStage = source.droppableId;
      const destinationId = destination.droppableId;

      if (
        sourceStage === destinationId &&
        source.index === destination.index
      ) {
        return;
      }

      const application = applications.find(
        (app) => String(app.id) === draggableId
      );
      if (!application) return;

      if (isQuickdropDroppableId(destinationId)) {
        if (destinationId === QUICKDROP_DISCUSSION) {
          onOpenDiscussion?.(application);
          return;
        }

        if (destinationId === QUICKDROP_ARCHIVE) {
          if (onArchive) {
            await onArchive(draggableId);
          }
          return;
        }

        if (
          destinationId === QUICKDROP_OFFER ||
          destinationId === QUICKDROP_HIRED
        ) {
          const targetStage = findQuickdropStageLabel(
            boardStages,
            destinationId
          );
          if (!targetStage || targetStage === sourceStage) return;

          const previousStatus = application.status || sourceStage;
          await onStatusChange(
            draggableId,
            targetStage as PipelineStage,
            previousStatus
          );
        }
        return;
      }

      if (sourceStage !== destinationId) {
        const previousStatus = application.status || sourceStage;
        await onStatusChange(
          draggableId,
          destinationId as PipelineStage,
          previousStatus
        );
      }
    },
    [
      applications,
      boardStages,
      onArchive,
      onOpenDiscussion,
      onStatusChange,
    ]
  );

  if (totalCandidates === 0) {
    return (
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col gap-4",
          className
        )}
        data-tour="pipeline-board"
      >
        {(jobTitle || jobLocation) && (
          <div className="flex flex-shrink-0 flex-col gap-2 rounded-xl border border-[#272055]/10 bg-gradient-to-r from-[#272055]/[0.04] to-[#31CDFF]/[0.06] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              {jobTitle && (
                <h2 className="truncate text-base font-semibold text-[#272055]">
                  {jobTitle}
                </h2>
              )}
              {jobLocation && (
                <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                  <MapPin
                    className="h-3.5 w-3.5 shrink-0 text-[#31CDFF]"
                    aria-hidden
                  />
                  <span className="truncate">{jobLocation}</span>
                </p>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Users className="h-4 w-4 text-[#272055]/60" aria-hidden />
              <span>0 candidates</span>
            </div>
          </div>
        )}

        <div className="flex min-h-0 flex-1 items-center justify-center rounded-xl border border-[#272055]/10 bg-white/80">
          <CandidatesEmptyState
            className="min-h-[360px] w-full"
            title="No candidates"
            description={
              jobTitle
                ? `${jobTitle} has no candidates in the pipeline yet.`
                : "This pipeline is empty. Add a candidate to get started."
            }
            onAddCandidate={
              onAddCandidate
                ? () => onAddCandidate(boardStages[0]?.label ?? "New")
                : undefined
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn("flex min-h-0 flex-1 flex-col gap-4", className)}
      data-tour="pipeline-board"
    >
      {(jobTitle || jobLocation) && (
        <div className="flex flex-shrink-0 flex-col gap-2 rounded-xl border border-[#272055]/10 bg-gradient-to-r from-[#272055]/[0.04] to-[#31CDFF]/[0.06] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            {jobTitle && (
              <h2 className="truncate text-base font-semibold text-[#272055]">
                {jobTitle}
              </h2>
            )}
            {jobLocation && (
              <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-[#31CDFF]" aria-hidden />
                <span className="truncate">{jobLocation}</span>
              </p>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Users className="h-4 w-4 text-[#272055]/60" aria-hidden />
            <span>
              {totalCandidates} candidate{totalCandidates === 1 ? "" : "s"}
            </span>
          </div>
        </div>
      )}

      <DragDropContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div
          className="flex min-h-0 flex-1 gap-3 overflow-x-auto overflow-y-hidden px-2 py-2 snap-x snap-mandatory md:gap-4"
          role="region"
          aria-label="Recruitment pipeline board"
        >
          {boardStages.map((stage) => {
            const stageApps = grouped[stage.label] ?? [];
            const isFirstStage = stage.id === boardStages[0]?.id;
            const otherStages = boardStages.filter((s) => s.id !== stage.id);

            return (
              <Droppable key={stage.id} droppableId={stage.label}>
                {(provided, snapshot) => (
                  <ColumnRankingGlow
                    active={rankingStageLabels.has(stage.label)}
                    paused={Boolean(reduceMotion)}
                    className="h-full w-[min(100%,280px)] min-w-[280px] flex-shrink-0 snap-start"
                  >
                    <ColumnShell
                      sectionClassName={cn(
                        "group/column flex h-full min-h-0 w-full flex-col rounded-xl border bg-white/80 transition-[border-color,border-style,background-color]",
                        snapshot.isDraggingOver
                          ? "border-solid border-[#31CDFF] bg-[#31CDFF]/[0.04] shadow-inner"
                          : "border-[#272055]/10 hover:border-dotted hover:border-[#272055]/55"
                      )}
                      isFirstStage={isFirstStage}
                      stage={stage}
                      stageApps={stageApps}
                      otherStages={otherStages}
                      jobId={jobId}
                      onAddCandidate={onAddCandidate}
                      onBulkMoveToStage={onBulkMoveToStage}
                      onBulkRunIntelligence={onBulkRunIntelligence}
                      onBulkDeleteCandidates={onBulkDeleteCandidates}
                      isBusy={Boolean(updatingApplicationId)}
                      body={
                        <ColumnBody
                          stageApps={stageApps}
                          isDraggingOver={snapshot.isDraggingOver}
                          isFirstStage={isFirstStage}
                          jobTitles={jobTitles}
                          onCardClick={onCardClick}
                          updatingApplicationId={updatingApplicationId}
                          droppableProvided={provided}
                        />
                      }
                    />
                  </ColumnRankingGlow>
                )}
              </Droppable>
            );
          })}
        </div>

        <QuickdropPipeline
          isVisible={isDraggingCard}
          stages={boardStages}
          canOpenDiscussion={Boolean(onOpenDiscussion)}
          canArchive={Boolean(onArchive)}
        />
      </DragDropContext>
    </div>
  );
}

export { getApplicationPipelineStage };
