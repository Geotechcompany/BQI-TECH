"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown, Paperclip, Search, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  ApplicationQuestionnaire,
  HiringTeamMember,
  PipelineStageConfig,
} from "@/types/job-wizard";
import {
  EmailSmsChannel,
  QuestionnaireDelay,
  StageAction,
  StageActionAttachment,
  StageActionType,
  TaskDueDate,
} from "@/types/pipeline-settings";
import {
  BACKGROUND_CHECK_COUNTRIES,
  MAX_STAGE_ACTION_TAGS,
  MAX_TASK_ATTACHMENT_BYTES,
  MAX_TASK_DESCRIPTION_LENGTH,
  QUESTIONNAIRE_DELAY_OPTIONS,
  TASK_DUE_DATE_OPTIONS,
  stageActionLabel,
} from "./stage-action-catalog";

/** Select menus portaled above nested Dialog overlays; stop wheel capture. */
const SELECT_IN_DIALOG_CONTENT_CLASS =
  "z-[200] max-h-72 overflow-y-auto";

const POPOVER_IN_DIALOG_CONTENT_CLASS =
  "z-[200] w-[var(--radix-popover-trigger-width)] p-0";

export interface StageActionConfigContext {
  questionnaires: ApplicationQuestionnaire[];
  hiringTeam: HiringTeamMember[];
  pipelineStages: PipelineStageConfig[];
  /** Optional account/job tags for the Add Tags picker. */
  availableTags?: string[];
  /** Stage currently being edited (excluded from move targets). */
  currentStageId: string;
}

interface StageActionConfigDialogProps {
  open: boolean;
  actionType: StageActionType | null;
  initialAction?: StageAction | null;
  context: StageActionConfigContext;
  onCancel: () => void;
  onSave: (action: StageAction) => void;
}

function createDraft(
  type: StageActionType,
  initial?: StageAction | null
): StageAction {
  if (initial && initial.type === type) {
    return {
      ...initial,
      ...(type === "send_questionnaire"
        ? { questionnaireDelay: initial.questionnaireDelay || "none" }
        : {}),
      ...(type === "assign_hiring_manager"
        ? { assignByRoundRobin: Boolean(initial.assignByRoundRobin) }
        : {}),
      ...(type === "move_after_meeting"
        ? { runStageActions: initial.runStageActions !== false }
        : {}),
      ...(type === "create_task"
        ? {
            taskDueDate: initial.taskDueDate || "none",
            taskAttachments: initial.taskAttachments || [],
            taskDescription: initial.taskDescription || "",
          }
        : {}),
      ...(type === "add_tags" ? { tags: initial.tags || [] } : {}),
    };
  }
  return {
    id: `action-${Date.now()}`,
    type,
    channel: "email",
    tags: [],
    ...(type === "send_questionnaire"
      ? { questionnaireDelay: "none" as QuestionnaireDelay }
      : {}),
    ...(type === "assign_hiring_manager"
      ? { assignByRoundRobin: false }
      : {}),
    ...(type === "move_after_meeting" ? { runStageActions: true } : {}),
    ...(type === "create_task"
      ? {
          taskDueDate: "none" as TaskDueDate,
          taskAttachments: [],
          taskDescription: "",
        }
      : {}),
  };
}

function isConfigValid(action: StageAction): boolean {
  switch (action.type) {
    case "add_tags": {
      const tags = (action.tags || []).map((tag) => tag.trim()).filter(Boolean);
      return tags.length > 0 && tags.length <= MAX_STAGE_ACTION_TAGS;
    }
    case "send_email_sms":
    case "send_email": {
      const channel = action.channel || "email";
      if (channel === "email" || channel === "both") {
        return Boolean(action.emailSubject?.trim() && action.emailBody?.trim());
      }
      return Boolean(action.smsBody?.trim());
    }
    case "send_questionnaire":
      return Boolean(action.questionnaireId);
    case "assign_hiring_manager":
      return Boolean(action.assignByRoundRobin || action.hiringManagerId);
    case "run_background_check":
      return Boolean(
        action.backgroundCheckCountry?.trim() &&
          action.backgroundCheckCity?.trim()
      );
    case "create_task":
      return Boolean(action.taskTitle?.trim());
    case "nurture_campaign":
      return Boolean(action.nurtureCampaignName?.trim());
    case "move_after_meeting":
      return Boolean(action.moveToStageId);
    case "team_feedback":
    case "notify_team":
      return true;
    case "candidate_scorecards":
      return true;
    default:
      return true;
  }
}

