import type { TourDefinition } from "./types";

export const leaveRequestsTour: TourDefinition = {
  id: "leave-requests",
  label: "Leave requests",
  autoStart: false,
  brandHero: true,
  steps: [
    {
      type: "modal",
      title: "Leave requests",
      content:
        "Review time-off submissions. Approve or reject pending rows; completed requests show the approver.",
      secondaryContent: "Press Guide beside the page title to replay.",
      illustration: "brand-hero",
    },
    {
      target: '[data-tour="leave-subnav"]',
      title: "Leave sections",
      content: "Switch to Balances, Calendar, or Policies without leaving Leave.",
      placement: "bottom",
    },
    {
      target: '[data-tour="leave-requests-filter"]',
      title: "Status filter",
      content: "Show all requests or only pending, approved, rejected, or cancelled.",
      placement: "bottom",
    },
    {
      target: '[data-tour="leave-requests-table"]',
      title: "Request table",
      content:
        "Employee, type, dates, days, and status. Pending rows expose Approve and Reject.",
      placement: "top",
    },
  ],
};
