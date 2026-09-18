import type { TourDefinition } from "./types";

export const employeesOnboardingTour: TourDefinition = {
  id: "employees-onboarding",
  label: "Onboarding",
  autoStart: false,
  brandHero: true,
  steps: [
    {
      type: "modal",
      title: "Onboarding pipeline",
      content:
        "Track new hires still in onboarding: stage progress, start cohorts, and the 30/60/90 plan.",
      secondaryContent: "Press Guide in the header to replay.",
      illustration: "brand-hero",
    },
    {
      target: '[data-tour="employees-onboarding-metrics"]',
      title: "Headline metrics",
      content:
        "Active count, average days in program, starts this month, and how many have finished every stage.",
      placement: "bottom",
    },
    {
      target: '[data-tour="employees-onboarding-cohort"]',
      title: "Hire cohort",
      content:
        "People currently onboarding grouped by start month. Empty months mean no one in that cohort yet.",
      placement: "top",
    },
    {
      target: '[data-tour="employees-onboarding-milestones"]',
      title: "Milestone checklist",
      content:
        "Share of active onboardings past paperwork, IT setup, orientation, buddy, and complete.",
      placement: "left",
    },
    {
      target: '[data-tour="employees-onboarding-list"]',
      title: "People in program",
      content:
        "Open a name for the profile. Stage labels show the current onboarding gate.",
      placement: "top",
    },
  ],
};
