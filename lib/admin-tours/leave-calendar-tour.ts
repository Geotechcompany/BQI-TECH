import type { TourDefinition } from "./types";

export const leaveCalendarTour: TourDefinition = {
  id: "leave-calendar",
  label: "Leave calendar",
  autoStart: false,
  brandHero: true,
  steps: [
    {
      type: "modal",
      title: "Leave calendar",
      content:
        "Approved time off on a month grid so managers can plan coverage.",
      secondaryContent: "Press Guide beside the page title to replay.",
      illustration: "brand-hero",
    },
    {
      target: '[data-tour="leave-subnav"]',
      title: "Leave sections",
      content: "Jump back to Overview or Requests from this strip.",
      placement: "bottom",
    },
    {
      target: '[data-tour="leave-calendar-nav"]',
      title: "Month controls",
      content: "Step to the previous or next month. The label shows the month you are viewing.",
      placement: "bottom",
    },
    {
      target: '[data-tour="leave-calendar-grid"]',
      title: "Day grid",
      content:
        "Days with approved leave list who is out and which leave type. Today is highlighted.",
      placement: "top",
    },
  ],
};
