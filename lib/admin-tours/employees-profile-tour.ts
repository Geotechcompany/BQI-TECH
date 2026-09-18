import type { TourDefinition } from "./types";

export const employeesProfileTour: TourDefinition = {
  id: "employees-profile",
  label: "Employee profile",
  autoStart: false,
  brandHero: true,
  steps: [
    {
      type: "modal",
      title: "Employee profile",
      content:
        "One record for role, pay, attendance, performance, documents, and activity. Edit from the header or the summary card.",
      secondaryContent: "Press Guide in the header to run this again.",
      illustration: "brand-hero",
    },
    {
      target: '[data-tour="employee-profile-actions"]',
      title: "Profile actions",
      content:
        "Print the page, open Edit profile, or use Quick actions when that menu is available.",
      placement: "bottom",
    },
    {
      target: '[data-tour="employee-profile-summary"]',
      title: "Summary card",
      content:
        "Photo, status, department, location, contact, and manager. Edit employee opens the same record in edit mode.",
      placement: "right",
    },
    {
      target: '[data-tour="employee-profile-tabs"]',
      title: "Detail tabs",
      content:
        "Switch between Overview, Compensation, Time & Attendance, Performance, Documents, and Activity without leaving the profile.",
      placement: "bottom",
    },
  ],
};
