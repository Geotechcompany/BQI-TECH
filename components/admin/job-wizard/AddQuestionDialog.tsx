"use client";

import { useEffect, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  QuestionnaireAnswerOption,
  QuestionnaireQuestion,
  QuestionnaireResponseType,
  QuestionnaireSection,
} from "@/types/job-wizard";
import {
  QUESTIONNAIRE_RESPONSE_TYPES,
  createAnswerOption,
  createQuestionnaireQuestion,
  responseTypeNeedsOptions,
} from "./questionnaire-utils";

interface AddQuestionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: QuestionnaireQuestion | null;
  sections: QuestionnaireSection[];
  onSave: (question: QuestionnaireQuestion) => void;
}

export function AddQuestionDialog({
  open,
  onOpenChange,
  initial,
  sections,
  onSave,
}: AddQuestionDialogProps) {
  const [prompt, setPrompt] = useState("");
  const [description, setDescription] = useState("");
  const [responseType, setResponseType] =
    useState<QuestionnaireResponseType>("text");
  const [required, setRequired] = useState(false);
  const [options, setOptions] = useState<QuestionnaireAnswerOption[]>([]);
  const [referenceContactCount, setReferenceContactCount] = useState(2);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setPrompt(initial.prompt);
      setDescription(initial.description || "");
      setResponseType(initial.responseType);
      setRequired(initial.required);
      setOptions(
        initial.options.length
          ? initial.options.map((opt) => ({ ...opt }))
          : responseTypeNeedsOptions(initial.responseType)
            ? [createAnswerOption(""), createAnswerOption("")]
            : []
      );
      setReferenceContactCount(initial.referenceContactCount ?? 2);
      return;
    }

    setPrompt("");
    setDescription("");
    setResponseType("text");
    setRequired(false);
    setOptions([]);
    setReferenceContactCount(2);
  }, [open, initial?.id]);

  const handleResponseTypeChange = (value: QuestionnaireResponseType) => {
    setResponseType(value);
    if (responseTypeNeedsOptions(value)) {
      setOptions((current) =>
        current.length >= 2
          ? current
          : [createAnswerOption(""), createAnswerOption("")]
      );
    } else if (value !== "reference_check") {
      setOptions([]);
    }
  };

  const updateOption = (
    id: string,
    patch: Partial<QuestionnaireAnswerOption>
  ) => {
    setOptions((current) =>
      current.map((opt) => (opt.id === id ? { ...opt, ...patch } : opt))
    );
  };

  const removeOption = (id: string) => {
    setOptions((current) =>
      current.length <= 2 ? current : current.filter((opt) => opt.id !== id)
    );
  };

  const handleSave = () => {
    const trimmed = prompt.trim();
    if (!trimmed) return;

    const needsOptions = responseTypeNeedsOptions(responseType);
    const cleanedOptions = needsOptions
      ? options
          .map((opt) => ({ ...opt, label: opt.label.trim() }))
          .filter((opt) => opt.label.length > 0)
      : [];

    onSave(
      createQuestionnaireQuestion({
        ...(initial?.id ? { id: initial.id } : {}),
        prompt: trimmed,
        description: description.trim(),
        responseType,
        required,
        options:
          needsOptions && cleanedOptions.length
            ? cleanedOptions
            : needsOptions
              ? [createAnswerOption("Option 1"), createAnswerOption("Option 2")]
              : [],
        referenceContactCount:
          responseType === "reference_check"
            ? Math.max(1, Math.min(10, referenceContactCount || 2))
            : undefined,
      })
    );
    onOpenChange(false);
  };

  const otherSections = sections.filter(Boolean);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {initial ? "Edit Question" : "Add Question"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div>
            <Label htmlFor="question-prompt">Enter your question</Label>
            <Input
              id="question-prompt"
              className="mt-1.5"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Enter your question"
            />
          </div>

          <div>
            <Label htmlFor="question-description">
              Question description (optional)
            </Label>
            <Textarea
              id="question-description"
              className="mt-1.5 min-h-[80px]"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add helper text shown under the question"
            />
          </div>

          <div>
            <Label>Response Type</Label>
            <Select
              value={responseType}
              onValueChange={(value) =>
                handleResponseTypeChange(value as QuestionnaireResponseType)
              }
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {QUESTIONNAIRE_RESPONSE_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <label className="flex cursor-pointer items-center gap-2">
            <Checkbox
              checked={required}
              onCheckedChange={(checked) => setRequired(checked === true)}
            />
            <span className="text-sm text-[#272055]">Required</span>
          </label>

          {responseTypeNeedsOptions(responseType) && (
            <div className="space-y-3 rounded-xl border border-[#272055]/10 bg-[#fafbfd] p-3">
              <div className="flex items-center justify-between">
                <Label>Answer options</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setOptions((current) => [...current, createAnswerOption("")])
                  }
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Add option
                </Button>
              </div>

              {options.map((option, index) => (
                <div key={option.id} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      value={option.label}
                      onChange={(e) =>
                        updateOption(option.id, { label: e.target.value })
                      }
                      placeholder={`Option ${index + 1}`}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Remove option"
                      disabled={options.length <= 2}
                      onClick={() => removeOption(option.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                  {otherSections.length > 1 && (
                    <div>
                      <Label className="text-xs text-muted-foreground">
                        Go to Section (optional)
                      </Label>
                      <Select
                        value={option.goToSectionId || "__none__"}
                        onValueChange={(value) =>
                          updateOption(option.id, {
                            goToSectionId:
                              value === "__none__" ? null : value,
                          })
                        }
                      >
                        <SelectTrigger className="mt-1 h-8 text-xs">
                          <SelectValue placeholder="No jump" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">No jump</SelectItem>
                          {otherSections.map((section, sectionIndex) => (
                            <SelectItem key={section.id} value={section.id}>
                              Section {sectionIndex + 1}
                              {section.title ? `: ${section.title}` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {responseType === "reference_check" && (
            <div>
              <Label htmlFor="reference-count">Number of contacts</Label>
              <Input
                id="reference-count"
                type="number"
                min={1}
                max={10}
                className="mt-1.5 w-28"
                value={referenceContactCount}
                onChange={(e) =>
                  setReferenceContactCount(Number(e.target.value) || 1)
                }
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={!prompt.trim()}
          >
            <Save className="mr-2 h-4 w-4" />
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