function memberLabel(member: HiringTeamMember): string {
  return member.name?.trim() || member.email || "Team member";
}

function TeamMemberPicker({
  members,
  value,
  onChange,
  placeholder,
  disabled = false,
  emptyMessage = "No team members available",
}: {
  members: HiringTeamMember[];
  value: string | null | undefined;
  onChange: (memberId: string | null) => void;
  placeholder: string;
  disabled?: boolean;
  emptyMessage?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = members.find((member) => member.id === value);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return members;
    return members.filter((member) => {
      const haystack = `${member.name} ${member.email}`.toLowerCase();
      return haystack.includes(normalized);
    });
  }, [members, query]);

  return (
    <Popover
      modal
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="mt-1.5 w-full justify-between font-normal"
        >
          <span className="flex min-w-0 items-center gap-2">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span
              className={cn("truncate", !selected && "text-muted-foreground")}
            >
              {selected ? memberLabel(selected) : placeholder}
            </span>
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className={POPOVER_IN_DIALOG_CONTENT_CLASS}
        align="start"
        onWheel={(event) => event.stopPropagation()}
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={placeholder}
            value={query}
            onValueChange={setQuery}
          />
          <CommandList className="max-h-60 overscroll-contain">
            <CommandEmpty>
              {members.length === 0 ? emptyMessage : "No matches"}
            </CommandEmpty>
            <CommandGroup>
              {filtered.map((member) => (
                <CommandItem
                  key={member.id}
                  value={member.id}
                  onSelect={() => {
                    onChange(member.id);
                    setOpen(false);
                    setQuery("");
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === member.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate">
                    <span className="block truncate">{memberLabel(member)}</span>
                    {member.name?.trim() && member.email ? (
                      <span className="block truncate text-xs text-muted-foreground">
                        {member.email}
                      </span>
                    ) : null}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function StageActionConfigDialog({
  open,
  actionType,
  initialAction,
  context,
  onCancel,
  onSave,
}: StageActionConfigDialogProps) {
  const [draft, setDraft] = useState<StageAction | null>(null);
  const [tagQuery, setTagQuery] = useState("");
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open || !actionType) {
      setDraft(null);
      setTagQuery("");
      setAttachmentError(null);
      return;
    }
    setDraft(createDraft(actionType, initialAction));
    setTagQuery("");
    setAttachmentError(null);
  }, [open, actionType, initialAction]);

  const isEditing = Boolean(initialAction);

  const title = useMemo(() => {
    if (!actionType) return "Configure action";
    if (actionType === "run_background_check") {
      return isEditing ? "Edit Background Check" : "Add Background Check";
    }
    if (actionType === "send_questionnaire") {
      return isEditing ? "Edit Questionnaire" : "Add Questionnaire";
    }
    if (actionType === "assign_hiring_manager") {
      return isEditing
        ? "Edit Hiring Manager Assignment"
        : "Add Hiring Manager Assignment";
    }
    if (actionType === "create_task") {
      return isEditing ? "Edit Task" : "Add Task";
    }
    if (actionType === "move_after_meeting") {
      return isEditing
        ? "Edit Move to Position Stage Action"
        : "Add Move to Position Stage Action";
    }
    if (actionType === "add_tags") {
      return "Tag a Candidate";
    }
    return stageActionLabel(actionType);
  }, [actionType, isEditing]);

  const saveLabel = useMemo(() => {
    if (actionType === "create_task") return "Save Task";
    if (actionType === "add_tags") return "Save Changes";
    return "Save";
  }, [actionType]);

  if (!draft || !actionType) {
    return (
      <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Configure action</DialogTitle>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  const patch = (next: Partial<StageAction>) => {
    setDraft((current) => (current ? { ...current, ...next } : current));
  };

  const canSave = isConfigValid(draft);
  const moveTargets = context.pipelineStages.filter(
    (stage) => stage.enabled && stage.id !== context.currentStageId
  );
  const selectedTags = (draft.tags || [])
    .map((tag) => tag.trim())
    .filter(Boolean);
  const catalogTags = context.availableTags || [];
  const availableTags = Array.from(
    new Set([...catalogTags, ...selectedTags])
  ).sort((a, b) => a.localeCompare(b));
  const filteredTags = availableTags.filter((tag) =>
    tag.toLowerCase().includes(tagQuery.trim().toLowerCase())
  );
  const taskDescription = draft.taskDescription || "";
  const hasTagCatalog = catalogTags.length > 0 || selectedTags.length > 0;

  const toggleTag = (tag: string) => {
    const exists = selectedTags.includes(tag);
    if (exists) {
      patch({ tags: selectedTags.filter((item) => item !== tag) });
      return;
    }
    if (selectedTags.length >= MAX_STAGE_ACTION_TAGS) return;
    patch({ tags: [...selectedTags, tag] });
  };

  const handleAttachmentFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setAttachmentError(null);
    const current = draft.taskAttachments || [];
    const next: StageActionAttachment[] = [...current];

    for (const file of Array.from(files)) {
      if (file.size > MAX_TASK_ATTACHMENT_BYTES) {
        setAttachmentError(`${file.name} exceeds the 10 MB limit`);
        continue;
      }
      next.push({
        id: `attachment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: file.name,
        size: file.size,
        type: file.type || "application/octet-stream",
      });
    }

    patch({ taskAttachments: next });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {actionType === "run_background_check" ? (
            <>
              <div>
                <Label htmlFor="bg-package">Background Check Package</Label>
                <Select
                  value={draft.backgroundCheckPackageId || "__none__"}
                  onValueChange={(value) =>
                    patch({
                      backgroundCheckPackageId:
                        value === "__none__" ? null : value,
                    })
                  }
                >
                  <SelectTrigger id="bg-package" className="mt-1.5">
                    <SelectValue placeholder="Select a package" />
                  </SelectTrigger>
                  <SelectContent
                    position="popper"
                    className={SELECT_IN_DIALOG_CONTENT_CLASS}
                    onWheel={(event) => event.stopPropagation()}
                  >
                    <SelectItem value="__none__" disabled>
                      No packages available
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Packages are managed in account settings. Country and city are
                  still required to save this action.
                </p>
              </div>
              <div>
                <Label htmlFor="bg-country">Country</Label>
                <Select
                  value={draft.backgroundCheckCountry || ""}
                  onValueChange={(value) =>
                    patch({ backgroundCheckCountry: value })
                  }
                >
                  <SelectTrigger id="bg-country" className="mt-1.5">
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent
                    position="popper"
                    className={SELECT_IN_DIALOG_CONTENT_CLASS}
                    onWheel={(event) => event.stopPropagation()}
                  >
                    {BACKGROUND_CHECK_COUNTRIES.map((country) => (
                      <SelectItem key={country} value={country}>
                        {country}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="bg-city">City</Label>
                <Input
                  id="bg-city"
                  className="mt-1.5"
                  value={draft.backgroundCheckCity || ""}
                  onChange={(event) =>
                    patch({ backgroundCheckCity: event.target.value })
                  }
                  placeholder="e.g. Nairobi"
                />
              </div>
            </>
          ) : null}

          {actionType === "add_tags" ? (
            <>
              <p className="text-sm text-muted-foreground">
                Automatically apply up to {MAX_STAGE_ACTION_TAGS} selected tags
                to a candidate when they enter a stage.
              </p>
              <div className="rounded-md border border-[#272055]/15 bg-[#fafbfd]">
                <div className="border-b border-[#272055]/10 px-3 py-2">
                  <p className="text-sm font-medium text-[#272055]">
                    Available Tags
                  </p>
                </div>
                <div className="space-y-3 p-3">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      className="pl-8"
                      value={tagQuery}
                      onChange={(event) => setTagQuery(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter") return;
                        event.preventDefault();
                        const nextTag = tagQuery.trim();
                        if (!nextTag) return;
                        const exists = selectedTags.some(
                          (tag) => tag.toLowerCase() === nextTag.toLowerCase()
                        );
                        if (exists) {
                          setTagQuery("");
                          return;
                        }
                        if (selectedTags.length >= MAX_STAGE_ACTION_TAGS) return;
                        patch({ tags: [...selectedTags, nextTag] });
                        setTagQuery("");
                      }}
                      placeholder="Search tags"
                    />
                  </div>
                  {!hasTagCatalog && !tagQuery.trim() ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                      No tags available
                    </p>
                  ) : filteredTags.length === 0 ? (
                    <p className="py-4 text-center text-sm text-muted-foreground">
                      {tagQuery.trim()
                        ? `Press Enter to add “${tagQuery.trim()}”`
                        : "No tags match your search"}
                    </p>
                  ) : (
                    <div className="flex max-h-48 flex-wrap gap-2 overflow-y-auto">
                      {filteredTags.map((tag) => {
                        const selected = selectedTags.includes(tag);
                        const atLimit =
                          !selected &&
                          selectedTags.length >= MAX_STAGE_ACTION_TAGS;
                        return (
                          <button
                            key={tag}
                            type="button"
                            disabled={atLimit}
                            onClick={() => toggleTag(tag)}
                            className={cn(
                              "rounded-full border px-3 py-1 text-sm transition-colors",
                              selected
                                ? "border-[#272055] bg-[#272055] text-white"
                                : "border-[#272055]/20 bg-white text-[#272055] hover:border-[#272055]/40",
                              atLimit && "cursor-not-allowed opacity-40"
                            )}
                          >
                            {tag}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {selectedTags.length > 0 ? (
                    <p className="text-xs text-muted-foreground">
                      {selectedTags.length}/{MAX_STAGE_ACTION_TAGS} tags
                      selected
                    </p>
                  ) : null}
                </div>
              </div>
            </>
          ) : null}

          {actionType === "send_email_sms" || actionType === "send_email" ? (
            <>
              <div>
                <Label>Channel</Label>
                <Select
                  value={draft.channel || "email"}
                  onValueChange={(value: EmailSmsChannel) =>
                    patch({ channel: value })
                  }
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent
                    position="popper"
                    className={SELECT_IN_DIALOG_CONTENT_CLASS}
                    onWheel={(event) => event.stopPropagation()}
                  >
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                    <SelectItem value="both">Email and SMS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(draft.channel || "email") !== "sms" ? (
                <>
                  <div>
                    <Label htmlFor="email-subject">Email subject</Label>
                    <Input
                      id="email-subject"
                      className="mt-1.5"
                      value={draft.emailSubject || ""}
                      onChange={(event) =>
                        patch({ emailSubject: event.target.value })
                      }
                      placeholder="Subject line"
                    />
                  </div>
                  <div>
                    <Label htmlFor="email-body">Email body</Label>
                    <Textarea
                      id="email-body"
                      className="mt-1.5 min-h-[100px]"
                      value={draft.emailBody || ""}
                      onChange={(event) =>
                        patch({ emailBody: event.target.value })
                      }
                      placeholder="Message body"
                    />
                  </div>
                </>
              ) : null}
              {(draft.channel || "email") !== "email" ? (
                <div>
                  <Label htmlFor="sms-body">SMS body</Label>
                  <Textarea
                    id="sms-body"
                    className="mt-1.5 min-h-[80px]"
                    value={draft.smsBody || ""}
                    onChange={(event) =>
                      patch({ smsBody: event.target.value })
                    }
                    placeholder="SMS message"
                  />
                </div>
              ) : null}
            </>
          ) : null}

          {actionType === "send_questionnaire" ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="min-w-0">
                <Label htmlFor="select-questionnaire">
                  Select Questionnaire
                </Label>
                <Select
                  value={draft.questionnaireId || undefined}
                  onValueChange={(value) => patch({ questionnaireId: value })}
                  disabled={context.questionnaires.length === 0}
                >
                  <SelectTrigger id="select-questionnaire" className="mt-1.5">
                    <SelectValue placeholder="Select a questionnaire." />
                  </SelectTrigger>
                  <SelectContent
                    position="popper"
                    className={SELECT_IN_DIALOG_CONTENT_CLASS}
                    onWheel={(event) => event.stopPropagation()}
                  >
                    {context.questionnaires.length === 0 ? (
                      <SelectItem value="__empty__" disabled>
                        No questionnaires on this position
                      </SelectItem>
                    ) : (
                      context.questionnaires.map((questionnaire) => (
                        <SelectItem
                          key={questionnaire.id}
                          value={questionnaire.id}
                        >
                          {questionnaire.title || "Untitled questionnaire"}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-0">
                <Label htmlFor="questionnaire-delay">Delay</Label>
                <Select
                  value={draft.questionnaireDelay || "none"}
                  onValueChange={(value: QuestionnaireDelay) =>
                    patch({ questionnaireDelay: value })
                  }
                >
                  <SelectTrigger id="questionnaire-delay" className="mt-1.5">
                    <SelectValue placeholder="No Delay" />
                  </SelectTrigger>
                  <SelectContent
                    position="popper"
                    className={SELECT_IN_DIALOG_CONTENT_CLASS}
                    onWheel={(event) => event.stopPropagation()}
                  >
                    {QUESTIONNAIRE_DELAY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : null}

          {actionType === "assign_hiring_manager" ? (
            <>
              <div>
                <Label>Assign to</Label>
                <TeamMemberPicker
                  members={context.hiringTeam}
                  value={draft.hiringManagerId}
                  onChange={(memberId) => patch({ hiringManagerId: memberId })}
                  placeholder="Select team member"
                  disabled={Boolean(draft.assignByRoundRobin)}
                  emptyMessage="Add hiring team members in the Hiring Team step"
                />
              </div>
              <div className="flex items-start justify-between gap-4 rounded-md border border-[#272055]/10 px-3 py-3">
                <div className="min-w-0 space-y-1">
                  <Label
                    htmlFor="assign-round-robin"
                    className="cursor-pointer text-sm font-medium"
                  >
                    Assign by Round Robin
                  </Label>
                  <p className="text-xs italic text-muted-foreground">
                    Automatically distribute candidates evenly among team
                    members
                  </p>
                </div>
                <Switch
                  id="assign-round-robin"
                  checked={Boolean(draft.assignByRoundRobin)}
                  onCheckedChange={(checked) =>
                    patch({
                      assignByRoundRobin: checked,
                      ...(checked ? { hiringManagerId: null } : {}),
                    })
                  }
                  className="data-[state=checked]:bg-[#272055]"
                />
              </div>
            </>
          ) : null}

          {actionType === "create_task" ? (
            <>
              <p className="text-sm text-muted-foreground">
                Create and assign tasks for yourself or someone on your team.
              </p>
              <div>
                <Label htmlFor="task-title">Task Name</Label>
                <Input
                  id="task-title"
                  className="mt-1.5"
                  value={draft.taskTitle || ""}
                  onChange={(event) =>
                    patch({ taskTitle: event.target.value })
                  }
                  placeholder="e.g. Review portfolio"
                />
              </div>
              <div>
                <Label>Who should this task be created for?</Label>
                <TeamMemberPicker
                  members={context.hiringTeam}
                  value={draft.taskAssigneeId}
                  onChange={(memberId) => patch({ taskAssigneeId: memberId })}
                  placeholder="Select team member"
                  emptyMessage="Add hiring team members in the Hiring Team step"
                />
              </div>
              <div>
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="task-description">Description</Label>
                  <span className="text-xs text-muted-foreground">
                    {taskDescription.length}/{MAX_TASK_DESCRIPTION_LENGTH}
                  </span>
                </div>
                <Textarea
                  id="task-description"
                  className="mt-1.5 min-h-[100px]"
                  value={taskDescription}
                  maxLength={MAX_TASK_DESCRIPTION_LENGTH}
                  onChange={(event) =>
                    patch({
                      taskDescription: event.target.value.slice(
                        0,
                        MAX_TASK_DESCRIPTION_LENGTH
                      ),
                    })
                  }
                  placeholder="Add details for this task"
                />
              </div>
              <div>
                <Label htmlFor="task-due-date">Due Date</Label>
                <Select
                  value={draft.taskDueDate || "none"}
                  onValueChange={(value: TaskDueDate) =>
                    patch({ taskDueDate: value })
                  }
                >
                  <SelectTrigger id="task-due-date" className="mt-1.5">
                    <SelectValue placeholder="No due date" />
                  </SelectTrigger>
                  <SelectContent
                    position="popper"
                    className={SELECT_IN_DIALOG_CONTENT_CLASS}
                    onWheel={(event) => event.stopPropagation()}
                  >
                    {TASK_DUE_DATE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Attachments</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  multiple
                  onChange={(event) =>
                    handleAttachmentFiles(event.target.files)
                  }
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    handleAttachmentFiles(event.dataTransfer.files);
                  }}
                  className="mt-1.5 flex w-full flex-col items-center justify-center gap-1 rounded-md border border-dashed border-[#272055]/25 bg-[#fafbfd] px-4 py-8 text-center transition-colors hover:border-[#272055]/40 hover:bg-[#f5f6fa]"
                >
                  <Upload className="h-5 w-5 text-[#272055]/60" />
                  <span className="text-sm font-medium text-[#272055]">
                    Drag and Drop or Click to Upload
                  </span>
                  <span className="text-xs text-muted-foreground">
                    10 MB max
                  </span>
                </button>
                {attachmentError ? (
                  <p className="mt-1.5 text-xs text-destructive">
                    {attachmentError}
                  </p>
                ) : null}
                {(draft.taskAttachments || []).length > 0 ? (
                  <ul className="mt-2 space-y-1.5">
                    {(draft.taskAttachments || []).map((attachment) => (
                      <li
                        key={attachment.id}
                        className="flex items-center gap-2 rounded-md border border-[#272055]/10 bg-white px-2.5 py-1.5 text-sm"
                      >
                        <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1 truncate">
                          {attachment.name}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {formatBytes(attachment.size)}
                        </span>
                        <button
                          type="button"
                          className="rounded p-0.5 text-muted-foreground hover:bg-[#272055]/5 hover:text-[#272055]"
                          aria-label={`Remove ${attachment.name}`}
                          onClick={() =>
                            patch({
                              taskAttachments: (
                                draft.taskAttachments || []
                              ).filter((item) => item.id !== attachment.id),
                            })
                          }
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </>
          ) : null}

          {actionType === "nurture_campaign" ? (
            <div>
              <Label htmlFor="nurture-name">Campaign name</Label>
              <Input
                id="nurture-name"
                className="mt-1.5"
                value={draft.nurtureCampaignName || ""}
                onChange={(event) =>
                  patch({ nurtureCampaignName: event.target.value })
                }
                placeholder="e.g. Passive talent nurture"
              />
            </div>
          ) : null}

          {actionType === "move_after_meeting" ? (
            <>
              <p className="text-sm text-muted-foreground">
                Automatically move candidates to a different stage when a
                meeting is scheduled.
              </p>
              <div>
                <Label>Move to stage</Label>
                <Select
                  value={draft.moveToStageId || undefined}
                  onValueChange={(value) => patch({ moveToStageId: value })}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Select destination stage" />
                  </SelectTrigger>
                  <SelectContent
                    position="popper"
                    className={SELECT_IN_DIALOG_CONTENT_CLASS}
                    onWheel={(event) => event.stopPropagation()}
                  >
                    {moveTargets.length === 0 ? (
                      <SelectItem value="__empty__" disabled>
                        No other stages available
                      </SelectItem>
                    ) : (
                      moveTargets.map((stage) => (
                        <SelectItem key={stage.id} value={stage.id}>
                          {stage.label}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-start justify-between gap-4 rounded-md border border-[#272055]/10 px-3 py-3">
                <div className="min-w-0 space-y-1">
                  <Label
                    htmlFor="run-stage-actions"
                    className="cursor-pointer text-sm font-medium"
                  >
                    Run Stage Actions
                  </Label>
                  <p className="text-xs italic text-muted-foreground">
                    Trigger stage actions on the destination stage when a
                    candidate is moved.
                  </p>
                </div>
                <Switch
                  id="run-stage-actions"
                  checked={draft.runStageActions !== false}
                  onCheckedChange={(checked) =>
                    patch({ runStageActions: checked })
                  }
                  className="data-[state=checked]:bg-[#272055]"
                />
              </div>
            </>
          ) : null}

          {actionType === "team_feedback" || actionType === "notify_team" ? (
            <div>
              <Label htmlFor="feedback-prompt">Feedback prompt (optional)</Label>
              <Textarea
                id="feedback-prompt"
                className="mt-1.5"
                value={draft.feedbackPrompt || ""}
                onChange={(event) =>
                  patch({ feedbackPrompt: event.target.value })
                }
                placeholder="What should reviewers focus on?"
              />
            </div>
          ) : null}

          {actionType === "candidate_scorecards" ? (
            <div>
              <Label htmlFor="scorecard-name">
                Scorecard template (optional)
              </Label>
              <Input
                id="scorecard-name"
                className="mt-1.5"
                value={draft.scorecardTemplateName || ""}
                onChange={(event) =>
                  patch({ scorecardTemplateName: event.target.value })
                }
                placeholder="e.g. Technical interview scorecard"
              />
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!canSave}
            onClick={() => onSave(draft)}
            className="bg-[#272055] hover:bg-[#272055]/90"
          >
            {saveLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
