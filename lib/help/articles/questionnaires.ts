import { HelpArticle } from "@/lib/help/types";
import { HELP_PATHS } from "@/lib/help/urls";

export const questionnairesArticle: HelpArticle = {
  slug: "questionnaires",
  collection: "questionnaires",
  title: "Questionnaires",
  summary:
    "Build multi-section questionnaires with response types, branching, and email templates.",
  author: "BQI Team",
  updatedAt: "2026-07-17",
  path: HELP_PATHS.questionnaires,
  intro:
    "Questionnaires let you ask candidates custom questions beyond the standard application fields. You create them on the Application step of the Job Setup Wizard, inside Add Questionnaire.",
  blocks: [
    {
      type: "callout",
      title: "Who can edit",
      text: "You need access to Positions (or the job wizard) in admin. Questionnaires are saved on the position you are editing.",
    },
    {
      type: "heading",
      id: "open-builder",
      text: "Open the questionnaire builder",
    },
    {
      type: "steps",
      items: [
        "Open a position in the Job Setup Wizard and go to the Application step.",
        "Under Application Questionnaire, click Add Questionnaire (or the pencil on an existing one).",
        "Enter a Questionnaire Name. This name is required before you can save.",
      ],
    },
    {
      type: "heading",
      id: "sections",
      text: "Sections",
    },
    {
      type: "paragraph",
      text: "Every questionnaire starts with Section 1. Use the Section button to add more. Each section can have its own title and description under Options.",
    },
    {
      type: "steps",
      items: [
        "Click Options on a section to set Section title and Section description.",
        "Use + Add Question to add questions to that section.",
        "At the bottom of a section, choose what happens next: Continue onto next section, Go to Section N, or Submit form.",
      ],
    },
    {
      type: "heading",
      id: "response-types",
      text: "Response types",
    },
    {
      type: "paragraph",
      text: "When you add or edit a question, pick a Response Type:",
    },
    {
      type: "list",
      items: [
        "Text — short answer",
        "Paragraph — longer written answer",
        "Date — date picker",
        "Multiple Choice — one option from a list",
        "Dropdown List — one option from a compact list",
        "Checkboxes — one or more options",
        "Video Response — candidate uploads a video",
        "Reference Check — ask for a set number of reference contacts",
        "File Attachment — candidate uploads a file",
      ],
    },
    {
      type: "paragraph",
      text: "Mark Required when the candidate must answer before they can continue. For Multiple Choice, Dropdown List, and Checkboxes, add Answer options. For Reference Check, set Number of contacts (1–10).",
    },
    {
      type: "heading",
      id: "branching",
      text: "Advanced branching",
    },
    {
      type: "paragraph",
      text: "You can route candidates by answer or by section navigation.",
    },
    {
      type: "steps",
      items: [
        "On Multiple Choice, Dropdown List, or Checkboxes options, use Go to Section to jump to another section when that option is selected.",
        "On the section footer, choose Go to Section N instead of Continue onto next section when everyone who finishes that section should jump ahead.",
        "Choose Submit form on the last path you want candidates to take.",
      ],
    },
    {
      type: "callout",
      text: "Option-level Go to Section only appears when the questionnaire has more than one section.",
    },
    {
      type: "heading",
      id: "move-on-completion",
      text: "Move on Completion",
    },
    {
      type: "paragraph",
      text: "Turn on Move To Stage to move a candidate into a pipeline stage after they finish the questionnaire. Pick the stage under Pipelines / Stage. This setting is ignored when the questionnaire is used on the application form.",
    },
    {
      type: "heading",
      id: "email-template",
      text: "Questionnaire Email Template",
    },
    {
      type: "paragraph",
      text: "Use Questionnaire Email Template when you send the assessment to an existing candidate (not when they fill it during apply). Click Show Template to edit the body.",
    },
    {
      type: "list",
      items: [
        "[[candidate_first_name]] — Candidate First Name",
        "[[candidate_full_name]] — Candidate Full Name",
        "[[questionnaire_link]] — Questionnaire Link",
        "[[company_user_first_name]] — Your First Name",
        "[[position_title]] — Position Title",
      ],
    },
    {
      type: "paragraph",
      text: "Insert variables from the Template Variables dropdown, then click Save Changes.",
    },
    {
      type: "heading",
      id: "related",
      text: "Related",
    },
    {
      type: "rich",
      parts: [
        { kind: "text", text: "See " },
        {
          kind: "link",
          href: HELP_PATHS.applicationForms,
          label: "Using Questionnaires with Application Forms",
        },
        { kind: "text", text: " for how questionnaires sit next to standard form fields." },
      ],
    },
  ],
};
