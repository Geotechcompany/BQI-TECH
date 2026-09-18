import type { TourDefinition } from "./types";

export const applicantsTour: TourDefinition = {
  id: "applicants",
  label: "Applicants",
  autoStart: false,
  brandHero: true,
  steps: [
    {
      type: "modal",
      title: "Applicants by position",
      content:
        "Select a job on the left, work the stage list in the middle, and open a candidate on the right without leaving this board.",
      secondaryContent: "Press Guide anytime to walk through the panes again.",
      illustration: "brand-hero",
    },
    {
      target: '[data-tour="applicants-positions"]',
      title: "Positions",
      content:
        "Switch All Positions or My Positions, then pick a job to load its applicants.",
      placement: "right",
    },
    {
      target: '[data-tour="applicants-preferences"]',
      title: "Preferences",
      content:
        "Set which stages and columns you see on this board for your account.",
      placement: "bottom",
    },
    {
      target: '[data-tour="applicants-action-bar"]',
      title: "Stage actions",
      content:
        "Move, tag, score, or open bulk tools for the applicants in the current stage.",
      placement: "bottom",
    },
    {
      target: '[data-tour="applicants-workspace"]',
      title: "Workspace",
      content:
        "The center list is the stage queue. Select a row to load the resume and profile panel.",
      placement: "top",
    },
  ],
};
