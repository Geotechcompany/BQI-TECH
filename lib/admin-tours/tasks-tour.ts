import type { TourDefinition } from "./types";

export const tasksTour: TourDefinition = {
  id: "tasks",
  label: "Tasks",
  autoStart: false,
  brandHero: true,
  steps: [
    {
      type: "modal",
      title: "Hiring tasks",
      content:
        "Track follow-ups assigned to you or the team. Create a task from the header, then mark it done from the list.",
      secondaryContent: "Press Guide in the header to replay this walkthrough.",
      illustration: "brand-hero",
    },
    {
      target: '[data-tour="tasks-filters"]',
      title: "Filters",
      content: "Switch between My Tasks, Assigned to Team, and Completed.",
      placement: "right",
    },
    {
      target: '[data-tour="tasks-list"]',
      title: "Task list",
      content:
        "Check a row to complete it, or use delete when the task no longer applies.",
      placement: "top",
    },
  ],
};
