"use client";

import { useMemo } from "react";
import { Briefcase, Calendar, MapPin } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SafeHtml } from "@/components/ui/safe-html";
import { CandidateApplicationForm } from "@/components/apply/CandidateApplicationForm";
import { JobWizardState } from "@/types/job-wizard";
import { wizardStateToPreviewQuestions } from "./wizard-preview-questions";

export type JobCareersPreviewVariant = "description" | "application";

interface JobCareersPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: JobWizardState;
  variant: JobCareersPreviewVariant;
}

function formatPostedDate(value: string): string {
  if (!value.trim()) return "Not set";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString();
}

export function JobCareersPreviewDialog({
  open,
  onOpenChange,
  state,
  variant,
}: JobCareersPreviewDialogProps) {
  const title = state.title.trim() || "Untitled position";
  const isApplication = variant === "application";
  const previewQuestions = useMemo(
    () => (isApplication ? wizardStateToPreviewQuestions(state) : []),
    [isApplication, state]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col gap-0 overflow-hidden p-0 bg-white text-gray-900 [color-scheme:light]">
        <DialogHeader className="shrink-0 border-b border-[#272055]/10 px-6 py-5 text-left">
          <p className="text-xs font-medium uppercase tracking-wide text-[#31CDFF]">
            {isApplication ? "Application preview" : "Description preview"}
          </p>
          <DialogTitle className="text-2xl font-bold text-[#272055]">
            {isApplication ? "Candidate application form" : title}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {isApplication
              ? "Same layout candidates see when applying. Submit is disabled."
              : "How this position description will appear on the careers site."}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {!isApplication ? (
            <>
              <div className="mb-6 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-[#fafbfd] p-3">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Briefcase className="h-3.5 w-3.5" />
                    Department
                  </p>
                  <p className="mt-1 text-sm font-medium text-[#272055]">
                    {state.department.trim() || "Not set"}
                  </p>
                </div>
                <div className="rounded-xl bg-[#fafbfd] p-3">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" />
                    Location
                  </p>
                  <p className="mt-1 text-sm font-medium text-[#272055]">
                    {state.location.trim() || "Not set"}
                  </p>
                </div>
                <div className="rounded-xl bg-[#fafbfd] p-3">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    Posted
                  </p>
                  <p className="mt-1 text-sm font-medium text-[#272055]">
                    {formatPostedDate(state.postedDate)}
                  </p>
                </div>
              </div>

              <p className="mb-4 text-sm text-muted-foreground">
                {state.employmentType || "Full-time"}
              </p>

              {state.description.trim() ? (
                <div className="prose max-w-none text-[#272055]">
                  <SafeHtml html={state.description} />
                </div>
              ) : (
                <p className="rounded-xl border border-dashed border-[#272055]/15 px-4 py-8 text-center text-sm text-muted-foreground">
                  Add a description to see it in this preview.
                </p>
              )}
            </>
          ) : (
            <CandidateApplicationForm
              key={`${open}-${previewQuestions.map((q) => q.id).join("|")}`}
              title={title}
              questions={previewQuestions}
              mode="preview"
              framed={false}
              subtitle="Fill out each section, then submit."
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
