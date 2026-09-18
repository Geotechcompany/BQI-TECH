import type { TourDefinition } from "./types";

export const auditLogsTour: TourDefinition = {
  id: "audit-logs",
  label: "Admin Activity",
  autoStart: false,
  brandHero: true,
  steps: [
    {
      type: "modal",
      title: "Admin activity",
      content:
        "A chronological log of admin actions. Filter by actor, action type, and date when you need an audit trail.",
      secondaryContent: "Press Guide in the header to replay this walkthrough.",
      illustration: "brand-hero",
    },
    {
      target: '[data-tour="audit-filters"]',
      title: "Filters",
      content: "Narrow the log by search text, action, or date range before you export or review.",
      placement: "bottom",
    },
    {
      target: '[data-tour="audit-table"]',
      title: "Activity table",
      content: "Each row shows who acted, what changed, and when. Expand a row when detail is available.",
      placement: "top",
    },
  ],
};
