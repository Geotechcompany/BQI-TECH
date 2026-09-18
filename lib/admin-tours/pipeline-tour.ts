import type { TourDefinition } from "./types";

export const pipelineTour: TourDefinition = {
  id: "pipeline",
  label: "Recruitment pipeline",
  autoStart: false,
  autoStartDelay: 900,
  brandHero: true,
  steps: [
    {
      type: "modal",
      title: "Pipeline board",
      content:
        "Candidates sit in stage columns for this position. Drag a card to move someone forward or back; the change saves immediately.",
      secondaryContent:
        "Press Guide anytime to walk through Add Candidates, settings, and list view.",
      illustration: "pipeline-kanban",
    },
    {
      type: "spotlight",
      target: '[data-tour="pipeline-board"]',
      title: "Hiring board",
      content:
        "Each column is a stage. Open a card for the full profile, or drag between columns to update status.",
      placement: "bottom",
    },
    {
      type: "spotlight",
      target: '[data-tour="pipeline-add-candidate"]',
      title: "Add candidates",
      content:
        "Add people into the first stage without waiting for a careers-site application.",
      placement: "bottom",
    },
    {
      type: "spotlight",
      target: '[data-tour="pipeline-settings"]',
      title: "Pipeline settings",
      content:
        "Rename stages, pick a template, and set automated stage actions for this position only.",
      placement: "bottom",
    },
    {
      type: "spotlight",
      target: '[data-tour="pipeline-list-view"]',
      title: "List view",
      content:
        "Jump to the Candidates table filtered to this position for bulk actions and exports.",
      placement: "bottom",
    },
    {
      target: '[data-tour="tour-help-button"]',
      title: "Replay the guide",
      content: "Press Guide in the header to run this walkthrough again.",
      placement: "bottom",
    },
  ],
};
