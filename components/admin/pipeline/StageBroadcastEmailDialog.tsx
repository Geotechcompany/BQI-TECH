"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Eye, Loader2, Mail } from "lucide-react";
import { toast } from "react-hot-toast";
import { adminApi } from "@/lib/api-backend";
import {
  findTemplateForStage,
  normalizeBroadcastTemplate,
  type BroadcastEmailTemplate,
} from "@/lib/email-broadcast-templates";

interface StageBroadcastEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stageLabel: string;
  /** Pipeline stage id (e.g. technical-assessment); used to auto-select template. */
  stageId?: string;
  recipientEmails: string[];
  candidateCount: number;
}

export function StageBroadcastEmailDialog({
  open,
  onOpenChange,
  stageLabel,
  stageId,
  recipientEmails,
  candidateCount,
}: StageBroadcastEmailDialogProps) {
  const [templates, setTemplates] = useState<BroadcastEmailTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [templateId, setTemplateId] = useState<string>("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [sending, setSending] = useState(false);

  const missingEmailCount = Math.max(0, candidateCount - recipientEmails.length);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    const load = async () => {
      setLoadingTemplates(true);
      setShowPreview(false);
      setSending(false);
      try {
        const response = await adminApi.listEmailTemplates();
        const items = (response?.items || []).map((item) =>
          normalizeBroadcastTemplate(item as Record<string, unknown>)
        );
        if (cancelled) return;
        setTemplates(items);

        const match =
          findTemplateForStage(items, stageId || stageLabel) || items[0];
        if (match) {
          setTemplateId(match.id);
          setSubject(match.subject);
          setBody(match.html || match.body);
        } else {
          setTemplateId("");
          setSubject("");
          setBody("");
        }
      } catch (error: unknown) {
        if (cancelled) return;
        setTemplates([]);
        setTemplateId("");
        setSubject("");
        setBody("");
        const message =
          error instanceof Error ? error.message : "Could not load templates";
        toast.error(message);
      } finally {
        if (!cancelled) setLoadingTemplates(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [open, stageId, stageLabel]);

  const applyTemplate = (id: string) => {
    setTemplateId(id);
    const template = templates.find((item) => item.id === id);
    if (!template) return;
    setSubject(template.subject);
    setBody(template.html || template.body);
    setShowPreview(false);
  };

  const onSend = async () => {
    if (recipientEmails.length === 0) {
      toast.error("No applicant emails on this stage");
      return;
    }
    if (!subject.trim() || !body.trim()) {
      toast.error("Add a subject and email body before sending");
      return;
    }

    setSending(true);
    try {
      const response = await adminApi.sendEmailBroadcast({
        subject: subject.trim(),
        body,
        recipients: recipientEmails,
        mode: "list",
      });

      const sentCount =
        typeof response?.sent === "number"
          ? response.sent
          : recipientEmails.length;

      toast.success(
        `Sent to ${sentCount} applicant${sentCount === 1 ? "" : "s"} in ${stageLabel}`
      );
      onOpenChange(false);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Could not send email";
      toast.error(message);
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-[min(96vw,64rem)] !max-w-5xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-[#272156]/10 px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-[#272156]" aria-hidden />
            Email {stageLabel}
          </DialogTitle>
          <DialogDescription>
            Sends to {recipientEmails.length} applicant
            {recipientEmails.length === 1 ? "" : "s"} currently in this stage
            {missingEmailCount > 0
              ? ` (${missingEmailCount} missing email)`
              : ""}
            . Edit the subject and body before sending.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
          <div>
            <Label htmlFor="stage-email-template">Email template</Label>
            <Select
              value={templateId || undefined}
              onValueChange={applyTemplate}
              disabled={
                sending ||
                loadingTemplates ||
                recipientEmails.length === 0 ||
                templates.length === 0
              }
            >
              <SelectTrigger id="stage-email-template" className="mt-1.5">
                <SelectValue
                  placeholder={
                    loadingTemplates
                      ? "Loading templates…"
                      : "Select a template"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {templates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="stage-email-subject">Subject</Label>
            <Input
              id="stage-email-subject"
              className="mt-1.5"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="Email subject"
              disabled={sending || loadingTemplates}
            />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <Label htmlFor="stage-email-body">Email body (HTML)</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0 gap-1.5"
                onClick={() => setShowPreview((value) => !value)}
                disabled={!body.trim()}
              >
                <Eye className="h-3.5 w-3.5" />
                {showPreview ? "Hide preview" : "Preview"}
              </Button>
            </div>
            <Textarea
              id="stage-email-body"
              className="min-h-[220px] font-mono text-xs leading-relaxed"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="HTML email body"
              disabled={sending || loadingTemplates}
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              Placeholders: {"{{candidateName}}"}, {"{{jobTitle}}"},{" "}
              {"{{companyName}}"}. Edits here are used for this send only.
            </p>
          </div>

          {showPreview && body ? (
            <div className="max-h-64 overflow-auto rounded-md border border-[#272156]/15 bg-white p-3 text-sm">
              <div dangerouslySetInnerHTML={{ __html: body }} />
            </div>
          ) : null}
        </div>

        <DialogFooter className="shrink-0 border-t border-[#272156]/10 px-6 py-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={sending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="bg-[#272156] text-white hover:bg-[#272156]/90"
            onClick={() => {
              void onSend();
            }}
            disabled={
              sending ||
              loadingTemplates ||
              recipientEmails.length === 0 ||
              !subject.trim() ||
              !body.trim()
            }
          >
            {sending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending…
              </>
            ) : (
              `Send to ${recipientEmails.length}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
