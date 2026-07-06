"use client";

import { useEffect, useState, useRef } from "react";
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

export type AiRankPhase = "extracting" | "analyzing" | "scoring" | "saving" | "complete";

export interface AiRankProgressState {
  isActive: boolean;
  current: number;
  total: number;
  applicationId?: string;
  candidateName?: string;
  phase: AiRankPhase;
  mode: "batch" | "single";
  /** When the current candidate's API call started (for time-based creep + long-wait UI). */
  candidateStartedAt?: number;
}

const LLM_PROGRESS_CAP = 92;
const SAVING_PROGRESS = 97;
const COMPLETE_PROGRESS = 100;
const LONG_WAIT_MS = 3000;

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
    label: "Scoring with AI",
    description: "Calculating fit score and recommendation",
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

const LLM_PHASES: AiRankPhase[] = ["extracting", "analyzing", "scoring"];

/** Shared percent for overlay, pill, and header — never 100% until `complete`. */
export function computeProgressPercent(
  progress: AiRankProgressState,
  now = Date.now()
): number {
  if (!progress.isActive || progress.total <= 0) return 0;

  if (progress.phase === "complete") {
    return COMPLETE_PROGRESS;
  }

  if (progress.phase === "saving") {
    return SAVING_PROGRESS;
  }

  const phaseIndex = Math.max(0, LLM_PHASES.indexOf(progress.phase));
  const withinCandidate = (phaseIndex + 1) / LLM_PHASES.length;
  const base = ((progress.current + withinCandidate) / progress.total) * LLM_PROGRESS_CAP;

  const elapsed = progress.candidateStartedAt ? now - progress.candidateStartedAt : 0;
  const timeBonus = Math.min(
    LLM_PROGRESS_CAP - base,
    (elapsed / 180_000) * (LLM_PROGRESS_CAP * 0.12)
  );

  return Math.min(LLM_PROGRESS_CAP, Math.round(base + timeBonus));
}

function progressPercentCap(phase: AiRankPhase): number {
  if (phase === "complete") return COMPLETE_PROGRESS;
  if (phase === "saving") return SAVING_PROGRESS;
  return LLM_PROGRESS_CAP;
}

function progressSessionKey(progress: AiRankProgressState): string {
  return `${progress.total}:${progress.applicationId ?? ""}:${progress.candidateStartedAt ?? ""}`;
}

function useMonotonicProgress(progress: AiRankProgressState): number {
  const [display, setDisplay] = useState(() => computeProgressPercent(progress));
  const peakRef = useRef(0);
  const sessionKeyRef = useRef("");

  useEffect(() => {
    if (!progress.isActive) {
      sessionKeyRef.current = "";
      peakRef.current = 0;
      setDisplay(0);
      return;
    }

    const sessionKey = progressSessionKey(progress);
    if (sessionKeyRef.current !== sessionKey) {
      sessionKeyRef.current = sessionKey;
      peakRef.current = 0;
    }

    const cap = progressPercentCap(progress.phase);
    const raw = Math.min(computeProgressPercent(progress), cap);
    const next = Math.min(Math.max(peakRef.current, raw), cap);
    peakRef.current = next;
    setDisplay(next);
  }, [
    progress.isActive,
    progress.current,
    progress.total,
    progress.phase,
    progress.applicationId,
    progress.candidateStartedAt,
  ]);

  useEffect(() => {
    if (!progress.isActive || progress.phase === "saving" || progress.phase === "complete") {
      return;
    }
    const id = window.setInterval(() => {
      const cap = progressPercentCap(progress.phase);
      const raw = Math.min(computeProgressPercent(progress), cap);
      const next = Math.min(Math.max(peakRef.current, raw), cap);
      peakRef.current = next;
      setDisplay(next);
    }, 1000);
    return () => window.clearInterval(id);
  }, [
    progress.isActive,
    progress.phase,
    progress.current,
    progress.total,
    progress.applicationId,
    progress.candidateStartedAt,
  ]);

  return display;
}

