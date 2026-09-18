import type { TourDefinition } from "./types";

export const pipelineSettingsTour: TourDefinition = {
  id: "pipeline-settings",
  label: "Pipeline settings",
  autoStart: false,
  brandHero: true,
  steps: [
    {
      type: "modal",
      title: "Pipeline settings",
      content:
        "Configure stages and automations for this position. Changes here do not affect other positions.",
      secondaryContent: "Press Guide in the header to replay this walkthrough.",
      illustration: "brand-hero",
    },
    {
      target: '[data-tour="pipeline-settings-template"]',
      title: "Pipeline template",
      content:
        "Pick a starting stage set for this position. Switching templates resets the stage list to that template.",
      placement: "bottom",
    },
    {
      target: '[data-tour="pipeline-settings-stages"]',
      title: "Stage actions",
      content:
        "Open a stage to rename it and attach actions such as emails or tags when candidates enter that stage.",
      placement: "top",
    },
    {
      target: '[data-tour="pipeline-settings-sender"]',
      title: "Email sender name",
      content:
        "Automated stage emails send under this display name so candidates see a familiar sender.",
      placement: "top",
    },
    {
      target: '[data-tour="pipeline-settings-save"]',
      title: "Save changes",
      content: "Nothing applies until you save. Preview opens the live board for this position.",
      placement: "top",
    },
  ],
};
