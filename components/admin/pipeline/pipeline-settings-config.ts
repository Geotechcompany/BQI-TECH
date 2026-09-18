import {
  UserPlus,
  ListChecks,
  ClipboardCheck,
  MessagesSquare,
  Trophy,
  UserX,
  type LucideIcon,
} from "lucide-react";
import {
  EmailSmsChannel,
  PipelineSettings,
  PipelineTemplate,
  QuestionnaireDelay,
  StageAction,
  StageActionAttachment,
  StageActionType,
  TaskDueDate,
} from "@/types/pipeline-settings";
import { PipelineStageConfig } from "@/types/job-wizard";
import { PIPELINE_STAGES } from "./pipeline-utils";

const VALID_QUESTIONNAIRE_DELAYS = new Set<QuestionnaireDelay>([
  "none",
  "1h",
  "4h",
  "1d",
  "2d",
  "3d",
  "1w",
  "2w",
]);

const VALID_TASK_DUE_DATES = new Set<TaskDueDate>([
  "none",
  "today",
  "tomorrow",
  "3d",
  "1w",
  "2w",
]);

function normalizeQuestionnaireDelay(
  value: unknown
): QuestionnaireDelay | undefined {
  if (typeof value !== "string") return undefined;
  if (VALID_QUESTIONNAIRE_DELAYS.has(value as QuestionnaireDelay)) {
    return value as QuestionnaireDelay;
  }
  return undefined;
}

function normalizeTaskDueDate(value: unknown): TaskDueDate | undefined {
  if (typeof value !== "string") return undefined;
  if (VALID_TASK_DUE_DATES.has(value as TaskDueDate)) {
    return value as TaskDueDate;
  }
  return undefined;
}

function normalizeAttachments(value: unknown): StageActionAttachment[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const attachments = value
    .filter(
      (item): item is Record<string, unknown> =>
        Boolean(item && typeof item === "object")
    )
    .map((item, index) => {
      const name = optionalString(item.name);
      if (!name) return null;
      return {
        id:
          typeof item.id === "string" && item.id.trim()
            ? item.id.trim()
            : `attachment-${index}`,
        name,
        size: typeof item.size === "number" && item.size >= 0 ? item.size : 0,
        type: optionalString(item.type) || "application/octet-stream",
      } satisfies StageActionAttachment;
    })
    .filter((item): item is StageActionAttachment => Boolean(item));
  return attachments.length > 0 ? attachments : undefined;
}

export interface PipelineStageDefinition {
  id: string;
  label: string;
  icon: LucideIcon;
}

export interface ResolvedPipelineStage extends PipelineStageDefinition {
  actionsCount: number;
}

export const PIPELINE_TEMPLATES: PipelineTemplate[] = [
  {
    id: "default",
    label: "Default Pipeline",
    description:
      "New, Shortlisted, Technical Assessment, Interviewing, Hired, Disqualified",
  },
];

export const DEFAULT_PIPELINE_STAGE_DEFINITIONS: PipelineStageDefinition[] =
  PIPELINE_STAGES.map((label) => ({
    id: label.toLowerCase().replace(/\s+/g, "-"),
    label,
    icon: stageIconForId(label.toLowerCase().replace(/\s+/g, "-")),
  }));

function stageIconForId(id: string): LucideIcon {
  switch (id) {
    case "new":
      return UserPlus;
    case "shortlisted":
      return ListChecks;
    case "technical-assessment":
      return ClipboardCheck;
    case "interviewing":
      return MessagesSquare;
    case "hired":
      return Trophy;
    case "disqualified":
      return UserX;
    default:
      return UserPlus;
  }
}

export function getPipelineTemplate(templateId?: string | null): PipelineTemplate {
  return (
    PIPELINE_TEMPLATES.find((template) => template.id === templateId) ??
    PIPELINE_TEMPLATES[0]
  );
}

export function getTemplateStageDefinitions(
  templateId?: string | null
): PipelineStageDefinition[] {
  const template = getPipelineTemplate(templateId);
  if (template.id === "default") {
    return DEFAULT_PIPELINE_STAGE_DEFINITIONS.map((stage) => ({ ...stage }));
  }
  return DEFAULT_PIPELINE_STAGE_DEFINITIONS.map((stage) => ({ ...stage }));
}

export function stagesFromTemplate(
  templateId?: string | null
): PipelineStageConfig[] {
  return getTemplateStageDefinitions(templateId).map((stage) => ({
    id: stage.id,
    label: stage.label,
    enabled: true,
  }));
}

export function createDefaultPipelineSettings(
  emailSenderName = ""
): PipelineSettings {
  return {
    templateId: "default",
    emailSenderName,
    stageActions: {},
  };
}

const VALID_ACTION_TYPES = new Set<StageActionType>([
  "add_tags",
  "move_after_meeting",
  "send_email_sms",
  "nurture_campaign",
  "send_questionnaire",
  "team_feedback",
  "candidate_scorecards",
  "assign_hiring_manager",
  "run_background_check",
  "create_task",
  "send_email",
  "notify_team",
]);

function normalizeActionType(raw: unknown): StageActionType {
  if (raw === "send_email") return "send_email_sms";
  if (raw === "notify_team") return "team_feedback";
  if (typeof raw === "string" && VALID_ACTION_TYPES.has(raw as StageActionType)) {
    return raw as StageActionType;
  }
  return "send_email_sms";
}

function optionalString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function optionalNullableString(value: unknown): string | null | undefined {
  if (value === null) return null;
  return optionalString(value);
}

function normalizeChannel(value: unknown): EmailSmsChannel | undefined {
  if (value === "email" || value === "sms" || value === "both") return value;
  return undefined;
}

