import type { TourDefinition } from "./types";

export const userJobsTour: TourDefinition = {
  id: "user-jobs",
  label: "Open positions",
  autoStart: false,
  autoStartDelay: 700,
  brandHero: true,
  heroImageSrc: "/images/admin-guides/job-postings.jpg",
  steps: [
    {
      type: "modal",
      title: "Open positions",
      content:
        "Browse roles you can apply for. Search by title, department, or location, then open a card to apply.",
      secondaryContent: "Press Guide in the header to replay this walkthrough.",
      illustration: "brand-hero",
    },
    {
      target: '[data-tour="user-jobs-header"]',
      title: "Jobs page",
      content:
        "Open positions from BQI appear here when they are accepting applications.",
      placement: "bottom",
    },
    {
      target: '[data-tour="user-jobs-search"]',
      title: "Search jobs",
      content:
        "Narrow the list by title, department, or location.",
      placement: "bottom",
    },
    {
      target: '[data-tour="user-jobs-list"]',
      title: "Job cards",
      content:
        "Each card shows title, department, and location. Use Apply to start the application form. Cards mark roles you already applied to.",
      placement: "top",
    },
    {
      target: '[data-tour="user-nav-applications"]',
      title: "Track submissions",
      content:
        "After you apply, check Applications to follow status updates.",
      placement: "right",
    },
    {
      target: '[data-tour="tour-help-button"]',
      title: "Replay the guide",
      content: "Press Guide in the page header to run this tour again.",
      placement: "bottom",
    },
  ],
};
