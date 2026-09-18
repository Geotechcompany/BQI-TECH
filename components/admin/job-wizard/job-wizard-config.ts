import {
  Briefcase,
  FileText,
  ClipboardList,
  Columns3,
  BrainCircuit,
  Megaphone,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  ApplicationFormField,
  ApplicationQuestionnaire,
  CustomApplicationQuestion,
  JobWizardState,
  JobWizardStepId,
  PipelineStageConfig,
} from "@/types/job-wizard";
import { PIPELINE_STAGES } from "@/components/admin/pipeline/pipeline-utils";
import {
  createDefaultPipelineSettings,
  normalizePipelineSettings,
  stagesFromTemplate,
} from "@/components/admin/pipeline/pipeline-settings-config";
import {
  flattenSectionsToCustomQuestions,
  normalizeQuestionnaire,
} from "./questionnaire-utils";
import { resolveJobPostingStatus } from "@/lib/job-posting-status";

export interface WizardStepConfig {
  id: JobWizardStepId;
  label: string;
  icon: LucideIcon;
}

export const WIZARD_STEPS: WizardStepConfig[] = [
  { id: "details", label: "Details", icon: Briefcase },
  { id: "description", label: "Description", icon: FileText },
  { id: "application", label: "Application", icon: ClipboardList },
  { id: "pipeline", label: "Pipeline", icon: Columns3 },
  { id: "screening", label: "Screening", icon: BrainCircuit },
  { id: "advertise", label: "Advertise", icon: Megaphone },
  { id: "hiring-team", label: "Hiring Team", icon: Users },
];

export const FORM_FIELD_CATEGORY_LABELS: Record<
  ApplicationFormField["category"],
  string
> = {
  personal: "Personal Information",
  experience: "Experience",
  general: "General",
};

export const DEFAULT_FORM_FIELDS: ApplicationFormField[] = [
  {
    id: "name",
    label: "Name",
    mode: "required",
    category: "personal",
    builtin: true,
    locked: true,
  },
  {
    id: "email",
    label: "Email Address",
    mode: "required",
    category: "personal",
    builtin: true,
    locked: true,
  },
  {
    id: "phone",
    label: "Phone Number",
    mode: "optional",
    category: "personal",
    builtin: true,
  },
  {
    id: "address",
    label: "Address",
    mode: "disabled",
    category: "personal",
    builtin: true,
  },
  {
    id: "desiredSalary",
    label: "Desired Salary",
    mode: "disabled",
    category: "personal",
    builtin: true,
  },
  {
    id: "preferredLocation",
    label: "Preferred Location",
    mode: "disabled",
    category: "personal",
    builtin: true,
  },
  {
    id: "cv",
    label: "Resume Upload",
    mode: "optional",
    category: "experience",
    builtin: true,
  },
  {
    id: "experienceSummary",
    label: "Experience Summary",
    mode: "optional",
    category: "experience",
    builtin: true,
  },
  {
    id: "workHistory",
    label: "Work History",
    mode: "optional",
    category: "experience",
    builtin: true,
  },
  {
    id: "education",
    label: "Education",
    mode: "optional",
    category: "experience",
    builtin: true,
  },
  {
    id: "coverLetter",
    label: "Cover Letter",
    mode: "optional",
    category: "general",
    builtin: true,
  },
];

export const DEFAULT_PIPELINE_STAGES: PipelineStageConfig[] =
  PIPELINE_STAGES.map((label) => ({
    id: label.toLowerCase().replace(/\s+/g, "-"),
    label,
    enabled: true,
  }));

/** Merge saved form schema with defaults so new fields appear for older jobs. */
export function mergeFormFields(
  saved: ApplicationFormField[] | undefined
): ApplicationFormField[] {
  const byId = new Map(
    (saved || []).map((field) => [field.id, field] as const)
  );

  return DEFAULT_FORM_FIELDS.map((defaults) => {
    const existing = byId.get(defaults.id);
    if (!existing) return { ...defaults };

    return {
      ...defaults,
      mode: defaults.locked ? "required" : existing.mode,
    };
  });
}

export function flattenQuestionnaires(
  questionnaires: ApplicationQuestionnaire[]
): CustomApplicationQuestion[] {
  return questionnaires.flatMap((questionnaire) => {
    const normalized = normalizeQuestionnaire(questionnaire);
    return flattenSectionsToCustomQuestions(normalized.sections);
  });
}

export function questionnairesFromQuestions(
  questions: CustomApplicationQuestion[]
): ApplicationQuestionnaire[] {
  if (!questions.length) return [];
  return [
    normalizeQuestionnaire({
      title: "Application Questionnaire",
      questions: questions.map((question) => ({ ...question })),
    }),
  ];
}

export function createEmptyWizardState(): JobWizardState {
  return {
    title: "",
    department: "",
    location: "",
    employmentType: "Full-time",
    postedDate: new Date().toISOString().slice(0, 10),
    description: "",
    formFields: DEFAULT_FORM_FIELDS.map((field) => ({ ...field })),
    customQuestions: [],
    questionnaires: [],
    includeAnswersOnExperience: true,
    pipelineStages: DEFAULT_PIPELINE_STAGES.map((stage) => ({ ...stage })),
    pipelineSettings: createDefaultPipelineSettings(),
    aiRequirements: "",
    enableAiRank: true,
    isActive: false,
    status: "draft",
    autoOpenEnabled: false,
    autoOpenAt: null,
    autoCloseEnabled: false,
    autoCloseAt: null,
    hiringTeam: [],
    externalRecruiters: [],
  };
}

