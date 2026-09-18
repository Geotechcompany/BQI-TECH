import type { TourDefinition } from "./types";

export const candidatesTour: TourDefinition = {
  id: "candidates",
  label: "Candidates",
  autoStart: false,
  brandHero: true,
  steps: [
    {
      type: "modal",
      title: "Candidates",
      content:
        "This table is your cross-position applicant list. Filter, bulk-act, score with BQI Intelligence, and open profiles from here.",
      secondaryContent: "Press Guide anytime to walk through the toolbar again.",
      illustration: "brand-hero",
    },
    {
      target: '[data-tour="candidates-search"]',
      title: "Search",
      content:
        "Filter the table by text. Use Filter, Views, and Columns beside the search box to narrow results and change what you see.",
      placement: "bottom",
    },
    {
      target: '[data-tour="candidates-actions"]',
      title: "Bulk actions",
      content:
        "Select rows, then use More for questionnaires, tags, move, merge, export, archive, or BQI Intelligence scoring.",
      placement: "bottom",
    },
    {
      target: '[data-tour="candidates-add"]',
      title: "Add candidate",
      content:
        "Create a candidate manually and place them into a position without a public application.",
      placement: "bottom",
    },
    {
      target: '[data-tour="candidates-table"]',
      title: "Results table",
      content:
        "Open a name for the full profile. Stage, AI score, and resume columns help you triage quickly.",
      placement: "top",
    },
  ],
};
