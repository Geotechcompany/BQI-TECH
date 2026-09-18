import type { TourDefinition } from "./types";

export const userManagementTour: TourDefinition = {
  id: "user-management",
  label: "User management",
  autoStart: false,
  brandHero: true,
  steps: [
    {
      type: "modal",
      title: "User management",
      content:
        "Invite admins, track pending invites, and edit roles or module permissions for your team.",
      secondaryContent: "Press Guide anytime to walk through this page again.",
      illustration: "brand-hero",
    },
    {
      target: '[data-tour="user-management-invite"]',
      title: "Invite user",
      content:
        "Send an admin invite with a role and module access. The person joins after accepting the email.",
      placement: "bottom",
    },
    {
      target: '[data-tour="user-management-stats"]',
      title: "Team snapshot",
      content:
        "Totals for users, admins, verified accounts, and pending invites update as membership changes.",
      placement: "bottom",
    },
    {
      target: '[data-tour="user-management-table"]',
      title: "Team members",
      content:
        "Search the list, resend invites, edit permissions, or remove users who no longer need access.",
      placement: "top",
    },
  ],
};