function scheduleAtToIso(value: unknown): string | null {
  if (value == null || value === "") return null;
  const text = String(value);
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

export function jobToWizardState(job: Record<string, unknown>): JobWizardState {
  const base = createEmptyWizardState();

  const customQuestions = Array.isArray(job.customQuestions)
    ? (job.customQuestions as CustomApplicationQuestion[])
    : [];

  const questionnaires =
    Array.isArray(job.questionnaires) &&
    (job.questionnaires as ApplicationQuestionnaire[]).length > 0
      ? (job.questionnaires as ApplicationQuestionnaire[]).map((item) =>
          normalizeQuestionnaire(item)
        )
      : questionnairesFromQuestions(customQuestions);

  const pipelineSettings = normalizePipelineSettings(job.pipelineSettings);
  const templateStages = stagesFromTemplate(pipelineSettings.templateId);
  const savedStages =
    Array.isArray(job.pipelineStages) && job.pipelineStages.length
      ? (job.pipelineStages as PipelineStageConfig[])
      : templateStages;

  return {
    ...base,
    title: String(job.title || ""),
    department: String(job.department || ""),
    location: String(job.location || ""),
    employmentType: String(job.employmentType || "Full-time"),
    postedDate: job.postedDate
      ? String(job.postedDate).slice(0, 10)
      : base.postedDate,
    description: String(job.description || ""),
    formFields: mergeFormFields(
      Array.isArray(job.formSchema)
        ? (job.formSchema as ApplicationFormField[])
        : undefined
    ),
    customQuestions:
      questionnaires.length > 0
        ? flattenQuestionnaires(questionnaires)
        : customQuestions,
    questionnaires,
    includeAnswersOnExperience:
      job.includeAnswersOnExperience === undefined
        ? true
        : Boolean(job.includeAnswersOnExperience),
    pipelineStages: templateStages.map((stage) => {
      const match = savedStages.find(
        (saved) =>
          saved.id === stage.id ||
          saved.label.trim().toLowerCase() === stage.label.trim().toLowerCase()
      );
      return {
        id: stage.id,
        label: match?.label || stage.label,
        enabled: match?.enabled ?? true,
      };
    }),
    pipelineSettings,
    aiRequirements: String(job.aiRequirements || ""),
    enableAiRank: job.enableAiRank !== false,
    isActive: normalizeWizardStatus(job) === "active",
    status: normalizeWizardStatus(job),
    autoOpenEnabled: Boolean(job.autoOpenEnabled),
    autoOpenAt: scheduleAtToIso(job.autoOpenAt),
    autoCloseEnabled: Boolean(job.autoCloseEnabled),
    autoCloseAt: scheduleAtToIso(job.autoCloseAt),
    hiringTeam: Array.isArray(job.hiringTeam)
      ? (job.hiringTeam as JobWizardState["hiringTeam"])
      : [],
    externalRecruiters: Array.isArray(job.externalRecruiters)
      ? (job.externalRecruiters as JobWizardState["externalRecruiters"])
      : [],
  };
}

function normalizeWizardStatus(
  job: Record<string, unknown>
): JobWizardState["status"] {
  return resolveJobPostingStatus({
    title: job.title != null ? String(job.title) : "",
    isActive: typeof job.isActive === "boolean" ? job.isActive : null,
    status: job.status != null ? String(job.status) : null,
  });
}

export function wizardStateToPayload(
  state: JobWizardState,
  options?: { forceDraft?: boolean }
) {
  const customQuestions = flattenQuestionnaires(state.questionnaires);
  const isActive = options?.forceDraft ? false : state.isActive;
  const status: JobWizardState["status"] = isActive
    ? "active"
    : options?.forceDraft
      ? "draft"
      : state.status === "inactive"
        ? "inactive"
        : "draft";

  return {
    title: state.title.trim(),
    department: state.department.trim(),
    location: state.location.trim(),
    employmentType: state.employmentType,
    postedDate: new Date(state.postedDate).toISOString(),
    description: state.description,
    isActive,
    status,
    autoOpenEnabled: state.autoOpenEnabled,
    autoOpenAt: state.autoOpenEnabled ? state.autoOpenAt : null,
    autoCloseEnabled: state.autoCloseEnabled,
    autoCloseAt: state.autoCloseEnabled ? state.autoCloseAt : null,
    formSchema: state.formFields,
    customQuestions,
    questionnaires: state.questionnaires.map((questionnaire) =>
      normalizeQuestionnaire(questionnaire)
    ),
    includeAnswersOnExperience: state.includeAnswersOnExperience,
    pipelineStages: state.pipelineStages.filter((stage) => stage.enabled),
    pipelineSettings: normalizePipelineSettings(state.pipelineSettings),
    aiRequirements: state.aiRequirements.trim(),
    enableAiRank: state.enableAiRank,
    hiringTeam: state.hiringTeam,
    externalRecruiters: state.externalRecruiters,
    category: state.department.trim() || "General",
  };
}
