import type { TourDefinition } from "./types";

export const jobPostingsTour: TourDefinition = {
  id: "job-postings",
  label: "Positions",
  autoStart: false,
  brandHero: true,
  steps: [
    {
      type: "modal",
      title: "Positions",
      content:
        "Manage every open position here: create postings, open pipelines, edit drafts, and activate or deactivate listings.",
      secondaryContent: "Press Guide anytime to walk through this page again.",
      illustration: "brand-hero",
    },
    {
      target: '[data-tour="job-postings-create"]',
      title: "Create a position",
      content:
        "Start the job wizard to set details, description, application form, pipeline, and publish options.",
      placement: "bottom",
    },
    {
      target: '[data-tour="job-postings-table"]',
      title: "Position list",
      content:
        "Search and review title, department, location, posted date, and status for each position.",
      placement: "top",
    },
    {
      target: '[data-tour="job-postings-pipeline"]',
      title: "Open pipeline",
      content:
        "The columns icon opens the kanban board so you can move candidates by stage.",
      placement: "left",
    },
  ],
};
