import type { TourDefinition } from "./types";

export const overviewTour: TourDefinition = {
  id: "overview",
  label: "Dashboard overview",
  // Version 4 welcome banner owns first visit; Guide / Take the tour start this.
  autoStart: false,
  autoStartDelay: 700,
  brandHero: true,
  steps: [
    {
      type: "modal",
      title: "Overview tour",
      content:
        "This page is your hiring home. You will filter positions, open pipelines, and jump to Inbox, Communications, and Reports.",
      secondaryContent:
        "Use Guide in the header anytime you want this walkthrough again.",
      illustration: "brand-hero",
    },
    {
      target: '[data-tour="overview-positions-filter"]',
      title: "Position filter",
      content:
        "Switch between My Positions, All Positions, and Starred. My Positions shows positions you created or joined on the hiring team.",
      placement: "bottom",
    },
    {
      target: '[data-tour="overview-job-title"]',
      title: "Position title",
      content:
        "Each card shows the position name. Click the card to open that position's pipeline.",
      placement: "bottom",
    },
    {
      target: '[data-tour="overview-job-hiring-team"]',
      title: "Hiring team",
      content:
        "Avatars are the managers on this position. Press + to invite more.",
      placement: "bottom",
    },
    {
      target: '[data-tour="overview-job-settings"]',
      title: "Card settings",
      content:
        "The gear opens edit, pipeline settings, star, and activate or deactivate.",
      placement: "left",
    },
    {
      target: '[data-tour="overview-job-applications"]',
      title: "Application count",
      content:
        "This number is total applications for the position. Inactive positions mark that next to the label.",
      placement: "top",
    },
    {
      target: '[data-tour="overview-job-links"]',
      title: "Pipeline and Candidates",
      content:
        "Pipeline opens the kanban board. Candidates opens the list filtered to this position.",
      placement: "top",
    },
    {
      target: '[data-tour="overview-metrics"]',
      title: "Headline metrics",
      content:
        "Totals for applications, active jobs, recent volume, and users. Click a card to open that section.",
      placement: "bottom",
    },
    {
      target: '[data-tour="overview-recent"]',
      title: "Recent applications",
      content:
        "Newest candidates for the positions you filtered. Open a row to review the application and update status.",
      placement: "top",
    },
    {
      target: '[data-tour="overview-agenda"]',
      title: "My Agenda",
      content:
        "Upcoming interviews and assessments tied to you. Open an item to jump to the candidate or calendar entry.",
      placement: "left",
    },
    {
      target: '[data-tour="overview-tasks"]',
      title: "My Tasks",
      content:
        "Open follow-ups assigned to you. Check a task off when you finish it.",
      placement: "left",
    },
    {
      target: '[data-tour="nav-inbox"]',
      title: "Inbox",
      content:
        "Candidate messages and hiring notifications live here in the sidebar.",
      placement: "right",
    },
    {
      target: '[data-tour="nav-communications"]',
      title: "Communications",
      content:
        "Send outreach and manage email from Communications. Open it anytime from the sidebar.",
      placement: "right",
    },
    {
      target: '[data-tour="nav-reports"]',
      title: "Reports",
      content:
        "Status counts by stage, hiring metrics, and exports live under Reports. Pipeline boards open from each position card when you need the kanban view.",
      placement: "right",
    },
    {
      target: '[data-tour="tour-help-button"]',
      title: "Replay the guide",
      content:
        "Press Guide in the page header to run this tour again. Finish Setup and the Whats New float stay in their own corners.",
      placement: "bottom",
    },
  ],
};
