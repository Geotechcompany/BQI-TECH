export type FormFieldMode = "required" | "optional" | "disabled";

export type FormFieldCategory = "personal" | "experience" | "general";

export interface ApplicationFormField {
  id: string;
  label: string;
  mode: FormFieldMode;
  category: FormFieldCategory;
  builtin?: boolean;
  /** When true, mode is fixed to required and cannot be changed in the UI. */
  locked?: boolean;
}

/** Legacy flat question shape used for API sync with job questions. */
export interface CustomApplicationQuestion {
  id: string;
  question: string;
  type: "text" | "textarea" | "select" | "radio" | "boolean" | "file" | "date";
  required: boolean;
  options: string[];
}

export type QuestionnaireResponseType =
  | "text"
  | "date"
  | "paragraph"
  | "multiple_choice"
  | "dropdown"
  | "checkboxes"
  | "video"
  | "reference_check"
  | "file";

export type SectionNavigationType = "continue" | "goto" | "submit";

export interface QuestionnaireAnswerOption {
  id: string;
  label: string;
  /** Optional branching: jump to another section when this answer is selected. */
  goToSectionId?: string | null;
}

export interface QuestionnaireQuestion {
  id: string;
  prompt: string;
  description: string;
  responseType: QuestionnaireResponseType;
  required: boolean;
  options: QuestionnaireAnswerOption[];
  /** Used when responseType is reference_check. */
  referenceContactCount?: number;
}

export interface QuestionnaireSection {
  id: string;
  title: string;
  description: string;
  questions: QuestionnaireQuestion[];
  navigation: SectionNavigationType;
  /** Target section when navigation is "goto". */
  goToSectionId?: string | null;
}

export interface ApplicationQuestionnaire {
  id: string;
  title: string;
  sections: QuestionnaireSection[];
  /**
   * Flat questions derived for list display / legacy payloads.
   * Prefer reading from sections; kept in sync on save.
   */
  questions: CustomApplicationQuestion[];
  moveOnCompletion: boolean;
  moveToStageId: string | null;
  emailTemplate: string;
}

export interface PipelineStageConfig {
  id: string;
  label: string;
  enabled: boolean;
}

export type { PipelineSettings } from "./pipeline-settings";

export interface HiringTeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface ExternalRecruiter {
  id: string;
  name: string;
  email: string;
}

export interface JobWizardState {
  title: string;
  department: string;
  location: string;
  employmentType: string;
  postedDate: string;
  description: string;
  formFields: ApplicationFormField[];
  /** Flat list kept in sync for API persistence / question sync. */
  customQuestions: CustomApplicationQuestion[];
  questionnaires: ApplicationQuestionnaire[];
  includeAnswersOnExperience: boolean;
  pipelineStages: PipelineStageConfig[];
  pipelineSettings: import("./pipeline-settings").PipelineSettings;
  aiRequirements: string;
  enableAiRank: boolean;
  /** When true, the role is published on the careers site. */
  isActive: boolean;
  /**
   * Publishing lifecycle. Synced with isActive:
   * draft → not published; active → published; inactive → previously published, now closed.
   */
  status: "draft" | "active" | "inactive";
  autoOpenEnabled: boolean;
  autoOpenAt: string | null;
  autoCloseEnabled: boolean;
  autoCloseAt: string | null;
  hiringTeam: HiringTeamMember[];
  externalRecruiters: ExternalRecruiter[];
}

export type JobWizardStepId =
  | "details"
  | "description"
  | "application"
  | "pipeline"
  | "screening"
  | "advertise"
  | "hiring-team";
