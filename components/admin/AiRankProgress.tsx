"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Brain,
  FileSearch,
  Sparkles,
  Save,
  CheckCircle2,
  Minimize2,
  Maximize2,
  type LucideIcon,
} from "lucide-react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useAiRank } from "@/contexts/AiRankContext";
import { cn } from "@/lib/utils";

/** Job pipeline kanban — not pipeline settings. */
function isJobPipelinePath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return /\/admin\/jobs\/[^/]+\/pipeline\/?$/.test(pathname);
}

/** Cross-position candidates table — keep scoring chrome out of the welcome banner. */
function isCandidatesPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return /^\/admin\/candidates\/?$/.test(pathname);
}

export type AiRankPhase =
  | "extracting"
  | "analyzing"
  | "scoring"
  | "saving"
  | "complete";

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
    label: "Scoring with BQI Intelligence",
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

/** Critically damped springs — Apple defaults (damping 1.0 ≈ bounce 0). */
const SPRING_UI = { type: "spring" as const, bounce: 0, duration: 0.4 };
const SPRING_SNAPPY = { type: "spring" as const, bounce: 0, duration: 0.32 };
/** Elegant ambient ease — soft settle, no abrupt edges (Emil / Sonner vibe). */
const AMBIENT_EASE: [number, number, number, number] = [0.4, 0, 0.2, 1];

function ScoringAmbientIcon({
  Icon,
  phase,
  isComplete,
  reduceMotion,
}: {
  Icon: LucideIcon;
  phase: AiRankPhase;
  isComplete: boolean;
  reduceMotion: boolean | null;
}) {
  const isWorking = !isComplete && phase !== "saving";
  const intensify =
    phase === "scoring" || phase === "analyzing" || phase === "extracting";

  return (
    <div className="relative mb-3.5 flex h-[4.5rem] w-[4.5rem] items-center justify-center">
      {/* Ambient lighting layers — soft violet bloom around the tile */}
      {!reduceMotion && intensify ? (
        <>
          <motion.div
            className="pointer-events-none absolute h-28 w-28 rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(167,139,250,0.45) 0%, rgba(124,58,237,0.18) 38%, transparent 68%)",
            }}
            animate={{
              opacity: [0.45, 0.85, 0.45],
              scale: [0.92, 1.12, 0.92],
            }}
            transition={{
              duration: 2.8,
              repeat: Infinity,
              ease: AMBIENT_EASE,
            }}
            aria-hidden
          />
          <motion.div
            className="pointer-events-none absolute h-20 w-20 rounded-full blur-xl"
            style={{
              background:
                "radial-gradient(circle, rgba(196,181,253,0.7) 0%, rgba(139,92,246,0.25) 50%, transparent 72%)",
            }}
            animate={{
              opacity: [0.35, 0.7, 0.35],
              scale: [1, 1.18, 1],
            }}
            transition={{
              duration: 2.2,
              repeat: Infinity,
              ease: AMBIENT_EASE,
              delay: 0.35,
            }}
            aria-hidden
          />
          <motion.div
            className="pointer-events-none absolute inset-0"
            animate={{ rotate: 360 }}
            transition={{
              duration: 10,
              repeat: Infinity,
              ease: "linear",
            }}
            aria-hidden
          >
            <div
              className="absolute left-1/2 top-0 h-14 w-10 -translate-x-1/2 blur-md"
              style={{
                background:
                  "radial-gradient(ellipse at center, rgba(233,213,255,0.55) 0%, transparent 70%)",
              }}
            />
          </motion.div>
        </>
      ) : (
        <div
          className="pointer-events-none absolute h-20 w-20 rounded-full bg-violet-400/25 blur-2xl"
          aria-hidden
        />
      )}

      {/* Squircle tile */}
      <motion.div
        className="relative z-[1] flex h-11 w-11 items-center justify-center rounded-[14px] text-white"
        style={{
          background:
            "linear-gradient(145deg, #a78bfa 0%, #8b5cf6 42%, #6d28d9 100%)",
          boxShadow: isWorking
            ? "0 0 0 1px rgba(255,255,255,0.18) inset, 0 10px 28px rgba(109,40,217,0.38), 0 0 36px rgba(139,92,246,0.28)"
            : "0 0 0 1px rgba(255,255,255,0.12) inset, 0 8px 20px rgba(109,40,217,0.3)",
        }}
        initial={reduceMotion ? false : { scale: 0.88, opacity: 0 }}
        animate={
          reduceMotion || !isWorking
            ? { scale: 1, opacity: 1 }
            : {
                scale: [1, 1.03, 1],
                opacity: 1,
              }
        }
        transition={
          reduceMotion || !isWorking
            ? SPRING_SNAPPY
            : {
                scale: {
                  duration: 2.6,
                  repeat: Infinity,
                  ease: AMBIENT_EASE,
                },
                opacity: SPRING_SNAPPY,
              }
        }
      >
        {/* Specular sheen sweep */}
        {!reduceMotion && isWorking ? (
          <motion.span
            className="pointer-events-none absolute inset-0 overflow-hidden rounded-[14px]"
            aria-hidden
          >
            <motion.span
              className="absolute -inset-y-4 -left-1/2 w-1/2 skew-x-[-18deg] bg-gradient-to-r from-transparent via-white/35 to-transparent"
              animate={{ x: ["-40%", "280%"] }}
              transition={{
                duration: 2.4,
                repeat: Infinity,
                ease: AMBIENT_EASE,
                repeatDelay: 1.1,
              }}
            />
          </motion.span>
        ) : null}

        <AnimatePresence mode="wait">
          <motion.div
            key={phase}
            initial={
              reduceMotion
                ? { opacity: 0 }
                : { scale: 0.84, opacity: 0, filter: "blur(4px)" }
            }
            animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
            exit={
              reduceMotion
                ? { opacity: 0 }
                : { scale: 0.92, opacity: 0, filter: "blur(3px)" }
            }
            transition={SPRING_SNAPPY}
            className="relative z-[1]"
          >
            <motion.div
              animate={
                reduceMotion || isComplete
                  ? undefined
                  : { rotate: [0, 6, -4, 0], scale: [1, 1.06, 1] }
              }
              transition={
                reduceMotion || isComplete
                  ? undefined
                  : {
                      duration: 3.2,
                      repeat: Infinity,
                      ease: AMBIENT_EASE,
                    }
              }
            >
              <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
            </motion.div>
          </motion.div>
        </AnimatePresence>

        {/* Inner rim light */}
        <span
          className="pointer-events-none absolute inset-0 rounded-[14px] ring-1 ring-inset ring-white/25"
          aria-hidden
        />
      </motion.div>
    </div>
  );
}

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
    return "Scoring with BQI Intelligence…";
  }
  const index = PHASES.findIndex((p) => p.id === progress.phase);
  return PHASES[index]?.label ?? "Ranking";
}

