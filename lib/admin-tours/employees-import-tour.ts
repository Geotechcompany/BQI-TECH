import type { TourDefinition } from "./types";

export const employeesImportTour: TourDefinition = {
  id: "employees-import",
  label: "Import / Export",
  autoStart: false,
  brandHero: true,
  steps: [
    {
      type: "modal",
      title: "CSV import and export",
      content:
        "Bulk-create employees from a spreadsheet, or download the live roster. Required import columns are firstName, lastName, email, and jobTitle.",
      secondaryContent: "Press Guide in the header to replay.",
      illustration: "brand-hero",
    },
    {
      target: '[data-tour="employees-import-upload"]',
      title: "Import CSV",
      content:
        "Choose a .csv file or download the template first. Matching emails are skipped so you do not duplicate people.",
      placement: "bottom",
    },
    {
      target: '[data-tour="employees-import-export"]',
      title: "Export CSV",
      content:
        "Download up to 500 people from the live roster for payroll or backup worksheets.",
      placement: "bottom",
    },
  ],
};
