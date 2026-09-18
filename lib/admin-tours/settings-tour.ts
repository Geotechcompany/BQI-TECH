import type { TourDefinition } from "./types";

export const settingsTour: TourDefinition = {
  id: "settings",
  label: "Settings",
  autoStart: false,
  brandHero: true,
  steps: [
    {
      type: "modal",
      title: "Admin settings",
      content:
        "Profile, notifications, contact form, email delivery, AI providers, BQI Intelligence, and system tools live in this page.",
      secondaryContent: "Press Guide in the header to replay this walkthrough.",
      illustration: "brand-hero",
    },
    {
      target: '[data-tour="settings-profile"]',
      title: "Profile",
      content:
        "Update your avatar and review the account tied to this admin session.",
      placement: "bottom",
    },
    {
      target: '[data-tour="settings-nav"]',
      title: "Sections",
      content:
        "Pick a section from this rail. Related links open User Management, Email Broadcast, Admin Activity, and Backup when you have access. Some sections save on their own; others use the sticky Save settings bar.",
      placement: "right",
    },
    {
      target: '[data-tour="settings-intelligence"]',
      title: "BQI Intelligence",
      content:
        "Open BQI Intelligence to toggle ranking and related AI features for your company after providers are configured.",
      placement: "right",
    },
    {
      target: '[data-tour="settings-content"]',
      title: "Section content",
      content:
        "Edit the active section here. AI providers must be configured before Intelligence features can score candidates.",
      placement: "left",
    },
  ],
};
