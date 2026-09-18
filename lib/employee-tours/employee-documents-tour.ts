import type { TourDefinition } from "@/lib/admin-tours/types";

export const employeeDocumentsTour: TourDefinition = {
  id: "employee-documents",
  label: "My documents",
  autoStart: false,
  brandHero: true,
  heroImageSrc: "/images/admin-guides/documents.jpg",
  steps: [
    {
      type: "modal",
      title: "My documents",
      content:
        "Upload National ID, good conduct, CV, tax ID, and other files for your employee record. You can also replace a file later.",
      secondaryContent: "Press Guide in the header to replay.",
      illustration: "brand-hero",
    },
    {
      target: '[data-tour="employee-documents-missing"]',
      title: "Missing documents",
      content:
        "Required categories still empty appear here with a one-tap Upload.",
      placement: "bottom",
    },
    {
      target: '[data-tour="employee-documents-upload"]',
      title: "Add document",
      content: "Pick a category, name the file, and upload it to your record.",
      placement: "left",
    },
    {
      target: '[data-tour="employee-documents-list"]',
      title: "Document list",
      content:
        "Open a file when a link is available. Category and upload date sit under each title.",
      placement: "top",
    },
  ],
};