function secondaryStatusCopy(
  progress: AiRankProgressState,
  isLongWait: boolean
): string {
  if (progress.phase === "complete") {
    return "Assessment saved";
  }
  if (progress.phase === "saving") {
    return "Writing score to the application";
  }
  if (isLongWait) {
    return "Still working — detailed CVs can take a few minutes";
  }
  if (progress.total > 1) {
    return `Candidate ${Math.min(progress.current + 1, progress.total)} of ${progress.total}`;
  }
  return "Evaluating against position requirements";
}

/**
 * Premium top panel — Apple-style materials + critically damped motion.
 * Screenshot-matched: sparkle tile, title · name, status line, bottom progress.
 */
function AiRankTopPanel({
  progress,
  onMinimize,
  className,
  embedded = false,
}: {
  progress: AiRankProgressState;
  onMinimize?: () => void;
  className?: string;
  /** When true, panel fills parent (candidate header slot) instead of fixed viewport. */
  embedded?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const percent = useMonotonicProgress(progress);
  const isLongWait = useLongWait(progress);
  const isComplete = progress.phase === "complete";
  const activePhaseIndex = PHASES.findIndex((p) => p.id === progress.phase);
  const ActiveIcon = isComplete
    ? CheckCircle2
    : (PHASES[activePhaseIndex]?.icon ?? Sparkles);
  const label = phaseDisplayLabel(progress, isLongWait);
  const subtitle = secondaryStatusCopy(progress, isLongWait);
  const showWorkingPulse =
    isLongWait && progress.phase !== "saving" && progress.phase !== "complete";

  return (
    <motion.div
      role="status"
      aria-live="polite"
      aria-label={`${label}${progress.candidateName ? ` for ${progress.candidateName}` : ""} — ${percent}%`}
      initial={
        reduceMotion
          ? { opacity: 0 }
          : { opacity: 0, y: embedded ? -8 : -18, filter: "blur(8px)" }
      }
      animate={
        reduceMotion
          ? { opacity: 1 }
          : { opacity: 1, y: 0, filter: "blur(0px)" }
      }
      exit={
        reduceMotion
          ? { opacity: 0 }
          : { opacity: 0, y: embedded ? -6 : -12, filter: "blur(6px)" }
      }
      transition={SPRING_UI}
      className={cn(
        "relative overflow-x-clip",
        embedded
          ? "w-full"
          : "fixed inset-x-0 top-0 z-[10050] border-b border-[#272055]/08 shadow-[0_8px_30px_rgba(39,32,85,0.06)]",
        className
      )}
    >
      {/* Translucent material */}
      <div
        className="absolute inset-0 bg-[#f6f5fa]/92 backdrop-blur-xl backdrop-saturate-150 dark:bg-[#16141f]/92"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(124,58,237,0.07),transparent_55%)]"
        aria-hidden
      />
      {!reduceMotion && !isComplete ? (
        <motion.div
          className="pointer-events-none absolute inset-x-0 top-0 h-full"
          style={{
            background:
              "radial-gradient(ellipse 55% 80% at 50% 28%, rgba(139,92,246,0.14), transparent 70%)",
          }}
          animate={{ opacity: [0.4, 0.85, 0.4] }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: AMBIENT_EASE,
          }}
          aria-hidden
        />
      ) : null}

      <div className="relative mx-auto flex max-w-2xl flex-col items-center px-6 pb-5 pt-5 text-center sm:px-8 sm:pb-6 sm:pt-6">
        {onMinimize ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-3 top-3 h-8 w-8 rounded-full text-muted-foreground hover:bg-[#272055]/06"
            onClick={onMinimize}
            aria-label="Continue in background"
          >
            <Minimize2 className="h-4 w-4" />
          </Button>
        ) : null}

        <ScoringAmbientIcon
          Icon={ActiveIcon}
          phase={progress.phase}
          isComplete={isComplete}
          reduceMotion={reduceMotion}
        />

        {/* Title */}
        <p className="text-[15px] font-semibold tracking-[-0.01em] text-[#1c1830] dark:text-foreground">
          {label}
          {progress.candidateName ? (
            <span className="font-normal text-[#6b7280] dark:text-muted-foreground">
              {" "}
              · {progress.candidateName}
            </span>
          ) : null}
        </p>

        <AnimatePresence mode="wait">
          <motion.p
            key={`${progress.phase}-${isLongWait}-${progress.candidateName}`}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -3 }}
            transition={SPRING_SNAPPY}
            className="mt-1 max-w-md text-[13px] leading-snug text-[#8b92a5] dark:text-muted-foreground"
          >
            {subtitle}
          </motion.p>
        </AnimatePresence>
      </div>

      {/* Bottom progress — thin Apple-style track */}
      <div className="relative h-[3px] w-full bg-[#e8e4f2] dark:bg-violet-950/60">
        <motion.div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#8b5cf6] via-[#7c3aed] to-[#a78bfa]"
          initial={false}
          animate={{ width: `${percent}%` }}
          transition={reduceMotion ? { duration: 0.2 } : SPRING_UI}
        />
        {showWorkingPulse && !reduceMotion ? (
          <motion.div
            className="absolute inset-y-0 w-1/4 bg-gradient-to-r from-transparent via-white/50 to-transparent"
            animate={{ left: ["-25%", "100%"] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
            aria-hidden
          />
        ) : null}
      </div>
    </motion.div>
  );
}

