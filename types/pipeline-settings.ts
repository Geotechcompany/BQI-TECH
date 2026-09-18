export type StageActionType =
  | "add_tags"
  | "move_after_meeting"
  | "send_email_sms"
  | "nurture_campaign"
  | "send_questionnaire"
  | "team_feedback"
  | "candidate_scorecards"
  | "assign_hiring_manager"
  | "run_background_check"
  | "create_task"
  /** @deprecated Prefer send_email_sms */
  | "send_email"
  /** @deprecated Prefer team_feedback */
  | "notify_team";

export type EmailSmsChannel = "email" | "sms" | "both";

/** Delay before sending a stage-action questionnaire. */
export type QuestionnaireDelay =
  | "none"
  | "1h"
  | "4h"
  | "1d"
  | "2d"
  | "3d"
  | "1w"
  | "2w";

/** Relative due date for create-task stage actions. */
export type TaskDueDate =
  | "none"
  | "today"
  | "tomorrow"
  | "3d"
  | "1w"
  | "2w";

export interface StageActionAttachment {
  id: string;
  name: string;
  size: number;
  type: string;
}

export interface StageAction {
  id: string;
  type: StageActionType;
  label?: string;
  /** Marks actions that ship with the default pipeline template. */
  isDefault?: boolean;
  /** Legacy / display template name for email actions */
  templateName?: string;
  tags?: string[];
  channel?: EmailSmsChannel;
  emailSubject?: string;
  emailBody?: string;
  smsBody?: string;
  questionnaireId?: string | null;
  questionnaireDelay?: QuestionnaireDelay;
  nurtureCampaignName?: string;
  hiringManagerId?: string | null;
  /** When true, ignore hiringManagerId and distribute evenly. */
  assignByRoundRobin?: boolean;
  taskTitle?: string;
  taskDescription?: string;
  taskAssigneeId?: string | null;
  taskDueDate?: TaskDueDate;
  taskAttachments?: StageActionAttachment[];
  moveToStageId?: string | null;
  /** When moving after a meeting, also run destination stage actions. */
  runStageActions?: boolean;
  backgroundCheckPackageId?: string | null;
  backgroundCheckCountry?: string;
  backgroundCheckCity?: string;
  scorecardTemplateName?: string;
  feedbackPrompt?: string;
}

export interface PipelineSettings {
  templateId: string;
  emailSenderName?: string;
  stageActions?: Record<string, StageAction[]>;
}

export interface PipelineTemplate {
  id: string;
  label: string;
  description?: string;
}
