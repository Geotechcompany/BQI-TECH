import type { TourDefinition } from "./types";

export const leaveOverviewTour: TourDefinition = {
  id: "leave-overview",
  label: "Leave overview",
  autoStart: false,
  brandHero: true,
  steps: [
    {
      type: "modal",
      title: "Leave overview",
      content:
        "Company-wide leave health: who is out today, pending approvals, monthly approvals, and balance trends.",
      secondaryContent: "Press Guide beside the page title to replay.",
      illustration: "brand-hero",
    },
    {
      target: '[data-tour="leave-subnav"]',
      title: "Leave sections",
      content:
        "Jump between Overview, Requests, Balances, Calendar, Leave Types, and Policies.",
      placement: "bottom",
    },
    {
      target: '[data-tour="leave-overview-kpis"]',
      title: "Leave KPIs",
      content:
        "On leave today, pending requests, approved this month, average remaining balance, and top usage type.",
      placement: "bottom",
    },
    {
      target: '[data-tour="leave-overview-trend"]',
      title: "Usage trend",
      content: "Monthly leave usage so you can spot busy seasons.",
      placement: "top",
    },
    {
      target: '[data-tour="leave-overview-this-week"]',
      title: "On leave this week",
      content: "People with approved time off overlapping the current week.",
      placement: "left",
    },
  ],
};
