import type { TourDefinition } from "./types";

export const documentsTour: TourDefinition = {
  id: "documents",
  label: "Documents",
  autoStart: false,
  brandHero: true,
  steps: [
    {
      type: "modal",
      title: "Company documents",
      content:
        "Upload policies, handbooks, templates, and forms. Search and filter by category, then open a file to view it.",
      secondaryContent: "Press Guide in the header to replay this walkthrough.",
      illustration: "brand-hero",
    },
    {
      target: '[data-tour="documents-upload"]',
      title: "Upload",
      content: "Add a PDF, Word, or Excel file with a title, category, and optional description.",
      placement: "left",
    },
    {
      target: '[data-tour="documents-search"]',
      title: "Search",
      content: "Filter the library by title, file name, author, or format.",
      placement: "bottom",
    },
    {
      target: '[data-tour="documents-categories"]',
      title: "Categories",
      content: "Narrow the list to Policies, Handbooks, Templates, Forms, or other categories.",
      placement: "bottom",
    },
    {
      target: '[data-tour="documents-list"]',
      title: "Library",
      content: "Open a row to view the file. Delete removes it from the shared library.",
      placement: "top",
    },
  ],
};
