import type { TourDefinition } from "./types";

export const backupTour: TourDefinition = {
  id: "backup",
  label: "Backup",
  autoStart: false,
  brandHero: true,
  steps: [
    {
      type: "modal",
      title: "Backup and recovery",
      content:
        "Enable a schedule, set retention, store credentials for the off-site target, then run a backup now when you need an immediate snapshot.",
      secondaryContent: "Press Guide in the header to replay this walkthrough.",
      illustration: "brand-hero",
    },
    {
      target: '[data-tour="backup-schedule"]',
      title: "Schedule",
      content: "Toggle backups on, pick a frequency, and set how long run history is kept.",
      placement: "bottom",
    },
    {
      target: '[data-tour="backup-run"]',
      title: "Run now",
      content: "Trigger an immediate backup without waiting for the next scheduled run.",
      placement: "bottom",
    },
    {
      target: '[data-tour="backup-history"]',
      title: "History",
      content: "Review recent jobs for success, failure, and timing.",
      placement: "top",
    },
  ],
};
