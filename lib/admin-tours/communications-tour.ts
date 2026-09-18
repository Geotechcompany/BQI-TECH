import type { TourDefinition } from "./types";

export const communicationsTour: TourDefinition = {
  id: "communications",
  label: "Communications",
  autoStart: false,
  brandHero: true,
  steps: [
    {
      type: "modal",
      title: "Communications",
      content:
        "Browse outbound and inbound hiring email by folder. Search from the page header filters the list by subject, recipient, or candidate.",
      secondaryContent: "Press Guide anytime to walk through folders and the message list.",
      illustration: "brand-hero",
    },
    {
      target: '[data-tour="communications-folders"]',
      title: "Folders",
      content:
        "Switch between Inbox, Sent, Failed, Starred, and related folders. Open Candidate Inbox for the threaded view.",
      placement: "right",
    },
    {
      target: '[data-tour="communications-toolbar"]',
      title: "Toolbar",
      content:
        "Filter by email type and refresh the current folder when you need the latest delivery status.",
      placement: "bottom",
    },
    {
      target: '[data-tour="communications-list"]',
      title: "Message list",
      content:
        "Select a row to read the message. Star important mail and jump to the candidate when a thread is linked.",
      placement: "top",
    },
  ],
};
