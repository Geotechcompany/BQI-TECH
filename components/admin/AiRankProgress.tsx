"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain,
  FileSearch,
  Sparkles,
  Save,
  CheckCircle2,
  Minimize2,
  Maximize2,
} from "lucide-react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { useAiRank } from "@/contexts/AiRankContext";

export type AiRankPhase = "extracting" | "analyzing" | "scoring" | "saving";

export interface AiRankProgressState {
  isActive: boolean;
  current: number;
  total: number;
  applicationId?: string;
  candidateName?: string;
  phase: AiRankPhase;
  mode: "batch" | "single";
}

const PHASES: Array<{
  id: AiRankPhase;
  label: string;
  description: string;
  icon: typeof FileSearch;
}> = [
  {
    id: "extracting",
    label: "Reading CV",
    description: "Extracting skills and experience from resume",
    icon: FileSearch,
  },
  {
    id: "analyzing",
    label: "Analyzing fit",
    description: "Matching profile against job requirements",
    icon: Brain,
  },
  {
    id: "scoring",
    label: "Scoring",
    description: "Calculating AI fit score and recommendation",
    icon: Sparkles,
  },
  {
    id: "saving",
    label: "Saving",
    description: "Writing assessment to application record",
    icon: Save,
  },
];

function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

function progressPercent(progress: AiRankProgressState): number {
  if (progress.total <= 0) return 0;
  const base = progress.current / progress.total;
  const phaseIndex = PHASES.findIndex((p) => p.id === progress.phase);
  const phaseFraction = (phaseIndex + 1) / PHASES.length / progress.total;
  return Math.min(100, Math.round((base + phaseFraction * 0.85) * 100));
}

