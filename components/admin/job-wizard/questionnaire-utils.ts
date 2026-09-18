import {
  ApplicationQuestionnaire,
  CustomApplicationQuestion,
  QuestionnaireAnswerOption,
  QuestionnaireQuestion,
  QuestionnaireResponseType,
  QuestionnaireSection,
} from "@/types/job-wizard";

export const DEFAULT_QUESTIONNAIRE_EMAIL_TEMPLATE = `Hi [[candidate_first_name]],

We'd like to ask you a few more questions. When you have a couple of minutes, please click the following link and fill out the form.

[[questionnaire_link]]

Thank you,
[[company_user_first_name]]`;

export const QUESTIONNAIRE_TEMPLATE_VARIABLES = [
  { key: "candidate_first_name", label: "Candidate First Name" },
  { key: "questionnaire_link", label: "Questionnaire Link" },
  { key: "company_user_first_name", label: "Your First Name" },
  { key: "candidate_full_name", label: "Candidate Full Name" },
  { key: "position_title", label: "Position Title" },
] as const;

export const QUESTIONNAIRE_RESPONSE_TYPES: {
  value: QuestionnaireResponseType;
  label: string;
}[] = [
  { value: "text", label: "Text" },
  { value: "date", label: "Date" },
  { value: "paragraph", label: "Paragraph" },
  { value: "multiple_choice", label: "Multiple Choice" },
  { value: "dropdown", label: "Dropdown List" },
  { value: "checkboxes", label: "Checkboxes" },
  { value: "video", label: "Video Response" },
  { value: "reference_check", label: "Reference Check" },
  { value: "file", label: "File Attachment" },
];

export function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createAnswerOption(
  label = ""
): QuestionnaireAnswerOption {
  return {
    id: newId("opt"),
    label,
    goToSectionId: null,
  };
}

export function createQuestionnaireQuestion(
  patch?: Partial<QuestionnaireQuestion>
): QuestionnaireQuestion {
  return {
    id: newId("q"),
    prompt: "",
    description: "",
    responseType: "text",
    required: false,
    options: [],
    referenceContactCount: 2,
    ...patch,
  };
}

export function createQuestionnaireSection(
  index = 0
): QuestionnaireSection {
  return {
    id: newId("section"),
    title: "",
    description: "",
    questions: [],
    navigation: "continue",
    goToSectionId: null,
  };
}

export function responseTypeToApiType(
  responseType: QuestionnaireResponseType
): CustomApplicationQuestion["type"] {
  switch (responseType) {
    case "date":
      return "date";
    case "multiple_choice":
      return "radio";
    case "dropdown":
    case "checkboxes":
      return "select";
    case "file":
    case "video":
      return "file";
    case "paragraph":
      return "textarea";
    case "reference_check":
    case "text":
    default:
      return "text";
  }
}

export function apiTypeToResponseType(
  type: CustomApplicationQuestion["type"]
): QuestionnaireResponseType {
  switch (type) {
    case "date":
      return "date";
    case "radio":
      return "multiple_choice";
    case "select":
      return "dropdown";
    case "file":
      return "file";
    case "boolean":
      return "multiple_choice";
    case "textarea":
      return "paragraph";
    case "text":
    default:
      return "text";
  }
}

export function questionToCustom(
  question: QuestionnaireQuestion
): CustomApplicationQuestion {
  return {
    id: question.id.startsWith("q-")
      ? `new-${question.id.slice(2)}`
      : question.id.startsWith("new-")
        ? question.id
        : question.id,
    question: question.prompt,
    type: responseTypeToApiType(question.responseType),
    required: question.required,
    options: question.options.map((opt) => opt.label).filter(Boolean),
  };
}

