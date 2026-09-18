export type TourPlacement = "top" | "bottom" | "left" | "right" | "auto";

export type TourStepType = "spotlight" | "modal";

export type TourIllustration = "pipeline-kanban" | "brand-hero";

export type TourStep = {
  type?: TourStepType;
  /** CSS selector for spotlight steps, e.g. `[data-tour="pipeline-board"]` */
  target?: string;
  title?: string;
  content: string;
  secondaryContent?: string;
  learnMoreHref?: string;
  illustration?: TourIllustration;
  placement?: TourPlacement;
};

export type TourDefinition = {
  id: string;
  label: string;
  /** Auto-offer on first visit when not dismissed or snoozed */
  autoStart?: boolean;
  /** Delay before auto-start (ms) */
  autoStartDelay?: number;
  /**
   * Compact branded cover strip on every driver.js popover for this tour.
   * Uses `heroImageSrc` when set, otherwise the tour-id map / login cover.
   */
  brandHero?: boolean;
  /**
   * Unique Guide intro hero for this tour. Prefer `/images/admin-guides/…`.
   * When set, the intro modal shows this image (and brandHero popovers use it).
   */
  heroImageSrc?: string;
  steps: TourStep[];
};
