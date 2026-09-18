import type { TourDefinition } from "./types";

export const userSettingsTour: TourDefinition = {
  id: "user-settings",
  label: "Profile and settings",
  autoStart: false,
  autoStartDelay: 700,
  brandHero: true,
  heroImageSrc: "/images/admin-guides/settings.jpg",
  steps: [
    {
      type: "modal",
      title: "Profile and settings",
      content:
        "Keep your contact details current and choose how you hear about application updates.",
      secondaryContent: "Press Guide in the header to replay this walkthrough.",
      illustration: "brand-hero",
    },
    {
      target: '[data-tour="user-settings-profile"]',
      title: "Profile",
      content:
        "Update your photo, name, email, and phone. Save Profile when you finish editing.",
      placement: "bottom",
    },
    {
      target: '[data-tour="user-settings-password"]',
      title: "Password",
      content:
        "Change your password here. Use a strong password you do not reuse elsewhere.",
      placement: "bottom",
    },
    {
      target: '[data-tour="user-settings-notifications"]',
      title: "Notifications",
      content:
        "Turn email and push alerts on or off for job alerts and application updates.",
      placement: "top",
    },
    {
      target: '[data-tour="user-settings-privacy"]',
      title: "Privacy",
      content:
        "Control profile visibility and what activity others can see.",
      placement: "top",
    },
    {
      target: '[data-tour="tour-help-button"]',
      title: "Replay the guide",
      content: "Press Guide in the page header to run this tour again.",
      placement: "bottom",
    },
  ],
};
