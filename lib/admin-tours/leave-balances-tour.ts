import type { TourDefinition } from "./types";

export const leaveBalancesTour: TourDefinition = {
  id: "leave-balances",
  label: "Leave balances",
  autoStart: false,
  brandHero: true,
  steps: [
    {
      type: "modal",
      title: "Leave balances",
      content:
        "Entitled, used, pending, and remaining days by employee and leave type after policies are assigned.",
      secondaryContent: "Press Guide beside the page title to replay.",
      illustration: "brand-hero",
    },
    {
      target: '[data-tour="leave-subnav"]',
      title: "Leave sections",
      content: "Open Requests to approve time off, or Policies to change entitlements.",
      placement: "bottom",
    },
    {
      target: '[data-tour="leave-balances-table"]',
      title: "Balance rows",
      content:
        "Each row is one employee and leave type. The bar shows how much of the entitlement is already used or pending.",
      placement: "top",
    },
  ],
};
