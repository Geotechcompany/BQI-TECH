import type { TourDefinition } from "./types";

export const notificationsTour: TourDefinition = {
  id: "notifications",
  label: "Notifications",
  autoStart: false,
  brandHero: true,
  steps: [
    {
      type: "modal",
      title: "Notifications",
      content:
        "In-app alerts for applications, assignments, and system events. Filter by read status or type, then mark items read.",
      secondaryContent: "Press Guide in the header to replay this walkthrough.",
      illustration: "brand-hero",
    },
    {
      target: '[data-tour="notifications-filters"]',
      title: "Filters",
      content: "Limit the list to unread or read, and by info, success, warning, or error.",
      placement: "bottom",
    },
    {
      target: '[data-tour="notifications-list"]',
      title: "Notification list",
      content: "Open an item for details. Use Mark All Read when you have cleared the queue.",
      placement: "top",
    },
  ],
};
