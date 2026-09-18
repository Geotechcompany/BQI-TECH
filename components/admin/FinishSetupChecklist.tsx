"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, ChevronDown, Lightbulb, X } from "lucide-react";
import { adminApi } from "@/lib/api-backend";
import { isAdminRole } from "@/lib/admin-permissions";
import {
  EMPTY_FINISH_SETUP_COMPLETION,
  FINISH_SETUP_TASKS,
  allFinishSetupTasksComplete,
  isFinishSetupMinimized,
  isFinishSetupSkipped,
  setFinishSetupMinimized,
  skipFinishSetup,
  type FinishSetupCompletion,
} from "@/lib/admin-finish-setup";
import { cn } from "@/lib/utils";

async function fetchFinishSetupCompletion(): Promise<FinishSetupCompletion> {
  const [overview, usersRes, invitesRes] = await Promise.all([
    adminApi.getOverview() as Promise<{
      jobs?: { total?: number; active?: number };
    }>,
    adminApi.getUsers({ skip: 0, limit: 100 }) as Promise<{
      users?: Array<{ role?: string }>;
    }>,
    adminApi.getAdminInvites() as Promise<{
      invites?: unknown[];
    }>,
  ]);

  const adminCount = (usersRes.users ?? []).filter((user) =>
    isAdminRole(user.role)
  ).length;
  const pendingInvites = invitesRes.invites?.length ?? 0;

  return {
    "add-position": (overview.jobs?.total ?? 0) > 0,
    "invite-team": adminCount > 1 || pendingInvites > 0,
    "careers-site": (overview.jobs?.active ?? 0) > 0,
  };
}

export function FinishSetupChecklist() {
  const reduceMotion = useReducedMotion();
  const [hydrated, setHydrated] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const [minimized, setMinimized] = useState(false);

  useEffect(() => {
    const wasSkipped = isFinishSetupSkipped();
    setSkipped(wasSkipped);
    setMinimized(isFinishSetupMinimized());
    if (!wasSkipped && window.matchMedia("(max-width: 767px)").matches) {
      setMinimized(true);
    }
    setHydrated(true);
  }, []);

  const {
    data: completion = EMPTY_FINISH_SETUP_COMPLETION,
    isFetched,
  } = useQuery({
    queryKey: ["admin-finish-setup"],
    queryFn: fetchFinishSetupCompletion,
    enabled: hydrated && !skipped,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  const allComplete = allFinishSetupTasksComplete(completion);

  const handleMinimize = (next: boolean) => {
    setMinimized(next);
    setFinishSetupMinimized(next);
  };

  const handleSkip = () => {
    skipFinishSetup();
    setSkipped(true);
  };

  // Stay visible until Skip (or minimize). Do not auto-hide when tasks are
  // already complete on load — that made the widget vanish immediately.
  if (!hydrated || skipped || !isFetched) {
    return null;
  }

  const completedCount = FINISH_SETUP_TASKS.filter(
    (task) => completion[task.id]
  ).length;
  const stepsLeft = FINISH_SETUP_TASKS.length - completedCount;
  const stepsLeftLabel =
    stepsLeft === 1 ? "1 Step Left" : `${stepsLeft} Steps Left`;

  const motionProps = reduceMotion
    ? { initial: false, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, y: 8, scale: 0.98 },
        animate: { opacity: 1, y: 0, scale: 1 },
        exit: { opacity: 0, y: 8, scale: 0.98 },
      };

  const motionTransition = {
    duration: reduceMotion ? 0 : 0.28,
  };

  return (
    <div className="pointer-events-none fixed bottom-20 right-24 z-[9990] flex max-w-[calc(100vw-7rem)] flex-col items-end">
      <AnimatePresence mode="wait" initial={false}>
        {minimized ? (
          <motion.button
            key="minimized"
            type="button"
            {...motionProps}
            transition={motionTransition}
            onClick={() => handleMinimize(false)}
            className="pointer-events-auto inline-flex items-center gap-2.5 rounded-full bg-white px-4 py-2.5 text-sm shadow-[0_4px_20px_rgba(15,23,42,0.12)] transition hover:shadow-[0_6px_24px_rgba(15,23,42,0.16)]"
            aria-label={
              allComplete
                ? "Expand Finish Setup checklist. You're all set"
                : `Expand Finish Setup checklist. ${stepsLeftLabel}`
            }
            aria-expanded={false}
          >
            <Lightbulb
              className="h-4 w-4 fill-current text-slate-900"
              strokeWidth={1.75}
              aria-hidden
            />
            {allComplete ? (
              <span className="font-semibold text-slate-900">
                You&apos;re all set
              </span>
            ) : (
              <>
                <span className="font-semibold text-slate-900">
                  Finish Setup
                </span>
                <span className="font-medium text-slate-400">
                  {stepsLeftLabel}
                </span>
              </>
            )}
          </motion.button>
        ) : (
          <motion.div
            key="expanded"
            {...motionProps}
            transition={motionTransition}
            className="pointer-events-auto w-[min(100vw-2rem,300px)] overflow-hidden rounded-lg border border-slate-200/90 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.08)]"
            role="region"
            aria-label="Finish Setup checklist"
          >
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
              <div className="flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-slate-800" aria-hidden />
                <h2 className="text-sm font-semibold text-slate-900">
                  {allComplete ? "You're all set" : "Finish Setup"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => handleMinimize(true)}
                className="inline-flex items-center gap-0.5 text-xs font-medium text-slate-500 transition hover:text-slate-700"
                aria-label="Minimize Finish Setup checklist"
                aria-expanded={true}
              >
                Minimize
                <ChevronDown className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>

            <ul className="px-1 py-1">
              {FINISH_SETUP_TASKS.map((task) => {
                const isDone = completion[task.id];
                const rowClass = "flex gap-3 rounded-md px-3 py-2.5";
                const content = (
                  <>
                    <Check
                      className={cn(
                        "mt-0.5 h-[18px] w-[18px] flex-shrink-0",
                        isDone ? "text-emerald-500" : "text-slate-300"
                      )}
                      strokeWidth={isDone ? 2.5 : 2}
                      aria-hidden
                    />
                    <span className="min-w-0">
                      <span
                        className={cn(
                          "block text-sm font-medium leading-snug",
                          isDone
                            ? "text-slate-400 line-through"
                            : "text-slate-900"
                        )}
                      >
                        {task.title}
                      </span>
                      <span
                        className={cn(
                          "mt-0.5 block text-xs leading-snug",
                          isDone ? "text-slate-300" : "text-slate-500"
                        )}
                      >
                        {task.description}
                      </span>
                    </span>
                  </>
                );

                if (isDone) {
                  return (
                    <li
                      key={task.id}
                      className={rowClass}
                      aria-label={`${task.title}, completed`}
                    >
                      {content}
                    </li>
                  );
                }

                return (
                  <li key={task.id}>
                    <Link
                      href={task.href}
                      className={cn(
                        rowClass,
                        "transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
                      )}
                      aria-label={`${task.title}, incomplete. Go to setup.`}
                    >
                      {content}
                    </Link>
                  </li>
                );
              })}
            </ul>

            <div className="border-t border-slate-100 px-4 py-2.5">
              <button
                type="button"
                onClick={handleSkip}
                className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 transition hover:text-slate-600"
                aria-label={
                  allComplete
                    ? "Dismiss Finish Setup checklist"
                    : "Skip Finish Setup checklist"
                }
              >
                {allComplete ? "Dismiss" : "Skip"}
                <X className="h-3 w-3" aria-hidden />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default FinishSetupChecklist;
