import type { TourDefinition } from "./types";

export const userOverviewTour: TourDefinition = {
  id: "user-overview",
  label: "Dashboard overview",
  autoStart: false,
  autoStartDelay: 700,
  brandHero: true,
  heroImageSrc: "/images/portal-user-login-cover.jpg",
  steps: [
    {
      type: "modal",
      title: "Your dashboard",
      content:
        "This is your home for applications, progress updates, and open roles.",
      secondaryContent: "Press Guide anytime to replay this walkthrough.",
      illustration: "brand-hero",
    },
    {
      target: '[data-tour="user-welcome-banner"]',
      title: "Welcome strip",
      content:
        "Counts for applications in review and open positions sit here. Jump to My applications or Browse jobs from the buttons.",
      placement: "bottom",
    },
    {
      target: '[data-tour="user-hiring-progress"]',
      title: "Your progress",
      content:
        "Shows where your latest application sits in the hiring stages.",
      placement: "bottom",
    },
    {
      target: '[data-tour="user-overview-stats"]',
      title: "Status totals",
      content:
        "Submitted, shortlisted, assessment, interview, offers, and closed counts for all of your applications.",
      placement: "bottom",
    },
    {
      target: '[data-tour="user-latest-application"]',
      title: "Latest application",
      content:
        "Your most recent submission and its status. Open View details to see the full record.",
      placement: "top",
    },
    {
      target: '[data-tour="user-nav-applications"]',
      title: "Applications",
      content:
        "Open Applications in the sidebar to search and review every submission.",
      placement: "right",
    },
    {
      target: '[data-tour="user-nav-jobs"]',
      title: "Jobs",
      content:
        "Browse open positions and apply from Jobs.",
      placement: "right",
    },
    {
      target: '[data-tour="user-nav-settings"]',
      title: "Profile and settings",
      content:
        "Update your name, photo, notifications, and password under Settings.",
      placement: "right",
    },
    {
      target: '[data-tour="tour-help-button"]',
      title: "Replay the guide",
      content:
        "Press Guide on the welcome banner to run this tour again.",
      placement: "bottom",
    },
  ],
};