function AiRankFloatingPill({
  progress,
  onExpand,
}: {
  progress: AiRankProgressState;
  onExpand?: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const percent = useMonotonicProgress(progress);
  const isLongWait = useLongWait(progress);
  const phaseLabel = phaseDisplayLabel(progress, isLongWait);
  const expandable = typeof onExpand === "function";

  const content = (
    <>
      <div className="relative h-10 w-10 shrink-0">
        <svg className="h-10 w-10 -rotate-90" viewBox="0 0 36 36" aria-hidden>
          <circle
            cx="18"
            cy="18"
            r="15.5"
            fill="none"
            className="stroke-[#272055]/15 dark:stroke-[#31CDFF]/20"
            strokeWidth="3"
          />
          <circle
            cx="18"
            cy="18"
            r="15.5"
            fill="none"
            className="stroke-[#272055] dark:stroke-[#31CDFF]"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={`${percent} 100`}
            pathLength={100}
          />
        </svg>
        <Sparkles className="absolute inset-0 m-auto h-4 w-4 text-[#272055] dark:text-[#31CDFF]" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold tracking-tight text-foreground">
          BQI Intelligence
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {phaseLabel}
          {progress.candidateName ? ` · ${progress.candidateName}` : ""}
        </p>
      </div>
      {expandable ? (
        <Maximize2 className="h-4 w-4 shrink-0 text-muted-foreground" />
      ) : null}
    </>
  );

  const shellClass =
    "fixed bottom-6 right-6 z-[10060] flex max-w-[min(100vw-2rem,22rem)] items-center gap-3 rounded-2xl border border-[#272055]/15 bg-white/95 px-4 py-3 text-left shadow-2xl shadow-[#272055]/10 backdrop-blur-xl dark:border-[#31CDFF]/20 dark:bg-[#16141f]/95";

  if (!expandable) {
    return (
      <motion.div
        role="status"
        aria-live="polite"
        aria-label={`${phaseLabel}${progress.candidateName ? ` for ${progress.candidateName}` : ""} — ${percent}%`}
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.97 }}
        transition={SPRING_UI}
        className={shellClass}
      >
        {content}
      </motion.div>
    );
  }

  return (
    <motion.button
      type="button"
      onClick={onExpand}
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.97 }}
      transition={SPRING_UI}
      whileTap={reduceMotion ? undefined : { scale: 0.97 }}
      className={shellClass}
    >
      {content}
    </motion.button>
  );
}

