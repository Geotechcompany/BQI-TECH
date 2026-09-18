"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, ChevronDown, Rocket, X } from "lucide-react";
import { employeePortalApi } from "@/lib/api-backend";
import {
  EMPTY_EMPLOYEE_QUICK_START_COMPLETION,
  EMPLOYEE_QUICK_START_TASKS,
  EMPLOYEE_QUICK_START_UPDATED_EVENT,
  allEmployeeQuickStartTasksComplete,
  getEmployeeQuickStartCompletion,
  isEmployeeQuickStartMinimized,
  isEmployeeQuickStartSkipped,
  setEmployeeQuickStartMinimized,
  skipEmployeeQuickStart,
} from "@/lib/employee-quick-start";
import type { Employee } from "@/types/employee";
import { cn } from "@/lib/utils";

export function EmployeeQuickStartChecklist() {
  const reduceMotion = useReducedMotion();
  const [hydrated, setHydrated] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [visitRevision, setVisitRevision] = useState(0);

  useEffect(() => {
    const wasSkipped = isEmployeeQuickStartSkipped();
    setSkipped(wasSkipped);
    setMinimized(isEmployeeQuickStartMinimized());
    if (!wasSkipped && window.matchMedia("(max-width: 767px)").matches) {
      setMinimized(true);
    }
    setHydrated(true);

    const refreshVisits = () => setVisitRevision((n) => n + 1);
    window.addEventListener(EMPLOYEE_QUICK_START_UPDATED_EVENT, refreshVisits);
    return () => {
      window.removeEventListener(
        EMPLOYEE_QUICK_START_UPDATED_EVENT,
        refreshVisits
      );
    };
  }, []);

  const { data: employee, isFetched } = useQuery({
    queryKey: ["employee-portal-me"],
    queryFn: () => employeePortalApi.getMe() as Promise<Employee>,
    enabled: hydrated && !skipped,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });

  const completion =
    employee && visitRevision >= 0
      ? getEmployeeQuickStartCompletion(employee)
      : EMPTY_EMPLOYEE_QUICK_START_COMPLETION;

  const allComplete = allEmployeeQuickStartTasksComplete(completion);

  const handleMinimize = (next: boolean) => {
    setMinimized(next);
    setEmployeeQuickStartMinimized(next);
  };

  const handleSkip = () => {
    skipEmployeeQuickStart();
    setSkipped(true);
  };

  if (!hydrated || skipped || !isFetched || !employee) {
    return null;
  }

  const completedCount = EMPLOYEE_QUICK_START_TASKS.filter(
    (task) => completion[task.id]
  ).length;
  const stepsLeft = EMPLOYEE_QUICK_START_TASKS.length - completedCount;
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
    <div
      className="pointer-events-none fixed bottom-20 right-4 z-[9990] flex max-w-[calc(100vw-2rem)] flex-col items-end sm:right-6 md:bottom-6 md:right-8"
      data-tour="employee-quick-start-checklist"
    >
      <AnimatePresence mode="wait" initial={false}>
        {minimized ? (
          <motion.button
            key="minimized"
            type="button"
            {...motionProps}
            transition={motionTransition}
            onClick={() => handleMinimize(false)}
            className="pointer-events-auto inline-flex items-center gap-2.5 rounded-full bg-white px-4 py-2.5 text-sm shadow-[0_4px_20px_rgba(39,33,86,0.14)] transition hover:shadow-[0_6px_24px_rgba(39,33,86,0.18)] dark:bg-card dark:shadow-black/40"
            aria-label={
              allComplete
                ? "Expand Quick Start checklist. You're all set"
                : `Expand Quick Start checklist. ${stepsLeftLabel}`
            }
            aria-expanded={false}
          >
            <Rocket
              className="h-4 w-4 text-[#272156] dark:text-[#31CDFF]"
              strokeWidth={1.75}
              aria-hidden
            />
            {allComplete ? (
              <span className="font-semibold text-[#272156] dark:text-foreground">
                You&apos;re all set
              </span>
            ) : (
              <>
                <span className="font-semibold text-[#272156] dark:text-foreground">
                  Quick Start
                </span>
                <span className="font-medium text-muted-foreground">
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
            className="pointer-events-auto w-[min(100vw-2rem,300px)] overflow-hidden rounded-lg border border-[#272156]/12 bg-white shadow-[0_8px_30px_rgba(39,33,86,0.1)] dark:border-border dark:bg-card"
            role="region"
            aria-label="Quick Start checklist"
          >
            <div className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
              <div className="flex items-center gap-2">
                <Rocket
                  className="h-4 w-4 text-[#272156] dark:text-[#31CDFF]"
                  aria-hidden
                />
                <h2 className="text-sm font-semibold text-[#272156] dark:text-foreground">
                  {allComplete ? "You're all set" : "Quick Start"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => handleMinimize(true)}
                className="inline-flex items-center gap-0.5 text-xs font-medium text-muted-foreground transition hover:text-foreground"
                aria-label="Minimize Quick Start checklist"
                aria-expanded={true}
              >
                Minimize
                <ChevronDown className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>

            <ul className="px-1 py-1">
              {EMPLOYEE_QUICK_START_TASKS.map((task) => {
                const isDone = completion[task.id];
                const rowClass = "flex gap-3 rounded-md px-3 py-2.5";
                const content = (
                  <>
                    <Check
                      className={cn(
                        "mt-0.5 h-[18px] w-[18px] flex-shrink-0",
                        isDone ? "text-emerald-500" : "text-muted-foreground/40"
                      )}
                      strokeWidth={isDone ? 2.5 : 2}
                      aria-hidden
                    />
                    <span className="min-w-0">
                      <span
                        className={cn(
                          "block text-sm font-medium leading-snug",
                          isDone
                            ? "text-muted-foreground line-through"
                            : "text-foreground"
                        )}
                      >
                        {task.title}
                      </span>
                      <span
                        className={cn(
                          "mt-0.5 block text-xs leading-snug",
                          isDone
                            ? "text-muted-foreground/70"
                            : "text-muted-foreground"
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
                        "transition hover:bg-[#272156]/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#31CDFF]/45 dark:hover:bg-muted/60"
                      )}
                      aria-label={`${task.title}, incomplete. Open page.`}
                    >
                      {content}
                    </Link>
                  </li>
                );
              })}
            </ul>

            <div className="border-t border-border/70 px-4 py-2.5">
              <button
                type="button"
                onClick={handleSkip}
                className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition hover:text-foreground"
                aria-label={
                  allComplete
                    ? "Dismiss Quick Start checklist"
                    : "Skip Quick Start checklist"
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

export default EmployeeQuickStartChecklist;
