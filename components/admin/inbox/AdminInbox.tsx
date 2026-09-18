"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ExternalLink, Inbox, Mail, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FailedStatusState } from "@/components/ui/failed-status-state";
import { InboxSplitSkeleton, Skeleton } from "@/components/ui/skeleton";
import { candidateEmailApi } from "@/components/admin/utils/candidate-email-api";
import { InboxEmptyState } from "@/components/admin/inbox/InboxEmptyState";
import type {
  ApplicationEmailMessage,
  InboxConversation,
} from "@/types/application-email";
import { cn } from "@/lib/utils";

function formatSentAt(value: string): string {
  try {
    return format(parseISO(value), "MMM d, yyyy · h:mm a");
  } catch {
    return value || "—";
  }
}

function formatListTime(value: string): string {
  try {
    const date = parseISO(value);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) {
      return format(date, "h:mm a");
    }
    return format(date, "MMM d");
  } catch {
    return "";
  }
}

function candidateProfileHref(conversation: InboxConversation): string | null {
  if (!conversation.jobId) return null;
  return `/manage/jobs/${conversation.jobId}/candidates/${conversation.applicationId}?tab=email`;
}

function MessageCard({ message }: { message: ApplicationEmailMessage }) {
  const isFailed = message.status === "failed";

  return (
    <article
      className={cn(
        "rounded-lg border border-[#272055]/10 bg-white p-4",
        isFailed && "border-red-200 bg-red-50/40"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[#272055]">
            {message.subject || "(No subject)"}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            To {message.to}
            {message.sentByName ? ` · from ${message.sentByName}` : ""}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs text-muted-foreground">
            {formatSentAt(message.sentAt)}
          </p>
          {isFailed ? (
            <p className="mt-0.5 text-xs font-medium text-red-600">Failed</p>
          ) : (
            <p className="mt-0.5 text-xs font-medium text-emerald-600">Sent</p>
          )}
        </div>
      </div>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
        {message.body}
      </p>
      {isFailed && message.error ? (
        <p className="mt-2 text-xs text-red-600">{message.error}</p>
      ) : null}
    </article>
  );
}

export function AdminInbox() {
  const [conversations, setConversations] = useState<InboxConversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ApplicationEmailMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);

  const loadConversations = useCallback(async () => {
    try {
      setIsLoading(true);
      setLoadError(null);
      const response = await candidateEmailApi.listInboxConversations(50);
      const next = response.conversations || [];
      setConversations(next);
      setSelectedId((current) => {
        if (current && next.some((item) => item.applicationId === current)) {
          return current;
        }
        return next[0]?.applicationId ?? null;
      });
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Failed to load inbox"
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  const selected = useMemo(
    () =>
      conversations.find((item) => item.applicationId === selectedId) ?? null,
    [conversations, selectedId]
  );

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      setMessagesError(null);
      return;
    }

    let cancelled = false;

    const loadMessages = async () => {
      try {
        setIsLoadingMessages(true);
        setMessagesError(null);
        const response = await candidateEmailApi.listMessages(selectedId);
        if (!cancelled) {
          setMessages(response.messages || []);
        }
      } catch (error) {
        if (!cancelled) {
          setMessagesError(
            error instanceof Error ? error.message : "Failed to load messages"
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoadingMessages(false);
        }
      }
    };

    void loadMessages();
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  if (isLoading) {
    return <InboxSplitSkeleton />;
  }

  if (loadError) {
    return (
      <div className="space-y-3 py-12">
        <FailedStatusState message={loadError} />
        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void loadConversations()}
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div
        className="flex min-h-[calc(100vh-12rem)] w-full flex-1 flex-col rounded-xl border border-[#272055]/08 bg-[#f8f9fb]"
        data-tour="inbox-empty"
      >
        <InboxEmptyState />
      </div>
    );
  }

  const profileHref = selected ? candidateProfileHref(selected) : null;

  return (
    <div className="flex min-h-[calc(100vh-12rem)] w-full flex-1 overflow-hidden rounded-xl border border-[#272055]/10 bg-white">
      <aside
        className="flex w-full max-w-sm flex-col border-r border-[#272055]/10 bg-[#f8f9fb] md:w-[22rem]"
        data-tour="inbox-list"
      >
        <div className="flex items-center gap-2 border-b border-[#272055]/10 px-4 py-3">
          <Inbox className="h-4 w-4 text-[#272055]/60" aria-hidden />
          <h2 className="text-sm font-semibold text-[#272055]">Conversations</h2>
          <span className="ml-auto text-xs text-muted-foreground">
            {conversations.length}
          </span>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {conversations.map((conversation) => {
            const isActive = conversation.applicationId === selectedId;
            const preview =
              conversation.lastMessage.subject ||
              conversation.lastMessage.body ||
              "Email";

            return (
              <button
                key={conversation.applicationId}
                type="button"
                onClick={() => setSelectedId(conversation.applicationId)}
                className={cn(
                  "flex w-full flex-col gap-1 border-b border-[#272055]/06 px-4 py-3 text-left transition-colors",
                  isActive
                    ? "bg-white shadow-[inset_3px_0_0_0_#31CDFF]"
                    : "hover:bg-white/70"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate text-sm font-semibold text-[#272055]">
                    {conversation.candidateName}
                  </p>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {formatListTime(conversation.lastMessage.sentAt)}
                  </span>
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {conversation.position || conversation.candidateEmail || "—"}
                </p>
                <div className="flex items-center gap-1.5">
                  <Mail className="h-3 w-3 shrink-0 text-[#272055]/35" />
                  <p className="truncate text-xs text-[#272055]/75">{preview}</p>
                  {conversation.messageCount > 1 ? (
                    <span className="ml-auto shrink-0 rounded-full bg-[#272055]/08 px-1.5 py-0.5 text-[10px] font-medium text-[#272055]">
                      {conversation.messageCount}
                    </span>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col" data-tour="inbox-thread">
        {selected ? (
          <>
            <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[#272055]/10 px-5 py-4">
              <div className="min-w-0">
                <h3 className="truncate text-base font-semibold text-[#272055]">
                  {selected.candidateName}
                </h3>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {[selected.candidateEmail, selected.position]
                    .filter(Boolean)
                    .join(" · ") || "Candidate"}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-[#272055]/20"
                  disabled
                  title="SMS delivery is not configured"
                >
                  <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
                  SMS unavailable
                </Button>
                {profileHref ? (
                  <Button
                    type="button"
                    size="sm"
                    className="bg-[#31CDFF] text-white hover:bg-[#31CDFF]/90"
                    asChild
                  >
                    <Link href={profileHref}>
                      <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                      Open profile
                    </Link>
                  </Button>
                ) : null}
              </div>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {isLoadingMessages ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div
                      key={i}
                      className="space-y-2 rounded-lg border border-border/60 p-4"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <Skeleton className="h-3.5 w-32" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-[70%]" />
                    </div>
                  ))}
                </div>
              ) : messagesError ? (
                <FailedStatusState message={messagesError} />
              ) : messages.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">
                  No messages in this conversation.
                </p>
              ) : (
                <div className="space-y-3">
                  {messages.map((message) => (
                    <MessageCard key={message.id} message={message} />
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            Select a conversation
          </div>
        )}
      </section>
    </div>
  );
}
