import type { TourDefinition } from "./types";

export const leaveTypesTour: TourDefinition = {
  id: "leave-types",
  label: "Leave types",
  autoStart: false,
  brandHero: true,
  steps: [
    {
      type: "modal",
      title: "Leave types",
      content:
        "Paid and unpaid categories used on requests, balances, and policies — annual leave, sick, unpaid, and custom codes.",
      secondaryContent: "Press Guide beside the page title to replay.",
      illustration: "brand-hero",
    },
    {
      target: '[data-tour="leave-subnav"]',
      title: "Leave sections",
      content: "Policies attach these types to regions and accrual rules.",
      placement: "bottom",
    },
    {
      target: '[data-tour="leave-types-table"]',
      title: "Type catalog",
      content:
        "Code, default allowance, paid flag, whether approval is required, and active status.",
      placement: "top",
    },
  ],
};
