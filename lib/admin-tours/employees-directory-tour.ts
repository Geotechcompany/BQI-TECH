import type { TourDefinition } from "./types";

export const employeesDirectoryTour: TourDefinition = {
  id: "employees-directory",
  label: "Employee directory",
  autoStart: false,
  brandHero: true,
  steps: [
    {
      type: "modal",
      title: "Staff directory",
      content:
        "Contact cards for live staff — email, phone, location, and department. Terminated people are hidden.",
      secondaryContent: "Press Guide in the header to replay.",
      illustration: "brand-hero",
    },
    {
      target: '[data-tour="employees-directory-search"]',
      title: "Find a teammate",
      content: "Filter cards by name or other roster fields.",
      placement: "bottom",
    },
    {
      target: '[data-tour="employees-directory-grid"]',
      title: "Contact cards",
      content:
        "Open a card to jump to that employee profile. Work email and phone sit on each card.",
      placement: "top",
    },
  ],
};
