"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { Plus, Trash2, User } from "lucide-react";
import { toast } from "react-hot-toast";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import { AdminPageWelcomeBanner } from "@/components/admin/AdminPageWelcomeBanner";
import { TourPageHelper } from "@/components/admin/tour/TourPageHelper";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { adminApi } from "@/lib/api-backend";
import {
  CreateTaskDialog,
  type CreateTaskPayload,
} from "@/components/admin/tasks/CreateTaskDialog";
import { TasksEmptyState } from "@/components/admin/tasks/TasksEmptyState";

export type TasksFilter = "mine" | "team" | "completed";

export interface AdminTaskItem {
  id: string;
  title: string;
  description?: string;
  assigneeId?: string | null;
  assigneeName?: string | null;
  dueDate?: string | null;
  status: "open" | "completed";
  createdById?: string;
  createdByName?: string;
  positionId?: string | null;
  createdAt?: string;
  completedAt?: string | null;
}

const FILTERS: { id: TasksFilter; label: string }[] = [
  { id: "mine", label: "My Tasks" },
  { id: "team", label: "Assigned to Team" },
  { id: "completed", label: "Completed" },
];

function formatDue(dueDate?: string | null): string | null {
  if (!dueDate) return null;
  try {
    const date = parseISO(dueDate);
    if (Number.isNaN(date.getTime())) return null;
    return format(date, "MMM d, yyyy");
  } catch {
    return null;
  }
}

async function fetchTasks(filter: TasksFilter): Promise<AdminTaskItem[]> {
  const response = (await adminApi.getTasks({ filter, limit: 100 })) as {
    tasks?: AdminTaskItem[];
  };
  return response?.tasks || [];
}

export function AdminTasksPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<TasksFilter>("mine");
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data: tasks = [], isLoading, isError } = useQuery({
    queryKey: ["admin-tasks", filter],
    queryFn: () => fetchTasks(filter),
    staleTime: 20_000,
    refetchOnWindowFocus: true,
  });

  const filteredTasks = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return tasks;
    return tasks.filter((task) => {
      const haystack = [
        task.title,
        task.description,
        task.assigneeName,
        task.createdByName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [tasks, search]);

  const createMutation = useMutation({
    mutationFn: async (payload: CreateTaskPayload) => {
      await adminApi.createTask(payload);
    },
    onSuccess: () => {
      toast.success("Task created");
      setCreateOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["admin-tasks"] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to create task");
    },
  });

  const completeMutation = useMutation({
    mutationFn: async (task: AdminTaskItem) => {
      const nextStatus = task.status === "completed" ? "open" : "completed";
      await adminApi.updateTask(task.id, { status: nextStatus });
    },
    onSuccess: (_data, task) => {
      const completed = task.status !== "completed";
      toast.success(completed ? "Task completed" : "Task reopened");
      void queryClient.invalidateQueries({ queryKey: ["admin-tasks"] });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to update task"
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (taskId: string) => {
      await adminApi.deleteTask(taskId);
    },
    onSuccess: () => {
      toast.success("Task deleted");
      void queryClient.invalidateQueries({ queryKey: ["admin-tasks"] });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete task"
      );
    },
  });

  const activeFilterLabel =
    FILTERS.find((item) => item.id === filter)?.label || "My Tasks";

  return (
    <AdminPageLayout
      title="Tasks"
      showSearch
      searchPlaceholder="Search tasks…"
      searchValue={search}
      onSearch={setSearch}
      tourId="tasks"
      guideInBanner
      headerActions={
        <Button
          type="button"
          className="bg-[#31CDFF] text-white hover:bg-[#31CDFF]/90"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="mr-1.5 h-4 w-4" />
          Task
        </Button>
      }
      contentClassName="!max-w-none px-0 py-0 md:px-0"
    >
      <TourPageHelper tourId="tasks" />
      <div className="px-4 pt-3 md:px-6">
        <AdminPageWelcomeBanner bannerKey="tasks" compact tourId="tasks" />
      </div>
      <div className="flex min-h-[calc(100vh-12rem)] flex-col md:flex-row">
        <aside
          className="w-full shrink-0 border-b border-border/60 bg-card/40 px-4 py-5 md:w-56 md:border-b-0 md:border-r lg:w-60"
          data-tour="tasks-filters"
        >
          <p className="mb-3 px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Filters
          </p>
          <nav className="flex gap-1 overflow-x-auto md:flex-col md:gap-0.5 md:overflow-visible">
            {FILTERS.map((item) => {
              const selected = filter === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setFilter(item.id)}
                  className={cn(
                    "whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm transition-colors",
                    selected
                      ? "bg-[#272055]/08 font-medium text-[#272055]"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  )}
                  aria-current={selected ? "page" : undefined}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
        </aside>

        <section
          className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8"
          data-tour="tasks-list"
        >
          <header className="mb-6 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                {activeFilterLabel}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {isLoading
                  ? "Loading…"
                  : `${filteredTasks.length} task${filteredTasks.length === 1 ? "" : "s"}`}
              </p>
            </div>
          </header>

          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : isError ? (
            <div className="flex min-h-[280px] flex-col items-center justify-center rounded-xl border border-dashed border-border px-6 text-center">
              <p className="text-sm text-muted-foreground">
                Could not load tasks. Check that the backend is running the latest
                code.
              </p>
            </div>
          ) : filteredTasks.length === 0 ? (
            <TasksEmptyState
              filterLabel={activeFilterLabel.toLowerCase()}
              onCreateTask={() => setCreateOpen(true)}
            />
          ) : (
            <ul className="divide-y divide-border/70 overflow-hidden rounded-xl border border-border/70 bg-card">
              {filteredTasks.map((task) => {
                const dueLabel = formatDue(task.dueDate);
                const isCompleted = task.status === "completed";
                const completing =
                  completeMutation.isPending &&
                  completeMutation.variables?.id === task.id;
                const deleting =
                  deleteMutation.isPending &&
                  deleteMutation.variables === task.id;

                return (
                  <li
                    key={task.id}
                    className="flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-muted/30 sm:gap-4 sm:px-5"
                  >
                    <Checkbox
                      checked={isCompleted}
                      disabled={completing}
                      className="mt-1"
                      aria-label={
                        isCompleted
                          ? `Reopen "${task.title}"`
                          : `Mark "${task.title}" complete`
                      }
                      onCheckedChange={() => completeMutation.mutate(task)}
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "text-sm font-medium text-foreground",
                          isCompleted && "text-muted-foreground line-through"
                        )}
                      >
                        {task.title}
                      </p>
                      {task.description ? (
                        <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                          {task.description}
                        </p>
                      ) : null}
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {task.assigneeName ? (
                          <span className="inline-flex items-center gap-1">
                            <User className="h-3 w-3" aria-hidden />
                            {task.assigneeName}
                          </span>
                        ) : null}
                        {dueLabel ? <span>Due {dueLabel}</span> : null}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="mt-0.5 h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                      disabled={deleting}
                      aria-label={`Delete "${task.title}"`}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Delete “${task.title}”? This cannot be undone.`
                          )
                        ) {
                          deleteMutation.mutate(task.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <CreateTaskDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        isSubmitting={createMutation.isPending}
        onSubmit={async (payload) => {
          await createMutation.mutateAsync(payload);
        }}
      />
    </AdminPageLayout>
  );
}
