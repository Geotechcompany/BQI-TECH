"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { SquareCheck } from "lucide-react";
import { toast } from "react-hot-toast";
import { adminApi } from "@/lib/api-backend";
import { candidateActionsApi } from "@/components/admin/utils/candidate-actions-api";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";

export interface MyTaskItem {
  id: string;
  applicationId: string;
  jobId?: string | null;
  title: string;
  dueAt?: string | null;
  completed: boolean;
  candidateName?: string | null;
  href?: string | null;
}

function formatDue(dueAt?: string | null): string | null {
  if (!dueAt) return null;
  try {
    const date = parseISO(dueAt);
    if (Number.isNaN(date.getTime())) return null;
    return format(date, "MMM d, h:mm a");
  } catch {
    return null;
  }
}

async function fetchMyTasks(): Promise<MyTaskItem[]> {
  const response = (await adminApi.getMyTasks({ limit: 20 })) as {
    tasks?: MyTaskItem[];
  };
  return response?.tasks || [];
}

export function MyTasksWidget({ className }: { className?: string }) {
  const queryClient = useQueryClient();
  const { data: tasks = [], isLoading, isError } = useQuery({
    queryKey: ["admin-my-tasks"],
    queryFn: fetchMyTasks,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  const completeMutation = useMutation({
    mutationFn: async (task: MyTaskItem) => {
      await candidateActionsApi.updateTask(task.applicationId, task.id, {
        completed: true,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-my-tasks"] });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to complete task"
      );
    },
  });

  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm",
        className
      )}
      aria-label="My Tasks"
      data-tour="overview-tasks"
    >
      <header className="flex items-center gap-2 border-b border-border/50 px-4 py-3">
        <SquareCheck className="h-4 w-4 text-foreground/80" aria-hidden />
        <h2 className="text-sm font-semibold text-foreground">My Tasks</h2>
      </header>

      <div className="p-3">
        {isLoading ? (
          <div className="space-y-2 rounded-lg bg-muted/30 p-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : isError ? (
          <div className="flex min-h-[140px] flex-col items-center justify-center rounded-lg bg-muted/40 px-4 py-8 text-center">
            <p className="text-sm text-muted-foreground">
              Could not load your tasks.
            </p>
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex min-h-[140px] flex-col items-center justify-center rounded-lg bg-muted/40 px-4 py-8 text-center">
            <SquareCheck
              className="mb-3 h-10 w-10 text-muted-foreground/45"
              strokeWidth={1.5}
              aria-hidden
            />
            <p className="text-sm text-muted-foreground">
              You have no incomplete tasks.
            </p>
          </div>
        ) : (
          <ul className="max-h-64 space-y-0.5 overflow-y-auto">
            {tasks.map((task) => {
              const dueLabel = formatDue(task.dueAt);
              const meta = [task.candidateName, dueLabel]
                .filter(Boolean)
                .join(" · ");
              const completing =
                completeMutation.isPending &&
                completeMutation.variables?.id === task.id;

              return (
                <li
                  key={task.id}
                  className="flex items-start gap-2.5 rounded-md px-2 py-2 hover:bg-muted/50"
                >
                  <Checkbox
                    checked={false}
                    disabled={completing}
                    className="mt-0.5"
                    aria-label={`Mark "${task.title}" complete`}
                    onCheckedChange={(checked) => {
                      if (checked) completeMutation.mutate(task);
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    {task.href ? (
                      <Link
                        href={task.href}
                        className="block truncate text-sm font-medium text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {task.title}
                      </Link>
                    ) : (
                      <span className="block truncate text-sm font-medium text-foreground">
                        {task.title}
                      </span>
                    )}
                    {meta ? (
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        {meta}
                      </span>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
