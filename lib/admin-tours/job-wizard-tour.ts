import type { TourDefinition } from "./types";

export const jobWizardTour: TourDefinition = {
  id: "job-wizard",
  label: "Position wizard",
  autoStart: false,
  brandHero: true,
  steps: [
    {
      type: "modal",
      title: "Position setup",
      content:
        "Work through each step to publish a position. Progress saves as you continue so you can leave and return.",
      secondaryContent: "Press Guide in the header to replay this walkthrough.",
      illustration: "brand-hero",
    },
    {
      target: '[data-tour="job-wizard-steps"]',
      title: "Step list",
      content:
        "Jump between Details, Description, Application, Pipeline, and the remaining publish steps from this rail.",
      placement: "right",
    },
    {
      target: '[data-tour="job-wizard-content"]',
      title: "Current step",
      content:
        "Fill in the fields for the active step. Required fields block Continue until they are complete.",
      placement: "top",
    },
    {
      target: '[data-tour="job-wizard-actions"]',
      title: "Save and continue",
      content:
        "Save Progress keeps a draft. Continue validates the step and moves you forward. Finish publishes when you reach the last step.",
      placement: "top",
    },
  ],
};
