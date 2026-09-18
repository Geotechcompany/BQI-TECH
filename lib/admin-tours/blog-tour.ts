import type { TourDefinition } from "./types";

export const blogTour: TourDefinition = {
  id: "blog",
  label: "Blog",
  autoStart: false,
  brandHero: true,
  steps: [
    {
      type: "modal",
      title: "Blog management",
      content:
        "Create and publish posts for the public careers blog. Drafts stay unpublished until you toggle them live.",
      secondaryContent: "Press Guide in the header to replay this walkthrough.",
      illustration: "brand-hero",
    },
    {
      target: '[data-tour="blog-create"]',
      title: "Create post",
      content: "Open the wizard to write a new post with cover image, body, and category.",
      placement: "left",
    },
    {
      target: '[data-tour="blog-table"]',
      title: "Posts table",
      content:
        "View, edit, publish or unpublish, and delete posts from the Actions column.",
      placement: "top",
    },
  ],
};
