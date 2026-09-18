import {
  ClipboardList,
  FileCheck2,
  Mail,
  MessagesSquare,
  MoveRight,
  ShieldCheck,
  Sparkles,
  Tags,
  UserCheck,
  ListTodo,
  type LucideIcon,
} from "lucide-react";
import { StageAction, StageActionType, QuestionnaireDelay } from "@/types/pipeline-settings";

export interface StageActionCatalogItem {
  type: StageActionType;
  label: string;
  description: string;
  icon: LucideIcon;
  /** Opens a config dialog before the action is added. */
  requiresConfig: boolean;
}

export const QUESTIONNAIRE_DELAY_OPTIONS: {
  value: QuestionnaireDelay;
  label: string;
}[] = [
  { value: "none", label: "No Delay" },
  { value: "1h", label: "1 hour" },
  { value: "4h", label: "4 hours" },
  { value: "1d", label: "1 day" },
  { value: "2d", label: "2 days" },
  { value: "3d", label: "3 days" },
  { value: "1w", label: "1 week" },
  { value: "2w", label: "2 weeks" },
];

export const TASK_DUE_DATE_OPTIONS: {
  value: import("@/types/pipeline-settings").TaskDueDate;
  label: string;
}[] = [
  { value: "none", label: "No due date" },
  { value: "today", label: "Today" },
  { value: "tomorrow", label: "Tomorrow" },
  { value: "3d", label: "In 3 days" },
  { value: "1w", label: "In 1 week" },
  { value: "2w", label: "In 2 weeks" },
];

export const MAX_STAGE_ACTION_TAGS = 5;
export const MAX_TASK_DESCRIPTION_LENGTH = 2000;
export const MAX_TASK_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export function questionnaireDelayLabel(
  delay: QuestionnaireDelay | null | undefined
): string {
  const match = QUESTIONNAIRE_DELAY_OPTIONS.find(
    (option) => option.value === (delay || "none")
  );
  return match?.label ?? "No Delay";
}

/** Actions shown in the Edit Stage picker (Breezy-style set). */
export const STAGE_ACTION_CATALOG: StageActionCatalogItem[] = [
  {
    type: "add_tags",
    label: "Add Tags",
    description: "Apply tags when a candidate enters this stage.",
    icon: Tags,
    requiresConfig: true,
  },
  {
    type: "move_after_meeting",
    label: "Move After Meeting Scheduled",
    description: "Move the candidate after a meeting is booked.",
    icon: MoveRight,
    requiresConfig: true,
  },
  {
    type: "send_email_sms",
    label: "Send Email/SMS",
    description: "Send a message the first time they enter this stage.",
    icon: Mail,
    requiresConfig: true,
  },
  {
    type: "nurture_campaign",
    label: "Nurture Campaign",
    description: "Enroll the candidate in a nurture sequence.",
    icon: Sparkles,
    requiresConfig: true,
  },
  {
    type: "send_questionnaire",
    label: "Send Questionnaire",
    description: "Send a questionnaire from this position.",
    icon: ClipboardList,
    requiresConfig: true,
  },
  {
    type: "team_feedback",
    label: "Team Feedback",
    description: "Request feedback from the hiring team.",
    icon: MessagesSquare,
    requiresConfig: true,
  },
  {
    type: "candidate_scorecards",
    label: "Candidate Scorecards",
    description: "Collect scorecard ratings for this stage.",
    icon: FileCheck2,
    requiresConfig: false,
  },
  {
    type: "assign_hiring_manager",
    label: "Assign Hiring Manager",
    description: "Assign a hiring manager from the team.",
    icon: UserCheck,
    requiresConfig: true,
  },
  {
    type: "run_background_check",
    label: "Run Background Check",
    description: "Start a background check package.",
    icon: ShieldCheck,
    requiresConfig: true,
  },
  {
    type: "create_task",
    label: "Create Task",
    description: "Create a follow-up task for the team.",
    icon: ListTodo,
    requiresConfig: true,
  },
];

const CATALOG_BY_TYPE = new Map(
  STAGE_ACTION_CATALOG.map((item) => [item.type, item] as const)
);

export function getStageActionCatalogItem(
  type: StageActionType
): StageActionCatalogItem | undefined {
  if (type === "send_email") return CATALOG_BY_TYPE.get("send_email_sms");
  if (type === "notify_team") return CATALOG_BY_TYPE.get("team_feedback");
  return CATALOG_BY_TYPE.get(type);
}

export function stageActionLabel(type: StageActionType): string {
  return getStageActionCatalogItem(type)?.label ?? type;
}

export function summarizeStageActionConfig(
  action: StageAction
): string {
  switch (action.type) {
    case "add_tags":
      return action.tags?.length
        ? `Tags: ${action.tags.join(", ")}`
        : "No tags set";
    case "send_email_sms":
    case "send_email": {
      const channel = action.channel || "email";
      const subject = action.emailSubject?.trim() || action.templateName?.trim();
      if (subject) return `${channel}: ${subject}`;
      return `Channel: ${channel}`;
    }
    case "send_questionnaire": {
      if (!action.questionnaireId) return "No questionnaire selected";
      const delay = questionnaireDelayLabel(action.questionnaireDelay);
      return delay === "No Delay"
        ? "Questionnaire selected"
        : `Questionnaire · ${delay}`;
    }
    case "assign_hiring_manager":
      if (action.assignByRoundRobin) return "Assign by round robin";
      return action.hiringManagerId
        ? "Hiring manager assigned"
        : "No hiring manager selected";
    case "run_background_check": {
      const parts = [
        action.backgroundCheckCountry,
        action.backgroundCheckCity,
      ].filter(Boolean);
      return parts.length ? parts.join(", ") : "Package not configured";
    }
    case "create_task":
      return action.taskTitle?.trim() || "Untitled task";
    case "nurture_campaign":
      return action.nurtureCampaignName?.trim() || "Campaign not named";
    case "move_after_meeting":
      if (!action.moveToStageId) return "No target stage selected";
      return action.runStageActions === false
        ? "Move without running stage actions"
        : "Move and run stage actions";
    case "team_feedback":
    case "notify_team":
      return action.feedbackPrompt?.trim() || "Request team feedback";
    case "candidate_scorecards":
      return action.scorecardTemplateName?.trim() || "Default scorecard";
    default:
      return action.label?.trim() || stageActionLabel(action.type);
  }
}

/** Common countries for background-check config UI. */
export const BACKGROUND_CHECK_COUNTRIES = [
  "United States",
  "Canada",
  "United Kingdom",
  "Kenya",
  "Uganda",
  "Tanzania",
  "South Africa",
  "Nigeria",
  "India",
  "Philippines",
  "Australia",
  "Germany",
  "Other",
] as const;
