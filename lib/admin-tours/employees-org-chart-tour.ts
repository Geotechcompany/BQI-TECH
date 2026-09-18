import type { TourDefinition } from "./types";

export const employeesOrgChartTour: TourDefinition = {
  id: "employees-org-chart",
  label: "Org chart",
  autoStart: false,
  brandHero: true,
  steps: [
    {
      type: "modal",
      title: "Org chart",
      content:
        "Reporting lines built from manager assignments on employee records. Roots are people with no manager in the roster.",
      secondaryContent: "Press Guide in the header to replay.",
      illustration: "brand-hero",
    },
    {
      target: '[data-tour="employees-org-chart-tree"]',
      title: "Reporting tree",
      content:
        "Each card is an employee. Nested cards under a person are their direct reports. Click a card to open the profile.",
      placement: "top",
    },
  ],
};
