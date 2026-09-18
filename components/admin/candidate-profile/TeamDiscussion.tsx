"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { format, isSameDay, parseISO } from "date-fns";
import { useReducedMotion } from "framer-motion";
import {
  Loader2,
  MessageSquare,
  Pencil,
  Reply,
  Search,
  Smile,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { GenerateButton } from "@/components/ui/generate-button";
import { GlowBorderCard } from "@/components/ui/glow-border-card";
import { Textarea } from "@/components/ui/textarea";
import { FailedStatusState } from "@/components/ui/failed-status-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useAiStatus } from "@/contexts/AiStatusContext";
import { useBqiIntelligence } from "@/contexts/BqiIntelligenceContext";
import { adminApi } from "@/lib/api-backend";
import { discussionApi } from "@/components/admin/utils/discussion-api";
import { cn } from "@/lib/utils";
import { getCandidateInitials } from "./application-helpers";
import type {
  ApplicationComment,
  CommentMention,
  TeamMember,
} from "@/types/application-comment";
import { toast } from "react-hot-toast";

/** Portaled mention list — Dialog RemoveScroll disables body siblings without this. */
export const MENTION_LIST_ATTR = "data-team-mention-list";

/** Violet → BQI cyan — same palette as ranking / column glow */
const BQI_SUMMARIZE_GLOW_COLORS = [
  "#1a1540",
  "#272055",
  "#5b4b9a",
  "#8b5cf6",
  "#c4b5fd",
  "#31CDFF",
  "#7ddfff",
  "#a78bfa",
  "#5b4b9a",
  "#272055",
];

/** Halo around the discussion panel while summarize runs; unmounts when idle. */
function DiscussionSummarizeGlow({
  active,
  paused,
  className,
  children,
}: {
  active: boolean;
  paused: boolean;
  className?: string;
  children: ReactNode;
}) {
  if (!active) {
    return (
      <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
        {children}
      </div>
    );
  }

  return (
    <GlowBorderCard
      fill
      width="100%"
      height="100%"
      borderRadius="0.75rem"
      animationDuration={3}
      gradientColors={BQI_SUMMARIZE_GLOW_COLORS}
      borderWidth="10px"
      blurAmount="14px"
      inset="0"
      paused={paused}
      className={cn(
        "relative z-0 min-h-0 flex-1 bg-transparent shadow-none",
        className
      )}
      contentClassName="relative z-0 min-h-0 flex-1 overflow-hidden"
    >
      {children}
    </GlowBorderCard>
  );
}

/**
 * Mention format:
 * - Body inserts `@Display Name` (display name from team member).
 * - Structured `mentions: [{ userId, email, name }]` is sent with the comment
 *   and is what the backend uses to email / notify teammates.
 */

interface TeamDiscussionProps {
  applicationId: string;
  jobId: string;
  candidateName: string;
}

interface CommentNode extends ApplicationComment {
  replies: CommentNode[];
}

export interface MentionComposerHandle {
  insertText: (text: string) => void;
  focus: () => void;
}

const COMPOSER_PLACEHOLDER =
  "Share a message with your team here. You can use @-mentions to notify individual team members. * Remember not to include sensitive information.";

const EMOJI_SET = [
  "👍",
  "👎",
  "✅",
  "❌",
  "🎉",
  "🙌",
  "👏",
  "🔥",
  "💡",
  "👀",
  "🤔",
  "😊",
  "😂",
  "🙏",
  "💪",
  "⭐",
  "❤️",
  "🚀",
  "📌",
  "⚠️",
  "📝",
  "🤝",
  "💯",
  "✨",
] as const;

function memberDisplayName(member: TeamMember): string {
  return member.name.trim() || member.email.split("@")[0];
}

function collectDescendantIds(
  comments: ApplicationComment[],
  rootId: string
): Set<string> {
  const ids = new Set<string>([rootId]);
  let added = true;

  while (added) {
    added = false;
    for (const comment of comments) {
      if (comment.parentId && ids.has(comment.parentId) && !ids.has(comment.id)) {
        ids.add(comment.id);
        added = true;
      }
    }
  }

  return ids;
}

function buildCommentTree(comments: ApplicationComment[]): CommentNode[] {
  const nodes = new Map<string, CommentNode>();
  const roots: CommentNode[] = [];

  for (const comment of comments) {
    nodes.set(comment.id, { ...comment, replies: [] });
  }

  for (const comment of comments) {
    const node = nodes.get(comment.id);
    if (!node) continue;

    if (comment.parentId && nodes.has(comment.parentId)) {
      nodes.get(comment.parentId)!.replies.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

const MENTION_HIGHLIGHT_CLASS =
  "rounded-sm bg-[#31CDFF]/15 px-0.5 font-medium text-[#31CDFF]";

const INLINE_MENTION_PATTERN =
  /^@[A-Za-z0-9][A-Za-z0-9._-]*(?:\s+[A-Za-z0-9][A-Za-z0-9._-]*)*$/;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildMentionTokens(mentions: CommentMention[]): string[] {
  return [
    ...new Set(
      mentions.flatMap((mention) => {
        const tokens: string[] = [];
        if (mention.name.trim()) tokens.push(`@${mention.name.trim()}`);
        if (mention.email.trim()) {
          tokens.push(`@${mention.email.trim()}`);
          const localPart = mention.email.split("@")[0]?.trim();
          if (localPart) tokens.push(`@${localPart}`);
        }
        return tokens;
      })
    ),
  ].sort((a, b) => b.length - a.length);
}

function isMentionSegment(part: string, knownTokens: string[]): boolean {
  if (!part.startsWith("@")) return false;
  return knownTokens.includes(part) || INLINE_MENTION_PATTERN.test(part);
}

function renderCommentBody(body: string, mentions: CommentMention[]) {
  const knownTokens = buildMentionTokens(mentions);
  const patterns = [
    ...knownTokens.map(escapeRegExp),
    "@[A-Za-z0-9][A-Za-z0-9._-]*(?:\\s+[A-Za-z0-9][A-Za-z0-9._-]*)*",
  ];

  const pattern = new RegExp(`(${patterns.join("|")})`, "g");
  const parts = body.split(pattern);

  return (
    <span className="whitespace-pre-wrap break-words">
      {parts.map((part, index) => {
        if (!part) return null;
        if (isMentionSegment(part, knownTokens)) {
          return (
            <span key={`${part}-${index}`} className={MENTION_HIGHLIGHT_CLASS}>
              {part}
            </span>
          );
        }
        return <span key={`${part}-${index}`}>{part}</span>;
      })}
    </span>
  );
}

const MentionComposer = forwardRef<
  MentionComposerHandle,
  {
    value: string;
    onChange: (value: string) => void;
    mentions: CommentMention[];
    onMentionsChange: (mentions: CommentMention[]) => void;
    teamMembers: TeamMember[];
    placeholder: string;
    disabled?: boolean;
    minHeightClass?: string;
    autoFocus?: boolean;
    className?: string;
  }
>(function MentionComposer(
  {
    value,
    onChange,
    mentions,
    onMentionsChange,
    teamMembers,
    placeholder,
    disabled,
    minHeightClass = "min-h-[88px]",
    autoFocus,
    className,
  },
  ref
) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const mentionStartRef = useRef<number | null>(null);
  const valueRef = useRef(value);
  const mentionsRef = useRef(mentions);
  const blurCloseTimerRef = useRef<number | null>(null);

  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [menuRect, setMenuRect] = useState<{
    left: number;
    bottom: number;
    width: number;
  } | null>(null);
  const [portalReady, setPortalReady] = useState(false);

  valueRef.current = value;
  mentionsRef.current = mentions;

  useEffect(() => {
    setPortalReady(true);
  }, []);

  const suggestions = useMemo(() => {
    if (mentionQuery === null) return [];
    const query = mentionQuery.toLowerCase().trim();
    const filtered = teamMembers.filter((member) => {
      if (!query) return true;
      const label = memberDisplayName(member).toLowerCase();
      return (
        label.includes(query) || member.email.toLowerCase().includes(query)
      );
    });
    return filtered.slice(0, 20);
  }, [mentionQuery, teamMembers]);

  useEffect(() => {
    if (activeIndex >= suggestions.length) {
      setActiveIndex(0);
    }
  }, [activeIndex, suggestions.length]);

  const syncMenuRect = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea || mentionQuery === null) {
      setMenuRect(null);
      return;
    }
    const rect = textarea.getBoundingClientRect();
    setMenuRect({
      left: rect.left,
      bottom: window.innerHeight - rect.top + 4,
      width: Math.max(rect.width, 280),
    });
  }, [mentionQuery]);

  useLayoutEffect(() => {
    syncMenuRect();
  }, [syncMenuRect, value, suggestions.length]);

  useEffect(() => {
    if (mentionQuery === null) return;
    const onReposition = () => syncMenuRect();
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [mentionQuery, syncMenuRect]);

  const cancelBlurClose = useCallback(() => {
    if (blurCloseTimerRef.current !== null) {
      window.clearTimeout(blurCloseTimerRef.current);
      blurCloseTimerRef.current = null;
    }
  }, []);

  const closeMentions = useCallback(() => {
    cancelBlurClose();
    mentionStartRef.current = null;
    setMentionQuery(null);
    setActiveIndex(0);
    setMenuRect(null);
  }, [cancelBlurClose]);

  const insertText = useCallback(
    (text: string) => {
      const textarea = textareaRef.current;
      if (!textarea) {
        onChange(`${value}${text}`);
        return;
      }

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const nextValue = `${value.slice(0, start)}${text}${value.slice(end)}`;
      onChange(nextValue);

      requestAnimationFrame(() => {
        const cursor = start + text.length;
        textarea.focus();
        textarea.setSelectionRange(cursor, cursor);
      });
    },
    [onChange, value]
  );

  useImperativeHandle(
    ref,
    () => ({
      insertText,
      focus: () => textareaRef.current?.focus(),
    }),
    [insertText]
  );

  const insertMention = useCallback(
    (member: TeamMember) => {
      const mentionStart = mentionStartRef.current;
      const currentValue = valueRef.current;
      const currentMentions = mentionsRef.current;
      if (mentionStart === null) return;

      const label = memberDisplayName(member);
      const textarea = textareaRef.current;
      // Prefer live caret; fall back to end of the @query token if blur reset selection.
      const caret =
        textarea && document.activeElement === textarea
          ? textarea.selectionStart
          : mentionStart + 1 + (mentionQuery?.length ?? 0);
      const queryEnd = Math.max(caret, mentionStart + 1);
      const before = currentValue.slice(0, mentionStart);
      const after = currentValue.slice(queryEnd);
      const nextValue = `${before}@${label} ${after}`;
      onChange(nextValue);

      const mention: CommentMention = {
        userId: member.id,
        email: member.email,
        name: label,
      };
      if (!currentMentions.some((item) => item.userId === mention.userId)) {
        onMentionsChange([...currentMentions, mention]);
      }

      closeMentions();

      requestAnimationFrame(() => {
        const cursor = before.length + label.length + 2;
        textareaRef.current?.focus();
        textareaRef.current?.setSelectionRange(cursor, cursor);
      });
    },
    [closeMentions, mentionQuery, onChange, onMentionsChange]
  );

  const openMentionAt = (start: number, query: string) => {
    mentionStartRef.current = start;
    setMentionQuery(query);
    setActiveIndex(0);
  };

  const handleChange = (nextValue: string) => {
    onChange(nextValue);

    const cursor = textareaRef.current?.selectionStart ?? nextValue.length;
    const prefix = nextValue.slice(0, cursor);
    const match = prefix.match(/(^|\s)@([^\s@]*)$/);

    if (match) {
      openMentionAt(cursor - match[2].length - 1, match[2]);
      return;
    }

    closeMentions();
  };

  const handleMentionNavKey = (
    event: KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>
  ) => {
    if (mentionQuery === null) return false;

    if (event.key === "Escape") {
      event.preventDefault();
      closeMentions();
      requestAnimationFrame(() => textareaRef.current?.focus());
      return true;
    }

    if (!suggestions.length) return false;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % suggestions.length);
      return true;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex(
        (current) => (current - 1 + suggestions.length) % suggestions.length
      );
      return true;
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      insertMention(suggestions[activeIndex] ?? suggestions[0]);
      return true;
    }
    if (event.key === "Tab" && !event.shiftKey && suggestions.length) {
      event.preventDefault();
      insertMention(suggestions[activeIndex] ?? suggestions[0]);
      return true;
    }

    return false;
  };

  const scheduleBlurClose = () => {
    cancelBlurClose();
    blurCloseTimerRef.current = window.setTimeout(() => {
      const active = document.activeElement;
      if (menuRef.current?.contains(active)) return;
      if (active === textareaRef.current) return;
      closeMentions();
    }, 150);
  };

  useEffect(() => {
    if (mentionQuery === null) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (menuRef.current?.contains(target)) return;
      if (textareaRef.current?.contains(target)) return;
      closeMentions();
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [mentionQuery, closeMentions]);

  useEffect(() => {
    return () => cancelBlurClose();
  }, [cancelBlurClose]);

  return (
    <div className="relative">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(event) => handleChange(event.target.value)}
        onKeyDown={(event) => {
          handleMentionNavKey(event);
        }}
        onBlur={scheduleBlurClose}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        className={cn(
          "resize-none border-0 bg-transparent p-3 text-sm shadow-none focus-visible:ring-0",
          minHeightClass,
          className
        )}
      />

      {portalReady && mentionQuery !== null && menuRect
        ? createPortal(
            <div
              ref={menuRef}
              data-team-mention-list=""
              role="listbox"
              aria-label="Mention teammates"
              className="pointer-events-auto fixed z-[10100] flex max-h-64 flex-col overflow-hidden rounded-md border border-[#272055]/10 bg-white shadow-lg"
              style={{
                left: menuRect.left,
                bottom: menuRect.bottom,
                width: menuRect.width,
                // Radix Dialog RemoveScroll sets pointer-events:none on body siblings.
                pointerEvents: "auto",
              }}
              onMouseDown={(event) => {
                // Keep composer focus unless the search field is the target.
                if (event.target === searchInputRef.current) return;
                if (searchInputRef.current?.contains(event.target as Node)) {
                  return;
                }
                event.preventDefault();
              }}
            >
              <div className="shrink-0 border-b border-[#272055]/10 p-2">
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                  />
                  <input
                    ref={searchInputRef}
                    type="search"
                    value={mentionQuery}
                    autoComplete="off"
                    placeholder="Search name or email…"
                    aria-label="Search teammates to mention"
                    className="h-8 w-full rounded-md border border-[#272055]/12 bg-[#f7f8fa] py-1.5 pl-8 pr-2 text-sm text-[#272055] outline-none placeholder:text-muted-foreground focus:border-[#31CDFF]/50 focus:ring-1 focus:ring-[#31CDFF]/40"
                    onFocus={cancelBlurClose}
                    onBlur={scheduleBlurClose}
                    onChange={(event) => {
                      const nextQuery = event.target.value;
                      setMentionQuery(nextQuery);
                      setActiveIndex(0);

                      // Keep the @token in the composer in sync with the search field.
                      const start = mentionStartRef.current;
                      if (start === null) return;
                      const current = valueRef.current;
                      const afterAt = start + 1;
                      const prefix = current.slice(0, afterAt);
                      const restMatch = current
                        .slice(afterAt)
                        .match(/^([^\s@]*)/);
                      const tokenLen = restMatch?.[1]?.length ?? 0;
                      const nextValue = `${prefix}${nextQuery}${current.slice(afterAt + tokenLen)}`;
                      onChange(nextValue);
                      requestAnimationFrame(() => {
                        const cursor = afterAt + nextQuery.length;
                        textareaRef.current?.setSelectionRange(cursor, cursor);
                      });
                    }}
                    onKeyDown={(event) => {
                      if (handleMentionNavKey(event)) return;
                      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                        return;
                      }
                    }}
                  />
                </div>
              </div>

              <ul className="min-h-0 flex-1 overflow-y-auto py-1">
                {suggestions.length === 0 ? (
                  <li className="px-3 py-2 text-sm text-muted-foreground">
                    {teamMembers.length === 0
                      ? "No teammates available to mention"
                      : "No matches"}
                  </li>
                ) : (
                  suggestions.map((member, index) => (
                    <li key={member.id} role="option" aria-selected={index === activeIndex}>
                      <button
                        type="button"
                        className={cn(
                          "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[#31CDFF]/10",
                          index === activeIndex && "bg-[#31CDFF]/10"
                        )}
                        onMouseDown={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          insertMention(member);
                        }}
                        onClick={(event) => {
                          event.preventDefault();
                          insertMention(member);
                        }}
                      >
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="bg-[#272055]/10 text-[10px] text-[#272055]">
                            {getCandidateInitials(memberDisplayName(member))}
                          </AvatarFallback>
                        </Avatar>
                        <span className="min-w-0 flex-1 truncate font-medium text-[#272055]">
                          {memberDisplayName(member)}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {member.email}
                        </span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </div>,
            document.body
          )
        : null}
    </div>
  );
});

function EmojiPickerButton({
  disabled,
  onSelect,
}: {
  disabled?: boolean;
  onSelect: (emoji: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-[#272055]/70 hover:bg-[#272055]/5 hover:text-[#272055]"
          disabled={disabled}
          aria-label="Insert emoji"
          title="Insert emoji"
        >
          <Smile className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="top"
        className="w-[240px] p-2"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <div className="grid grid-cols-6 gap-0.5">
          {EMOJI_SET.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-md text-base hover:bg-[#272055]/8"
              onClick={() => {
                onSelect(emoji);
                setOpen(false);
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function CommentItem({
  comment,
  currentUserId,
  depth,
  onReply,
  onDelete,
  replyingToId,
  editingCommentId,
  editBody,
  editMentions,
  onEditStart,
  onEditBodyChange,
  onEditMentionsChange,
  onEditCancel,
  onEditSave,
  isSubmitting,
  teamMembers,
}: {
  comment: CommentNode;
  currentUserId?: string;
  depth: number;
  onReply: (comment: ApplicationComment) => void;
  onDelete: (comment: ApplicationComment) => void;
  replyingToId: string | null;
  editingCommentId: string | null;
  editBody: string;
  editMentions: CommentMention[];
  onEditStart: (comment: ApplicationComment) => void;
  onEditBodyChange: (value: string) => void;
  onEditMentionsChange: (mentions: CommentMention[]) => void;
  onEditCancel: () => void;
  onEditSave: () => void;
  isSubmitting: boolean;
  teamMembers: TeamMember[];
}) {
  const isOwn = currentUserId === comment.authorId;
  const created = parseISO(comment.createdAt);
  const edited = comment.updatedAt !== comment.createdAt;
  const isEditing = editingCommentId === comment.id;

  if (isEditing) {
    return (
      <div
        className={cn(
          "rounded-lg border border-[#272055]/10 bg-white/80 p-3 backdrop-blur-sm",
          depth > 0 && "ml-6"
        )}
      >
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-[#272055]">Editing comment</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onEditCancel}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="rounded-md border border-[#272055]/10 bg-white">
          <MentionComposer
            value={editBody}
            onChange={onEditBodyChange}
            mentions={editMentions}
            onMentionsChange={onEditMentionsChange}
            teamMembers={teamMembers}
            placeholder="Update your comment..."
            disabled={isSubmitting}
            minHeightClass="min-h-[72px]"
            autoFocus
          />
        </div>
        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onEditCancel}>
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            className="bg-[#2563EB] text-white hover:bg-[#1D4ED8]"
            disabled={isSubmitting || !editBody.trim()}
            onClick={onEditSave}
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <article
      className={cn("group", depth > 0 && "ml-6 border-l-2 border-[#272055]/10 pl-4")}
    >
      <div className="flex gap-3 py-3">
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarFallback className="bg-[#272055]/10 text-xs font-medium text-[#272055]">
            {getCandidateInitials(comment.authorName)}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-sm font-semibold text-[#272055]">
              {comment.authorName}
            </span>
            <time
              className="text-xs text-muted-foreground"
              dateTime={comment.createdAt}
              title={format(created, "PPpp")}
            >
              {format(created, "h:mm a")}
              {edited ? " · edited" : ""}
            </time>
          </div>

          <div className="mt-1 text-sm leading-relaxed text-foreground">
            {renderCommentBody(comment.body, comment.mentions)}
          </div>

          <div className="mt-2 flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn(
                "h-7 px-2 text-xs text-muted-foreground hover:text-[#272055]",
                replyingToId === comment.id && "text-[#2563EB]"
              )}
              onClick={() => onReply(comment)}
            >
              <Reply className="mr-1 h-3.5 w-3.5" />
              Reply
            </Button>
            {isOwn ? (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-[#272055]"
                  onClick={() => onEditStart(comment)}
                >
                  <Pencil className="mr-1 h-3.5 w-3.5" />
                  Edit
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-red-600"
                  onClick={() => onDelete(comment)}
                >
                  <Trash2 className="mr-1 h-3.5 w-3.5" />
                  Delete
                </Button>
              </>
            ) : null}
          </div>
        </div>
      </div>

      {comment.replies.map((reply) => (
        <CommentItem
          key={reply.id}
          comment={reply}
          currentUserId={currentUserId}
          depth={depth + 1}
          onReply={onReply}
          onDelete={onDelete}
          replyingToId={replyingToId}
          editingCommentId={editingCommentId}
          editBody={editBody}
          editMentions={editMentions}
          onEditStart={onEditStart}
          onEditBodyChange={onEditBodyChange}
          onEditMentionsChange={onEditMentionsChange}
          onEditCancel={onEditCancel}
          onEditSave={onEditSave}
          isSubmitting={isSubmitting}
          teamMembers={teamMembers}
        />
      ))}
    </article>
  );
}

export function TeamDiscussion({
  applicationId,
  jobId: _jobId,
  candidateName,
}: TeamDiscussionProps) {
  const { user } = useAuth();
  const { isConfigured: aiConfigured, loading: aiStatusLoading } = useAiStatus();
  const { activitySummary } = useBqiIntelligence();
  const reduceMotion = useReducedMotion();
  const showSummarize = !aiStatusLoading && aiConfigured && activitySummary;
  const composerRef = useRef<MentionComposerHandle>(null);
  const feedEndRef = useRef<HTMLDivElement>(null);

  const [comments, setComments] = useState<ApplicationComment[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryText, setSummaryText] = useState("");

  const [composerBody, setComposerBody] = useState("");
  const [composerMentions, setComposerMentions] = useState<CommentMention[]>(
    []
  );
  const [replyTarget, setReplyTarget] = useState<ApplicationComment | null>(
    null
  );
  const [editingComment, setEditingComment] =
    useState<ApplicationComment | null>(null);
  const [editBody, setEditBody] = useState("");
  const [editMentions, setEditMentions] = useState<CommentMention[]>([]);

  const commentTree = useMemo(() => buildCommentTree(comments), [comments]);

  const loadDiscussion = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [{ comments: loadedComments }, usersResponse] = await Promise.all([
        discussionApi.getComments(applicationId),
        adminApi.getUsers({ limit: 100 }),
      ]);

      setComments(loadedComments);

      const rawUsers = (usersResponse as { users?: Array<Record<string, string>> })
        .users;
      const admins = (rawUsers || [])
        .filter((entry) => {
          const role = String(entry.role || "").toUpperCase();
          return role === "ADMIN" || role === "SUPER_ADMIN";
        })
        .map((entry) => ({
          id: String(entry.id || entry._id || ""),
          name: String(entry.name || "").trim(),
          email: String(entry.email || "").trim(),
        }))
        .filter((entry) => entry.id && entry.email);

      setTeamMembers(admins);
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : "Failed to load team discussion"
      );
    } finally {
      setIsLoading(false);
    }
  }, [applicationId]);

  useEffect(() => {
    void loadDiscussion();
  }, [loadDiscussion]);

  useEffect(() => {
    if (!isLoading && comments.length > 0) {
      feedEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [comments.length, isLoading]);

  const resetComposer = () => {
    setComposerBody("");
    setComposerMentions([]);
    setReplyTarget(null);
  };

  const handlePost = async () => {
    const body = composerBody.trim();
    if (!body) return;

    setIsSubmitting(true);
    try {
      const created = await discussionApi.createComment(applicationId, {
        body,
        parentId: replyTarget?.id ?? null,
        mentions: composerMentions,
      });
      setComments((current) => [...current, created]);
      resetComposer();
      toast.success(replyTarget ? "Reply posted" : "Comment posted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to post comment");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingComment) return;
    const body = editBody.trim();
    if (!body) return;

    setIsSubmitting(true);
    try {
      const updated = await discussionApi.updateComment(
        applicationId,
        editingComment.id,
        { body, mentions: editMentions }
      );
      setComments((current) =>
        current.map((item) => (item.id === updated.id ? updated : item))
      );
      setEditingComment(null);
      setEditBody("");
      setEditMentions([]);
      toast.success("Comment updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update comment");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (comment: ApplicationComment) => {
    if (!window.confirm("Delete this comment and any replies?")) return;

    try {
      await discussionApi.deleteComment(applicationId, comment.id);
      const removeIds = collectDescendantIds(comments, comment.id);
      setComments((current) =>
        current.filter((item) => !removeIds.has(item.id))
      );
      if (replyTarget?.id === comment.id) {
        setReplyTarget(null);
      }
      if (editingComment?.id === comment.id) {
        setEditingComment(null);
      }
      toast.success("Comment deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete comment");
    }
  };

  const handleSummarize = async () => {
    if (!showSummarize || comments.length === 0) return;

    setIsSummarizing(true);
    try {
      const result = await discussionApi.summarizeComments(applicationId);
      setSummaryText(result.summary);
      setSummaryOpen(true);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to summarize discussion"
      );
    } finally {
      setIsSummarizing(false);
    }
  };

  const groupedComments = useMemo(() => {
    const groups: Array<{ dateLabel: string; items: CommentNode[] }> = [];
    for (const comment of commentTree) {
      const created = parseISO(comment.createdAt);
      const dateLabel = format(created, "EEEE, MMMM do");
      const lastGroup = groups[groups.length - 1];
      if (lastGroup && isSameDay(parseISO(lastGroup.items[0].createdAt), created)) {
        lastGroup.items.push(comment);
      } else {
        groups.push({ dateLabel, items: [comment] });
      }
    }
    return groups;
  }, [commentTree]);

  if (isLoading) {
    return (
      <div className="space-y-4 py-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-[70%]" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="space-y-3 py-8">
        <FailedStatusState message={loadError} />
        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void loadDiscussion()}
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex shrink-0 items-center justify-between gap-3">
        <h3 className="text-base font-semibold tracking-tight text-[#272055]">
          Team Discussion
        </h3>
        {showSummarize ? (
          <GenerateButton
            label="Summarize"
            generatingLabel="Summarizing…"
            isGenerating={isSummarizing}
            disabled={isSummarizing || comments.length === 0}
            onClick={() => void handleSummarize()}
            className="text-sm"
          />
        ) : null}
      </div>

      <DiscussionSummarizeGlow
        active={isSummarizing}
        paused={!!reduceMotion}
      >
        <div
          className={cn(
            "flex min-h-0 h-full flex-1 flex-col overflow-hidden rounded-lg border border-[#272055]/12",
            "bg-[#f7f8fa] bg-[radial-gradient(circle_at_1px_1px,#2720550a_1px,transparent_0)] [background-size:16px_16px]"
          )}
        >
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {comments.length === 0 ? (
            <div className="flex h-full min-h-[180px] flex-col items-center justify-center px-4 py-10 text-center">
              <MessageSquare
                className="mb-3 h-10 w-10 text-[#272055]/25"
                aria-hidden
              />
              <p className="text-sm font-medium text-[#272055]">No messages yet</p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Start the conversation about {candidateName}. Use @ to notify
                teammates.
              </p>
            </div>
          ) : (
            <div className="space-y-1 pb-2">
              {groupedComments.map((group) => (
                <section key={group.dateLabel}>
                  <div className="relative py-3">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-[#272055]/10" />
                    </div>
                    <div className="relative flex justify-center">
                      <span className="rounded-full bg-[#f7f8fa]/95 px-3 py-0.5 text-xs font-medium text-muted-foreground">
                        {group.dateLabel}
                      </span>
                    </div>
                  </div>

                  {group.items.map((comment) => (
                    <CommentItem
                      key={comment.id}
                      comment={comment}
                      currentUserId={user?.id}
                      depth={0}
                      onReply={(target) => {
                        setReplyTarget(target);
                        setEditingComment(null);
                        requestAnimationFrame(() => composerRef.current?.focus());
                      }}
                      onDelete={(target) => void handleDelete(target)}
                      replyingToId={replyTarget?.id ?? null}
                      editingCommentId={editingComment?.id ?? null}
                      editBody={editBody}
                      editMentions={editMentions}
                      onEditStart={(target) => {
                        setEditingComment(target);
                        setEditBody(target.body);
                        setEditMentions(target.mentions);
                        setReplyTarget(null);
                      }}
                      onEditBodyChange={setEditBody}
                      onEditMentionsChange={setEditMentions}
                      onEditCancel={() => {
                        setEditingComment(null);
                        setEditBody("");
                        setEditMentions([]);
                      }}
                      onEditSave={() => void handleSaveEdit()}
                      isSubmitting={isSubmitting}
                      teamMembers={teamMembers}
                    />
                  ))}
                </section>
              ))}
              <div ref={feedEndRef} />
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-[#272055]/10 bg-white/90 p-3 backdrop-blur-sm">
          {replyTarget ? (
            <div className="mb-2 flex items-center justify-between rounded-md bg-[#2563EB]/8 px-3 py-2 text-xs text-[#272055]">
              <span>
                Replying to{" "}
                <strong className="font-semibold">{replyTarget.authorName}</strong>
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setReplyTarget(null)}
                aria-label="Cancel reply"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : null}

          <div className="rounded-md border border-[#2563EB]/45 bg-[#F0F7FF]">
            <MentionComposer
              ref={composerRef}
              value={composerBody}
              onChange={setComposerBody}
              mentions={composerMentions}
              onMentionsChange={setComposerMentions}
              teamMembers={teamMembers}
              placeholder={COMPOSER_PLACEHOLDER}
              disabled={isSubmitting}
              className="bg-transparent"
            />

            <div className="flex items-center justify-between gap-2 border-t border-[#2563EB]/15 px-2 py-1.5">
              <EmojiPickerButton
                disabled={isSubmitting}
                onSelect={(emoji) => composerRef.current?.insertText(emoji)}
              />

              <Button
                type="button"
                size="sm"
                className="bg-[#2563EB] px-4 text-white hover:bg-[#1D4ED8]"
                disabled={isSubmitting || !composerBody.trim()}
                onClick={() => void handlePost()}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Posting...
                  </>
                ) : (
                  "Post"
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
      </DiscussionSummarizeGlow>

      <Dialog open={summaryOpen} onOpenChange={setSummaryOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#272055]">
              <Sparkles className="h-4 w-4 text-violet-600" />
              Discussion summary
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[50vh] overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-foreground">
            {summaryText}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
