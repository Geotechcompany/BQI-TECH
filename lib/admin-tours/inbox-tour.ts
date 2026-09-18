import type { TourDefinition } from "./types";

export const inboxTour: TourDefinition = {
  id: "inbox",
  label: "Inbox",
  autoStart: false,
  brandHero: true,
  steps: [
    {
      type: "modal",
      title: "Inbox",
      content:
        "Candidate email threads for hiring live here. Pick a conversation, read the history, then open the profile when you need context.",
      secondaryContent: "Press Guide in the header to replay this walkthrough.",
      illustration: "brand-hero",
    },
    {
      target: '[data-tour="inbox-list"]',
      title: "Conversations",
      content:
        "Each row is a candidate thread. Unread volume shows on the right when there is more than one message.",
      placement: "right",
    },
    {
      target: '[data-tour="inbox-thread"]',
      title: "Thread and profile",
      content:
        "Read the exchange and use Open profile to jump into the candidate workspace for status changes and ranking.",
      placement: "left",
    },
    {
      target: '[data-tour="inbox-empty"]',
      title: "Empty inbox",
      content:
        "When no threads exist yet, this space stays empty until candidate email starts flowing through Communications.",
      placement: "bottom",
    },
  ],
};
