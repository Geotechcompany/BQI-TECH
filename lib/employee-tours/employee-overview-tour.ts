import type { TourDefinition } from "@/lib/admin-tours/types";

export const employeeOverviewTour: TourDefinition = {
  id: "employee-overview",
  label: "Employee overview",
  // Quick Start welcome modal owns first visit; Guide / Take the tour start this.
  autoStart: false,
  autoStartDelay: 700,
  brandHero: true,
  heroImageSrc: "/images/portal-user-login-cover.jpg",
  steps: [
    {
      type: "modal",
      title: "Your employee home",
      content:
        "This is your BQI employee portal. Finish your profile and documents, check leave, and manage your password from here.",
      secondaryContent:
        "Use Guide in the header anytime you want this walkthrough again.",
      illustration: "brand-hero",
    },
    {
      target: '[data-tour="employee-overview-welcome"]',
      title: "Welcome strip",
      content:
        "Your name, title, department, status, and employee number.",
      placement: "bottom",
    },
    {
      target: '[data-tour="employee-quick-start-button"]',
      title: "Quick Start",
      content:
        "Replay this orientation anytime. The floating checklist tracks profile, documents, leave, and settings.",
      placement: "bottom",
    },
    {
      target: '[data-tour="employee-overview-gaps"]',
      title: "Open items",
      content:
        "When fields or documents are missing, this strip links you straight to Profile or Documents.",
      placement: "bottom",
    },
    {
      target: '[data-tour="employee-overview-stats"]',
      title: "Quick stats",
      content:
        "Leave remaining, document count, and a jump into your profile details.",
      placement: "bottom",
    },
    {
      target: '[data-tour="employee-overview-links"]',
      title: "Quick links",
      content:
        "Open profile, leave, documents, or password settings without using the sidebar.",
      placement: "top",
    },
    {
      target: '[data-tour="employee-nav-profile"]',
      title: "My profile",
      content:
        "Edit contact details, address, and emergency contact under My profile.",
      placement: "right",
    },
    {
      target: '[data-tour="employee-nav-documents"]',
      title: "Documents",
      content: "Upload or replace IDs, CVs, and certificates HR expects on file.",
      placement: "right",
    },
    {
      target: '[data-tour="employee-nav-leave"]',
      title: "Leave",
      content: "Balances and your request history live under Leave in the sidebar.",
      placement: "right",
    },
    {
      target: '[data-tour="employee-nav-settings"]',
      title: "Settings",
      content: "Change the password for the account you use to sign into this portal.",
      placement: "right",
    },
    {
      target: '[data-tour="tour-help-button"]',
      title: "Replay the guide",
      content:
        "Press Guide in the page header to run this tour again. Quick Start stays in the corner until you skip it.",
      placement: "bottom",
    },
  ],
};
