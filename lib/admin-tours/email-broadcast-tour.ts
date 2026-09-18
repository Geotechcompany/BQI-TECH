import type { TourDefinition } from "./types";

export const emailBroadcastTour: TourDefinition = {
  id: "email-broadcast",
  label: "Email Broadcast",
  autoStart: false,
  brandHero: true,
  steps: [
    {
      type: "modal",
      title: "Email broadcast",
      content:
        "Choose recipients, write the subject and body, preview, then send. History shows past broadcasts.",
      secondaryContent: "Press Guide in the header to replay this walkthrough.",
      illustration: "brand-hero",
    },
    {
      target: '[data-tour="email-broadcast-recipients"]',
      title: "Recipients",
      content:
        "Send to everyone, a saved list, or selected users. Confirm the recipient count before you send.",
      placement: "bottom",
    },
    {
      target: '[data-tour="email-broadcast-content"]',
      title: "Message",
      content:
        "Edit subject and body, apply a template, preview the HTML, or draft with AI assist.",
      placement: "top",
    },
    {
      target: '[data-tour="email-broadcast-history"]',
      title: "History",
      content: "Open past broadcasts to confirm what was sent and when.",
      placement: "left",
    },
  ],
};
