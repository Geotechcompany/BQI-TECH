import type { TourDefinition } from "./types";

export const attendanceTour: TourDefinition = {
  id: "attendance",
  label: "Attendance",
  autoStart: false,
  brandHero: true,
  steps: [
    {
      type: "modal",
      title: "Attendance overview",
      content:
        "Presence, leave days, late marks, and overtime rolled up across the workforce for this period.",
      secondaryContent: "Press Guide on the banner to replay.",
      illustration: "brand-hero",
    },
    {
      target: '[data-tour="attendance-metrics"]',
      title: "Period totals",
      content:
        "Summed present days, leave, late, and overtime hours across everyone in the overview.",
      placement: "bottom",
    },
    {
      target: '[data-tour="attendance-table"]',
      title: "By employee",
      content:
        "Per-person present, leave, late, and overtime. Open a name to review their Time & Attendance tab.",
      placement: "top",
    },
  ],
};
