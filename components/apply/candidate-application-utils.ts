import { z } from "zod";
import type {
  CandidateApplicationQuestion,
  CandidateApplicationQuestionType,
} from "./candidate-application-types";

/** Builtin / known long-answer field ids (wizard formSchema + API). */
const MULTILINE_FIELD_IDS = [
  "coverletter",
  "experiencesummary",
  "workhistory",
  "education",
  "address",
] as const;

/** Label fallbacks when type is wrongly stored as `text`. */
const MULTILINE_LABEL_PATTERNS = [
  "cover letter",
  "experience summary",
  "work history",
  "education",
  "address",
] as const;

export function questionFieldId(
  question: Pick<CandidateApplicationQuestion, "id" | "_id">
): string {
  return question._id || question.id;
}

/** Normalize API / questionnaire type aliases onto the apply form union. */
export function normalizeCandidateQuestionType(
  raw: unknown
): CandidateApplicationQuestionType {
  const type = String(raw || "text")
    .toLowerCase()
    .replace(/-/g, "_");

  switch (type) {
    case "textarea":
    case "paragraph":
    case "long_text":
      return "textarea";
    case "select":
    case "dropdown":
    case "checkboxes":
      return "select";
    case "radio":
    case "multiple_choice":
      return "radio";
    case "boolean":
      return "boolean";
    case "file":
    case "video":
      return "file";
    case "date":
      return "date";
    case "text":
    default:
      return "text";
  }
}

function fieldIdLooksMultiline(fieldId: string): boolean {
  const normalized = fieldId.toLowerCase().replace(/[^a-z0-9]/g, "");
  return MULTILINE_FIELD_IDS.some(
    (id) => normalized === id || normalized.endsWith(id)
  );
}

function labelLooksMultiline(label: string): boolean {
  const normalized = label.toLowerCase().trim();
  return MULTILINE_LABEL_PATTERNS.some(
    (pattern) =>
      normalized === pattern ||
      normalized.includes(pattern) ||
      // Exact builtin labels without spaces (rare)
      normalized.replace(/\s+/g, "") === pattern.replace(/\s+/g, "")
  );
}

/** True when the field should render as a multi-line textarea. */
export function isMultilineApplicationField(
  question: Pick<
    CandidateApplicationQuestion,
    "id" | "_id" | "question" | "type"
  >
): boolean {
  const type = String(question.type || "").toLowerCase();
  if (type === "textarea" || type === "paragraph" || type === "long_text") {
    return true;
  }

  if (fieldIdLooksMultiline(questionFieldId(question))) {
    return true;
  }

  return labelLooksMultiline(question.question || "");
}

/** Row count sized by field: address shorter; paragraph / essays taller. */
export function multilineFieldRows(
  question: Pick<
    CandidateApplicationQuestion,
    "id" | "_id" | "question" | "type"
  >
): number {
  const fieldId = questionFieldId(question).toLowerCase();
  const label = (question.question || "").toLowerCase();
  const type = String(question.type || "").toLowerCase();

  if (fieldId.includes("address") || label.includes("address")) {
    return 3;
  }
  if (type === "paragraph" || type === "long_text") {
    return 6;
  }
  return 5;
}

export function getDefaultValues(
  questions: CandidateApplicationQuestion[]
): Record<string, string> {
  return questions.reduce(
    (acc, question) => {
      const fieldName = questionFieldId(question);
      if (!fieldName) return acc;
      acc[fieldName] = "";
      return acc;
    },
    {} as Record<string, string>
  );
}

export function buildCandidateFormSchema(
  questions: CandidateApplicationQuestion[]
) {
  const schemaMap = questions.reduce(
    (acc, question) => {
      const fieldName = questionFieldId(question);
      let schema: z.ZodTypeAny;

      switch (question.type) {
        case "text":
        case "textarea":
          if (question.question.toLowerCase().includes("email")) {
            schema = z
              .string()
              .min(1, { message: `${question.question} is required` })
              .email({ message: "Please enter a valid email address" });
          } else if (question.question.toLowerCase().includes("phone")) {
            schema = z
              .string()
              .min(1, { message: `${question.question} is required` })
              .regex(/^\+?[0-9\s-()]{10,}$/, {
                message:
                  "Please enter a valid phone number (at least 10 digits)",
              });
          } else if (question.question.toLowerCase().includes("salary")) {
            schema = z
              .string()
              .min(1, { message: `${question.question} is required` })
              .regex(/^\d+(?:\.\d+)?$/, {
                message: "Please enter a valid number for salary",
              });
          } else {
            schema = z
              .string()
              .min(1, { message: `${question.question} is required` });
          }
          break;
        case "select":
          schema = z.string().min(1, {
            message: `Please select an option for ${question.question.toLowerCase()}`,
          });
          break;
        case "radio":
          schema = z.string().min(1, {
            message: `Please select an option for ${question.question.toLowerCase()}`,
          });
          break;
        case "boolean":
          schema = z
            .string()
            .min(1, { message: `${question.question} is required` });
          break;
        case "file":
          schema = z.string().min(1, {
            message: `Please upload a file for ${question.question.toLowerCase()}`,
          });
          break;
        case "date":
          schema = z
            .string()
            .min(1, { message: `${question.question} is required` })
            .refine((value) => !Number.isNaN(new Date(value).getTime()), {
              message: "Please enter a valid date",
            });
          break;
        default:
          schema = z
            .string()
            .min(1, { message: `${question.question} is required` });
      }

      if (!question.required) {
        schema = schema.optional();
      }

      return {
        ...acc,
        [fieldName]: schema,
      };
    },
    {} as Record<string, z.ZodTypeAny>
  );

  return z.object(schemaMap);
}

export interface ApplicationFormStep {
  key: string;
  title: string;
  fieldIds: string[];
}

/** Multistep grouping used on the public apply form. */
export function deriveApplicationSteps(
  questions: CandidateApplicationQuestion[]
): ApplicationFormStep[] {
  const basicInfoIds: string[] = [];
  const questionIds: string[] = [];
  const attachmentIds: string[] = [];

  for (const question of questions) {
    const id = questionFieldId(question);
    if (!id) continue;
    const qText = (question.question || "").toLowerCase();
    if (question.type === "file") {
      attachmentIds.push(id);
    } else if (
      qText.includes("email") ||
      qText.includes("phone") ||
      qText.includes("name")
    ) {
      basicInfoIds.push(id);
    } else {
      questionIds.push(id);
    }
  }

  const result = [
    { key: "basic", title: "Personal info", fieldIds: basicInfoIds },
    { key: "questions", title: "Questions", fieldIds: questionIds },
    { key: "attachments", title: "Resume & files", fieldIds: attachmentIds },
  ].filter((step) => step.fieldIds.length > 0);

  if (result.length === 0) {
    return [
      {
        key: "all",
        title: "Application",
        fieldIds: questions.map(questionFieldId).filter(Boolean),
      },
    ];
  }
  return result;
}
