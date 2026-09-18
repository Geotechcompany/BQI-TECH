"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Clock,
  Info,
  MessageSquare,
  MoreVertical,
  Paperclip,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  formatAbsencePeriod,
  formatDayAmount,
  formatRequestedShort,
  requestStatusPillClass,
} from "@/components/employee/leave/leave-helpers";
import { employeePortalApi } from "@/lib/api-backend";
import { resolveEmployeeAvatarSrc } from "@/lib/employee-portal-avatar";
import { cn } from "@/lib/utils";
import type {
  LeaveOverlapEntry,
  LeaveRequest,
  LeaveRequestDetail,
  LeaveRequestOverlaps,
  LeaveRequestStatus,
} from "@/types/leave";
import { LEAVE_STATUS_LABELS } from "@/types/leave";

type DrawerTab = "info" | "comments" | "attachments" | "history";

const TABS: { id: DrawerTab; label: string; icon: typeof Info }[] = [
  { id: "info", label: "Info", icon: Info },
  { id: "comments", label: "Comments", icon: MessageSquare },
  { id: "attachments", label: "Attachments", icon: Paperclip },
  { id: "history", label: "History", icon: Clock },
];

function StatusPill({ status }: { status: LeaveRequestStatus | string }) {
  const key = (status in LEAVE_STATUS_LABELS
    ? status
    : "pending") as LeaveRequestStatus;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
        requestStatusPillClass(key)
      )}
    >
      {LEAVE_STATUS_LABELS[key]}
    </span>
  );
}

