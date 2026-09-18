import type { TourDefinition } from "@/lib/admin-tours/types";

export const employeeProfileTour: TourDefinition = {
  id: "employee-profile",
  label: "My profile",
  autoStart: false,
  brandHero: true,
  heroImageSrc: "/images/admin-guides/candidate-profile.jpg",
  steps: [
    {
      type: "modal",
      title: "My profile",
      content:
        "Update the contact details HR needs — phone, personal email, address, and emergency contact. Role and employment dates stay read-only.",
      secondaryContent: "Press Guide in the header to replay.",
      illustration: "brand-hero",
    },
    {
      target: '[data-tour="employee-portal-profile-missing"]',
      title: "Missing fields",
      content:
        "When something is blank, this banner lists what still needs filling in.",
      placement: "bottom",
    },
    {
      target: '[data-tour="employee-portal-profile-header"]',
      title: "Identity",
      content: "Your photo, name, job title, and department.",
      placement: "bottom",
    },
    {
      target: '[data-tour="employee-portal-profile-edit"]',
      title: "Edit profile",
      content: "Open the form, update your details, then save.",
      placement: "left",
    },
    {
      target: '[data-tour="employee-portal-profile-fields"]',
      title: "Employment details",
      content:
        "Employee number, status, work email, phone, location, manager, and start date. Editable fields sit in the form after you press Edit.",
      placement: "top",
    },
  ],
};
