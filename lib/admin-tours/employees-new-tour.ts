import type { TourDefinition } from "./types";

export const employeesNewTour: TourDefinition = {
  id: "employees-new",
  label: "Add employee wizard",
  autoStart: false,
  brandHero: true,
  steps: [
    {
      type: "modal",
      title: "Add employee",
      content:
        "Create a roster record step by step: personal details, role, compensation, then documents and invite options.",
      secondaryContent: "Press Guide in the wizard header to replay.",
      illustration: "brand-hero",
    },
    {
      target: '[data-tour="employee-wizard-steps"]',
      title: "Step list",
      content:
        "Jump between Personal, Role, Compensation, Documents, and Review from this rail. Completed steps show a check.",
      placement: "right",
    },
    {
      target: '[data-tour="employee-wizard-content"]',
      title: "Current step",
      content:
        "Fill the fields for the active step. Required fields block Continue until they are valid.",
      placement: "top",
    },
    {
      target: '[data-tour="employee-wizard-actions"]',
      title: "Save and continue",
      content:
        "Back moves one step. Save & exit returns to the roster. On the last step, Confirm & create writes the employee.",
      placement: "top",
    },
  ],
};