function ProgressCore({
  progress,
  compact = false,
}: {
  progress: AiRankProgressState;
  compact?: boolean;
}) {
  const percent = progressPercent(progress);
  const activePhaseIndex = PHASES.findIndex((p) => p.id === progress.phase);
  const ActiveIcon = PHASES[activePhaseIndex]?.icon ?? Sparkles;

  return (
    <div className={compact ? "space-y-3" : "space-y-5"}>
      <div className="relative flex items-center justify-center">
        <motion.div
          className="absolute h-28 w-28 rounded-full bg-violet-500/15 blur-3xl"
          animate={{ scale: [1, 1.15, 1], opacity: [0.35, 0.6, 0.35] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className={`relative flex items-center justify-center rounded-2xl border border-white/20 bg-gradient-to-br from-violet-600 via-violet-700 to-indigo-700 text-white shadow-xl shadow-violet-900/25 ${
            compact ? "h-12 w-12" : "h-[4.5rem] w-[4.5rem]"
          }`}
        >
          <motion.div
            key={progress.phase}
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 320, damping: 22 }}
          >
            <ActiveIcon className={compact ? "h-5 w-5" : "h-8 w-8"} strokeWidth={1.75} />
          </motion.div>
          <motion.span
            className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/25"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2.2, repeat: Infinity }}
          />
        </motion.div>
      </div>

      <div className="space-y-1 text-center">
        <p
          className={`font-semibold tracking-tight text-foreground ${
            compact ? "text-sm" : "text-lg"
          }`}
        >
          {PHASES[activePhaseIndex]?.label}
          {progress.candidateName ? (
            <span className="font-normal text-muted-foreground">
              {" "}
              · {progress.candidateName}
            </span>
          ) : null}
        </p>
        <AnimatePresence mode="wait">
          <motion.p
            key={`${progress.candidateName}-${progress.phase}`}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className={`text-muted-foreground ${compact ? "text-xs" : "text-sm"}`}
          >
            {progress.candidateName
              ? `Evaluating against role requirements`
              : PHASES[activePhaseIndex]?.description}
          </motion.p>
        </AnimatePresence>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            {progress.total > 1
              ? `Candidate ${Math.min(progress.current + 1, progress.total)} of ${progress.total}`
              : "Processing"}
          </span>
          <span className="font-semibold tabular-nums text-violet-600 dark:text-violet-400">
            {percent}%
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-violet-100/70 dark:bg-violet-950/50">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-violet-500 via-indigo-500 to-violet-400"
            animate={{ width: `${percent}%` }}
            transition={{ type: "spring", stiffness: 140, damping: 22 }}
          />
        </div>
      </div>

      {!compact && (
        <div className="relative">
          <div className="absolute left-4 right-4 top-4 h-px bg-border/80" aria-hidden />
          <div className="grid grid-cols-4 gap-2">
            {PHASES.map((phase, index) => {
              const Icon = phase.icon;
              const isDone = index < activePhaseIndex;
              const isCurrent = index === activePhaseIndex;
              return (
                <div
                  key={phase.id}
                  className={`relative rounded-xl border px-2 py-2.5 text-center transition-colors ${
                    isCurrent
                      ? "border-violet-300/80 bg-violet-50/90 shadow-sm dark:border-violet-700 dark:bg-violet-950/50"
                      : isDone
                        ? "border-emerald-200/80 bg-emerald-50/70 dark:border-emerald-800 dark:bg-emerald-950/30"
                        : "border-border/60 bg-muted/20"
                  }`}
                >
                  <div className="flex flex-col items-center gap-1">
                    {isDone ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    ) : (
                      <Icon
                        className={`h-3.5 w-3.5 ${
                          isCurrent ? "text-violet-600" : "text-muted-foreground"
                        }`}
                      />
                    )}
                    <span
                      className={`text-[10px] font-medium leading-tight ${
                        isCurrent ? "text-violet-700 dark:text-violet-300" : "text-muted-foreground"
                      }`}
                    >
                      {phase.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function AiRankFloatingPill({
  progress,
  onExpand,
}: {
  progress: AiRankProgressState;
  onExpand: () => void;
}) {
  const percent = progressPercent(progress);
  const phaseLabel = PHASES.find((p) => p.id === progress.phase)?.label ?? "Ranking";

  return (
    <motion.button
      type="button"
      onClick={onExpand}
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 12, scale: 0.96 }}
      className="fixed bottom-6 right-6 z-[10060] flex max-w-[min(100vw-2rem,22rem)] items-center gap-3 rounded-2xl border border-violet-200/70 bg-background/95 px-4 py-3 text-left shadow-2xl shadow-violet-900/15 backdrop-blur-md dark:border-violet-800/60"
    >
      <div className="relative h-10 w-10 shrink-0">
        <svg className="h-10 w-10 -rotate-90" viewBox="0 0 36 36" aria-hidden>
          <circle
            cx="18"
            cy="18"
            r="15.5"
            fill="none"
            className="stroke-violet-100 dark:stroke-violet-950"
            strokeWidth="3"
          />
          <circle
            cx="18"
            cy="18"
            r="15.5"
            fill="none"
            className="stroke-violet-600"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={`${percent} 100`}
            pathLength={100}
          />
        </svg>
        <Sparkles className="absolute inset-0 m-auto h-4 w-4 text-violet-600" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">AI ranking</p>
        <p className="truncate text-xs text-muted-foreground">
          {phaseLabel}
          {progress.candidateName ? ` · ${progress.candidateName}` : ""}
        </p>
      </div>
      <Maximize2 className="h-4 w-4 shrink-0 text-muted-foreground" />
    </motion.button>
  );
}

export function AiRankProgressHost() {
  const mounted = useMounted();
  const { progress, isBackground, sendToBackground, expandOverlay } = useAiRank();

  if (!mounted || !progress?.isActive) return null;

  return createPortal(
    <AnimatePresence mode="wait">
      {isBackground ? (
        <AiRankFloatingPill
          key="pill"
          progress={progress}
          onExpand={expandOverlay}
        />
      ) : (
        <motion.div
          key="overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[10050] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 10 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            className="relative w-full max-w-md overflow-hidden rounded-2xl border border-violet-200/50 bg-background shadow-2xl shadow-violet-950/20 dark:border-violet-800/40"
          >
            <div
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-500/8 via-transparent to-transparent"
              aria-hidden
            />
            <div className="relative border-b border-border/50 px-6 pb-4 pt-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="mb-1 flex items-center gap-2">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-violet-600/10">
                      <Sparkles className="h-4 w-4 text-violet-600" />
                    </span>
                    <h3 className="text-base font-semibold tracking-tight">
                      AI Ranking
                    </h3>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {progress.total > 1
                      ? `Evaluating ${progress.total} candidates`
                      : "Evaluating candidate fit"}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 rounded-lg text-muted-foreground"
                  onClick={sendToBackground}
                  aria-label="Continue in background"
                >
                  <Minimize2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="relative px-6 py-5">
              <ProgressCore progress={progress} />
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-border/50 bg-muted/20 px-6 py-4">
              <p className="text-xs text-muted-foreground">
                Ranking continues if you navigate away
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0 border-violet-200 text-violet-700 hover:bg-violet-50 dark:border-violet-800 dark:text-violet-300 dark:hover:bg-violet-950/40"
                onClick={sendToBackground}
              >
                Continue in background
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

/** @deprecated Use AiRankProgressHost in admin layout instead */
export function AiRankProgressOverlay({
  progress: _progress,
}: {
  progress: AiRankProgressState | null;
}) {
  return null;
}

export function AiRankInlineProgress({
  progress,
}: {
  progress: AiRankProgressState | null;
}) {
  if (!progress?.isActive) return null;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden rounded-xl border border-violet-200/70 bg-gradient-to-br from-violet-50/80 to-indigo-50/40 p-4 dark:border-violet-800/60 dark:from-violet-950/40 dark:to-indigo-950/20"
    >
      <ProgressCore progress={progress} compact />
    </motion.div>
  );
}

export function AiRankHeaderIndicator() {
  const { progress, isBackground, isRanking, expandOverlay } = useAiRank();

  if (!isRanking || !isBackground || !progress) return null;

  const percent = progressPercent(progress);

  return (
    <button
      type="button"
      onClick={expandOverlay}
      className="inline-flex items-center gap-2 rounded-xl border border-violet-200/70 bg-violet-50/80 px-2.5 py-1.5 text-xs font-medium text-violet-800 transition hover:bg-violet-100 dark:border-violet-800/60 dark:bg-violet-950/40 dark:text-violet-200 dark:hover:bg-violet-950/60"
    >
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-500 opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-violet-600" />
      </span>
      AI rank {percent}%
    </button>
  );
}

export function cycleAiRankPhase(phase: AiRankPhase): AiRankPhase {
  const order: AiRankPhase[] = ["extracting", "analyzing", "scoring", "saving"];
  const index = order.indexOf(phase);
  return order[(index + 1) % order.length];
}
