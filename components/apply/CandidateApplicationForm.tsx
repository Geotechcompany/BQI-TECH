"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Check,
  Loader2,
  MapPin,
  Send,
  Upload,
} from "lucide-react";
import {
  DocumentIcon,
  ExclamationCircleIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import Lottie from "lottie-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type {
  CandidateApplicationAnswer,
  CandidateApplicationFormMode,
  CandidateApplicationQuestion,
} from "./candidate-application-types";
import {
  buildCandidateFormSchema,
  deriveApplicationSteps,
  getDefaultValues,
  isMultilineApplicationField,
  multilineFieldRows,
  normalizeCandidateQuestionType,
  questionFieldId,
} from "./candidate-application-utils";

const BRAND_CYAN = "#31CDFF";
const EMPTY_DOCS_LOTTIE_SRC = "/lottie/empty-documents.json";

let emptyDocsLottieCache: object | null | undefined;
let emptyDocsLottiePromise: Promise<object | null> | null = null;

function loadEmptyDocsLottie(): Promise<object | null> {
  if (emptyDocsLottieCache !== undefined) {
    return Promise.resolve(emptyDocsLottieCache);
  }
  if (!emptyDocsLottiePromise) {
    emptyDocsLottiePromise = fetch(EMPTY_DOCS_LOTTIE_SRC)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: object | null) => {
        emptyDocsLottieCache = data;
        return data;
      })
      .catch(() => {
        emptyDocsLottieCache = null;
        return null;
      });
  }
  return emptyDocsLottiePromise;
}

export interface CandidateApplicationJobMeta {
  department?: string;
  location?: string;
  employmentType?: string;
}

export interface CandidateApplicationFormProps {
  title: string;
  questions: CandidateApplicationQuestion[];
  mode?: CandidateApplicationFormMode;
  subtitle?: string;
  jobMeta?: CandidateApplicationJobMeta;
  /** When false, omit the page shell (e.g. embedded in a dialog). */
  framed?: boolean;
  className?: string;
  /** Live mode only: persist the application. Never called in preview. */
  onSubmitApplication?: (payload: {
    values: Record<string, string>;
    answers: CandidateApplicationAnswer[];
  }) => Promise<void>;
  /** Live mode only: upload a file and return its URL. */
  onUploadFile?: (file: File) => Promise<string>;
  /** Live mode: navigate after session expiry during upload. */
  onSessionExpired?: () => void;
}

const fieldControlClass =
  "h-10 border-border/80 bg-background shadow-sm transition-colors focus-visible:border-[#272156]/40 focus-visible:ring-[#272156]/25";

const textareaControlClass =
  "min-h-[5rem] resize-y border-border/80 bg-background shadow-sm transition-colors focus-visible:border-[#272156]/40 focus-visible:ring-[#272156]/25";

function stepDescription(stepKey: string): string {
  switch (stepKey) {
    case "basic":
      return "Name and contact details for this application.";
    case "questions":
      return "Answer the role-specific questions below.";
    case "attachments":
      return "Upload your resume or other required files (PDF, DOC, DOCX · max 5MB).";
    default:
      return "Complete each field, then submit.";
  }
}

