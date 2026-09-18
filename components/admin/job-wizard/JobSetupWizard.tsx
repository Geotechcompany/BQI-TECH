"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Save, X } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { WizardSkeleton } from "@/components/ui/skeleton";
import { TourHelpButton } from "@/components/admin/tour/TourHelpButton";
import { TourPageHelper } from "@/components/admin/tour/TourPageHelper";
import { cn } from "@/lib/utils";
import { APP_URL } from "@/lib/config";
import { JobWizardStepId } from "@/types/job-wizard";
import {
  canActivateJob,
  formatMissingActivationMessage,
  getMissingActivationFields,
} from "@/lib/job-activation";
import { WIZARD_STEPS } from "./job-wizard-config";
import {
  getCareersJobLivePath,
  getCareersJobPreviewPath,
  openCareersJobPreviewTab,
} from "./job-preview-urls";
import { PositionActivatedModal } from "./PositionActivatedModal";
import { renderWizardStep } from "./wizard-steps";
import { FinishWizardResult, useJobWizard } from "./useJobWizard";

interface JobSetupWizardProps {
  jobId?: string;
}

function validateStep(step: JobWizardStepId, state: ReturnType<typeof useJobWizard>["state"]) {
  if (step === "details") {
    const missing = getMissingActivationFields(state).filter((label) =>
      ["Title", "Department", "Location"].includes(label)
    );
    if (missing.length) {
      return "Title, department, and location are required.";
    }
  }

  if (step === "description" && !state.description.trim()) {
    return "Add a job description before continuing.";
  }

  if (step === "pipeline") {
    const enabled = state.pipelineStages.filter((stage) => stage.enabled);
    if (!enabled.length) {
      return "Enable at least one pipeline stage.";
    }
  }

  return null;
}

