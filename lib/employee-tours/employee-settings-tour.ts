import type { TourDefinition } from "@/lib/admin-tours/types";

export const employeeSettingsTour: TourDefinition = {
  id: "employee-settings",
  label: "Employee settings",
  autoStart: false,
  brandHero: true,
  heroImageSrc: "/images/admin-guides/settings.jpg",
  steps: [
    {
      type: "modal",
      title: "Settings",
      content:
        "Manage your sign-in account, password, email preferences, and portal appearance.",
      secondaryContent: "Press Guide in the header to replay.",
      illustration: "brand-hero",
    },
    {
      target: '[data-tour="employee-settings-account"]',
      title: "Account",
      content:
        "Your work email is read-only here. Open Edit profile to change personal details.",
      placement: "bottom",
    },
    {
      target: '[data-tour="employee-settings-password"]',
      title: "Security",
      content:
        "Enter your current password, choose a new one, confirm it, then save.",
      placement: "top",
    },
    {
      target: '[data-tour="employee-settings-notifications"]',
      title: "Notifications",
      content:
        "Toggle email preferences. Changes save to your BQI account immediately.",
      placement: "top",
    },
    {
      target: '[data-tour="employee-settings-appearance"]',
      title: "Appearance",
      content:
        "Pick light, dark, or system theme, and collapse the sidebar if you want more space.",
      placement: "top",
    },
  ],
};