export function CandidateApplicationForm({
  title,
  questions,
  mode = "live",
  subtitle = "Fill out each section, then submit.",
  jobMeta,
  framed = true,
  className,
  onSubmitApplication,
  onUploadFile,
  onSessionExpired,
}: CandidateApplicationFormProps) {
  const isPreview = mode === "preview";
  const prefersReducedMotion = useReducedMotion();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isFileDragOver, setIsFileDragOver] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFileUrl, setUploadedFileUrl] = useState<string | null>(null);
  const [showErrorDialog, setShowErrorDialog] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [emptyLottie, setEmptyLottie] = useState<object | null>(
    () => emptyDocsLottieCache ?? null
  );

  const formSchema = useMemo(
    () => buildCandidateFormSchema(questions),
    [questions]
  );

  const {
    register,
    handleSubmit,
    formState,
    reset,
    setValue,
    setError,
    trigger,
    getValues,
    clearErrors,
  } = useForm({
    defaultValues: getDefaultValues(questions),
    resolver: zodResolver(formSchema),
    mode: "onSubmit",
    reValidateMode: "onSubmit",
  });

  const steps = useMemo(() => deriveApplicationSteps(questions), [questions]);

  const currentFieldIds = useMemo(
    () => steps[currentStep]?.fieldIds || [],
    [steps, currentStep]
  );

  const currentStepMeta = steps[currentStep];
  const progressPercent =
    steps.length > 0 ? ((currentStep + 1) / steps.length) * 100 : 100;

  useEffect(() => {
    reset(getDefaultValues(questions));
    setCurrentStep(0);
    setUploadedFile(null);
    setUploadedFileUrl(null);
  }, [questions, reset]);

  useEffect(() => {
    if (prefersReducedMotion || questions.length > 0) return;
    let cancelled = false;
    loadEmptyDocsLottie().then((data) => {
      if (!cancelled && data) setEmptyLottie(data);
    });
    return () => {
      cancelled = true;
    };
  }, [prefersReducedMotion, questions.length]);

  const validateCurrentStep = useCallback(async () => {
    if (currentFieldIds.length === 0) {
      return { ok: true, errors: [] as string[] };
    }

    clearErrors(currentFieldIds as never[]);
    const valid = await trigger(currentFieldIds as never[]);

    if (valid) {
      return { ok: true, errors: [] as string[] };
    }

    const stepErrors: string[] = [];
    for (const fieldId of currentFieldIds) {
      const message = (
        formState.errors as Record<string, { message?: string } | undefined>
      )?.[fieldId]?.message;
      if (message) stepErrors.push(message);
    }

    if (stepErrors.length === 0) {
      const values = getValues();
      for (const fieldId of currentFieldIds) {
        const question = questions.find(
          (entry) => questionFieldId(entry) === fieldId
        );
        if (!question || !question.required) continue;
        const raw = values[fieldId as keyof typeof values];
        const str = typeof raw === "string" ? raw.trim() : "";
        if (!str) {
          const message = `${question.question} is required`;
          stepErrors.push(message);
          setError(fieldId as never, { type: "manual", message });
        }
      }
    }

    return { ok: false, errors: stepErrors };
  }, [
    clearErrors,
    currentFieldIds,
    formState.errors,
    getValues,
    questions,
    setError,
    trigger,
  ]);

  const getFieldError = (fieldId: string): string | undefined => {
    return (
      formState.errors as Record<string, { message?: string } | undefined>
    )?.[fieldId]?.message;
  };

  const blockPreviewAction = (
    message = "Preview only — submissions are disabled."
  ) => {
    toast(message);
  };

  const onSubmit = async (data: Record<string, string>) => {
    setFormErrors([]);

    const schemaErrors = Object.entries(formState.errors).map(
      ([, error]) => (error?.message as string) || "Invalid field"
    );
    if (schemaErrors.length > 0) {
      setFormErrors(schemaErrors);
      setShowErrorDialog(true);
      return;
    }

    if (isPreview) {
      blockPreviewAction();
      return;
    }

    if (!onSubmitApplication) {
      toast.error("Application submit handler is not configured.");
      return;
    }

    setIsSubmitting(true);
    try {
      const answers: CandidateApplicationAnswer[] = questions.map((question) => {
        const questionId = questionFieldId(question);
        const answer = data[questionId] || "";
        if (question.required && !answer.trim()) {
          throw new Error(`${question.question} is required`);
        }
        return {
          questionId,
          questionText: question.question,
          answer,
        };
      });

      await onSubmitApplication({ values: data, answers });
    } catch (error) {
      console.error("Application submission error:", error);
      setIsSubmitting(false);
      const message =
        error instanceof Error
          ? error.message
          : "Failed to submit application. Please try again.";
      toast.error(message);
      setFormErrors([message]);
      setShowErrorDialog(true);
    }
  };

  const handleFileChange = async (
    fieldName: string,
    file: File | undefined
  ) => {
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size should not exceed 5MB");
      return;
    }

    if (isPreview) {
      setUploadedFile(file);
      setUploadedFileUrl(`preview://${file.name}`);
      setValue(fieldName, `preview://${file.name}`, {
        shouldValidate: true,
        shouldDirty: true,
        shouldTouch: true,
      });
      blockPreviewAction("Preview only — files are not uploaded.");
      return;
    }

    if (!onUploadFile) {
      toast.error("File upload is not available.");
      return;
    }

    setUploadedFile(file);
    setIsUploading(true);
    try {
      const url = await onUploadFile(file);
      setUploadedFileUrl(url);
      setValue(fieldName, url, {
        shouldValidate: true,
        shouldDirty: true,
        shouldTouch: true,
      });
      toast.success("File uploaded successfully!");
    } catch (error) {
      console.error("Upload error:", error);
      const message =
        error instanceof Error ? error.message : "Failed to upload file.";
      if (message === "Session expired. Please log in again.") {
        onSessionExpired?.();
      } else {
        toast.error(message);
      }
      setUploadedFile(null);
      setValue(fieldName, "", {
        shouldValidate: true,
        shouldDirty: true,
        shouldTouch: true,
      });
    } finally {
      setIsUploading(false);
    }
  };

  const clearUploadedFile = (fieldName: string) => {
    setUploadedFile(null);
    setUploadedFileUrl(null);
    setValue(fieldName, "");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const renderOptionGroup = (
    fieldName: string,
    options: string[],
    error?: string
  ) => (
    <div className="space-y-2">
      {options.map((option) => (
        <label
          key={option}
          htmlFor={`${fieldName}-${option}`}
          className={cn(
            "flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-3 transition-colors",
            "border-[#272156]/12 bg-[#fafbfd] hover:border-[#272156]/25 hover:bg-white",
            "has-[:checked]:border-[#31CDFF]/50 has-[:checked]:bg-[#31CDFF]/8 has-[:checked]:ring-1 has-[:checked]:ring-[#31CDFF]/30"
          )}
        >
          <input
            type="radio"
            {...register(fieldName)}
            value={option}
            id={`${fieldName}-${option}`}
            className="h-4 w-4 shrink-0 border-border text-[#272156] focus:ring-[#272156]/30"
          />
          <span className="text-sm font-medium text-[#272156]/90 select-none">
            {option}
          </span>
        </label>
      ))}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );

  const renderQuestionField = (question: CandidateApplicationQuestion) => {
    const fieldName = questionFieldId(question);
    const resolvedQuestion: CandidateApplicationQuestion = {
      ...question,
      type: normalizeCandidateQuestionType(question.type),
    };
    const error = getFieldError(fieldName);

    const renderLabel = (options?: { htmlFor?: string }) => (
      <Label
        htmlFor={options?.htmlFor}
        className="text-sm font-medium text-[#272156] dark:text-foreground"
      >
        {resolvedQuestion.question}
        {resolvedQuestion.required ? (
          <span className="ml-1 text-destructive" aria-hidden>
            *
          </span>
        ) : null}
      </Label>
    );

    switch (resolvedQuestion.type) {
      case "text":
      case "textarea": {
        if (isMultilineApplicationField(resolvedQuestion)) {
          return (
            <div key={fieldName} className="space-y-2">
              {renderLabel({ htmlFor: fieldName })}
              <Textarea
                id={fieldName}
                {...register(fieldName)}
                className={textareaControlClass}
                rows={multilineFieldRows(resolvedQuestion)}
                placeholder={`Enter your ${resolvedQuestion.question.toLowerCase()}`}
                aria-invalid={Boolean(error)}
              />
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
            </div>
          );
        }

        return (
          <div key={fieldName} className="space-y-2">
            {renderLabel({ htmlFor: fieldName })}
            <Input
              id={fieldName}
              {...register(fieldName)}
              className={fieldControlClass}
              type={
                String(resolvedQuestion.question)
                  .toLowerCase()
                  .includes("salary")
                  ? "number"
                  : "text"
              }
              inputMode={
                String(resolvedQuestion.question)
                  .toLowerCase()
                  .includes("salary")
                  ? "decimal"
                  : undefined
              }
              placeholder={`Enter your ${resolvedQuestion.question.toLowerCase()}`}
              error={error}
            />
          </div>
        );
      }

      case "select":
        return (
          <div key={fieldName} className="space-y-2">
            {renderLabel({ htmlFor: fieldName })}
            <select
              id={fieldName}
              {...register(fieldName)}
              defaultValue=""
              aria-invalid={Boolean(error)}
              className={cn(
                "flex h-10 w-full rounded-md border border-border/80 bg-background px-3 py-2 text-sm shadow-sm",
                "ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#272156]/25 focus-visible:ring-offset-2",
                "disabled:cursor-not-allowed disabled:opacity-50",
                error && "border-red-500 focus-visible:ring-red-500"
              )}
            >
              <option value="" disabled>
                Select an option
              </option>
              {resolvedQuestion.options?.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
        );

      case "radio":
        return (
          <div key={fieldName} className="space-y-2" role="radiogroup">
            {renderLabel()}
            {renderOptionGroup(
              fieldName,
              resolvedQuestion.options || [],
              error
            )}
          </div>
        );

      case "boolean":
        return (
          <div key={fieldName} className="space-y-2" role="radiogroup">
            {renderLabel()}
            {renderOptionGroup(fieldName, ["Yes", "No"], error)}
          </div>
        );

      case "file":
        return (
          <div key={fieldName} className="space-y-3">
            {renderLabel()}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx"
              className="sr-only"
              onChange={(event) =>
                void handleFileChange(fieldName, event.target.files?.[0])
              }
            />
            <input
              type="hidden"
              {...register(fieldName)}
              value={uploadedFileUrl || ""}
              readOnly
            />

            {uploadedFile ? (
              <div
                className={cn(
                  "flex items-center justify-between gap-3 rounded-xl border px-4 py-3",
                  "border-[#272156]/12 bg-white shadow-sm"
                )}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#272156]/8 ring-1 ring-[#272156]/10">
                    <DocumentIcon className="h-5 w-5 text-[#272156]" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[#272156]">
                      {uploadedFile.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {isUploading
                        ? "Uploading…"
                        : uploadedFileUrl
                          ? "Ready to submit"
                          : "Selected"}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {isUploading ? (
                    <Loader2 className="h-4 w-4 animate-spin text-[#31CDFF]" />
                  ) : null}
                  {uploadedFileUrl && !isUploading ? (
                    <button
                      type="button"
                      onClick={() => clearUploadedFile(fieldName)}
                      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      aria-label="Remove file"
                    >
                      <XMarkIcon className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
              </div>
            ) : (
              <button
                type="button"
                disabled={isUploading}
                onClick={() => fileInputRef.current?.click()}
                onDragEnter={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setIsFileDragOver(true);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setIsFileDragOver(true);
                }}
                onDragLeave={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setIsFileDragOver(false);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setIsFileDragOver(false);
                  const file = event.dataTransfer.files?.[0];
                  if (file) void handleFileChange(fieldName, file);
                }}
                className={cn(
                  "group flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-10 text-center transition-colors",
                  "border-[#272156]/20 bg-[#fafbfd] hover:border-[#31CDFF]/50 hover:bg-[#31CDFF]/5",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#272156]/25",
                  "disabled:cursor-not-allowed disabled:opacity-60",
                  isFileDragOver && "border-[#31CDFF] bg-[#31CDFF]/10",
                  error && "border-destructive/50"
                )}
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#272156]/8 ring-1 ring-[#272156]/10 transition-colors group-hover:bg-[#31CDFF]/15">
                  <Upload className="h-5 w-5 text-[#272156]" strokeWidth={1.75} />
                </span>
                <span className="text-sm font-medium text-[#272156]">
                  Choose a file or drop it here
                </span>
                <span className="text-xs text-muted-foreground">
                  PDF, DOC, or DOCX · up to 5MB
                </span>
              </button>
            )}
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
        );

      case "date":
        return (
          <div key={fieldName} className="space-y-2">
            {renderLabel({ htmlFor: fieldName })}
            <Input
              id={fieldName}
              {...register(fieldName)}
              className={fieldControlClass}
              type="date"
              error={error}
            />
          </div>
        );

      default:
        return null;
    }
  };

  const metaChips = [
    jobMeta?.department
      ? { icon: Briefcase, label: jobMeta.department }
      : null,
    jobMeta?.location ? { icon: MapPin, label: jobMeta.location } : null,
    jobMeta?.employmentType
      ? { icon: Briefcase, label: jobMeta.employmentType }
      : null,
  ].filter(Boolean) as Array<{
    icon: typeof Briefcase;
    label: string;
  }>;

  const formBody = (
    <>
      <div
        className={cn("mb-6 space-y-3", !framed && "mb-4")}
        data-tour="user-apply-title"
      >
        <div className="space-y-1.5">
          <p
            className="text-xs font-medium uppercase tracking-[0.16em]"
            style={{ color: BRAND_CYAN }}
          >
            Job application
          </p>
          <h1
            className={cn(
              "font-bold tracking-tight text-[#272156] dark:text-foreground",
              framed ? "text-2xl sm:text-3xl" : "text-xl sm:text-2xl"
            )}
          >
            {title}
          </h1>
          <p className="max-w-xl text-sm text-muted-foreground sm:text-base">
            {subtitle}
          </p>
        </div>

        {metaChips.length > 0 ? (
          <div className="flex flex-wrap gap-2 pt-1">
            {metaChips.map(({ icon: Icon, label }) => (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#272156]/12 bg-white/80 px-2.5 py-1 text-xs font-medium text-[#272156]/80 shadow-sm dark:border-border dark:bg-card dark:text-foreground"
              >
                <Icon className="h-3.5 w-3.5 shrink-0 opacity-70" />
                {label}
              </span>
            ))}
          </div>
        ) : null}

        {isPreview ? (
          <p className="text-xs font-medium uppercase tracking-wide text-[#31CDFF]">
            Preview only — submissions disabled
          </p>
        ) : null}
      </div>

      {questions.length === 0 ? (
        <div
          className="relative overflow-hidden rounded-2xl border border-dashed border-[#272156]/15 bg-card/80 px-4 py-12 text-center shadow-sm"
          data-tour="user-apply-form"
        >
          <div
            className="pointer-events-none absolute inset-0"
            aria-hidden
            style={{
              background:
                "radial-gradient(ellipse 70% 55% at 50% 40%, rgba(49,205,255,0.10) 0%, rgba(39,33,86,0.04) 45%, transparent 72%)",
            }}
          />
          <div className="relative z-[1] mx-auto flex max-w-sm flex-col items-center">
            <div className="mb-2 h-[120px] w-[120px]" aria-hidden>
              {emptyLottie && !prefersReducedMotion ? (
                <Lottie
                  animationData={emptyLottie}
                  loop
                  className="h-full w-full"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#272156]/10 ring-1 ring-[#272156]/10">
                    <DocumentIcon className="h-8 w-8 text-[#272156]/70" />
                  </div>
                </div>
              )}
            </div>
            <p className="text-sm font-semibold text-[#272156] dark:text-foreground">
              No application fields yet
            </p>
            <p className="mt-1.5 text-sm text-muted-foreground">
              This job has no questionnaire or required fields enabled.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-5 space-y-3" data-tour="user-apply-steps">
            <div className="h-1.5 overflow-hidden rounded-full bg-[#272156]/08">
              <motion.div
                className="h-full rounded-full bg-[#31CDFF]"
                initial={false}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: prefersReducedMotion ? 0 : 0.35 }}
              />
            </div>
            <ol className="flex flex-wrap items-center gap-2 sm:gap-3">
              {steps.map((step, idx) => {
                const isDone = idx < currentStep;
                const isActive = idx === currentStep;
                return (
                  <li key={step.key} className="flex items-center gap-2 sm:gap-3">
                    <div
                      className={cn(
                        "flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-sm transition-colors sm:px-3",
                        isDone &&
                          "border-[#272156]/20 bg-[#272156] text-white",
                        isActive &&
                          "border-[#31CDFF]/40 bg-[#31CDFF]/12 text-[#272156] ring-1 ring-[#31CDFF]/25",
                        !isDone &&
                          !isActive &&
                          "border-border/70 bg-card/60 text-muted-foreground"
                      )}
                    >
                      <span
                        className={cn(
                          "inline-flex h-5 w-5 items-center justify-center rounded-full border text-[11px] font-semibold",
                          isDone && "border-white/40 bg-white/15",
                          isActive && "border-[#31CDFF] bg-white",
                          !isDone &&
                            !isActive &&
                            "border-border bg-background"
                        )}
                      >
                        {isDone ? <Check className="h-3 w-3" /> : idx + 1}
                      </span>
                      <span className="whitespace-nowrap font-medium">
                        {step.title}
                      </span>
                    </div>
                    {idx < steps.length - 1 ? (
                      <span
                        className="hidden h-px w-4 bg-border sm:block"
                        aria-hidden
                      />
                    ) : null}
                  </li>
                );
              })}
            </ol>
          </div>

          <div
            className={cn(
              "overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm [color-scheme:light]",
              "dark:border-border dark:[color-scheme:dark]"
            )}
            data-tour="user-apply-form"
          >
            <div className="border-b border-border/40 bg-muted/20 px-5 py-4 sm:px-6">
              <h2 className="text-base font-semibold tracking-tight text-[#272156] dark:text-foreground sm:text-lg">
                {currentStepMeta?.title || "Application"}
              </h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {stepDescription(currentStepMeta?.key || "all")}
              </p>
            </div>

            <form
              onSubmit={handleSubmit(onSubmit)}
              className="flex flex-col"
              noValidate={isPreview}
            >
              <div className="space-y-5 px-5 py-5 sm:space-y-6 sm:px-6 sm:py-6">
                {questions
                  .filter((question) =>
                    currentFieldIds.includes(questionFieldId(question))
                  )
                  .map((question) => renderQuestionField(question))}
              </div>

              <div
                className={cn(
                  "sticky bottom-0 z-10 flex items-center gap-3 border-t border-border/50 bg-card/95 px-5 py-4 backdrop-blur-md sm:px-6",
                  "supports-[backdrop-filter]:bg-card/90"
                )}
                data-tour="user-apply-actions"
              >
                {currentStep > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    className="border-[#272156]/20 text-[#272156] hover:bg-[#272156]/5"
                    onClick={() =>
                      setCurrentStep((step) => Math.max(0, step - 1))
                    }
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back
                  </Button>
                )}
                {currentStep < steps.length - 1 && (
                  <Button
                    type="button"
                    className="ml-auto bg-[#272156] text-white hover:bg-[#272156]/90"
                    onClick={async () => {
                      const result = await validateCurrentStep();
                      if (result.ok) {
                        setCurrentStep((step) =>
                          Math.min(steps.length - 1, step + 1)
                        );
                      } else {
                        toast.error(
                          result.errors[0] ||
                            "Please complete required fields to continue"
                        );
                      }
                    }}
                  >
                    Next <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                )}
                {currentStep === steps.length - 1 && (
                  <Button
                    type={isPreview ? "button" : "submit"}
                    disabled={isSubmitting || isPreview}
                    title={isPreview ? "Preview only" : undefined}
                    className={cn(
                      "ml-auto min-w-[10rem]",
                      isPreview
                        ? "bg-muted text-muted-foreground"
                        : "bg-[#31CDFF] text-white hover:bg-[#31CDFF]/90"
                    )}
                  >
                    {isSubmitting ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Submitting…
                      </span>
                    ) : isPreview ? (
                      <span className="inline-flex items-center gap-2">
                        <Send className="h-4 w-4" />
                        Preview only
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-2">
                        <Send className="h-4 w-4" />
                        Submit application
                      </span>
                    )}
                  </Button>
                )}
              </div>
            </form>
          </div>
        </>
      )}
    </>
  );

  return (
    <>
      {framed ? (
        <motion.div
          className={cn("mx-auto w-full max-w-3xl pb-8", className)}
          initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          {formBody}
        </motion.div>
      ) : (
        <div className={cn("mx-auto max-w-3xl", className)}>{formBody}</div>
      )}

      <AlertDialog open={showErrorDialog} onOpenChange={setShowErrorDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <ExclamationCircleIcon className="h-6 w-6" />
              Fix these issues
            </AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogDescription asChild>
            <ul className="list-disc space-y-2 pl-5">
              {formErrors.map((error) => (
                <li key={error} className="text-foreground/80">
                  {error}
                </li>
              ))}
            </ul>
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={() => setShowErrorDialog(false)}
              className="bg-[#272156] hover:bg-[#272156]/90"
            >
              Got it
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
