"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, FileSearch, Sparkles, Save, CheckCircle2 } from "lucide-react";
import { createPortal } from "react-dom";

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

function ProgressCore({
  progress,
  compact = false,
}: {
  progress: AiRankProgressState;
  compact?: boolean;
}) {
  const percent =
    progress.total > 0
      ? Math.min(100, Math.round(((progress.current + 0.35) / progress.total) * 100))
      : 0;
  const activePhaseIndex = PHASES.findIndex((p) => p.id === progress.phase);
  const ActiveIcon = PHASES[activePhaseIndex]?.icon ?? Sparkles;

  return (
    <div className={compact ? "space-y-4" : "space-y-6"}>
      <div className="relative flex items-center justify-center">
        <motion.div
          className="absolute h-24 w-24 rounded-full bg-violet-400/20 blur-2xl"
          animate={{ scale: [1, 1.2, 1], opacity: [0.4, 0.7, 0.4] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute h-16 w-16 rounded-full bg-blue-400/20 blur-xl"
          animate={{ scale: [1.1, 0.9, 1.1], opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
        />
        <motion.div
          className={`relative flex items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-blue-500 text-white shadow-lg shadow-violet-500/30 ${
            compact ? "h-14 w-14" : "h-20 w-20"
          }`}
          animate={{ rotate: [0, 3, -3, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        >
          <motion.div
            key={progress.phase}
            initial={{ scale: 0.6, opacity: 0, rotate: -20 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 18 }}
          >
            <ActiveIcon className={compact ? "h-6 w-6" : "h-9 w-9"} />
          </motion.div>
        </motion.div>
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="absolute h-1.5 w-1.5 rounded-full bg-violet-400"
            style={{ top: "50%", left: "50%" }}
            animate={{
              x: [0, Math.cos(i * 2.1) * 42, 0],
              y: [0, Math.sin(i * 2.1) * 42, 0],
              opacity: [0.2, 1, 0.2],
              scale: [0.8, 1.2, 0.8],
            }}
            transition={{ duration: 2.5, repeat: Infinity, delay: i * 0.4, ease: "easeInOut" }}
          />
        ))}
      </div>

      <div className="text-center space-y-1">
        <motion.p
          key={PHASES[activePhaseIndex]?.label}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className={`font-semibold text-foreground ${compact ? "text-sm" : "text-lg"}`}
        >
          {PHASES[activePhaseIndex]?.label}
        </motion.p>
        <AnimatePresence mode="wait">
          <motion.p
            key={progress.candidateName ?? "batch"}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className={`text-muted-foreground ${compact ? "text-xs" : "text-sm"}`}
          >
            {progress.candidateName
              ? `Evaluating ${progress.candidateName} against role requirements`
              : PHASES[activePhaseIndex]?.description}
          </motion.p>
        </AnimatePresence>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {progress.mode === "batch"
              ? `Candidate ${Math.min(progress.current + 1, progress.total)} of ${progress.total}`
              : "Single candidate"}
          </span>
          <motion.span
            key={percent}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="font-semibold text-violet-600 tabular-nums"
          >
            {percent}%
          </motion.span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-violet-100/80 dark:bg-violet-950/40">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-violet-500 via-blue-500 to-violet-400"
            initial={{ width: 0 }}
            animate={{ width: `${percent}%` }}
            transition={{ type: "spring", stiffness: 120, damping: 20 }}
          />
        </div>
      </div>

      <div className={`grid gap-2 ${compact ? "grid-cols-2" : "grid-cols-4"}`}>
        {PHASES.map((phase, index) => {
          const Icon = phase.icon;
          const isDone = index < activePhaseIndex;
          const isCurrent = index === activePhaseIndex;
          return (
            <motion.div
              key={phase.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`rounded-xl border px-2 py-2 text-center transition-colors ${
                isCurrent
                  ? "border-violet-300 bg-violet-50 dark:border-violet-700 dark:bg-violet-950/40"
                  : isDone
                    ? "border-emerald-200 bg-emerald-50/80 dark:border-emerald-800 dark:bg-emerald-950/30"
                    : "border-border bg-muted/30"
              }`}
            >
              <div className="flex items-center justify-center gap-1.5">
                {isDone ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <Icon
                    className={`h-3.5 w-3.5 ${isCurrent ? "text-violet-600" : "text-muted-foreground"}`}
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
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

export function AiRankProgressOverlay({
  progress,
}: {
  progress: AiRankProgressState | null;
}) {
  const mounted = useMounted();

  if (!mounted || !progress?.isActive || progress.mode !== "batch") return null;

  return createPortal(
    <AnimatePresence>
      {progress.isActive && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[10050] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ type: "spring", stiffness: 280, damping: 24 }}
            className="relative w-full max-w-md overflow-hidden rounded-2xl border border-violet-200/60 bg-background/95 p-6 shadow-2xl shadow-violet-500/10 dark:border-violet-800/60"
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-violet-500 via-blue-500 to-violet-400" />
            <div className="mb-5 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-violet-600" />
              <h3 className="text-base font-semibold text-foreground">AI Ranking in Progress</h3>
            </div>
            <ProgressCore progress={progress} />
            <p className="mt-5 text-center text-xs text-muted-foreground">
              Please keep this tab open while candidates are evaluated
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

export function AiRankInlineProgress({
  progress,
}: {
  progress: AiRankProgressState | null;
}) {
  if (!progress?.isActive || progress.mode !== "single") return null;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50/90 to-blue-50/50 p-4 dark:border-violet-800 dark:from-violet-950/40 dark:to-blue-950/20"
    >
      <ProgressCore progress={progress} compact />
    </motion.div>
  );
}

export function cycleAiRankPhase(phase: AiRankPhase): AiRankPhase {
  const order: AiRankPhase[] = ["extracting", "analyzing", "scoring", "saving"];
  const index = order.indexOf(phase);
  return order[(index + 1) % order.length];
}