export function AiRankProgressHost() {
  const mounted = useMounted();
  const pathname = usePathname();
  const { progress, isBackground, sendToBackground, expandOverlay } = useAiRank();
  const onPipelinePage = isJobPipelinePath(pathname);
  const onCandidatesPage = isCandidatesPath(pathname);

  if (!mounted || !progress?.isActive) return null;

  // Pipeline: board glow + header chip only — never the full top banner.
  if (onPipelinePage) {
    return null;
  }

  // Candidates: floating status pill only — no purple top-panel glow over the banner.
  if (onCandidatesPage) {
    return createPortal(
      <AnimatePresence mode="wait">
        <AiRankFloatingPill key="pill" progress={progress} />
      </AnimatePresence>,
      document.body
    );
  }

  // Single-candidate background: page slot / header chip owns chrome.
  if (isBackground && progress.mode === "single") {
    return null;
  }

  return createPortal(
    <AnimatePresence mode="wait">
      {isBackground ? (
        <AiRankFloatingPill
          key="pill"
          progress={progress}
          onExpand={expandOverlay}
        />
      ) : (
        <AiRankTopPanel
          key="panel"
          progress={progress}
          onMinimize={sendToBackground}
        />
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
    <AiRankTopPanel progress={progress} embedded className="rounded-none" />
  );
}

export function AiRankHeaderIndicator() {
  const pathname = usePathname();
  const { progress, isBackground, isRanking, expandOverlay } = useAiRank();
  const onPipelinePage = isJobPipelinePath(pathname);
  const onCandidatesPage = isCandidatesPath(pathname);

  // Candidates uses the floating pill; pipeline uses this chip; elsewhere when backgrounded.
  if (!isRanking || !progress) return null;
  if (onCandidatesPage) return null;
  if (!isBackground && !onPipelinePage) return null;

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
      className="inline-flex items-center gap-2 rounded-xl border border-[#272055]/15 bg-[#272055]/[0.06] px-2.5 py-1.5 text-xs font-medium text-[#272055] transition hover:bg-[#272055]/10 dark:border-[#31CDFF]/25 dark:bg-[#31CDFF]/10 dark:text-[#31CDFF] dark:hover:bg-[#31CDFF]/15"
    >
      {isComplete ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
      ) : (
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#31CDFF] opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-[#272055] dark:bg-[#31CDFF]" />
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
