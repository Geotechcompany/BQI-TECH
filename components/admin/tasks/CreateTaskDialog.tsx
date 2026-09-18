"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Paperclip, Upload, X } from "lucide-react";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { MAX_TASK_DESCRIPTION_LENGTH } from "@/components/admin/pipeline/stage-action-catalog";
import { isAdminRoleLabel } from "@/lib/format-admin-role";
import { adminApi } from "@/lib/api-backend";
import { useAuth } from "@/contexts/AuthContext";

export interface TaskAssigneeOption {
  id: string;
  name: string;
  email: string;
}

export interface CreateTaskPayload {
  title: string;
  description?: string;
  assigneeId?: string | null;
  assigneeName?: string | null;
  dueDate?: string | null;
}

interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isSubmitting: boolean;
  onSubmit: (payload: CreateTaskPayload) => Promise<void>;
}

interface AttachmentStub {
  id: string;
  name: string;
  size: number;
}

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function displayName(user: {
  id?: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}): string {
  const combined = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return combined || user.name?.trim() || user.email || "Team member";
}

export function CreateTaskDialog({
  open,
  onOpenChange,
  isSubmitting,
  onSubmit,
}: CreateTaskDialogProps) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [dueDate, setDueDate] = useState("");
  const [assignees, setAssignees] = useState<TaskAssigneeOption[]>([]);
  const [loadingAssignees, setLoadingAssignees] = useState(false);
  const [attachments, setAttachments] = useState<AttachmentStub[]>([]);

  const currentUserId = user?.id || "";

  useEffect(() => {
    if (!open) {
      setTitle("");
      setDescription("");
      setAssigneeId(currentUserId);
      setDueDate("");
      setAttachments([]);
      return;
    }

    setAssigneeId(currentUserId);
    let cancelled = false;

    async function loadAssignees() {
      setLoadingAssignees(true);
      try {
        const response = (await adminApi.getUsers({ limit: 100 })) as {
          users?: Array<{
            id: string;
            name?: string;
            firstName?: string;
            lastName?: string;
            email?: string;
            role?: string;
          }>;
        };
        if (cancelled) return;
        const options = (response.users || [])
          .filter((member) => isAdminRoleLabel(member.role))
          .map((member) => ({
            id: member.id,
            name: displayName(member),
            email: member.email || "",
          }));
        setAssignees(options);
      } catch {
        if (!cancelled) {
          toast.error("Could not load team members");
          setAssignees([]);
        }
      } finally {
        if (!cancelled) setLoadingAssignees(false);
      }
    }

    void loadAssignees();
    return () => {
      cancelled = true;
    };
  }, [open, currentUserId]);

  const selectedAssignee = useMemo(
    () => assignees.find((member) => member.id === assigneeId),
    [assignees, assigneeId]
  );

  const handleAttachmentFiles = (files: FileList | null) => {
    if (!files?.length) return;
    const next: AttachmentStub[] = [];
    for (const file of Array.from(files)) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} exceeds the 10 MB limit`);
        continue;
      }
      next.push({
        id: `${file.name}-${file.size}-${file.lastModified}`,
        name: file.name,
        size: file.size,
      });
    }
    if (next.length) {
      setAttachments((prev) => [...prev, ...next]);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    await onSubmit({
      title: trimmed,
      description: description.trim() || undefined,
      assigneeId: assigneeId || currentUserId || null,
      assigneeName: selectedAssignee?.name || user?.name || null,
      dueDate: dueDate ? new Date(`${dueDate}T17:00:00`).toISOString() : null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
          <DialogDescription>
            Assign follow-up work to yourself or someone on the admin team.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="admin-task-title">Task Name</Label>
            <Input
              id="admin-task-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Review portfolio"
              disabled={isSubmitting}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="admin-task-assignee">Assignee</Label>
            <Select
              value={assigneeId || undefined}
              onValueChange={setAssigneeId}
              disabled={isSubmitting || loadingAssignees}
            >
              <SelectTrigger id="admin-task-assignee">
                <SelectValue
                  placeholder={
                    loadingAssignees ? "Loading team…" : "Select team member"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {assignees.length === 0 ? (
                  <SelectItem value="__empty__" disabled>
                    No admin team members found
                  </SelectItem>
                ) : (
                  assignees.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.name}
                      {member.email ? ` · ${member.email}` : ""}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="admin-task-description">Description</Label>
              <span className="text-xs text-muted-foreground">
                {description.length}/{MAX_TASK_DESCRIPTION_LENGTH}
              </span>
            </div>
            <Textarea
              id="admin-task-description"
              className="min-h-[100px]"
              value={description}
              maxLength={MAX_TASK_DESCRIPTION_LENGTH}
              onChange={(event) =>
                setDescription(
                  event.target.value.slice(0, MAX_TASK_DESCRIPTION_LENGTH)
                )
              }
              placeholder="Add details for this task"
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="admin-task-due">Due Date</Label>
            <Input
              id="admin-task-due"
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Attachments</Label>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              multiple
              onChange={(event) => handleAttachmentFiles(event.target.files)}
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
              className="flex w-full flex-col items-center justify-center gap-1 rounded-md border border-dashed border-[#272055]/25 bg-[#fafbfd] px-4 py-8 text-center transition-colors hover:border-[#272055]/40 hover:bg-[#f5f6fa]"
              disabled={isSubmitting}
            >
              <Upload className="h-5 w-5 text-[#272055]/60" />
              <span className="text-sm font-medium text-[#272055]">
                Drag and Drop or Click to Upload
              </span>
              <span className="text-xs text-muted-foreground">10 MB max</span>
            </button>
            {attachments.length > 0 ? (
              <ul className="mt-2 space-y-1.5">
                {attachments.map((attachment) => (
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
                        setAttachments((prev) =>
                          prev.filter((item) => item.id !== attachment.id)
                        )
                      }
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
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
            disabled={isSubmitting || !title.trim()}
            onClick={() => void handleSubmit()}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Create task"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
