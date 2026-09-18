"use client";

import { useCallback, useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FailedStatusState } from "@/components/ui/failed-status-state";
import { ListSkeleton } from "@/components/ui/skeleton";
import { candidateEmailApi } from "@/components/admin/utils/candidate-email-api";
import type { ApplicationEmailMessage } from "@/types/application-email";
import { cn } from "@/lib/utils";
import { toast } from "react-hot-toast";

interface CandidateEmailSmsProps {
  applicationId: string;
  candidateName: string;
  candidateEmail: string;
}

function formatSentAt(value: string): string {
  try {
    return format(parseISO(value), "MMM d, yyyy · h:mm a");
  } catch {
    return value || "—";
  }
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

export function CandidateEmailSms({
  applicationId,
  candidateName,
  candidateEmail,
}: CandidateEmailSmsProps) {
  const hasEmail =
    Boolean(candidateEmail?.trim()) &&
    candidateEmail !== "No Email Provided" &&
    candidateEmail.includes("@");

  const [messages, setMessages] = useState<ApplicationEmailMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isComposing, setIsComposing] = useState(false);
  const [to, setTo] = useState(hasEmail ? candidateEmail : "");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [isSending, setIsSending] = useState(false);

  const loadMessages = useCallback(async () => {
    try {
      setIsLoading(true);
      setLoadError(null);
      const response = await candidateEmailApi.listMessages(applicationId);
      setMessages(response.messages || []);
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Failed to load messages"
      );
    } finally {
      setIsLoading(false);
    }
  }, [applicationId]);

  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    setTo(hasEmail ? candidateEmail : "");
    setSubject("");
    setBody("");
    setIsComposing(false);
  }, [applicationId, candidateEmail, hasEmail]);

  const openComposer = () => {
    if (!hasEmail) {
      toast.error("This candidate has no email address on file");
      return;
    }
    setTo(candidateEmail);
    setIsComposing(true);
  };

  const closeComposer = () => {
    setIsComposing(false);
    setSubject("");
    setBody("");
    setTo(hasEmail ? candidateEmail : "");
  };

  const handleSend = async () => {
    const trimmedTo = to.trim();
    const trimmedSubject = subject.trim();
    const trimmedBody = body.trim();

    if (!trimmedTo || !trimmedTo.includes("@")) {
      toast.error("Enter a valid recipient email");
      return;
    }
    if (!trimmedSubject) {
      toast.error("Subject is required");
      return;
    }
    if (!trimmedBody) {
      toast.error("Message body is required");
      return;
    }

    setIsSending(true);
    try {
      const sent = await candidateEmailApi.sendEmail(applicationId, {
        to: trimmedTo,
        subject: trimmedSubject,
        body: trimmedBody,
      });
      setMessages((current) => [sent, ...current]);
      closeComposer();
      toast.success("Email sent");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send email");
      void loadMessages();
    } finally {
      setIsSending(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 py-4">
        <ListSkeleton items={4} />
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
            onClick={() => void loadMessages()}
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col justify-start">
      <div className="mb-4 flex shrink-0 items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[#272055]">Email</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Messages sent to {candidateName} from this profile.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            size="sm"
            className="bg-[#31CDFF] text-white hover:bg-[#31CDFF]/90"
            onClick={openComposer}
            disabled={isComposing || !hasEmail}
          >
            <Mail className="mr-1.5 h-3.5 w-3.5" />
            Compose Email
          </Button>
        </div>
      </div>

      {isComposing ? (
        <div className="mb-4 shrink-0 space-y-3 rounded-lg border border-[#272055]/10 bg-[#f8f9fb] p-4">
          <div className="space-y-1.5">
            <Label htmlFor="candidate-email-to" className="text-xs text-muted-foreground">
              To
            </Label>
            <Input
              id="candidate-email-to"
              type="email"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              placeholder="candidate@example.com"
              disabled={isSending}
            />
          </div>
          <div className="space-y-1.5">
            <Label
              htmlFor="candidate-email-subject"
              className="text-xs text-muted-foreground"
            >
              Subject
            </Label>
            <Input
              id="candidate-email-subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="Subject"
              disabled={isSending}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label
              htmlFor="candidate-email-body"
              className="text-xs text-muted-foreground"
            >
              Message
            </Label>
            <Textarea
              id="candidate-email-body"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder={`Write a message to ${candidateName}...`}
              className="min-h-[160px] resize-y"
              disabled={isSending}
            />
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={closeComposer}
              disabled={isSending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              className="bg-[#31CDFF] text-white hover:bg-[#31CDFF]/90"
              onClick={() => void handleSend()}
              disabled={isSending}
            >
              {isSending ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Sending...
                </>
              ) : (
                "Send"
              )}
            </Button>
          </div>
        </div>
      ) : null}

      {messages.length === 0 && !isComposing ? (
        <div className="flex flex-col items-center px-4 pt-6 text-center">
          <Mail className="mb-3 h-10 w-10 text-[#272055]/25" aria-hidden />
          <p className="text-sm font-medium text-[#272055]">No emails yet</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {hasEmail
              ? `No messages have been sent to ${candidateName} yet.`
              : "Add a contact email before sending a message."}
          </p>
          {hasEmail ? (
            <Button
              type="button"
              size="sm"
              className="mt-4 bg-[#31CDFF] text-white hover:bg-[#31CDFF]/90"
              onClick={openComposer}
            >
              <Mail className="mr-1.5 h-3.5 w-3.5" />
              Compose Email
            </Button>
          ) : null}
        </div>
      ) : messages.length > 0 ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="space-y-3 pb-2">
            {messages.map((message) => (
              <MessageCard key={message.id} message={message} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