function normalizeStageAction(
  action: Record<string, unknown>,
  stageId: string,
  index: number
): StageAction {
  const type = normalizeActionType(action.type);
  const tags = Array.isArray(action.tags)
    ? action.tags
        .filter((tag): tag is string => typeof tag === "string")
        .map((tag) => tag.trim())
        .filter(Boolean)
    : undefined;

  return {
    id:
      typeof action.id === "string" && action.id.trim()
        ? action.id.trim()
        : `${stageId}-action-${index}`,
    type,
    label: optionalString(action.label),
    isDefault: Boolean(action.isDefault),
    templateName: optionalString(action.templateName),
    tags,
    channel: normalizeChannel(action.channel),
    emailSubject: optionalString(action.emailSubject),
    emailBody: optionalString(action.emailBody),
    smsBody: optionalString(action.smsBody),
    questionnaireId: optionalNullableString(action.questionnaireId),
    questionnaireDelay: normalizeQuestionnaireDelay(action.questionnaireDelay),
    nurtureCampaignName: optionalString(action.nurtureCampaignName),
    hiringManagerId: optionalNullableString(action.hiringManagerId),
    assignByRoundRobin: Boolean(action.assignByRoundRobin),
    taskTitle: optionalString(action.taskTitle),
    taskDescription: optionalString(action.taskDescription),
    taskAssigneeId: optionalNullableString(action.taskAssigneeId),
    taskDueDate: normalizeTaskDueDate(action.taskDueDate),
    taskAttachments: normalizeAttachments(action.taskAttachments),
    moveToStageId: optionalNullableString(action.moveToStageId),
    runStageActions:
      action.runStageActions === undefined
        ? undefined
        : Boolean(action.runStageActions),
    backgroundCheckPackageId: optionalNullableString(
      action.backgroundCheckPackageId
    ),
    backgroundCheckCountry: optionalString(action.backgroundCheckCountry),
    backgroundCheckCity: optionalString(action.backgroundCheckCity),
    scorecardTemplateName: optionalString(action.scorecardTemplateName),
    feedbackPrompt: optionalString(action.feedbackPrompt),
  };
}

export function normalizePipelineSettings(
  raw: unknown,
  fallbackEmailSenderName = ""
): PipelineSettings {
  const base = createDefaultPipelineSettings(fallbackEmailSenderName);
  if (!raw || typeof raw !== "object") return base;

  const input = raw as Record<string, unknown>;
  const templateId =
    typeof input.templateId === "string" && input.templateId.trim()
      ? input.templateId.trim()
      : base.templateId;

  const emailSenderName =
    typeof input.emailSenderName === "string"
      ? input.emailSenderName.trim()
      : base.emailSenderName;

  const stageActions: Record<string, StageAction[]> = {};

  if (input.stageActions && typeof input.stageActions === "object") {
    for (const [stageId, actions] of Object.entries(
      input.stageActions as Record<string, unknown>
    )) {
      if (!Array.isArray(actions)) continue;
      stageActions[stageId] = actions
        .filter(
          (action): action is Record<string, unknown> =>
            Boolean(action && typeof action === "object")
        )
        .map((action, index) => normalizeStageAction(action, stageId, index));
    }
  }

  return {
    templateId,
    emailSenderName,
    stageActions,
  };
}

export function resolveJobPipelineStages(job: {
  pipelineSettings?: PipelineSettings | null;
  pipelineStages?: PipelineStageConfig[] | null;
}): ResolvedPipelineStage[] {
  const settings = normalizePipelineSettings(job.pipelineSettings);
  const templateStages = getTemplateStageDefinitions(settings.templateId);
  const enabledStages = Array.isArray(job.pipelineStages)
    ? job.pipelineStages.filter((stage) => stage.enabled)
    : [];

  const filteredStages =
    enabledStages.length > 0
      ? templateStages
          .map((stage) => {
            const match = enabledStages.find(
              (enabled) =>
                enabled.id === stage.id ||
                enabled.label.trim().toLowerCase() ===
                  stage.label.trim().toLowerCase()
            );
            if (!match) return null;
            return {
              ...stage,
              label: match.label || stage.label,
            };
          })
          .filter((stage): stage is PipelineStageDefinition => Boolean(stage))
      : templateStages;

  return filteredStages.map((stage) => ({
    ...stage,
    actionsCount: settings.stageActions?.[stage.id]?.length ?? 0,
  }));
}

export function pipelineStageLabels(stages: ResolvedPipelineStage[]): string[] {
  return stages.map((stage) => stage.label);
}

/** Unique tags already used across stage actions (for the Add Tags picker). */
export function collectStageActionTags(
  stageActions?: Record<string, StageAction[]> | null
): string[] {
  if (!stageActions) return [];
  const tags = new Set<string>();
  for (const actions of Object.values(stageActions)) {
    if (!Array.isArray(actions)) continue;
    for (const action of actions) {
      for (const tag of action.tags || []) {
        const trimmed = tag.trim();
        if (trimmed) tags.add(trimmed);
      }
    }
  }
  return Array.from(tags).sort((a, b) => a.localeCompare(b));
}

export function mergeStageDefinitionsWithConfig(
  templateId: string | null | undefined,
  pipelineStages: PipelineStageConfig[]
): PipelineStageDefinition[] {
  const definitions = getTemplateStageDefinitions(templateId);
  return definitions.map((stage) => {
    const saved = pipelineStages.find(
      (item) =>
        item.id === stage.id ||
        item.label.trim().toLowerCase() === stage.label.trim().toLowerCase()
    );
    return {
      ...stage,
      label: saved?.label || stage.label,
    };
  });
}
