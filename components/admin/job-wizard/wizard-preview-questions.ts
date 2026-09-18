import type { CandidateApplicationQuestion } from "@/components/apply/candidate-application-types";
import { normalizeCandidateQuestionType } from "@/components/apply/candidate-application-utils";
import type {
  ApplicationFormField,
  JobWizardState,
} from "@/types/job-wizard";
import { flattenQuestionnaires } from "./job-wizard-config";

const FILE_FIELD_IDS = new Set(["cv"]);

/** Builtin form fields that need multi-line answers. */
const TEXTAREA_FIELD_IDS = new Set([
  "coverLetter",
  "experienceSummary",
  "workHistory",
  "education",
  "address",
]);

function formFieldToQuestion(
  field: ApplicationFormField
): CandidateApplicationQuestion {
  let type: CandidateApplicationQuestion["type"] = "text";
  if (FILE_FIELD_IDS.has(field.id)) {
    type = "file";
  } else if (TEXTAREA_FIELD_IDS.has(field.id)) {
    type = "textarea";
  }

  return {
    id: `field-${field.id}`,
    question: field.label,
    type,
    required: field.mode === "required",
    options: [],
  };
}

/**
 * Build the same question list shape the public apply form uses,
 * from current wizard Application step state (enabled fields + questionnaires).
 */
export function wizardStateToPreviewQuestions(
  state: JobWizardState
): CandidateApplicationQuestion[] {
  const enabledFields = state.formFields
    .filter((field) => field.mode !== "disabled")
    .map(formFieldToQuestion);

  const questionnaireQuestions = flattenQuestionnaires(
    state.questionnaires
  ).map(
    (question): CandidateApplicationQuestion => ({
      id: question.id,
      question: question.question,
      type: normalizeCandidateQuestionType(question.type),
      required: question.required,
      options: question.options,
    })
  );

  return [...enabledFields, ...questionnaireQuestions];
}
