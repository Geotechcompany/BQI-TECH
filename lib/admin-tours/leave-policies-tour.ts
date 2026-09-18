import type { TourDefinition } from "./types";

export const leavePoliciesTour: TourDefinition = {
  id: "leave-policies",
  label: "Leave policies",
  autoStart: false,
  brandHero: true,
  steps: [
    {
      type: "modal",
      title: "Leave policies",
      content:
        "Region-specific accrual and approval rules that drive employee balances and request workflows.",
      secondaryContent: "Press Guide beside the page title to replay.",
      illustration: "brand-hero",
    },
    {
      target: '[data-tour="leave-subnav"]',
      title: "Leave sections",
      content: "Leave Types define the categories these policies assign.",
      placement: "bottom",
    },
    {
      target: '[data-tour="leave-policies-add"]',
      title: "New policy",
      content:
        "Starts policy creation when the editor ships. Until then, create via the leave policies API.",
      placement: "bottom",
    },
    {
      target: '[data-tour="leave-policies-grid"]',
      title: "Policy cards",
      content:
        "Each card summarizes region, accrual, and approval flow for that policy.",
      placement: "top",
    },
  ],
};