export function JobSetupWizard({ jobId }: JobSetupWizardProps) {
  const router = useRouter();
  const {
    state,
    setState,
    savedJobId,
    isLoading,
    isSaving,
    saveProgress,
    finishWizard,
  } = useJobWizard(jobId);

  const [activeStep, setActiveStep] = useState<JobWizardStepId>("details");
  const [completedSteps, setCompletedSteps] = useState<Set<JobWizardStepId>>(
    () => new Set()
  );
  const [finishResult, setFinishResult] = useState<FinishWizardResult | null>(null);

  const activeIndex = WIZARD_STEPS.findIndex((step) => step.id === activeStep);
  const isLastStep = activeIndex === WIZARD_STEPS.length - 1;
  const pageTitle = jobId ? "Edit Position" : "Create a New Position";

  const stepTitle = useMemo(
    () => WIZARD_STEPS.find((step) => step.id === activeStep)?.label || "",
    [activeStep]
  );

  const patchState = (patch: Partial<typeof state>) => {
    setState((current) => ({ ...current, ...patch }));
  };

  const goToStep = (step: JobWizardStepId) => {
    setActiveStep(step);
  };

  const handleClose = () => {
    router.push("/admin/job-postings");
  };

  const openCareersPreview = async (): Promise<boolean> => {
    const existingId = savedJobId?.trim();

    try {
      const targetId = (await saveProgress()) || existingId;
      if (!targetId) {
        toast.error("Save progress first to preview on the careers site.");
        return false;
      }
      return openCareersJobPreviewTab(targetId);
    } catch {
      // Prefer the public careers tab whenever an id already exists.
      if (existingId && openCareersJobPreviewTab(existingId)) {
        return true;
      }
      toast.error("Save progress first to preview on the careers site.");
      return false;
    }
  };

  const handleContinue = async () => {
    const error = validateStep(activeStep, state);
    if (error) {
      toast.error(error);
      return;
    }

    setCompletedSteps((current) => new Set(current).add(activeStep));

    if (isLastStep) {
      if (state.isActive && !canActivateJob(state)) {
        toast.error(
          formatMissingActivationMessage(getMissingActivationFields(state))
        );
        return;
      }
      try {
        const result = await finishWizard();
        setFinishResult(result);
      } catch {
        // finishWizard already toasts
      }
      return;
    }

    try {
      await saveProgress();
      setActiveStep(WIZARD_STEPS[activeIndex + 1].id);
    } catch {
      // saveProgress already toasts
    }
  };

  const handleBack = () => {
    if (activeIndex > 0) {
      setActiveStep(WIZARD_STEPS[activeIndex - 1].id);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100">
        <WizardSkeleton />
      </div>
    );
  }

  const handleFinishModalClose = () => {
    router.push("/admin/job-postings");
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <TourPageHelper tourId="job-wizard" />
      {finishResult && (
        <PositionActivatedModal
          open
          onClose={handleFinishModalClose}
          jobTitle={finishResult.title}
          jobUrl={
            finishResult.jobId
              ? `${APP_URL}${
                  finishResult.isActive
                    ? getCareersJobLivePath(finishResult.jobId)
                    : getCareersJobPreviewPath(finishResult.jobId)
                }`
              : `${APP_URL}/careers/jobs`
          }
          isActive={finishResult.isActive}
        />
      )}
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col">
        <div className="flex items-start justify-between border-b border-[#272055]/10 px-5 py-5 md:px-6 md:py-6">
          <div>
            <h1 className="text-2xl font-bold leading-[1.1] tracking-[-0.02em] text-[#272055] md:text-[1.75rem]">
              {pageTitle}
            </h1>
            <p className="mt-2.5 text-sm font-normal leading-relaxed text-[#272055]/55">
              Hiring starts with an open position. Walk through the steps, then
              publish when you&apos;re ready.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <TourHelpButton tourId="job-wizard" />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleClose}
              aria-label="Close wizard"
              className="h-9 w-9 shrink-0 rounded-full border border-[#272055]/25 bg-transparent text-[#272055] transition-transform duration-100 ease-out hover:bg-[#272055]/5 hover:text-[#272055] active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex min-h-[calc(100vh-5.5rem)] flex-col lg:flex-row">
          <aside className="border-b border-[#272055]/10 lg:w-64 lg:border-b-0 lg:border-r lg:border-[#272055]/10">
            <nav
              className="flex gap-1 overflow-x-auto p-3 lg:flex-col lg:overflow-visible"
              data-tour="job-wizard-steps"
            >
              {WIZARD_STEPS.map((step, index) => {
                const Icon = step.icon;
                const isActive = step.id === activeStep;
                const isComplete = completedSteps.has(step.id);

                return (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => goToStep(step.id)}
                    className={cn(
                      "flex min-w-[150px] items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors lg:min-w-0",
                      isActive
                        ? "bg-[#31CDFF]/15 text-[#272055]"
                        : "text-[#272055]/70 hover:bg-[#272055]/5"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border",
                        isActive
                          ? "border-[#31CDFF] bg-gray-100 text-[#31CDFF]"
                          : "border-[#272055]/15 bg-gray-100"
                      )}
                    >
                      {isComplete ? (
                        <Check className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <Icon className="h-4 w-4" />
                      )}
                    </span>
                    <span className="text-sm font-medium">{step.label}</span>
                    {isActive && (
                      <span className="ml-auto hidden text-xs text-[#31CDFF] lg:inline">
                        {index + 1}/{WIZARD_STEPS.length}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </aside>

          <div className="flex flex-1 flex-col">
            <div className="border-b border-[#272055]/10 px-5 py-5 md:px-6">
              <h2 className="text-xl font-bold leading-[1.15] tracking-[-0.02em] text-[#272055]">
                {stepTitle}
              </h2>
            </div>

            <div
              className="flex-1 overflow-y-auto px-5 py-6 md:px-6"
              data-tour="job-wizard-content"
            >
              {renderWizardStep(activeStep, {
                state,
                onChange: patchState,
                jobId: savedJobId,
                onOpenCareersPreview: openCareersPreview,
              })}
            </div>

            <div
              className="flex items-center justify-between border-t border-[#272055]/10 px-5 py-4 md:px-6"
              data-tour="job-wizard-actions"
            >
              <Button
                type="button"
                variant="outline"
                onClick={handleBack}
                disabled={activeIndex === 0 || isSaving}
              >
                Back
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void saveProgress()}
                  disabled={isSaving}
                >
                  <Save className="mr-2 h-4 w-4" />
                  Save as Draft
                </Button>
                <Button type="button" onClick={() => void handleContinue()} disabled={isSaving}>
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : isLastStep ? (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Activate Position
                    </>
                  ) : (
                    "Next Step >"
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
