import { HelpArticle } from "@/lib/help/types";
import { HELP_PATHS } from "@/lib/help/urls";

export const positionPipelineArticle: HelpArticle = {
  slug: "position-pipeline",
  collection: "pipelines",
  title: "Position Pipeline and Stage Actions",
  summary:
    "Pick a pipeline template, edit stage actions, and set the email sender for a position.",
  author: "BQI Team",
  updatedAt: "2026-07-17",
  path: HELP_PATHS.positionPipeline,
  intro:
    "Each position has its own pipeline. On the Pipeline step of the Job Setup Wizard you choose a template, configure stage actions, and set the email sender. Changes apply only to that position.",
  blocks: [
    {
      type: "heading",
      id: "choose-pipeline",
      text: "Choose which pipeline to use",
    },
    {
      type: "steps",
      items: [
        "Open the Job Setup Wizard and go to the Pipeline step.",
        "Under Choose which pipeline to use with this position, select a template such as Default Pipeline.",
        "The Pipeline Stages list updates to match that template.",
      ],
    },
    {
      type: "paragraph",
      text: "Default stages include New, Shortlisted, Technical Assessment, Interviewing, Hired, and Disqualified. Use Preview (when the job already exists) to open the pipeline board for this position.",
    },
    {
      type: "heading",
      id: "stage-actions",
      text: "Pipeline stage actions",
    },
    {
      type: "paragraph",
      text: "Stage actions automate common tasks. Config is saved with the position. Runtime automation when a candidate first enters a stage can be enabled later; today you configure and persist the actions here.",
    },
    {
      type: "steps",
      items: [
        "On a stage row, click Add Stage Actions.",
        "In Edit Stage, change the stage name if needed.",
        "Search Available Stage Actions and pick an action (Add Tags, Send Email/SMS, Run Background Check, and others).",
        "Fill the action config dialog, then Save.",
        "Remove one action or use Remove All, then Save Changes on Edit Stage.",
        "Continue through the wizard so the position keeps your changes.",
      ],
    },
    {
      type: "callout",
      title: "Position pipeline settings",
      text: "You can also open Position pipeline settings from the job pipeline board. That page uses the same template, stage actions, and email sender for this job only.",
    },
    {
      type: "heading",
      id: "email-sender",
      text: "Email sender",
    },
    {
      type: "steps",
      items: [
        "Scroll to Email Sender on the Pipeline step.",
        "Enter the name automated stage-action emails should use.",
        "Save the wizard (or Save on Position pipeline settings if you edit there).",
      ],
    },
    {
      type: "callout",
      title: "Per-position only",
      text: "Pipeline template, stage actions, and sender name do not change other jobs. Update each position separately.",
    },
    {
      type: "heading",
      id: "related",
      text: "Related",
    },
    {
      type: "rich",
      parts: [
        {
          kind: "text",
          text: "Questionnaires can move candidates with Move To Stage when sent outside the application form. See ",
        },
        {
          kind: "link",
          href: HELP_PATHS.questionnaires,
          label: "Questionnaires",
        },
        { kind: "text", text: "." },
      ],
    },
  ],
};
