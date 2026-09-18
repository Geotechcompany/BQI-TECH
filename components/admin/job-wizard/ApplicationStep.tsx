"use client";

import { useMemo, useState } from "react";
import { ExternalLink, Plus, Pencil, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { HELP_PATHS } from "@/lib/help/urls";
import {
  ApplicationFormField,
  ApplicationQuestionnaire,
  FormFieldMode,
  JobWizardState,
} from "@/types/job-wizard";
import {
  FORM_FIELD_CATEGORY_LABELS,
  flattenQuestionnaires,
} from "./job-wizard-config";
import { JobCareersPreviewDialog } from "./JobCareersPreviewDialog";
import { getCareersJobPreviewPath } from "./job-preview-urls";
import { QuestionnaireBuilderDialog } from "./QuestionnaireBuilderDialog";
import { countQuestionnaireQuestions } from "./questionnaire-utils";

interface StepProps {
  state: JobWizardState;
  onChange: (patch: Partial<JobWizardState>) => void;
  jobId?: string;
  /** Saves if needed, then opens isolated careers preview (`preview=1`). */
  onOpenCareersPreview?: () => Promise<boolean>;
}

const CATEGORY_ORDER: ApplicationFormField["category"][] = [
  "personal",
  "experience",
  "general",
];

function ModeToggle({
  value,
  onChange,
  locked,
}: {
  value: FormFieldMode;
  onChange: (mode: FormFieldMode) => void;
  locked?: boolean;
}) {
  const options: FormFieldMode[] = locked
    ? ["required"]
    : ["required", "optional", "disabled"];

  return (
    <div className="inline-flex rounded-lg border border-[#272055]/15 bg-white p-0.5">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          disabled={locked}
          onClick={() => onChange(option)}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors",
            value === option
              ? "bg-emerald-600 text-white"
              : "text-[#272055]/70 hover:bg-[#31CDFF]/10",
            locked && "cursor-default"
          )}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

export function ApplicationStep({
  state,
  onChange,
  jobId,
  onOpenCareersPreview,
}: StepProps) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingQuestionnaire, setEditingQuestionnaire] =
    useState<ApplicationQuestionnaire | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const careersHref = getCareersJobPreviewPath(jobId);

  const handleOpenCareersPage = async () => {
    if (jobId) return;
    if (onOpenCareersPreview) {
      const opened = await onOpenCareersPreview();
      if (opened) return;
    }
    toast.error("Save progress first to open the careers page.");
  };

  const fieldsByCategory = useMemo(() => {
    const grouped = new Map<
      ApplicationFormField["category"],
      ApplicationFormField[]
    >();

    for (const category of CATEGORY_ORDER) {
      grouped.set(category, []);
    }

    for (const field of state.formFields) {
      const list = grouped.get(field.category) || [];
      list.push(field);
      grouped.set(field.category, list);
    }

    return CATEGORY_ORDER.map((category) => ({
      category,
      label: FORM_FIELD_CATEGORY_LABELS[category],
      fields: grouped.get(category) || [],
    })).filter((group) => group.fields.length > 0);
  }, [state.formFields]);

  const syncQuestionnaires = (questionnaires: ApplicationQuestionnaire[]) => {
    onChange({
      questionnaires,
      customQuestions: flattenQuestionnaires(questionnaires),
    });
  };

  const updateField = (id: string, mode: FormFieldMode) => {
    onChange({
      formFields: state.formFields.map((field) =>
        field.id === id && !field.locked ? { ...field, mode } : field
      ),
    });
  };

  const openCreateQuestionnaire = () => {
    setEditingQuestionnaire(null);
    setEditorOpen(true);
  };

  const openEditQuestionnaire = (questionnaire: ApplicationQuestionnaire) => {
    setEditingQuestionnaire(questionnaire);
    setEditorOpen(true);
  };

  const saveQuestionnaire = (questionnaire: ApplicationQuestionnaire) => {
    const exists = state.questionnaires.some((q) => q.id === questionnaire.id);
    const next = exists
      ? state.questionnaires.map((q) =>
          q.id === questionnaire.id ? questionnaire : q
        )
      : [...state.questionnaires, questionnaire];
    syncQuestionnaires(next);
  };

  const removeQuestionnaire = (id: string) => {
    syncQuestionnaires(state.questionnaires.filter((q) => q.id !== id));
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-[#272055]">
            Application Form
          </h3>
          <p className="text-sm text-muted-foreground">
            Choose what info to collect from candidates who apply through your
            Careers Site or Employee Portal.
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-start gap-1.5 sm:items-end">
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[#31CDFF] hover:underline"
          >
            Preview
          </button>
          {jobId ? (
            <a
              href={careersHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-[#31CDFF] hover:underline"
            >
              Open live careers page
              <ExternalLink className="h-3 w-3" />
            </a>
          ) : (
            <button
              type="button"
              onClick={() => void handleOpenCareersPage()}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-[#31CDFF] hover:underline"
              title="Save this position first to open the careers page"
            >
              Open live careers page
              <ExternalLink className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      <div className="space-y-6">
        {fieldsByCategory.map((group) => (
          <div key={group.category}>
            <h4 className="mb-3 text-sm font-semibold text-[#272055]">
              {group.label}
            </h4>
            <div className="space-y-2">
              {group.fields.map((field) => (
                <div
                  key={field.id}
                  className="flex flex-col gap-3 rounded-xl border border-[#272055]/10 bg-[#fafbfd] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="font-medium text-[#272055]">
                    {field.label}
                  </span>
                  <ModeToggle
                    value={field.mode}
                    locked={field.locked}
                    onChange={(mode) => updateField(field.id, mode)}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-4 border-t border-[#272055]/10 pt-6">
        <div>
          <h3 className="text-base font-semibold text-[#272055]">
            Application Questionnaire
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Extend your application with custom questions.{" "}
            <a
              href={HELP_PATHS.questionnaires}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-[#31CDFF] hover:underline"
            >
              Learn More
            </a>
          </p>
        </div>

        {state.questionnaires.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#272055]/15 px-4 py-10 text-center text-sm text-muted-foreground">
            You have not created any questionnaires.
          </div>
        ) : (
          <div className="space-y-3">
            {state.questionnaires.map((questionnaire) => {
              const questionCount = countQuestionnaireQuestions(questionnaire);
              return (
                <div
                  key={questionnaire.id}
                  className="flex flex-col gap-3 rounded-xl border border-[#272055]/10 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium text-[#272055]">
                      {questionnaire.title}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {questionCount} question
                      {questionCount === 1 ? "" : "s"}
                      {questionnaire.sections?.length
                        ? ` · ${questionnaire.sections.length} section${
                            questionnaire.sections.length === 1 ? "" : "s"
                          }`
                        : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Edit questionnaire"
                      onClick={() => openEditQuestionnaire(questionnaire)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Remove questionnaire"
                      onClick={() => removeQuestionnaire(questionnaire.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#272055]/10 bg-[#fafbfd] px-4 py-3">
          <Checkbox
            checked={state.includeAnswersOnExperience}
            onCheckedChange={(checked) =>
              onChange({ includeAnswersOnExperience: checked === true })
            }
            className="mt-0.5"
          />
          <span className="text-sm text-[#272055]">
            Include candidate&apos;s answers on the Experience tab of their
            profile.
          </span>
        </label>

        <Button type="button" variant="outline" onClick={openCreateQuestionnaire}>
          <Plus className="mr-2 h-4 w-4" />
          Add a Questionnaire
        </Button>
      </div>

      <QuestionnaireBuilderDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        initial={editingQuestionnaire}
        pipelineStages={state.pipelineStages}
        onSave={saveQuestionnaire}
      />

      <JobCareersPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        state={state}
        variant="application"
      />
    </div>
  );
}
