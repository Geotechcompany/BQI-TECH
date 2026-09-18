"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Application } from "@/types/application";
import {
  getEmailDisplay,
  getNameDisplay,
} from "@/components/admin/utils/table-utils";
import { resolveApplicationId } from "./candidates-utils";

export interface QuestionnaireOption {
  key: string;
  jobId: string;
  jobTitle: string;
  questionnaireId: string;
  title: string;
}

interface TagCandidatesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  existingTags: string[];
  catalogTags: string[];
  isSubmitting: boolean;
  onSubmit: (payload: { add: string[]; remove: string[] }) => Promise<void>;
}

export function TagCandidatesDialog({
  open,
  onOpenChange,
  selectedCount,
  existingTags,
  catalogTags,
  isSubmitting,
  onSubmit,
}: TagCandidatesDialogProps) {
  const [draftTag, setDraftTag] = useState("");
  const [addTags, setAddTags] = useState<string[]>([]);
  const [removeTags, setRemoveTags] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) {
      setDraftTag("");
      setAddTags([]);
      setRemoveTags(new Set());
    }
  }, [open]);

  const suggestions = useMemo(() => {
    const selected = new Set(
      [...existingTags, ...addTags].map((tag) => tag.toLowerCase())
    );
    return catalogTags.filter((tag) => !selected.has(tag.toLowerCase()));
  }, [addTags, catalogTags, existingTags]);

  const addDraft = () => {
    const next = draftTag.trim();
    if (!next) return;
    const exists = addTags.some(
      (tag) => tag.toLowerCase() === next.toLowerCase()
    );
    if (!exists) setAddTags((prev) => [...prev, next]);
    setDraftTag("");
  };

  const canSubmit = addTags.length > 0 || removeTags.size > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Tag Candidates</DialogTitle>
          <DialogDescription>
            Add or remove tags on {selectedCount} selected candidate
            {selectedCount === 1 ? "" : "s"}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="candidate-tag-input">Add tags</Label>
            <div className="flex gap-2">
              <Input
                id="candidate-tag-input"
                value={draftTag}
                onChange={(event) => setDraftTag(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  addDraft();
                }}
                placeholder="Type a tag and press Enter"
                disabled={isSubmitting}
              />
              <Button
                type="button"
                variant="outline"
                onClick={addDraft}
                disabled={isSubmitting || !draftTag.trim()}
              >
                Add
              </Button>
            </div>
            {addTags.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {addTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className="inline-flex items-center gap-1 rounded-full border border-[#272055]/20 bg-[#272055]/5 px-2 py-0.5 text-xs text-[#272055]"
                    onClick={() =>
                      setAddTags((prev) => prev.filter((item) => item !== tag))
                    }
                    disabled={isSubmitting}
                  >
                    {tag}
                    <X className="h-3 w-3" />
                  </button>
                ))}
              </div>
            ) : null}
            {suggestions.length > 0 ? (
              <div className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto pt-1">
                {suggestions.slice(0, 24).map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground hover:border-[#272055]/30 hover:text-[#272055]"
                    onClick={() =>
                      setAddTags((prev) =>
                        prev.some((item) => item.toLowerCase() === tag.toLowerCase())
                          ? prev
                          : [...prev, tag]
                      )
                    }
                    disabled={isSubmitting}
                  >
                    + {tag}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label>Remove existing tags</Label>
            {existingTags.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No tags on the selected candidates yet.
              </p>
            ) : (
              <div className="max-h-36 space-y-2 overflow-y-auto">
                {existingTags.map((tag) => (
                  <label
                    key={tag}
                    className="flex cursor-pointer items-center gap-2 text-sm"
                  >
                    <Checkbox
                      checked={removeTags.has(tag)}
                      onCheckedChange={(checked) => {
                        setRemoveTags((prev) => {
                          const next = new Set(prev);
                          if (checked === true) next.add(tag);
                          else next.delete(tag);
                          return next;
                        });
                      }}
                      disabled={isSubmitting}
                    />
                    {tag}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="bg-[#31CDFF] text-white hover:bg-[#31CDFF]/90"
            disabled={isSubmitting || !canSubmit}
            onClick={() =>
              void onSubmit({
                add: addTags,
                remove: Array.from(removeTags),
              })
            }
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              "Save tags"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface SendQuestionnaireDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  options: QuestionnaireOption[];
  isLoadingOptions: boolean;
  isSubmitting: boolean;
  onSubmit: (payload: {
    jobId: string;
    questionnaireId: string;
  }) => Promise<void>;
}

export function SendQuestionnaireDialog({
  open,
  onOpenChange,
  selectedCount,
  options,
  isLoadingOptions,
  isSubmitting,
  onSubmit,
}: SendQuestionnaireDialogProps) {
  const [selectedKey, setSelectedKey] = useState("");

  useEffect(() => {
    if (!open) {
      setSelectedKey("");
      return;
    }
    if (options.length === 1) setSelectedKey(options[0].key);
  }, [open, options]);

  const selected = options.find((option) => option.key === selectedKey);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send Questionnaire</DialogTitle>
          <DialogDescription>
            Email a position questionnaire to {selectedCount} selected candidate
            {selectedCount === 1 ? "" : "s"}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-1">
          <Label htmlFor="questionnaire-select">Questionnaire</Label>
          {isLoadingOptions ? (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading questionnaires…
            </div>
          ) : options.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No questionnaires found on the selected candidates&apos; positions.
              Add one in the job wizard Application step.
            </p>
          ) : (
            <Select value={selectedKey || undefined} onValueChange={setSelectedKey}>
              <SelectTrigger id="questionnaire-select">
                <SelectValue placeholder="Select a questionnaire" />
              </SelectTrigger>
              <SelectContent>
                {options.map((option) => (
                  <SelectItem key={option.key} value={option.key}>
                    {option.title}
                    {option.jobTitle ? ` · ${option.jobTitle}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="bg-[#31CDFF] text-white hover:bg-[#31CDFF]/90"
            disabled={isSubmitting || !selected}
            onClick={() => {
              if (!selected) return;
              void onSubmit({
                jobId: selected.jobId,
                questionnaireId: selected.questionnaireId,
              });
            }}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending…
              </>
            ) : (
              "Send"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface MergeCandidatesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selected: Application[];
  isSubmitting: boolean;
  onSubmit: (primaryId: string) => Promise<void>;
}

export function MergeCandidatesDialog({
  open,
  onOpenChange,
  selected,
  isSubmitting,
  onSubmit,
}: MergeCandidatesDialogProps) {
  const [primaryId, setPrimaryId] = useState("");

  useEffect(() => {
    if (!open) {
      setPrimaryId("");
      return;
    }
    if (selected.length > 0) {
      setPrimaryId(resolveApplicationId(selected[0]));
    }
  }, [open, selected]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Merge Candidates</DialogTitle>
          <DialogDescription>
            Keep one primary profile. Tags, team assignments, discussion, emails,
            and tasks from the others move onto it. The other records are deleted.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-72 space-y-2 overflow-y-auto py-1">
          {selected.map((app) => {
            const id = resolveApplicationId(app);
            const name = getNameDisplay(app);
            const email = getEmailDisplay(app);
            return (
              <label
                key={id}
                className="flex cursor-pointer items-start gap-3 rounded-md border border-[#272055]/10 px-3 py-2 hover:bg-[#272055]/[0.03]"
              >
                <input
                  type="radio"
                  name="merge-primary"
                  className="mt-1"
                  checked={primaryId === id}
                  onChange={() => setPrimaryId(id)}
                  disabled={isSubmitting}
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-[#272055]">
                    {name}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {email.includes("@") ? email : "No email"} · {id.slice(-8)}
                  </span>
                </span>
              </label>
            );
          })}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="bg-[#31CDFF] text-white hover:bg-[#31CDFF]/90"
            disabled={isSubmitting || !primaryId || selected.length < 2}
            onClick={() => void onSubmit(primaryId)}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Merging…
              </>
            ) : (
              "Merge"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
