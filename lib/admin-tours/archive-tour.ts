import type { TourDefinition } from "./types";

export const archiveTour: TourDefinition = {
  id: "archive",
  label: "Archive",
  autoStart: false,
  brandHero: true,
  steps: [
    {
      type: "modal",
      title: "Archived applications",
      content:
        "Applications removed from active pipelines land here. Search, filter by position, open a profile, or restore selected rows.",
      secondaryContent: "Press Guide in the header to replay this walkthrough.",
      illustration: "brand-hero",
    },
    {
      target: '[data-tour="archive-filters"]',
      title: "Position filter",
      content: "Limit the archive table to one job posting when you need a narrower list.",
      placement: "bottom",
    },
    {
      target: '[data-tour="archive-table"]',
      title: "Archive table",
      content:
        "Open a candidate to review details. Use bulk restore when applications should return to the pipeline.",
      placement: "top",
    },
  ],
};