export function customToQuestionnaireQuestion(
  question: CustomApplicationQuestion
): QuestionnaireQuestion {
  const responseType = apiTypeToResponseType(question.type);
  const needsOptions =
    responseType === "multiple_choice" ||
    responseType === "dropdown" ||
    responseType === "checkboxes" ||
    question.type === "boolean";

  const options =
    question.type === "boolean"
      ? [
          createAnswerOption("Yes"),
          createAnswerOption("No"),
        ]
      : (question.options || []).map((label) => createAnswerOption(label));

  return createQuestionnaireQuestion({
    id: question.id,
    prompt: question.question,
    description: "",
    responseType,
    required: question.required,
    options: needsOptions
      ? options.length
        ? options
        : [createAnswerOption(""), createAnswerOption("")]
      : [],
  });
}

export function countQuestionnaireQuestions(
  questionnaire: ApplicationQuestionnaire
): number {
  if (questionnaire.sections?.length) {
    return questionnaire.sections.reduce(
      (sum, section) => sum + section.questions.length,
      0
    );
  }
  return questionnaire.questions?.length || 0;
}

export function flattenSectionsToCustomQuestions(
  sections: QuestionnaireSection[]
): CustomApplicationQuestion[] {
  return sections.flatMap((section) =>
    section.questions
      .filter((q) => q.prompt.trim().length > 0)
      .map(questionToCustom)
  );
}

export function normalizeQuestionnaire(
  raw: Partial<ApplicationQuestionnaire> & { id?: string; title?: string }
): ApplicationQuestionnaire {
  const id = raw.id || newId("questionnaire");
  const title = raw.title?.trim() || "Untitled Questionnaire";

  let sections: QuestionnaireSection[] = [];

  if (Array.isArray(raw.sections) && raw.sections.length > 0) {
    sections = raw.sections.map((section, index) => ({
      id: section.id || newId("section"),
      title: section.title || "",
      description: section.description || "",
      questions: Array.isArray(section.questions)
        ? section.questions.map((q) => ({
            id: q.id || newId("q"),
            prompt: q.prompt || "",
            description: q.description || "",
            responseType: q.responseType || "text",
            required: Boolean(q.required),
            options: Array.isArray(q.options)
              ? q.options.map((opt) =>
                  typeof opt === "string"
                    ? createAnswerOption(opt)
                    : {
                        id: opt.id || newId("opt"),
                        label: opt.label || "",
                        goToSectionId: opt.goToSectionId ?? null,
                      }
                )
              : [],
            referenceContactCount: q.referenceContactCount ?? 2,
          }))
        : [],
      navigation: section.navigation || (index === 0 ? "continue" : "continue"),
      goToSectionId: section.goToSectionId ?? null,
    }));
  } else if (Array.isArray(raw.questions) && raw.questions.length > 0) {
    sections = [
      {
        ...createQuestionnaireSection(0),
        questions: raw.questions.map(customToQuestionnaireQuestion),
        navigation: "submit",
      },
    ];
  } else {
    sections = [createQuestionnaireSection(0)];
  }

  // Last section defaults to submit if still "continue" and it's the only/last one
  if (sections.length === 1 && sections[0].navigation === "continue") {
    sections = [{ ...sections[0], navigation: "submit" }];
  }

  const questions = flattenSectionsToCustomQuestions(sections);

  return {
    id,
    title,
    sections,
    questions,
    moveOnCompletion: Boolean(raw.moveOnCompletion),
    moveToStageId: raw.moveToStageId ?? null,
    emailTemplate:
      typeof raw.emailTemplate === "string" && raw.emailTemplate.length
        ? raw.emailTemplate
        : DEFAULT_QUESTIONNAIRE_EMAIL_TEMPLATE,
  };
}

export function createBlankQuestionnaire(): ApplicationQuestionnaire {
  return normalizeQuestionnaire({
    id: newId("questionnaire"),
    title: "",
    sections: [
      {
        ...createQuestionnaireSection(0),
        navigation: "submit",
      },
    ],
  });
}

export function responseTypeNeedsOptions(
  responseType: QuestionnaireResponseType
): boolean {
  return (
    responseType === "multiple_choice" ||
    responseType === "dropdown" ||
    responseType === "checkboxes"
  );
}

export function responseTypeLabel(
  responseType: QuestionnaireResponseType
): string {
  return (
    QUESTIONNAIRE_RESPONSE_TYPES.find((item) => item.value === responseType)
      ?.label || responseType
  );
}
