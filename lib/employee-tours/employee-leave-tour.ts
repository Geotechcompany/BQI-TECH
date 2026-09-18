import type { TourDefinition } from "@/lib/admin-tours/types";

export const employeeLeaveTour: TourDefinition = {
  id: "employee-leave",
  label: "My leave",
  autoStart: false,
  brandHero: true,
  heroImageSrc: "/images/admin-guides/calendar.jpg",
  steps: [
    {
      type: "modal",
      title: "Time off",
      content:
        "Apply for leave, check your calendar, track request status, and review entitlements — each in its own section.",
      secondaryContent: "Press Guide in the header to replay.",
      illustration: "brand-hero",
    },
    {
      target:
        '[data-tour="employee-leave-subnav"], [data-tour="employee-nav-leave"]',
      title: "Sections",
      content:
        "Open Apply, Calendar, Requests, or Entitlement from the sidebar. On a phone, use the tabs under the title.",
      placement: "bottom",
    },
    {
      target:
        '[data-tour="employee-leave-tab-apply"], [data-tour="employee-nav-leave-apply"]',
      title: "Apply",
      content:
        "Pick dates on the month calendar, choose an absence type, and submit for approval.",
      placement: "bottom",
    },
    {
      target:
        '[data-tour="employee-leave-tab-calendar"], [data-tour="employee-nav-leave-calendar"]',
      title: "Calendar",
      content:
        "See pending and approved absences on a month view of your own leave.",
      placement: "bottom",
    },
    {
      target:
        '[data-tour="employee-leave-tab-requests"], [data-tour="employee-nav-leave-requests"]',
      title: "Requests",
      content:
        "Status history for every leave request — pending, approved, rejected, or cancelled.",
      placement: "bottom",
    },
    {
      target:
        '[data-tour="employee-leave-tab-entitlement"], [data-tour="employee-nav-leave-entitlement"]',
      title: "Entitlement",
      content: "Remaining days for each leave type HR assigned to you.",
      placement: "bottom",
    },
  ],
};
