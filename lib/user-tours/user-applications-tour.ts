import type { TourDefinition } from "./types";

export const userApplicationsTour: TourDefinition = {
  id: "user-applications",
  label: "My applications",
  autoStart: false,
  autoStartDelay: 700,
  brandHero: true,
  heroImageSrc: "/images/admin-guides/applicants.jpg",
  steps: [
    {
      type: "modal",
      title: "My applications",
      content:
        "Every role you applied for lives here. Search by title or department, then open a card for details.",
      secondaryContent: "Press Guide in the header to replay this walkthrough.",
      illustration: "brand-hero",
    },
    {
      target: '[data-tour="user-applications-header"]',
      title: "Applications list",
      content:
        "This page lists your submissions and their current status.",
      placement: "bottom",
    },
    {
      target: '[data-tour="user-applications-search"]',
      title: "Search",
      content:
        "Filter by position title, department, or name when you have many applications.",
      placement: "bottom",
    },
    {
      target: '[data-tour="user-applications-list"]',
      title: "Application cards",
      content:
        "Each card shows the role, status, location, and applied date. Press View Application for the full record.",
      placement: "top",
    },
    {
      target: '[data-tour="user-nav-jobs"]',
      title: "Apply to more roles",
      content:
        "Need another position? Open Jobs from the sidebar to browse and apply.",
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
