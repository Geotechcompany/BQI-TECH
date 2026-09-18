import type { TourDefinition } from "./types";

export const employeesTour: TourDefinition = {
  id: "employees",
  label: "All employees",
  autoStart: false,
  brandHero: true,
  steps: [
    {
      type: "modal",
      title: "Employee roster",
      content:
        "Search and filter the full BQI roster, then open a row for the profile. Add employee starts the setup wizard.",
      secondaryContent: "Press Guide anytime to walk this page again.",
      illustration: "brand-hero",
    },
    {
      target: '[data-tour="employees-search"]',
      title: "Search",
      content:
        "Match name, email, job title, or employee ID. Results update as you type.",
      placement: "bottom",
    },
    {
      target: '[data-tour="employees-filters"]',
      title: "Filters",
      content:
        "Narrow by department, status (active, onboarding, offboarding), and employment type.",
      placement: "bottom",
    },
    {
      target: '[data-tour="employees-add"]',
      title: "Add employee",
      content:
        "Opens the multi-step wizard for personal details, role, pay, and documents.",
      placement: "bottom",
    },
    {
      target: '[data-tour="employees-table"]',
      title: "Roster table",
      content:
        "Click a name to open the profile. Status badges show where someone sits in the employment lifecycle.",
      placement: "top",
    },
  ],
};
