"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Circle, ListTodo, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ListSkeleton, Skeleton } from "@/components/ui/skeleton";
import {
  candidateActionsApi,
  type ApplicationTask,
} from "@/components/admin/utils/candidate-actions-api";
import { formatDate } from "@/lib/utils";
import { toast } from "react-hot-toast";
import { cn } from "@/lib/utils";

interface CandidateTasksPanelProps {
  applicationId: string;
  onAddTask: () => void;
  refreshKey?: number;
}

export function CandidateTasksPanel({
  applicationId,
  onAddTask,
  refreshKey = 0,
}: CandidateTasksPanelProps) {
  const [tasks, setTasks] = useState<ApplicationTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);

  const loadTasks = useCallback(async () => {
    setIsLoading(true);
    try {
      const list = await candidateActionsApi.listTasks(applicationId);
      setTasks(list);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load tasks");
    } finally {
      setIsLoading(false);
    }
  }, [applicationId]);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks, refreshKey]);

  const toggleComplete = useCallback(
    async (task: ApplicationTask) => {
      setBusyTaskId(task.id);
      try {
        const updated = await candidateActionsApi.updateTask(
          applicationId,
          task.id,
          { completed: !task.completed }
        );
        setTasks((current) =>
          current.map((item) => (item.id === updated.id ? updated : item))
        );
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to update task");
      } finally {
        setBusyTaskId(null);
      }
    },
    [applicationId]
  );

  if (isLoading) {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-3 p-1">
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-8 w-16" />
        </div>
        <ListSkeleton items={4} />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ListTodo className="h-4 w-4 text-[#272055]/60" aria-hidden />
          <h3 className="text-sm font-semibold text-[#272055]">Tasks</h3>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 border-[#272055]/20 text-[#272055]"
          onClick={onAddTask}
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          Add
        </Button>
      </div>

      {tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
          <ListTodo className="mb-3 h-10 w-10 text-[#272055]/25" aria-hidden />
          <p className="text-sm font-medium text-[#272055]">No tasks yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add a follow-up for this candidate.
          </p>
          <Button type="button" size="sm" className="mt-4" onClick={onAddTask}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add task
          </Button>
        </div>
      ) : (
        <ul className="space-y-2">
          {tasks.map((task) => (
            <li
              key={task.id}
              className="flex items-start gap-2 rounded-lg border border-[#272055]/10 bg-white p-3"
            >
              <button
                type="button"
                className="mt-0.5 text-[#272055] disabled:opacity-50"
                disabled={busyTaskId === task.id}
                aria-label={task.completed ? "Mark incomplete" : "Mark complete"}
                onClick={() => void toggleComplete(task)}
              >
                {busyTaskId === task.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : task.completed ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : (
                  <Circle className="h-4 w-4 text-[#272055]/40" />
                )}
              </button>
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "text-sm font-medium text-[#272055]",
                    task.completed && "text-muted-foreground line-through"
                  )}
                >
                  {task.title}
                </p>
                {task.dueAt ? (
                  <p className="text-xs text-muted-foreground">
                    Due {formatDate(task.dueAt)}
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
