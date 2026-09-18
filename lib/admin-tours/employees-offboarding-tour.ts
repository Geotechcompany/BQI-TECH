import type { TourDefinition } from "./types";

export const employeesOffboardingTour: TourDefinition = {
  id: "employees-offboarding",
  label: "Offboarding",
  autoStart: false,
  brandHero: true,
  steps: [
    {
      type: "modal",
      title: "Offboarding pipeline",
      content:
        "Exit work from notice through knowledge transfer, asset return, exit interview, and close-out.",
      secondaryContent: "Press Guide in the header to replay.",
      illustration: "brand-hero",
    },
    {
      target: '[data-tour="employees-offboarding-metrics"]',
      title: "Exit metrics",
      content:
        "Active exits, people leaving within 14 days, assets still outstanding, and finished offboardings.",
      placement: "bottom",
    },
    {
      target: '[data-tour="employees-offboarding-list"]',
      title: "Active exits",
      content:
        "Everyone currently in offboarding with last day and stage. Open a row for the full profile.",
      placement: "top",
    },
    {
      target: '[data-tour="employees-offboarding-milestones"]',
      title: "Exit milestones",
      content:
        "How far the cohort has progressed through each exit gate.",
      placement: "left",
    },
  ],
};