function formatTimestamp(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 16);
  return d.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function OverlapList({
  title,
  items,
}: {
  title: string;
  items: LeaveOverlapEntry[];
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">
          No one else is absent in this period.
        </p>
      ) : (
        <ul className="mt-2 space-y-2">
          {items.map((entry) => (
            <li
              key={entry.id}
              className="flex items-center gap-2.5 rounded-lg border border-border/60 px-2.5 py-2"
            >
              <Avatar className="h-8 w-8">
                <AvatarImage
                  src={resolveEmployeeAvatarSrc(entry.avatarUrl)}
                  alt=""
                />
                <AvatarFallback className="bg-[#272156] text-[10px] text-white">
                  {entry.employeeName.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[#272156] dark:text-foreground">
                  {entry.employeeName}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {entry.leaveTypeName} ·{" "}
                  {formatAbsencePeriod(entry.startDate, entry.endDate)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function RequestDetailDrawer({
  request,
  open,
  onClose,
}: {
  request: LeaveRequest | null;
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<DrawerTab>("info");
  const [commentDraft, setCommentDraft] = useState("");
  const requestId = request?.id ?? "";

  useEffect(() => {
    if (open) {
      setTab("info");
      setCommentDraft("");
    }
  }, [open, requestId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const detailQuery = useQuery({
    queryKey: ["employee-leave-request-detail", requestId],
    queryFn: () =>
      employeePortalApi.getLeaveRequestDetail(
        requestId
      ) as Promise<LeaveRequestDetail>,
    enabled: open && Boolean(requestId),
    staleTime: 30_000,
  });

  const overlapsQuery = useQuery({
    queryKey: ["employee-leave-request-overlaps", requestId],
    queryFn: () =>
      employeePortalApi.getLeaveRequestOverlaps(
        requestId
      ) as Promise<LeaveRequestOverlaps>,
    enabled: open && Boolean(requestId) && tab === "info",
    staleTime: 60_000,
  });

  const cancelMutation = useMutation({
    mutationFn: () => employeePortalApi.cancelLeaveRequest(requestId),
    onSuccess: () => {
      toast.success("Request cancelled");
      void queryClient.invalidateQueries({
        queryKey: ["employee-portal-leave-requests"],
      });
      void queryClient.invalidateQueries({
        queryKey: ["employee-leave-request-detail", requestId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["employee-portal-leave-balances"],
      });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Could not cancel");
    },
  });

  const commentMutation = useMutation({
    mutationFn: (body: string) =>
      employeePortalApi.addLeaveRequestComment(requestId, body),
    onSuccess: () => {
      setCommentDraft("");
      toast.success("Comment added");
      void queryClient.invalidateQueries({
        queryKey: ["employee-leave-request-detail", requestId],
      });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Could not add comment");
    },
  });

  if (!open || !request) return null;

  const detail = detailQuery.data;
  const display = detail ?? request;
  const canCancel =
    display.status === "pending" || display.status === "approved";
  const avatarSrc = resolveEmployeeAvatarSrc(detail?.avatarUrl);
  const remaining = detail?.remainingDays;
  const entitled = detail?.entitledDays;
  const unlimited = detail?.unlimited;
  const remainingPct =
    !unlimited &&
    entitled != null &&
    entitled > 0 &&
    remaining != null
      ? Math.max(0, Math.min(100, (remaining / entitled) * 100))
      : null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-[#272156]/25 backdrop-blur-[1px]"
        aria-label="Close request details"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="leave-request-drawer-title"
        className="relative flex h-full w-full max-w-lg animate-in slide-in-from-right duration-200 border-l border-border bg-background shadow-2xl"
      >
        <nav className="flex w-12 shrink-0 flex-col items-center gap-1 border-r border-border/70 bg-[#272156]/[0.03] py-3">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              title={label}
              aria-label={label}
              aria-current={tab === id ? "page" : undefined}
              onClick={() => setTab(id)}
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
                tab === id
                  ? "bg-[#31CDFF]/20 text-[#272156]"
                  : "text-muted-foreground hover:bg-muted hover:text-[#272156]"
              )}
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
        </nav>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-start gap-3 border-b border-border/70 px-4 py-3">
            <Avatar className="mt-0.5 h-11 w-11 border border-[#272156]/10">
              <AvatarImage src={avatarSrc} alt="" />
              <AvatarFallback className="bg-[#272156] text-xs text-white">
                {display.employeeName.slice(0, 2).toUpperCase() || "BQ"}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2
                    id="leave-request-drawer-title"
                    className="truncate text-base font-semibold text-[#272156] dark:text-foreground"
                  >
                    {display.employeeName || "You"}
                  </h2>
                  <p className="truncate text-sm text-muted-foreground">
                    {display.leaveTypeName}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  {canCancel ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          aria-label="More actions"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          className="text-rose-700 focus:text-rose-700"
                          disabled={cancelMutation.isPending}
                          onClick={() => cancelMutation.mutate()}
                        >
                          Cancel request
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Close"
                    onClick={onClose}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="mt-1.5">
                <StatusPill status={display.status} />
              </div>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto px-4 py-4">
            {detailQuery.isLoading && !detail ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : null}

            {tab === "info" ? (
              <div className="space-y-5">
                <dl className="grid grid-cols-2 gap-3">
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Date
                    </dt>
                    <dd className="mt-1 text-sm font-medium text-[#272156] dark:text-foreground">
                      {formatAbsencePeriod(display.startDate, display.endDate)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Requested
                    </dt>
                    <dd className="mt-1 text-sm font-medium text-[#272156] dark:text-foreground">
                      {formatDayAmount(display.days)}
                    </dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Remaining
                    </dt>
                    <dd className="mt-1">
                      {unlimited ? (
                        <p className="text-sm font-medium text-[#272156] dark:text-foreground">
                          Unlimited
                        </p>
                      ) : remaining == null ? (
                        <p className="text-sm text-muted-foreground">—</p>
                      ) : (
                        <>
                          <p className="text-sm font-medium text-[#272156] dark:text-foreground">
                            {formatDayAmount(remaining)}
                            {entitled != null
                              ? ` / ${formatDayAmount(entitled)}`
                              : ""}
                          </p>
                          {remainingPct != null ? (
                            <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#272156]/10">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-[#272156] to-[#31CDFF]"
                                style={{ width: `${remainingPct}%` }}
                              />
                            </div>
                          ) : null}
                        </>
                      )}
                    </dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Approval
                    </dt>
                    <dd className="mt-1 text-sm font-medium text-[#272156] dark:text-foreground">
                      {display.status === "pending"
                        ? "Awaiting approval"
                        : display.approverName ||
                          (display.status === "approved"
                            ? "Approved"
                            : display.status === "rejected"
                              ? "Rejected"
                              : display.status === "cancelled"
                                ? "Cancelled"
                                : "—")}
                    </dd>
                  </div>
                </dl>

                {display.reason ? (
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Comment
                    </p>
                    <p className="mt-1 text-sm text-foreground/90">
                      {display.reason}
                    </p>
                  </div>
                ) : null}

                <div className="border-t border-border/60 pt-4">
                  <h3 className="text-sm font-semibold text-[#272156] dark:text-foreground">
                    Absent at the same time
                  </h3>
                  {overlapsQuery.isLoading ? (
                    <Skeleton className="mt-3 h-16 w-full" />
                  ) : (
                    <div className="mt-3 space-y-4">
                      <OverlapList
                        title={
                          overlapsQuery.data?.departmentName
                            ? overlapsQuery.data.departmentName
                            : "Department"
                        }
                        items={overlapsQuery.data?.department ?? []}
                      />
                      <OverlapList
                        title="Whole company"
                        items={overlapsQuery.data?.company ?? []}
                      />
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            {tab === "comments" ? (
              <div className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  {(detail?.comments ?? []).length} comment
                  {(detail?.comments ?? []).length === 1 ? "" : "s"}
                </p>
                {(detail?.comments ?? []).length === 0 ? (
                  <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                    No comments yet. Add a note below.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {(detail?.comments ?? []).map((c) => (
                      <li
                        key={c.id}
                        className="rounded-xl border border-border/60 px-3 py-2.5"
                      >
                        <div className="flex items-center gap-2">
                          <Avatar className="h-7 w-7">
                            <AvatarImage
                              src={resolveEmployeeAvatarSrc(c.authorAvatarUrl)}
                              alt=""
                            />
                            <AvatarFallback className="bg-[#272156] text-[10px] text-white">
                              {c.authorName.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">
                              {c.authorName}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {formatTimestamp(c.createdAt)}
                            </p>
                          </div>
                        </div>
                        <p className="mt-2 text-sm whitespace-pre-wrap">
                          {c.body}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
                <form
                  className="flex items-start gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const body = commentDraft.trim();
                    if (!body) return;
                    commentMutation.mutate(body);
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <Input
                      value={commentDraft}
                      onChange={(e) => setCommentDraft(e.target.value)}
                      placeholder="Write a comment…"
                      maxLength={2000}
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={
                      !commentDraft.trim() || commentMutation.isPending
                    }
                    className="shrink-0 bg-[#272156] text-white hover:bg-[#272156]/90"
                  >
                    Add
                  </Button>
                </form>
              </div>
            ) : null}

            {tab === "attachments" ? (
              <div className="rounded-xl border border-dashed border-border px-4 py-12 text-center">
                <Paperclip className="mx-auto h-8 w-8 text-muted-foreground/50" />
                <p className="mt-3 text-sm font-medium text-[#272156] dark:text-foreground">
                  No attachment has been added…
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  File upload for leave requests will arrive in a later update.
                </p>
              </div>
            ) : null}

            {tab === "history" ? (
              <div>
                {(detail?.history ?? []).length === 0 ? (
                  <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                    No history events yet.
                  </p>
                ) : (
                  <ol className="relative space-y-0 border-l border-[#31CDFF]/40 pl-4">
                    {(detail?.history ?? []).map((event) => (
                      <li key={event.id} className="relative pb-5 last:pb-0">
                        <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-[#31CDFF] bg-background" />
                        <div className="flex items-start gap-2.5">
                          <Avatar className="h-7 w-7">
                            <AvatarImage
                              src={resolveEmployeeAvatarSrc(
                                event.actorAvatarUrl
                              )}
                              alt=""
                            />
                            <AvatarFallback className="bg-[#272156] text-[10px] text-white">
                              {(event.actorName || "?").slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-[#272156] dark:text-foreground">
                              {event.label}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {event.actorName ? `${event.actorName} · ` : ""}
                              {formatTimestamp(event.at)}
                            </p>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            ) : null}
          </div>

          <footer className="border-t border-border/70 px-4 py-2 text-[11px] text-muted-foreground">
            Requested {formatRequestedShort(display.days)} ·{" "}
            {formatAbsencePeriod(display.startDate, display.endDate)}
          </footer>
        </div>
      </aside>
    </div>
  );
}
