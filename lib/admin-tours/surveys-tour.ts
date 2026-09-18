import type { TourDefinition } from "./types";

export const surveysTour: TourDefinition = {
  id: "surveys",
  label: "Surveys",
  autoStart: false,
  brandHero: true,
  steps: [
    {
      type: "modal",
      title: "Surveys",
      content:
        "Build a form on the left, then manage saved surveys on the right. Share the public link once a survey is saved.",
      secondaryContent: "Press Guide in the header to replay this walkthrough.",
      illustration: "brand-hero",
    },
    {
      target: '[data-tour="surveys-builder"]',
      title: "Builder",
      content:
        "Set the title and description, add question types, then save or update the survey.",
      placement: "right",
    },
    {
      target: '[data-tour="surveys-list"]',
      title: "Saved surveys",
      content:
        "Copy the share link, open responses, edit an existing survey, or delete one you no longer need.",
      placement: "left",
    },
  ],
};
