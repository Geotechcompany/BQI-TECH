"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { Check, Copy, Pencil, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "react-hot-toast";

type FieldIcon = React.ComponentType<{ className?: string }>;

export interface InlineEditableFieldProps {
  icon: FieldIcon;
  label: string;
  value: string;
  emptyLabel: string;
  onSave: (nextValue: string) => Promise<void>;
  type?: "text" | "email" | "tel" | "textarea";
  copyable?: boolean;
  href?: string;
  validate?: (value: string) => string | null;
  disabled?: boolean;
  className?: string;
}

export function InlineEditableField({
  icon: Icon,
  label,
  value,
  emptyLabel,
  onSave,
  type = "text",
  copyable = false,
  href,
  validate,
  disabled = false,
  className,
}: InlineEditableFieldProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const skipBlurSaveRef = useRef(false);

  useEffect(() => {
    if (!isEditing) setDraft(value);
  }, [value, isEditing]);

  useEffect(() => {
    if (!isEditing) return;
    const node = inputRef.current;
    if (!node) return;
    node.focus();
    if ("select" in node) node.select();
  }, [isEditing]);

  const startEditing = useCallback(() => {
    if (disabled || isSaving) return;
    setError(null);
    setDraft(value);
    setIsEditing(true);
  }, [disabled, isSaving, value]);

  const cancelEditing = useCallback(() => {
    skipBlurSaveRef.current = true;
    setDraft(value);
    setError(null);
    setIsEditing(false);
  }, [value]);

  const commit = useCallback(async () => {
    const nextValue = draft.trim();
    const previous = value.trim();

    if (nextValue === previous) {
      setIsEditing(false);
      setError(null);
      return;
    }

    const validationError = validate?.(nextValue) ?? null;
    if (validationError) {
      setError(validationError);
      inputRef.current?.focus();
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await onSave(nextValue);
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
      inputRef.current?.focus();
    } finally {
      setIsSaving(false);
    }
  }, [draft, onSave, validate, value]);

  const handleBlur = useCallback(() => {
    if (skipBlurSaveRef.current) {
      skipBlurSaveRef.current = false;
      return;
    }
    void commit();
  }, [commit]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (event.key === "Escape") {
        event.preventDefault();
        cancelEditing();
        return;
      }
      if (event.key === "Enter" && type !== "textarea") {
        event.preventDefault();
        void commit();
      }
    },
    [cancelEditing, commit, type]
  );

  const handleCopy = useCallback(async () => {
    if (!value.trim()) return;
    try {
      await navigator.clipboard.writeText(value.trim());
      toast.success("Copied");
    } catch {
      toast.error("Could not copy");
    }
  }, [value]);

  const displayValue = value.trim();
  const isEmpty = !displayValue;

  return (
    <div className={cn("group/field flex items-start gap-3 py-2.5", className)}>
      <Icon
        className="mt-0.5 h-4 w-4 shrink-0 text-[#272156]/50"
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>

        {isEditing ? (
          <div className="mt-1 space-y-1">
            {type === "textarea" ? (
              <Textarea
                id={inputId}
                ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                disabled={isSaving}
                rows={2}
                className="min-h-[64px] resize-none border-[#272156]/30 text-sm text-[#272156] focus-visible:ring-[#31CDFF]"
                aria-label={label}
              />
            ) : (
              <Input
                id={inputId}
                ref={inputRef as React.RefObject<HTMLInputElement>}
                type={type}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                disabled={isSaving}
                className="h-9 border-[#272156]/30 text-sm text-[#272156] focus-visible:ring-[#31CDFF]"
                aria-label={label}
              />
            )}
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="inline-flex h-7 w-7 items-center justify-center rounded text-[#272156] hover:bg-[#272156]/8 disabled:opacity-50"
                aria-label={`Save ${label}`}
                disabled={isSaving}
                onMouseDown={(event) => {
                  event.preventDefault();
                  skipBlurSaveRef.current = true;
                }}
                onClick={() => void commit()}
              >
                <Check className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                className="inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-[#272156]/8 disabled:opacity-50"
                aria-label={`Cancel ${label}`}
                disabled={isSaving}
                onMouseDown={(event) => {
                  event.preventDefault();
                  skipBlurSaveRef.current = true;
                }}
                onClick={cancelEditing}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            {error ? (
              <p className="text-xs text-red-600" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="mt-0.5 flex items-start gap-1">
            {isEmpty ? (
              <button
                type="button"
                disabled={disabled}
                onClick={startEditing}
                className={cn(
                  "min-w-0 flex-1 rounded-md px-1.5 py-0.5 text-left text-sm font-medium text-[#31CDFF] transition-colors",
                  disabled
                    ? "cursor-default"
                    : "hover:bg-[#272156]/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#31CDFF]/40"
                )}
              >
                {emptyLabel}
              </button>
            ) : href ? (
              <a
                href={href}
                className="min-w-0 flex-1 break-all rounded-md px-1.5 py-0.5 text-sm font-medium text-[#31CDFF] hover:underline"
              >
                {displayValue}
              </a>
            ) : (
              <button
                type="button"
                disabled={disabled}
                onClick={startEditing}
                className={cn(
                  "min-w-0 flex-1 break-words rounded-md px-1.5 py-0.5 text-left text-sm font-medium text-[#272156] transition-colors",
                  disabled
                    ? "cursor-default"
                    : "hover:bg-[#272156]/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#31CDFF]/40"
                )}
              >
                {displayValue}
              </button>
            )}

            <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover/field:opacity-100 group-focus-within/field:opacity-100">
              {copyable && !isEmpty ? (
                <button
                  type="button"
                  className="inline-flex h-7 w-7 items-center justify-center rounded text-[#272156]/60 hover:bg-[#272156]/8 hover:text-[#272156]"
                  aria-label={`Copy ${label}`}
                  onClick={() => void handleCopy()}
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              ) : null}
              {!disabled ? (
                <button
                  type="button"
                  className="inline-flex h-7 w-7 items-center justify-center rounded text-[#272156]/60 hover:bg-[#272156]/8 hover:text-[#272156]"
                  aria-label={`Edit ${label}`}
                  onClick={startEditing}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export interface InlineTagsFieldProps {
  icon: FieldIcon;
  tags: string[];
  onChange: (tags: string[]) => Promise<void>;
  disabled?: boolean;
}

export function InlineTagsField({
  icon: Icon,
  tags,
  onChange,
  disabled = false,
}: InlineTagsFieldProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const skipBlurSaveRef = useRef(false);

  useEffect(() => {
    if (!isAdding) return;
    inputRef.current?.focus();
  }, [isAdding]);

  const cancelAdd = useCallback(() => {
    skipBlurSaveRef.current = true;
    setDraft("");
    setIsAdding(false);
  }, []);

  const commitAdd = useCallback(async () => {
    const nextTag = draft.trim();
    if (!nextTag) {
      setIsAdding(false);
      return;
    }

    const exists = tags.some(
      (tag) => tag.toLowerCase() === nextTag.toLowerCase()
    );
    if (exists) {
      setDraft("");
      setIsAdding(false);
      return;
    }

    setIsSaving(true);
    try {
      await onChange([...tags, nextTag]);
      setDraft("");
      setIsAdding(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add tag");
      inputRef.current?.focus();
    } finally {
      setIsSaving(false);
    }
  }, [draft, onChange, tags]);

  const removeTag = useCallback(
    async (tagToRemove: string) => {
      if (disabled || isSaving) return;
      setIsSaving(true);
      try {
        await onChange(tags.filter((tag) => tag !== tagToRemove));
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Could not remove tag"
        );
      } finally {
        setIsSaving(false);
      }
    },
    [disabled, isSaving, onChange, tags]
  );

  return (
    <div className="group/field flex items-start gap-3 py-2.5">
      <Icon
        className="mt-0.5 h-4 w-4 shrink-0 text-[#272156]/50"
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">Tags</p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-md border border-[#272156]/15 bg-[#272156]/[0.04] px-2 py-0.5 text-xs font-medium text-[#272156]"
            >
              {tag}
              {!disabled ? (
                <button
                  type="button"
                  className="rounded p-0.5 text-[#272156]/50 hover:bg-[#272156]/10 hover:text-[#272156]"
                  aria-label={`Remove ${tag}`}
                  disabled={isSaving}
                  onClick={() => void removeTag(tag)}
                >
                  <X className="h-3 w-3" />
                </button>
              ) : null}
            </span>
          ))}

          {isAdding ? (
            <Input
              ref={inputRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onBlur={() => {
                if (skipBlurSaveRef.current) {
                  skipBlurSaveRef.current = false;
                  return;
                }
                void commitAdd();
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  cancelAdd();
                } else if (event.key === "Enter") {
                  event.preventDefault();
                  void commitAdd();
                }
              }}
              disabled={isSaving}
              placeholder="Tag name"
              className="h-7 w-28 border-[#272156]/30 px-2 text-xs text-[#272156] focus-visible:ring-[#31CDFF]"
              aria-label="New tag"
            />
          ) : (
            <button
              type="button"
              disabled={disabled || isSaving}
              onClick={() => {
                setDraft("");
                setIsAdding(true);
              }}
              className="rounded-md px-1.5 py-0.5 text-sm font-medium text-[#31CDFF] transition-colors hover:bg-[#272156]/[0.06]"
            >
              + Add tag
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
