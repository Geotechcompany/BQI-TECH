"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Save, X } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { WizardSkeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { BlogWizardStepId } from "@/types/blog-wizard";
import {
  BLOG_WIZARD_STEPS,
  contentHasText,
} from "./blog-wizard-config";
import { FinishBlogWizardResult, useBlogWizard } from "./useBlogWizard";
import { renderBlogWizardStep } from "./wizard-steps";
import { publicAdminHref } from "@/lib/admin-path";

interface BlogSetupWizardProps {
  postId?: string;
}

function validateStep(
  step: BlogWizardStepId,
  state: ReturnType<typeof useBlogWizard>["state"]
) {
  if (step === "basics") {
    if (!state.title.trim()) return "Title is required.";
    if (!state.excerpt.trim()) return "Excerpt is required.";
    if (!state.category.trim()) return "Category is required.";
    if (!state.readTime.trim()) return "Read time is required.";
    if (
      state.slug.trim() &&
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(state.slug.trim())
    ) {
      return "Slug must use lowercase letters, numbers, and hyphens.";
    }
  }

  if (step === "content" && !contentHasText(state.content)) {
    return "Add post content before continuing.";
  }

  if (step === "media") {
    if (!state.imageUrl.trim()) return "Upload a cover image.";
    if (!state.authorName.trim()) return "Author name is required.";
    if (!state.authorTitle.trim()) return "Author title is required.";
    if (!state.authorBio.trim()) return "Author bio is required.";
    if (!state.authorProfileImage.trim()) {
      return "Upload an author profile photo.";
    }
  }

  if (step === "publish") {
    return (
      validateStep("basics", state) ||
      validateStep("content", state) ||
      validateStep("media", state)
    );
  }

  return null;
}

export function BlogSetupWizard({ postId }: BlogSetupWizardProps) {
  const router = useRouter();
  const {
    state,
    setState,
    isLoading,
    isSaving,
    saveProgress,
    finishWizard,
  } = useBlogWizard(postId);

  const [activeStep, setActiveStep] = useState<BlogWizardStepId>("basics");
  const [completedSteps, setCompletedSteps] = useState<Set<BlogWizardStepId>>(
    () => new Set()
  );
  const [finishResult, setFinishResult] = useState<FinishBlogWizardResult | null>(
    null
  );

  const activeIndex = BLOG_WIZARD_STEPS.findIndex(
    (step) => step.id === activeStep
  );
  const isLastStep = activeIndex === BLOG_WIZARD_STEPS.length - 1;
  const pageTitle = postId ? "Edit Blog Post" : "Create a Blog Post";

  const stepTitle = useMemo(
    () => BLOG_WIZARD_STEPS.find((step) => step.id === activeStep)?.label || "",
    [activeStep]
  );

  const patchState = (patch: Partial<typeof state>) => {
    setState((current) => ({ ...current, ...patch }));
  };

  const handleClose = () => {
    router.push(publicAdminHref("/manage/blog-management"));
  };

  const handleContinue = async () => {
    const error = validateStep(activeStep, state);
    if (error) {
      toast.error(error);
      return;
    }

    setCompletedSteps((current) => new Set(current).add(activeStep));

    if (isLastStep) {
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
      setActiveStep(BLOG_WIZARD_STEPS[activeIndex + 1].id);
    } catch {
      // saveProgress already toasts
    }
  };

  const handleBack = () => {
    if (activeIndex > 0) {
      setActiveStep(BLOG_WIZARD_STEPS[activeIndex - 1].id);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100">
        <WizardSkeleton />
      </div>
    );
  }

  if (finishResult) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100 px-5">
        <div className="w-full max-w-md rounded-2xl border border-[#272055]/10 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#31CDFF]/15">
            <Check className="h-6 w-6 text-[#31CDFF]" />
          </div>
          <h2 className="mt-4 text-xl font-bold tracking-[-0.02em] text-[#272055]">
            {finishResult.published ? "Post published" : "Draft saved"}
          </h2>
          <p className="mt-2 text-sm text-[#272055]/55">
            {finishResult.title}
            {finishResult.published && finishResult.slug
              ? ` is live at /blog/${finishResult.slug}`
              : " is ready when you want to publish."}
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            {finishResult.published && finishResult.slug ? (
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  window.open(`/blog/${finishResult.slug}`, "_blank")
                }
              >
                View post
              </Button>
            ) : null}
            <Button type="button" onClick={handleClose}>
              Back to Blog Management
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col">
        <div className="flex items-start justify-between border-b border-[#272055]/10 px-5 py-5 md:px-6 md:py-6">
          <div>
            <h1 className="text-2xl font-bold leading-[1.1] tracking-[-0.02em] text-[#272055] md:text-[1.75rem]">
              {pageTitle}
            </h1>
            <p className="mt-2.5 text-sm font-normal leading-relaxed text-[#272055]/55">
              Walk through the steps, then publish when you&apos;re ready.
            </p>
          </div>
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

        <div className="flex min-h-[calc(100vh-5.5rem)] flex-col lg:flex-row">
          <aside className="border-b border-[#272055]/10 lg:w-64 lg:border-b-0 lg:border-r lg:border-[#272055]/10">
            <nav className="flex gap-1 overflow-x-auto p-3 lg:flex-col lg:overflow-visible">
              {BLOG_WIZARD_STEPS.map((step, index) => {
                const Icon = step.icon;
                const isActive = step.id === activeStep;
                const isComplete = completedSteps.has(step.id);

                return (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => setActiveStep(step.id)}
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
                    {isActive ? (
                      <span className="ml-auto hidden text-xs text-[#31CDFF] lg:inline">
                        {index + 1}/{BLOG_WIZARD_STEPS.length}
                      </span>
                    ) : null}
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

            <div className="flex-1 overflow-y-auto px-5 py-6 md:px-6">
              {renderBlogWizardStep(activeStep, {
                state,
                onChange: patchState,
              })}
            </div>

            <div className="flex items-center justify-between border-t border-[#272055]/10 px-5 py-4 md:px-6">
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
                <Button
                  type="button"
                  onClick={() => void handleContinue()}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : isLastStep ? (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      {state.published ? "Publish Post" : "Save Draft"}
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
