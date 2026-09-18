"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow, isToday, isYesterday } from "date-fns";
import {
  AlertCircle,
  AlertTriangle,
  ExternalLink,
  Inbox,
  Loader2,
  Mail,
  Menu,
  RefreshCw,
  RotateCcw,
  Send,
  Star,
  X,
} from "lucide-react";
import { toast } from "react-hot-toast";

import { adminApi } from "@/lib/api-backend";
import { candidateEmailApi } from "@/components/admin/utils/candidate-email-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { ListRowSkeleton } from "@/components/ui/skeleton";
import type {
  CommunicationEmail,
  CommunicationEmailType,
  CommunicationFolder,
} from "@/types/communication-email";
import type { InboxConversation } from "@/types/application-email";
import { EmailHtmlPreview } from "@/components/admin/communications/EmailHtmlPreview";

const TYPE_LABELS: Record<string, string> = {
  candidate: "Candidate",
  request_application: "Request application",
  broadcast: "Broadcast",
  mention: "Mention",
  hiring_team: "Hiring team",
  generic: "System",
  system: "System",
};

const FOLDERS: {
  id: CommunicationFolder;
  label: string;
  icon: typeof Inbox;
}[] = [
  { id: "inbox", label: "Inbox", icon: Inbox },
  { id: "starred", label: "Starred", icon: Star },
  { id: "sent", label: "Sent", icon: Send },
  { id: "failed", label: "Failed", icon: AlertTriangle },
  { id: "all", label: "All Mail", icon: Mail },
];

function typeLabel(type: CommunicationEmailType): string {
  return TYPE_LABELS[type] || String(type).replace(/_/g, " ");
}

function formatListDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  if (isToday(date)) return format(date, "h:mm a");
  if (isYesterday(date)) return "Yesterday";
  if (date.getFullYear() === new Date().getFullYear()) {
    return format(date, "MMM d");
  }
  return format(date, "MMM d, yyyy");
}

function formatDetailDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${format(date, "MMM d, yyyy · h:mm a")} (${formatDistanceToNow(date, {
    addSuffix: true,
  })})`;
}

function statusBadge(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === "failed") {
    return (
      <Badge variant="destructive" className="font-normal">
        Failed
      </Badge>
    );
  }
  if (normalized === "pending") {
    return (
      <Badge variant="secondary" className="font-normal">
        Pending
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="border-emerald-500/40 bg-emerald-500/10 font-normal text-emerald-700 dark:text-emerald-400"
    >
      Sent
    </Badge>
  );
}

function extractJobIdFromHtml(html?: string | null): string | null {
  if (!html) return null;
  const match = html.match(
    /\/admin\/jobs\/([a-fA-F0-9]{24})\/(?:pipeline|candidates)/i
  );
  return match?.[1] ?? null;
}

function resolveJobId(email: CommunicationEmail): string | null {
  return email.jobId || extractJobIdFromHtml(email.htmlBody) || null;
}

function candidateHref(email: CommunicationEmail) {
  if (!email.applicationId) return null;
  const jobId = resolveJobId(email);
  return jobId
    ? `/admin/jobs/${jobId}/candidates/${email.applicationId}`
    : `/admin/candidates?highlight=${email.applicationId}`;
}

function pipelineHref(email: CommunicationEmail): string | null {
  const jobId = resolveJobId(email);
  if (!jobId) return null;
  return `/admin/jobs/${jobId}/pipeline`;
}

function jobActionLabel(email: CommunicationEmail): string {
  if (email.type === "hiring_team") return "Open Pipeline";
  if (email.applicationId) return "View Candidate";
  return "Open Job";
}

function conversationHref(conversation: InboxConversation) {
  return conversation.jobId
    ? `/admin/jobs/${conversation.jobId}/candidates/${conversation.applicationId}?tab=email`
    : `/admin/inbox`;
}

function EmailsEmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
      <Mail className="h-10 w-10 text-muted-foreground/50" />
      <div className="space-y-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

export function CommunicationManager({ searchQuery }: { searchQuery: string }) {
  const queryClient = useQueryClient();
  const [folder, setFolder] = useState<CommunicationFolder>("inbox");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedEmail, setSelectedEmail] = useState<CommunicationEmail | null>(
    null
  );
  const [folderNavOpen, setFolderNavOpen] = useState(false);
  const pageSize = 50;

  const isInbox = folder === "inbox";
  const statusParam =
    folder === "sent" || folder === "failed" ? folder : undefined;
  const starredParam = folder === "starred" ? true : undefined;
  const typeParam = typeFilter === "all" ? undefined : typeFilter;

  const emailsQuery = useQuery({
    queryKey: [
      "admin-communications-emails",
      folder,
      statusParam,
      starredParam,
      typeParam,
      searchQuery,
      page,
    ],
    queryFn: () =>
      adminApi.getCommunicationEmails({
        skip: page * pageSize,
        limit: pageSize,
        status: statusParam,
        type: typeParam,
        q: searchQuery.trim() || undefined,
        starred: starredParam,
      }),
    enabled: !isInbox,
    staleTime: 15_000,
  });

  const inboxQuery = useQuery({
    queryKey: ["admin-communications-inbox"],
    queryFn: () => candidateEmailApi.listInboxConversations(50),
    staleTime: 15_000,
  });

  const countsQuery = useQuery({
    queryKey: ["admin-communications-counts"],
    queryFn: () => adminApi.getCommunicationEmailCounts(),
    staleTime: 30_000,
  });

  const resendMutation = useMutation({
    mutationFn: (emailId: string) => adminApi.resendCommunicationEmail(emailId),
    onSuccess: () => {
      toast.success("Email resent");
      queryClient.invalidateQueries({
        queryKey: ["admin-communications-emails"],
      });
      queryClient.invalidateQueries({
        queryKey: ["admin-communications-counts"],
      });
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error ? error.message : "Failed to resend email";
      toast.error(message);
    },
  });

  const starMutation = useMutation({
    mutationFn: ({
      emailId,
      starred,
    }: {
      emailId: string;
      starred: boolean;
    }) => adminApi.starCommunicationEmail(emailId, starred),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({
        queryKey: ["admin-communications-emails"],
      });
      queryClient.invalidateQueries({
        queryKey: ["admin-communications-counts"],
      });
      setSelectedEmail((current) =>
        current && current.id === updated.id
          ? { ...current, starred: updated.starred }
          : current
      );
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error ? error.message : "Failed to update star";
      toast.error(message);
    },
  });

  const emails = emailsQuery.data?.emails ?? [];
  const total = emailsQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const counts = countsQuery.data;

  const conversations = useMemo(() => {
    const items = inboxQuery.data?.conversations ?? [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return items;
    return items.filter((c) => {
      const haystack = [
        c.candidateName,
        c.candidateEmail,
        c.position,
        c.lastMessage?.subject,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [inboxQuery.data?.conversations, searchQuery]);

  const folderCounts: Record<CommunicationFolder, number | undefined> = {
    inbox: inboxQuery.data?.conversations?.length,
    starred: counts?.starred,
    sent: counts?.sent,
    failed: counts?.failed,
    all: counts?.all,
  };

  const emptyCopy: Record<
    CommunicationFolder,
    { title: string; description: string }
  > = {
    inbox: {
      title: "No conversations",
      description:
        "Candidate email threads appear here. Open the full Inbox to reply.",
    },
    starred: {
      title: "No starred emails",
      description: "Star messages from the list to keep them here.",
    },
    sent: {
      title: "No sent emails",
      description: "Successfully delivered emails show up in this folder.",
    },
    failed: {
      title: "No failed emails",
      description: "Delivery failures land here so you can investigate and resend.",
    },
    all: {
      title: "No emails yet",
      description: "Outbound platform emails appear here once messages are sent.",
    },
  };

  function selectFolder(next: CommunicationFolder) {
    setFolder(next);
    setPage(0);
    setSelectedEmail(null);
    setSelectedIds(new Set());
    setFolderNavOpen(false);
  }

  function toggleSelected(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleSelectAll(checked: boolean) {
    if (!checked) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(emails.map((e) => e.id)));
  }

  const folderNav = (
    <nav
      className="flex flex-col gap-0.5 p-2"
      aria-label="Mail folders"
      data-tour="communications-folders"
    >
      {FOLDERS.map((item) => {
        const Icon = item.icon;
        const active = folder === item.id;
        const count = folderCounts[item.id];
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => selectFolder(item.id)}
            className={cn(
              "flex w-full items-center gap-3 rounded-r-full px-3 py-2 text-left text-sm transition-colors",
              active
                ? "bg-primary/15 font-bold text-primary"
                : "font-medium text-foreground/80 hover:bg-muted/70"
            )}
          >
            <Icon
              className={cn(
                "h-4 w-4 shrink-0",
                active ? "text-primary" : "text-muted-foreground",
                item.id === "starred" && active && "fill-primary"
              )}
            />
            <span className="flex-1 truncate">{item.label}</span>
            {typeof count === "number" && count > 0 ? (
              <span
                className={cn(
                  "tabular-nums text-xs",
                  active
                    ? "font-semibold text-primary"
                    : "text-muted-foreground"
                )}
              >
                {count}
              </span>
            ) : null}
          </button>
        );
      })}
      <div className="mt-3 border-t px-3 pt-3">
        <Button asChild variant="ghost" size="sm" className="h-8 w-full justify-start px-0">
          <Link href="/admin/inbox">
            <Inbox className="mr-2 h-4 w-4" />
            Open full Inbox
          </Link>
        </Button>
      </div>
    </nav>
  );

  return (
    <div className="relative flex min-h-0 flex-1 overflow-hidden rounded-lg border bg-card">
      {/* Desktop folder rail */}
      <aside className="hidden w-52 shrink-0 border-r bg-muted/20 md:block lg:w-56">
        {folderNav}
      </aside>

      {/* Mobile folder drawer */}
      {folderNavOpen ? (
        <div className="absolute inset-0 z-20 flex md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/30"
            aria-label="Close folders"
            onClick={() => setFolderNavOpen(false)}
          />
          <aside className="relative z-10 h-full w-64 border-r bg-card shadow-lg">
            <div className="flex items-center justify-between border-b px-3 py-2">
              <span className="text-sm font-semibold">Folders</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setFolderNavOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            {folderNav}
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Toolbar */}
        <div
          className="flex flex-wrap items-center gap-2 border-b px-3 py-2"
          data-tour="communications-toolbar"
        >
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 md:hidden"
            onClick={() => setFolderNavOpen(true)}
            aria-label="Open folders"
          >
            <Menu className="h-4 w-4" />
          </Button>
          <span className="text-sm font-semibold md:hidden">
            {FOLDERS.find((f) => f.id === folder)?.label}
          </span>
          <div className="ml-auto flex items-center gap-2">
            {!isInbox ? (
              <Select
                value={typeFilter}
                onValueChange={(value) => {
                  setTypeFilter(value);
                  setPage(0);
                }}
              >
                <SelectTrigger className="h-8 w-[160px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="candidate">Candidate</SelectItem>
                  <SelectItem value="request_application">
                    Request application
                  </SelectItem>
                  <SelectItem value="broadcast">Broadcast</SelectItem>
                  <SelectItem value="mention">Mention</SelectItem>
                  <SelectItem value="hiring_team">Hiring team</SelectItem>
                  <SelectItem value="generic">System</SelectItem>
                </SelectContent>
              </Select>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => {
                if (isInbox) inboxQuery.refetch();
                else emailsQuery.refetch();
                countsQuery.refetch();
              }}
              disabled={
                isInbox ? inboxQuery.isFetching : emailsQuery.isFetching
              }
              aria-label="Refresh"
            >
              <RefreshCw
                className={cn(
                  "h-4 w-4",
                  (isInbox ? inboxQuery.isFetching : emailsQuery.isFetching) &&
                    "animate-spin"
                )}
              />
            </Button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1">
          {/* List */}
          <div
            className={cn(
              "min-w-0 flex-1 overflow-auto",
              selectedEmail && !isInbox && "hidden lg:block lg:border-r"
            )}
            data-tour="communications-list"
          >
            {isInbox ? (
              <InboxList
                conversations={conversations}
                isLoading={inboxQuery.isLoading}
                isError={inboxQuery.isError}
                empty={emptyCopy.inbox}
              />
            ) : (
              <EmailList
                emails={emails}
                isLoading={emailsQuery.isLoading}
                isError={emailsQuery.isError}
                empty={emptyCopy[folder]}
                selectedIds={selectedIds}
                selectedEmailId={selectedEmail?.id ?? null}
                onToggleSelected={toggleSelected}
                onToggleSelectAll={toggleSelectAll}
                onSelectEmail={setSelectedEmail}
                onToggleStar={(email, starred) =>
                  starMutation.mutate({ emailId: email.id, starred })
                }
                starringId={
                  starMutation.isPending ? starMutation.variables?.emailId : null
                }
              />
            )}

            {!isInbox && total > pageSize ? (
              <div className="flex items-center justify-between border-t px-3 py-2 text-xs text-muted-foreground">
                <span>
                  {page * pageSize + 1}–
                  {Math.min((page + 1) * pageSize, total)} of {total}
                </span>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7"
                    disabled={page === 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7"
                    disabled={page + 1 >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            ) : null}
          </div>

          {/* Detail pane */}
          {selectedEmail && !isInbox ? (
            <EmailDetailPane
              email={selectedEmail}
              onClose={() => setSelectedEmail(null)}
              onResend={(id) => resendMutation.mutate(id)}
              resending={
                resendMutation.isPending &&
                resendMutation.variables === selectedEmail.id
              }
              onToggleStar={(starred) =>
                starMutation.mutate({
                  emailId: selectedEmail.id,
                  starred,
                })
              }
              starring={
                starMutation.isPending &&
                starMutation.variables?.emailId === selectedEmail.id
              }
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function EmailList({
  emails,
  isLoading,
  isError,
  empty,
  selectedIds,
  selectedEmailId,
  onToggleSelected,
  onToggleSelectAll,
  onSelectEmail,
  onToggleStar,
  starringId,
}: {
  emails: CommunicationEmail[];
  isLoading: boolean;
  isError: boolean;
  empty: { title: string; description: string };
  selectedIds: Set<string>;
  selectedEmailId: string | null;
  onToggleSelected: (id: string, checked: boolean) => void;
  onToggleSelectAll: (checked: boolean) => void;
  onSelectEmail: (email: CommunicationEmail) => void;
  onToggleStar: (email: CommunicationEmail, starred: boolean) => void;
  starringId: string | null | undefined;
}) {
  if (isLoading) {
    return <ListRowSkeleton rows={8} />;
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="text-sm font-medium">Could not load emails</p>
        <p className="text-sm text-muted-foreground">
          Restart the backend if you just pulled these changes, then refresh.
        </p>
      </div>
    );
  }

  if (!emails.length) {
    return (
      <EmailsEmptyState title={empty.title} description={empty.description} />
    );
  }

  const allSelected =
    emails.length > 0 && emails.every((e) => selectedIds.has(e.id));

  return (
    <div>
      <div className="flex items-center gap-3 border-b px-3 py-1.5">
        <Checkbox
          checked={allSelected}
          onCheckedChange={(value) => onToggleSelectAll(value === true)}
          aria-label="Select all"
        />
        <span className="text-xs text-muted-foreground">
          {selectedIds.size > 0 ? `${selectedIds.size} selected` : "Select"}
        </span>
      </div>
      <ul className="divide-y">
        {emails.map((email) => {
          const isSelected = selectedEmailId === email.id;
          const isFailed = email.status?.toLowerCase() === "failed";
          return (
            <li key={`${email.source}-${email.id}`}>
              <div
                className={cn(
                  "group flex cursor-pointer items-center gap-2 px-3 py-2.5 transition-colors hover:bg-muted/50",
                  isSelected && "bg-primary/5",
                  isFailed && "bg-destructive/[0.03]"
                )}
                onClick={() => onSelectEmail(email)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectEmail(email);
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <div
                  className="flex shrink-0 items-center gap-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Checkbox
                    checked={selectedIds.has(email.id)}
                    onCheckedChange={(value) =>
                      onToggleSelected(email.id, value === true)
                    }
                    aria-label={`Select ${email.subject || "email"}`}
                  />
                  <button
                    type="button"
                    className="rounded p-1 text-muted-foreground hover:text-amber-500"
                    aria-label={email.starred ? "Unstar" : "Star"}
                    disabled={starringId === email.id}
                    onClick={() => onToggleStar(email, !email.starred)}
                  >
                    <Star
                      className={cn(
                        "h-4 w-4",
                        email.starred && "fill-amber-400 text-amber-500"
                      )}
                    />
                  </button>
                </div>

                <div className="w-[140px] shrink-0 truncate text-sm font-medium sm:w-[180px]">
                  {email.to || "—"}
                </div>

                <div className="min-w-0 flex-1 truncate text-sm">
                  <span className="font-medium">
                    {email.subject || "(no subject)"}
                  </span>
                  {email.snippet ? (
                    <span className="text-muted-foreground">
                      {" — "}
                      {email.snippet}
                    </span>
                  ) : null}
                </div>

                <div className="hidden shrink-0 sm:block">
                  {statusBadge(email.status)}
                </div>

                <div className="w-[72px] shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                  {formatListDate(email.sentAt)}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function InboxList({
  conversations,
  isLoading,
  isError,
  empty,
}: {
  conversations: InboxConversation[];
  isLoading: boolean;
  isError: boolean;
  empty: { title: string; description: string };
}) {
  if (isLoading) {
    return <ListRowSkeleton rows={8} />;
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="text-sm font-medium">Could not load inbox conversations</p>
      </div>
    );
  }

  if (!conversations.length) {
    return (
      <EmailsEmptyState title={empty.title} description={empty.description} />
    );
  }

  return (
    <ul className="divide-y">
      {conversations.map((conversation) => (
        <li key={conversation.applicationId}>
          <Link
            href={conversationHref(conversation)}
            className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-muted/50"
          >
            <div className="w-[140px] shrink-0 truncate text-sm font-medium sm:w-[180px]">
              {conversation.candidateName}
            </div>
            <div className="min-w-0 flex-1 truncate text-sm">
              <span className="font-medium">
                {conversation.lastMessage?.subject || "No subject"}
              </span>
              <span className="text-muted-foreground">
                {" — "}
                {conversation.candidateEmail}
                {conversation.position ? ` · ${conversation.position}` : ""}
                {" · "}
                {conversation.messageCount}{" "}
                {conversation.messageCount === 1 ? "message" : "messages"}
              </span>
            </div>
            <div className="w-[72px] shrink-0 text-right text-xs text-muted-foreground">
              {formatListDate(conversation.lastMessage?.sentAt)}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function EmailDetailPane({
  email,
  onClose,
  onResend,
  resending,
  onToggleStar,
  starring,
}: {
  email: CommunicationEmail;
  onClose: () => void;
  onResend: (id: string) => void;
  resending: boolean;
  onToggleStar: (starred: boolean) => void;
  starring: boolean;
}) {
  const candidateLink = candidateHref(email);
  const pipelineLink = pipelineHref(email);
  const isHiringTeam = email.type === "hiring_team";
  const jobLink = isHiringTeam
    ? pipelineLink
    : candidateLink || pipelineLink;
  const jobLabel = isHiringTeam
    ? "Open Pipeline"
    : candidateLink
      ? "View Candidate"
      : jobActionLabel(email);

  return (
    <div className="flex w-full flex-col bg-background lg:w-[460px] xl:w-[540px]">
      <div className="flex items-start justify-between gap-2 border-b px-4 py-3">
        <div className="min-w-0 space-y-1">
          <h2 className="text-base font-semibold leading-snug">
            {email.subject || "(no subject)"}
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            {statusBadge(email.status)}
            <Badge variant="secondary" className="font-normal">
              {typeLabel(email.type)}
            </Badge>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            disabled={starring}
            onClick={() => onToggleStar(!email.starred)}
            aria-label={email.starred ? "Unstar" : "Star"}
          >
            <Star
              className={cn(
                "h-4 w-4",
                email.starred && "fill-amber-400 text-amber-500"
              )}
            />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-auto px-4 py-4">
        <dl className="space-y-2 text-sm">
          <div className="flex gap-2">
            <dt className="w-16 shrink-0 text-muted-foreground">To</dt>
            <dd className="min-w-0 break-all font-medium">{email.to || "—"}</dd>
          </div>
          {email.sentByName ? (
            <div className="flex gap-2">
              <dt className="w-16 shrink-0 text-muted-foreground">From</dt>
              <dd>{email.sentByName}</dd>
            </div>
          ) : null}
          <div className="flex gap-2">
            <dt className="w-16 shrink-0 text-muted-foreground">Date</dt>
            <dd>{formatDetailDate(email.sentAt)}</dd>
          </div>
          {(email.candidateName || candidateLink) && (
            <div className="flex gap-2">
              <dt className="w-16 shrink-0 text-muted-foreground">Related</dt>
              <dd>
                {candidateLink ? (
                  <Link
                    href={candidateLink}
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    {email.candidateName || "View candidate"}
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                ) : (
                  email.candidateName
                )}
                {email.position ? (
                  <span className="text-muted-foreground">
                    {" "}
                    · {email.position}
                  </span>
                ) : null}
              </dd>
            </div>
          )}
        </dl>

        {email.error ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {email.error}
          </div>
        ) : null}

        {jobLink ? (
          <Button asChild className="w-full sm:w-auto">
            <Link href={jobLink}>
              {jobLabel}
              <ExternalLink className="ml-2 h-3.5 w-3.5" />
            </Link>
          </Button>
        ) : null}

        <EmailHtmlPreview htmlBody={email.htmlBody} plainBody={email.body} />
      </div>

      {email.canResend ? (
        <div className="border-t px-4 py-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={resending}
            onClick={() => onResend(email.id)}
          >
            {resending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RotateCcw className="mr-2 h-3.5 w-3.5" />
            )}
            Resend
          </Button>
        </div>
      ) : null}
    </div>
  );
}
