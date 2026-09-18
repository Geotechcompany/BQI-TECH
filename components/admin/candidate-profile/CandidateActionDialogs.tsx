"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { adminApi } from "@/lib/api-backend";
import type { ApplicationAssignee } from "@/components/admin/utils/candidate-actions-api";

interface AddTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidateName: string;
  isSubmitting: boolean;
  onSubmit: (payload: { title: string; dueAt?: string }) => Promise<void>;
}

export function AddTaskDialog({
  open,
  onOpenChange,
  candidateName,
  isSubmitting,
  onSubmit,
}: AddTaskDialogProps) {
  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState("");

  useEffect(() => {
    if (!open) {
      setTitle("");
      setDueAt("");
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add task</DialogTitle>
          <DialogDescription>
            Create a follow-up task for {candidateName}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="candidate-task-title">Task</Label>
            <Input
              id="candidate-task-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Schedule technical screen"
              disabled={isSubmitting}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="candidate-task-due">Due (optional)</Label>
            <Input
              id="candidate-task-due"
              type="datetime-local"
              value={dueAt}
              onChange={(event) => setDueAt(event.target.value)}
              disabled={isSubmitting}
            />
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
            onClick={() =>
              void onSubmit({
                title: title.trim(),
                dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
              })
            }
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Add task"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface SetReminderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidateName: string;
  isSubmitting: boolean;
  onSubmit: (payload: { dueAt: string; note?: string }) => Promise<void>;
}

export function SetReminderDialog({
  open,
  onOpenChange,
  candidateName,
  isSubmitting,
  onSubmit,
}: SetReminderDialogProps) {
  const [dueAt, setDueAt] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!open) {
      setDueAt("");
      setNote("");
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Set reminder</DialogTitle>
          <DialogDescription>
            You will get an admin notification for {candidateName}. The due date
            also appears on the recruitment calendar.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="candidate-reminder-due">Remind me on</Label>
            <Input
              id="candidate-reminder-due"
              type="datetime-local"
              value={dueAt}
              onChange={(event) => setDueAt(event.target.value)}
              disabled={isSubmitting}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="candidate-reminder-note">Note (optional)</Label>
            <Textarea
              id="candidate-reminder-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="What should you follow up on?"
              className="min-h-[80px] resize-y"
              disabled={isSubmitting}
            />
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
            disabled={isSubmitting || !dueAt}
            onClick={() =>
              void onSubmit({
                dueAt: new Date(dueAt).toISOString(),
                note: note.trim() || undefined,
              })
            }
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Set reminder"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface AssignHiringTeamDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidateName: string;
  title?: string;
  description?: string;
  initialAssignees: ApplicationAssignee[];
  isSubmitting: boolean;
  onSubmit: (assignees: ApplicationAssignee[]) => Promise<void>;
}

export function AssignHiringTeamDialog({
  open,
  onOpenChange,
  candidateName,
  title = "Assign hiring team",
  description,
  initialAssignees,
  isSubmitting,
  onSubmit,
}: AssignHiringTeamDialogProps) {
  const dialogDescription =
    description ?? `Choose admins who should review ${candidateName}.`;
  const [admins, setAdmins] = useState<ApplicationAssignee[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    setSelectedIds(new Set(initialAssignees.map((item) => item.id)));
    setIsLoading(true);
    setLoadError(null);

    let cancelled = false;
    void (async () => {
      try {
        const response = await adminApi.getUsers({ limit: 100 });
        if (cancelled) return;
        const rawUsers =
          (response as { users?: Array<Record<string, string>> })?.users || [];
        const mapped = rawUsers
          .map((user) => ({
            id: String(user.id || user._id || ""),
            name: String(user.name || user.email || "Admin"),
            email: String(user.email || ""),
            role: String(user.role || "Admin"),
          }))
          .filter((user) => user.id);
        setAdmins(mapped);
      } catch (error) {
        if (cancelled) return;
        setLoadError(
          error instanceof Error ? error.message : "Failed to load admins"
        );
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // Only reload when the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const selectedAssignees = useMemo(
    () => admins.filter((admin) => selectedIds.has(admin.id)),
    [admins, selectedIds]
  );

  const toggle = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>

        <div className="max-h-72 space-y-2 overflow-y-auto py-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-[#31CDFF]" />
            </div>
          ) : loadError ? (
            <p className="text-sm text-red-600">{loadError}</p>
          ) : admins.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No admin users found to assign.
            </p>
          ) : (
            admins.map((admin) => (
              <label
                key={admin.id}
                className="flex cursor-pointer items-start gap-3 rounded-md border border-[#272055]/10 px-3 py-2 hover:bg-[#272055]/[0.03]"
              >
                <Checkbox
                  checked={selectedIds.has(admin.id)}
                  onCheckedChange={() => toggle(admin.id)}
                  disabled={isSubmitting}
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-[#272055]">
                    {admin.name}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {admin.email || admin.role}
                  </span>
                </span>
              </label>
            ))
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
            disabled={isSubmitting || isLoading || Boolean(loadError)}
            onClick={() => void onSubmit(selectedAssignees)}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              `Save (${selectedAssignees.length})`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