function useLongWait(progress: AiRankProgressState): boolean {
  const [isLongWait, setIsLongWait] = useState(false);

  useEffect(() => {
    if (
      !progress.candidateStartedAt ||
      progress.phase === "saving" ||
      progress.phase === "complete"
    ) {
      setIsLongWait(false);
      return;
    }

    const check = () => {
      setIsLongWait(Date.now() - progress.candidateStartedAt! > LONG_WAIT_MS);
    };
    check();
    const id = window.setInterval(check, 500);
    return () => window.clearInterval(id);
  }, [progress.candidateStartedAt, progress.phase, progress.applicationId]);

  return isLongWait;
}

function phaseDisplayLabel(progress: AiRankProgressState, isLongWait: boolean): string {
  if (progress.phase === "complete") {
    return "Complete";
  }
  if (progress.phase === "scoring" && isLongWait) {
    return "Scoring with AI…";
  }
  const index = PHASES.findIndex((p) => p.id === progress.phase);
  return PHASES[index]?.label ?? "Ranking";
}

function ProgressCore({
  progress,
  compact = false,
}: {
  progress: AiRankProgressState;
  compact?: boolean;
}) {
  const percent = useMonotonicProgress(progress);
  const isLongWait = useLongWait(progress);
  const isComplete = progress.phase === "complete";
  const activePhaseIndex = PHASES.findIndex((p) => p.id === progress.phase);
  const ActiveIcon = isComplete
    ? CheckCircle2
    : (PHASES[activePhaseIndex]?.icon ?? Sparkles);
  const label = phaseDisplayLabel(progress, isLongWait);
  const showWorkingPulse =
    isLongWait && progress.phase !== "saving" && progress.phase !== "complete";

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
          {label}
          {progress.candidateName ? (
            <span className="font-normal text-muted-foreground">
              {" "}
              · {progress.candidateName}
            </span>
          ) : null}
        </p>
        <AnimatePresence mode="wait">
          <motion.p
            key={`${progress.candidateName}-${progress.phase}-${isLongWait}`}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className={`text-muted-foreground ${compact ? "text-xs" : "text-sm"}`}
          >
            {showWorkingPulse
              ? "Still working — detailed CVs can take a few minutes"
              : progress.candidateName
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
        <div className="relative h-2 overflow-hidden rounded-full bg-violet-100/70 dark:bg-violet-950/50">
          {showWorkingPulse ? (
            <motion.div
              className="absolute inset-y-0 w-1/3 rounded-full bg-gradient-to-r from-transparent via-white/40 to-transparent"
              animate={{ x: ["-100%", "300%"] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "linear" }}
              aria-hidden
            />
          ) : null}
          <motion.div
            className={`h-full rounded-full bg-gradient-to-r from-violet-500 via-indigo-500 to-violet-400 ${
              showWorkingPulse ? "opacity-90" : ""
            }`}
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
  const percent = useMonotonicProgress(progress);
  const isLongWait = useLongWait(progress);
  const phaseLabel = phaseDisplayLabel(progress, isLongWait);

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

  return (
    <AiRankHeaderIndicatorContent progress={progress} onExpand={expandOverlay} />
  );
}

function AiRankHeaderIndicatorContent({
  progress,
  onExpand,
}: {
  progress: AiRankProgressState;
  onExpand: () => void;
}) {
  const percent = useMonotonicProgress(progress);
  const isLongWait = useLongWait(progress);
  const isComplete = progress.phase === "complete";
  const phaseLabel = phaseDisplayLabel(progress, isLongWait);

  return (
    <button
      type="button"
      onClick={onExpand}
      className="inline-flex items-center gap-2 rounded-xl border border-violet-200/70 bg-violet-50/80 px-2.5 py-1.5 text-xs font-medium text-violet-800 transition hover:bg-violet-100 dark:border-violet-800/60 dark:bg-violet-950/40 dark:text-violet-200 dark:hover:bg-violet-950/60"
    >
      {isComplete ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
      ) : (
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-500 opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-violet-600" />
        </span>
      )}
      {phaseLabel}
      {!isComplete ? ` ${percent}%` : null}
    </button>
  );
}

export function cycleAiRankPhase(phase: AiRankPhase): AiRankPhase {
  if (phase === "saving" || phase === "complete") return phase;
  const index = LLM_PHASES.indexOf(phase);
  if (index < 0) return "extracting";
  if (index >= LLM_PHASES.length - 1) return "scoring";
  return LLM_PHASES[index + 1];
}
