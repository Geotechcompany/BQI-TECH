import type { TourDefinition } from "./types";

export const calendarTour: TourDefinition = {
  id: "calendar",
  label: "Calendar",
  autoStart: false,
  brandHero: true,
  steps: [
    {
      type: "modal",
      title: "Recruitment calendar",
      content:
        "Interviews, technical assessments, and hire dates from applications appear on this calendar.",
      secondaryContent: "Press Guide anytime to walk through navigation and filters.",
      illustration: "brand-hero",
    },
    {
      target: '[data-tour="calendar-nav"]',
      title: "Navigate dates",
      content:
        "Move month, week, or day with the arrows, or jump to Today. Switch the view toggle on the right.",
      placement: "bottom",
    },
    {
      target: '[data-tour="calendar-filters"]',
      title: "Event filters",
      content:
        "Show or hide event types and limit the calendar to one position when the filter panel is open.",
      placement: "bottom",
    },
    {
      target: '[data-tour="calendar-grid"]',
      title: "Events",
      content:
        "Click an event to open the linked application and update interview details from the modal.",
      placement: "top",
    },
  ],
};
