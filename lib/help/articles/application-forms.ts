import { HelpArticle } from "@/lib/help/types";
import { HELP_PATHS } from "@/lib/help/urls";

export const applicationFormsArticle: HelpArticle = {
  slug: "application-forms",
  collection: "questionnaires",
  title: "Using Questionnaires with Application Forms",
  summary:
    "Combine standard application fields with custom questionnaires on the Application step.",
  author: "BQI Team",
  updatedAt: "2026-07-17",
  path: HELP_PATHS.applicationForms,
  intro:
    "The Application step has two parts: the Application Form (built-in fields) and Application Questionnaire (your custom questions). Candidates see both when they apply through the Careers Site or Employee Portal.",
  blocks: [
    {
      type: "heading",
      id: "standard-fields",
      text: "Configure standard fields",
    },
    {
      type: "steps",
      items: [
        "Open the Job Setup Wizard and go to Application.",
        "Under each category (Personal, Experience, General), set each field to Required, Optional, or Disabled.",
        "Locked fields stay Required. You cannot disable them.",
      ],
    },
    {
      type: "paragraph",
      text: "Use Preview (top right) to open the careers jobs page and check how the public site looks.",
    },
    {
      type: "heading",
      id: "attach-questionnaire",
      text: "Attach questionnaires",
    },
    {
      type: "steps",
      items: [
        "Under Application Questionnaire, click Add Questionnaire.",
        "Build sections and questions, then Save Changes.",
        "Add more questionnaires if you need separate assessments on the same position.",
        "Use the pencil to edit or the trash icon to remove a questionnaire from this position.",
      ],
    },
    {
      type: "callout",
      title: "Move on Completion",
      text: "Move To Stage does not run for questionnaires used on the application form. Use it when you send a questionnaire to a candidate already in the pipeline.",
    },
    {
      type: "heading",
      id: "what-candidates-see",
      text: "What candidates see",
    },
    {
      type: "list",
      items: [
        "Required standard fields and required questionnaire questions must be completed to submit.",
        "Optional fields can be skipped.",
        "Disabled fields are hidden from the form.",
        "Questionnaire sections follow the navigation and branching you configured.",
      ],
    },
    {
      type: "heading",
      id: "related",
      text: "Related",
    },
    {
      type: "rich",
      parts: [
        { kind: "text", text: "For sections, response types, and branching, read " },
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
