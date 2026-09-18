"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  ListTodo,
  Pencil,
  Plus,
  Save,
  Settings2,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ApplicationQuestionnaire,
  PipelineStageConfig,
  QuestionnaireQuestion,
  QuestionnaireSection,
} from "@/types/job-wizard";
import { AddQuestionDialog } from "./AddQuestionDialog";
import {
  QUESTIONNAIRE_TEMPLATE_VARIABLES,
  createBlankQuestionnaire,
  createQuestionnaireSection,
  flattenSectionsToCustomQuestions,
  normalizeQuestionnaire,
  responseTypeLabel,
} from "./questionnaire-utils";

interface QuestionnaireBuilderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: ApplicationQuestionnaire | null;
  pipelineStages: PipelineStageConfig[];
  onSave: (questionnaire: ApplicationQuestionnaire) => void;
}

function snapshotDraft(questionnaire: ApplicationQuestionnaire): string {
  return JSON.stringify({
    title: questionnaire.title,
    sections: questionnaire.sections,
    moveOnCompletion: questionnaire.moveOnCompletion,
    moveToStageId: questionnaire.moveToStageId,
    emailTemplate: questionnaire.emailTemplate,
  });
}

export function QuestionnaireBuilderDialog({
  open,
  onOpenChange,
  initial,
  pipelineStages,
  onSave,
}: QuestionnaireBuilderDialogProps) {
  const [draft, setDraft] = useState<ApplicationQuestionnaire>(() =>
    createBlankQuestionnaire()
  );
  const [sectionOptionsOpen, setSectionOptionsOpen] = useState<
    Record<string, boolean>
  >({});
  const [showEmailTemplate, setShowEmailTemplate] = useState(false);
  const [questionDialogOpen, setQuestionDialogOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] =
    useState<QuestionnaireQuestion | null>(null);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [unsavedOpen, setUnsavedOpen] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const baselineRef = useRef("");
  const emailBodyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    const normalized = initial
      ? normalizeQuestionnaire(initial)
      : createBlankQuestionnaire();
    setDraft(normalized);
    baselineRef.current = snapshotDraft(normalized);
    setSectionOptionsOpen({});
    setShowEmailTemplate(false);
    setEditingQuestion(null);
    setActiveSectionId(null);
    setQuestionDialogOpen(false);
    setUnsavedOpen(false);
    setNameError(null);
  }, [open, initial?.id]);

  const isDirty = useMemo(
    () => snapshotDraft(draft) !== baselineRef.current,
    [draft]
  );

  const enabledStages = useMemo(
    () => pipelineStages.filter((stage) => stage.enabled),
    [pipelineStages]
  );

  const updateDraft = (patch: Partial<ApplicationQuestionnaire>) => {
    setDraft((current) => ({ ...current, ...patch }));
    if (patch.title !== undefined) setNameError(null);
  };

  const updateSection = (
    sectionId: string,
    patch: Partial<QuestionnaireSection>
  ) => {
    setDraft((current) => ({
      ...current,
      sections: current.sections.map((section) =>
        section.id === sectionId ? { ...section, ...patch } : section
      ),
    }));
  };

  const addSection = () => {
    setDraft((current) => {
      const nextSections = current.sections.map((section, index) => {
        if (
          index === current.sections.length - 1 &&
          section.navigation === "submit"
        ) {
          return { ...section, navigation: "continue" as const };
        }
        return section;
      });
      return {
        ...current,
        sections: [
          ...nextSections,
          {
            ...createQuestionnaireSection(nextSections.length),
            navigation: "submit",
          },
        ],
      };
    });
  };

  const removeSection = (sectionId: string) => {
    setDraft((current) => {
      if (current.sections.length <= 1) return current;
      const sections = current.sections.filter(
        (section) => section.id !== sectionId
      );
      return {
        ...current,
        sections: sections.map((section) => ({
          ...section,
          goToSectionId:
            section.goToSectionId === sectionId ? null : section.goToSectionId,
          questions: section.questions.map((question) => ({
            ...question,
            options: question.options.map((opt) => ({
              ...opt,
              goToSectionId:
                opt.goToSectionId === sectionId ? null : opt.goToSectionId,
            })),
          })),
        })),
      };
    });
  };

  const openAddQuestion = (sectionId: string) => {
    setActiveSectionId(sectionId);
    setEditingQuestion(null);
    setQuestionDialogOpen(true);
  };

  const openEditQuestion = (
    sectionId: string,
    question: QuestionnaireQuestion
  ) => {
    setActiveSectionId(sectionId);
    setEditingQuestion(question);
    setQuestionDialogOpen(true);
  };

  const removeQuestion = (sectionId: string, questionId: string) => {
    setDraft((current) => ({
      ...current,
      sections: current.sections.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              questions: section.questions.filter((q) => q.id !== questionId),
            }
          : section
      ),
    }));
  };

  const saveQuestion = (question: QuestionnaireQuestion) => {
    if (!activeSectionId) return;

    setDraft((current) => ({
      ...current,
      sections: current.sections.map((section) => {
        if (section.id !== activeSectionId) return section;
        const exists = section.questions.some((q) => q.id === question.id);
        return {
          ...section,
          questions: exists
            ? section.questions.map((q) =>
                q.id === question.id ? question : q
              )
            : [...section.questions, question],
        };
      }),
    }));
  };

  const insertTemplateVariable = (key: string) => {
    const token = `[[${key}]]`;
    const el = emailBodyRef.current;
    const body = draft.emailTemplate || "";

    if (!el) {
      updateDraft({ emailTemplate: `${body}${token}` });
      return;
    }

    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    const next = `${body.slice(0, start)}${token}${body.slice(end)}`;
    updateDraft({ emailTemplate: next });

    requestAnimationFrame(() => {
      el.focus();
      const cursor = start + token.length;
      el.setSelectionRange(cursor, cursor);
    });
  };

  const trySave = (): boolean => {
    const title = draft.title.trim();
    if (!title) {
      setNameError("Questionnaire name is required.");
      return false;
    }

    const normalized = normalizeQuestionnaire({
      ...draft,
      title,
      questions: flattenSectionsToCustomQuestions(draft.sections),
    });
    onSave(normalized);
    baselineRef.current = snapshotDraft(normalized);
    setDraft(normalized);
    setNameError(null);
    return true;
  };

  const closeBuilder = () => {
    setUnsavedOpen(false);
    setNameError(null);
    onOpenChange(false);
  };

  const attemptClose = () => {
    if (isDirty) {
      setUnsavedOpen(true);
      return;
    }
    closeBuilder();
  };

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      onOpenChange(true);
      return;
    }
    attemptClose();
  };

  const handleDiscard = () => {
    closeBuilder();
  };

  const handleSaveFromUnsaved = () => {
    const saved = trySave();
    if (saved) {
      closeBuilder();
      return;
    }
    // Keep builder open; dismiss confirm so the name error is visible.
    setUnsavedOpen(false);
  };

  const handleSaveClick = () => {
    if (trySave()) {
      closeBuilder();
    }
  };

  const navigationValue = (section: QuestionnaireSection) => {
    if (section.navigation === "goto" && section.goToSectionId) {
      return `goto:${section.goToSectionId}`;
    }
    return section.navigation;
  };

  const setNavigation = (sectionId: string, value: string) => {
    if (value === "continue" || value === "submit") {
      updateSection(sectionId, {
        navigation: value,
        goToSectionId: null,
      });
      return;
    }
    if (value.startsWith("goto:")) {
      updateSection(sectionId, {
        navigation: "goto",
        goToSectionId: value.slice(5),
      });
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="flex max-h-[92vh] max-w-3xl flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="shrink-0 border-b border-[#272055]/10 px-6 py-4">
            <DialogTitle>
              {initial ? "Edit Questionnaire" : "Add Questionnaire"}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
            <div>
              <Label htmlFor="questionnaire-name">
                Questionnaire Name (Required)
              </Label>
              <Input
                id="questionnaire-name"
                className="mt-1.5"
                value={draft.title}
                onChange={(e) => updateDraft({ title: e.target.value })}
                placeholder="Questionnaire Name (Required)"
                aria-invalid={Boolean(nameError)}
              />
              {nameError ? (
                <p className="mt-1.5 text-sm text-destructive">{nameError}</p>
              ) : null}
            </div>

            <div className="space-y-4">
              {draft.sections.map((section, sectionIndex) => {
                const optionsOpen = Boolean(sectionOptionsOpen[section.id]);
                return (
                  <div
                    key={section.id}
                    className="rounded-xl border border-[#272055]/12 bg-white shadow-sm"
                  >
                    <div className="flex items-center justify-between border-b border-[#272055]/08 px-4 py-3">
                      <h4 className="text-sm font-semibold text-[#272055]">
                        Section {sectionIndex + 1}
                      </h4>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="gap-1.5 text-[#272055]/70"
                          onClick={() =>
                            setSectionOptionsOpen((current) => ({
                              ...current,
                              [section.id]: !current[section.id],
                            }))
                          }
                        >
                          <Settings2 className="h-4 w-4" />
                          Options
                          {optionsOpen ? (
                            <ChevronUp className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5" />
                          )}
                        </Button>
                        {draft.sections.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={`Remove section ${sectionIndex + 1}`}
                            onClick={() => removeSection(section.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {optionsOpen && (
                      <div className="space-y-3 border-b border-[#272055]/08 bg-[#fafbfd] px-4 py-3">
                        <div>
                          <Label>Section title</Label>
                          <Input
                            className="mt-1.5"
                            value={section.title}
                            onChange={(e) =>
                              updateSection(section.id, {
                                title: e.target.value,
                              })
                            }
                            placeholder="Optional section title"
                          />
                        </div>
                        <div>
                          <Label>Section description</Label>
                          <Textarea
                            className="mt-1.5 min-h-[72px]"
                            value={section.description}
                            onChange={(e) =>
                              updateSection(section.id, {
                                description: e.target.value,
                              })
                            }
                            placeholder="Optional section description"
                          />
                        </div>
                      </div>
                    )}

                    <div className="px-4 py-5">
                      {section.questions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center gap-2 py-8 text-muted-foreground">
                          <ListTodo className="h-10 w-10 opacity-40" />
                          <p className="text-sm">No Questions</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {section.questions.map((question) => (
                            <div
                              key={question.id}
                              className="flex items-start justify-between gap-3 rounded-lg border border-[#272055]/10 bg-[#fafbfd] px-3 py-2.5"
                            >
                              <div className="min-w-0">
                                <p className="truncate font-medium text-[#272055]">
                                  {question.prompt}
                                  {question.required ? (
                                    <span className="ml-1 text-destructive">
                                      *
                                    </span>
                                  ) : null}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {responseTypeLabel(question.responseType)}
                                </p>
                              </div>
                              <div className="flex shrink-0 items-center gap-0.5">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  aria-label="Edit question"
                                  onClick={() =>
                                    openEditQuestion(section.id, question)
                                  }
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  aria-label="Remove question"
                                  onClick={() =>
                                    removeQuestion(section.id, question.id)
                                  }
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      <button
                        type="button"
                        className="mt-3 text-sm font-medium text-[#31CDFF] hover:underline"
                        onClick={() => openAddQuestion(section.id)}
                      >
                        + Add Question
                      </button>
                    </div>

                    <div className="flex justify-end border-t border-[#272055]/08 px-4 py-3">
                      <Select
                        value={navigationValue(section)}
                        onValueChange={(value) =>
                          setNavigation(section.id, value)
                        }
                      >
                        <SelectTrigger className="w-[240px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="continue">
                            Continue onto next section
                          </SelectItem>
                          {draft.sections.map((target, targetIndex) =>
                            target.id === section.id ? null : (
                              <SelectItem
                                key={target.id}
                                value={`goto:${target.id}`}
                              >
                                Go to Section {targetIndex + 1}
                                {target.title ? `: ${target.title}` : ""}
                              </SelectItem>
                            )
                          )}
                          <SelectItem value="submit">Submit form</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                );
              })}

              <Button
                type="button"
                className="bg-[#31CDFF] text-[#272055] hover:bg-[#31CDFF]/90"
                onClick={addSection}
              >
                <Plus className="mr-2 h-4 w-4" />
                Section
              </Button>
            </div>

            <div className="space-y-3 rounded-xl border border-[#272055]/10 bg-[#fafbfd] p-4">
              <div>
                <h4 className="text-sm font-semibold text-[#272055]">
                  Move on Completion
                </h4>
                <p className="mt-1 text-sm text-muted-foreground">
                  Move the candidate to another stage after completing this
                  questionnaire:
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  * Ignored when questionnaire is used in application form.
                </p>
              </div>

              <label className="flex cursor-pointer items-center gap-2">
                <Checkbox
                  checked={draft.moveOnCompletion}
                  onCheckedChange={(checked) =>
                    updateDraft({
                      moveOnCompletion: checked === true,
                      moveToStageId:
                        checked === true
                          ? draft.moveToStageId ||
                            enabledStages[0]?.id ||
                            null
                          : null,
                    })
                  }
                />
                <span className="text-sm font-medium text-[#272055]">
                  Move To Stage
                </span>
              </label>

              {draft.moveOnCompletion && (
                <div>
                  <Label>Pipelines / Stage</Label>
                  <Select
                    value={draft.moveToStageId || "__none__"}
                    onValueChange={(value) =>
                      updateDraft({
                        moveToStageId: value === "__none__" ? null : value,
                      })
                    }
                  >
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder="Select stage" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Don&apos;t Move</SelectItem>
                      {enabledStages.map((stage) => (
                        <SelectItem key={stage.id} value={stage.id}>
                          {stage.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="space-y-3 rounded-xl border border-[#272055]/10 bg-white p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-[#272055]">
                    Questionnaire Email Template
                  </h4>
                  <p className="mt-1 text-sm text-muted-foreground">
                    This template is used when sending this assessment to an
                    existing candidate.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 gap-1.5"
                  onClick={() => setShowEmailTemplate((value) => !value)}
                >
                  <Settings2 className="h-4 w-4" />
                  {showEmailTemplate ? "Hide Template" : "Show Template"}
                </Button>
              </div>

              {showEmailTemplate && (
                <div className="space-y-3 border-t border-[#272055]/08 pt-3">
                  <div>
                    <Label>Template Variables</Label>
                    <Select
                      onValueChange={(value) => insertTemplateVariable(value)}
                    >
                      <SelectTrigger className="mt-1.5">
                        <SelectValue placeholder="Insert variable…" />
                      </SelectTrigger>
                      <SelectContent>
                        {QUESTIONNAIRE_TEMPLATE_VARIABLES.map((variable) => (
                          <SelectItem key={variable.key} value={variable.key}>
                            {variable.label} ([[{variable.key}]])
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="questionnaire-email-body">Email body</Label>
                    <Textarea
                      id="questionnaire-email-body"
                      ref={emailBodyRef}
                      className="mt-1.5 min-h-[200px] font-mono text-sm"
                      value={draft.emailTemplate}
                      onChange={(e) =>
                        updateDraft({ emailTemplate: e.target.value })
                      }
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="shrink-0 border-t border-[#272055]/10 px-6 py-4">
            <Button type="button" variant="outline" onClick={attemptClose}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSaveClick}>
              <Save className="mr-2 h-4 w-4" />
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={unsavedOpen} onOpenChange={setUnsavedOpen}>
        <AlertDialogContent className="z-[100] max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              Would you like to save your changes to this questionnaire?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
            <button
              type="button"
              className="text-sm font-medium text-[#31CDFF] hover:underline"
              onClick={handleDiscard}
            >
              No thanks
            </button>
            <Button
              type="button"
              className="bg-[#31CDFF] text-[#272055] hover:bg-[#31CDFF]/90"
              onClick={handleSaveFromUnsaved}
            >
              <Check className="mr-2 h-4 w-4" />
              Yes please
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AddQuestionDialog
        open={questionDialogOpen}
        onOpenChange={setQuestionDialogOpen}
        initial={editingQuestion}
        sections={draft.sections}
        onSave={saveQuestion}
      />
    </>
  );
}
