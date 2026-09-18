import type { TourDefinition } from "./types";

export const userApplyTour: TourDefinition = {
  id: "user-apply",
  label: "Apply for a role",
  autoStart: false,
  autoStartDelay: 700,
  brandHero: true,
  heroImageSrc: "/images/admin-guides/job-wizard.jpg",
  steps: [
    {
      type: "modal",
      title: "Application form",
      content:
        "Answer each section for this role. Required fields must be filled before you can move on or submit.",
      secondaryContent: "Press Guide in the header to replay this walkthrough.",
      illustration: "brand-hero",
    },
    {
      target: '[data-tour="user-apply-title"]',
      title: "Role title",
      content:
        "Confirms which position you are applying for.",
      placement: "bottom",
    },
    {
      target: '[data-tour="user-apply-steps"]',
      title: "Form steps",
      content:
        "The form may split into sections. Complete the current step before pressing Next.",
      placement: "bottom",
    },
    {
      target: '[data-tour="user-apply-form"]',
      title: "Questions",
      content:
        "Enter your answers and upload files where asked. Your progress stays on this page until you submit.",
      placement: "top",
    },
    {
      target: '[data-tour="user-apply-actions"]',
      title: "Back, Next, Submit",
      content:
        "Use Back and Next between sections. On the last section, Submit sends your application.",
      placement: "top",
    },
    {
      target: '[data-tour="tour-help-button"]',
      title: "Replay the guide",
      content: "Press Guide in the page header to run this tour again.",
      placement: "bottom",
    },
  ],
};
