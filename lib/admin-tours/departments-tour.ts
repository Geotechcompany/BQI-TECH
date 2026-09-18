import type { TourDefinition } from "./types";

export const departmentsTour: TourDefinition = {
  id: "departments",
  label: "Departments",
  autoStart: false,
  brandHero: true,
  steps: [
    {
      type: "modal",
      title: "Departments",
      content:
        "Define teams, codes, and department heads. Headcount on each card comes from the live employee roster.",
      secondaryContent: "Press Guide on the banner to replay.",
      illustration: "brand-hero",
    },
    {
      target: '[data-tour="departments-add"]',
      title: "Add department",
      content:
        "Create a name, short code, optional description, and optional department head from the roster.",
      placement: "bottom",
    },
    {
      target: '[data-tour="departments-chart"]',
      title: "Headcount chart",
      content:
        "Growth over time when departments have create dates, otherwise a distribution by department size.",
      placement: "top",
    },
    {
      target: '[data-tour="departments-grid"]',
      title: "Department cards",
      content:
        "Each card shows code, headcount share, and a link into the filtered employee list for that team.",
      placement: "top",
    },
  ],
};
