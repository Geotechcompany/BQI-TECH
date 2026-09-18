import type { TourDefinition } from "./types";

export const reportsTour: TourDefinition = {
  id: "reports",
  label: "Reports",
  autoStart: false,
  brandHero: true,
  steps: [
    {
      type: "modal",
      title: "Reports",
      content:
        "Hiring metrics pull from live applications: volume, sources, pipeline conversion, and time to hire.",
      secondaryContent: "Press Guide in the header to replay this walkthrough.",
      illustration: "brand-hero",
    },
    {
      target: '[data-tour="reports-position-filter"]',
      title: "Position scope",
      content:
        "Limit charts and KPIs to one position, or keep All Positions for company-wide totals.",
      placement: "left",
    },
    {
      target: '[data-tour="reports-metrics"]',
      title: "Headline KPIs",
      content:
        "Application totals, active jobs or position status, average time to hire, and hire rate for the selected scope.",
      placement: "bottom",
    },
    {
      target: '[data-tour="reports-status-metrics"]',
      title: "Status counts",
      content:
        "New, Shortlisted, Interviewing, Technical, Hired, and Disqualified for the selected position scope, each with count and share of total.",
      placement: "bottom",
    },
    {
      target: '[data-tour="reports-charts"]',
      title: "Trends and funnel",
      content:
        "Daily application trends, source mix, and pipeline conversion for the positions in scope.",
      placement: "top",
    },
    {
      target: '[data-tour="reports-export"]',
      title: "Export",
      content: "Download CSV or print a PDF snapshot of the metrics on this page.",
      placement: "bottom",
    },
  ],
};
