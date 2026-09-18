"use client";

import Lottie from "lottie-react";
import { CheckCircle2, ListTodo, Plus } from "lucide-react";
import { useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const EMPTY_TASKS_LOTTIE_SRC = "/lottie/empty-tasks.json";

let emptyTasksLottieCache: object | null | undefined;
let emptyTasksLottiePromise: Promise<object | null> | null = null;

function loadEmptyTasksLottie(): Promise<object | null> {
  if (emptyTasksLottieCache !== undefined) {
    return Promise.resolve(emptyTasksLottieCache);
  }
  if (!emptyTasksLottiePromise) {
    emptyTasksLottiePromise = fetch(EMPTY_TASKS_LOTTIE_SRC)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: object | null) => {
        emptyTasksLottieCache = data;
        return data;
      })
      .catch(() => {
        emptyTasksLottieCache = null;
        return null;
      });
  }
  return emptyTasksLottiePromise;
}

type TasksEmptyStateProps = {
  filterLabel: string;
  className?: string;
  /** Opens the create-task dialog when provided. */
  onCreateTask?: () => void;
};

export function TasksEmptyState({
  filterLabel,
  className,
  onCreateTask,
}: TasksEmptyStateProps) {
  const prefersReducedMotion = useReducedMotion();
  const [animationData, setAnimationData] = useState<object | null>(
    () => emptyTasksLottieCache ?? null
  );

  useEffect(() => {
    if (prefersReducedMotion) return;
    let cancelled = false;
    loadEmptyTasksLottie().then((data) => {
      if (!cancelled && data) setAnimationData(data);
    });
    return () => {
      cancelled = true;
    };
  }, [prefersReducedMotion]);

  return (
    <div
      className={cn(
        "relative flex min-h-[420px] flex-col items-center justify-center overflow-hidden px-6 py-16 text-center",
        className
      )}
    >
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{
          background:
            "radial-gradient(ellipse 70% 55% at 50% 42%, rgba(49,205,255,0.10) 0%, rgba(39,33,86,0.05) 45%, transparent 72%)",
        }}
      />
      <div
        className="pointer-events-none absolute left-1/2 top-[38%] h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#272156]/[0.04] blur-2xl"
        aria-hidden
      />

      <div className="relative z-[1] flex flex-col items-center">
        <div className="mb-1 h-[140px] w-[140px]" aria-hidden>
          {animationData && !prefersReducedMotion ? (
            <Lottie
              animationData={animationData}
              loop
              className="h-full w-full"
            />
          ) : (
            <StaticTasksMark />
          )}
        </div>

        <h2 className="text-base font-semibold tracking-tight text-[#272156]">
          No tasks found
        </h2>
        <p className="mt-1.5 max-w-[280px] text-sm leading-relaxed text-muted-foreground">
          Nothing in {filterLabel} right now. Create a task or switch filters to
          see what else is open.
        </p>

        {onCreateTask ? (
          <Button
            type="button"
            size="sm"
            className="mt-5 bg-[#31CDFF] text-white hover:bg-[#31CDFF]/90"
            onClick={onCreateTask}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" aria-hidden />
            Create task
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function StaticTasksMark() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="relative">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-[#31CDFF]/15">
          <ListTodo className="h-9 w-9 text-[#272156]/70" strokeWidth={1.5} />
        </div>
        <CheckCircle2
          className="absolute -bottom-1 -right-1 h-7 w-7 text-[#31CDFF]"
          strokeWidth={1.5}
        />
      </div>
    </div>
  );
}
