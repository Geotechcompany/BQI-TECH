"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Loader2, X } from "lucide-react";
import toast from "react-hot-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { adminApi } from "@/lib/api-backend";
import { HELP_PATHS } from "@/lib/help/urls";
import { buildStubJobDescription } from "@/lib/generate-job-description-stub";

const MIN_CHARS = 20;
const MAX_CHARS = 500;

export type GenerateJobDescriptionMode = "generate" | "adjust";

interface GenerateJobDescriptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: GenerateJobDescriptionMode;
  title: string;
  department: string;
  location: string;
  employmentType: string;
  existingDescription: string;
  onGenerated: (html: string) => void;
}

export function GenerateJobDescriptionDialog({
  open,
  onOpenChange,
  mode,
  title,
  department,
  location,
  employmentType,
  existingDescription,
  onGenerated,
}: GenerateJobDescriptionDialogProps) {
  const [prompt, setPrompt] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (mode === "adjust" && existingDescription) {
      setPrompt(
        "Tighten the wording, keep the same structure, and make responsibilities more concrete for candidates."
      );
    } else {
      setPrompt("");
    }
  }, [open, mode, existingDescription]);

  const charCount = prompt.length;
  const isTooShort = charCount > 0 && charCount < MIN_CHARS;
  const isTooLong = charCount > MAX_CHARS;
  const isValid = charCount >= MIN_CHARS && charCount <= MAX_CHARS;

  const counterClass = useMemo(
    () =>
      cn(
        "text-sm tabular-nums",
        isTooShort || isTooLong || charCount === 0
          ? "font-medium text-red-500"
          : "text-[#272055]/55"
      ),
    [charCount, isTooLong, isTooShort]
  );

  const handleSubmit = async () => {
    if (!isValid || submitting) return;

    setSubmitting(true);
    try {
      const response = await adminApi.generateJobDescription({
        prompt: prompt.trim(),
        title,
        department,
        location,
        employmentType,
        existingDescription:
          mode === "adjust" ? existingDescription : undefined,
        mode,
      });

      const html =
        typeof response?.description === "string"
          ? response.description.trim()
          : "";

      if (!html) {
        throw new Error("No description returned");
      }

      onGenerated(html);
      onOpenChange(false);
      toast.success(
        mode === "adjust"
          ? "Job description updated"
          : "Job description generated"
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Generation failed";
      const useStub =
        /not configured|503|AI service|AI provider|Failed to fetch|NetworkError|fetch failed/i.test(
          message
        );

      if (useStub) {
        const stub = buildStubJobDescription({
          prompt: prompt.trim(),
          title,
          department,
          location,
          employmentType,
          existingDescription:
            mode === "adjust" ? existingDescription : undefined,
          mode,
        });
        onGenerated(stub);
        onOpenChange(false);
        toast.success(
          "Draft applied offline — add an AI provider in Settings for live generation"
        );
        return;
      }

      toast.error(message || "Could not generate the job description");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="gap-0 overflow-hidden border-[#272055]/10 p-0 sm:max-w-xl [&>button]:hidden"
        aria-describedby="generate-jd-description"
      >
        <DialogHeader className="relative space-y-2 border-b border-[#272055]/10 px-6 pb-4 pt-6 text-left">
          <DialogTitle className="pr-10 text-xl font-bold tracking-[-0.02em] text-[#272055]">
            Generate Job Description
          </DialogTitle>
          <DialogDescription
            id="generate-jd-description"
            className="text-sm leading-relaxed text-muted-foreground"
          >
            BQI Intelligence drafts a custom description for this position.{" "}
            <a
              href={HELP_PATHS.jobDescription}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-[#31CDFF] underline-offset-2 hover:text-[#272055] hover:underline"
            >
              Learn More
            </a>
          </DialogDescription>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Close"
            onClick={() => onOpenChange(false)}
            className="absolute right-4 top-4 h-9 w-9 rounded-full border border-[#272055]/25 text-[#272055] hover:bg-[#272055]/5"
          >
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>

        <div className="space-y-3 px-6 py-5">
          <Textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="20 characters minimum, 500 characters maximum."
            className="min-h-[180px] resize-y border-[#272055]/15 text-sm focus-visible:ring-[#31CDFF]"
            maxLength={MAX_CHARS + 50}
            disabled={submitting}
          />
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm leading-relaxed text-muted-foreground">
              Tell us what this position needs. Call out must-haves, tone, or
              details candidates should see.
            </p>
            <span className={counterClass} aria-live="polite">
              {charCount}/{MAX_CHARS}
            </span>
          </div>
        </div>

        <div className="flex justify-end border-t border-[#272055]/10 px-6 py-4">
          <Button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={!isValid || submitting}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <ArrowRight className="mr-2 h-4 w-4" />
                Submit
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
