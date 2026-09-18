import type { DriveStep, PopoverDOM, Side } from "driver.js";
import type { TourPlacement, TourStep } from "@/lib/admin-tours/types";
import { createTourBrandHeroElement } from "./TourBrandHero";

const PLACEMENT_MAP: Record<TourPlacement, Side | undefined> = {
  top: "top",
  bottom: "bottom",
  left: "left",
  right: "right",
  auto: undefined,
};

export function resolveTourTarget(target: string): Element | null {
  if (typeof document === "undefined") return null;
  const matches = document.querySelectorAll(target);
  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0];

  for (const element of matches) {
    if (isTourTargetVisible(element)) return element;
  }

  return matches[0];
}

function isTourTargetVisible(element: Element): boolean {
  if (!(element instanceof HTMLElement)) return false;

  let current: HTMLElement | null = element;
  while (current) {
    const style = getComputedStyle(current);
    if (style.display === "none" || style.visibility === "hidden") {
      return false;
    }
    current = current.parentElement;
  }

  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

export function isStepAvailable(step: TourStep): boolean {
  if (step.type === "modal") return true;
  if (!step.target) return false;
  return Boolean(resolveTourTarget(step.target));
}

export function filterAvailableSteps(steps: TourStep[]): TourStep[] {
  return steps.filter(isStepAvailable);
}

export function buildDriveStep(step: TourStep): DriveStep {
  const resolved = step.target ? resolveTourTarget(step.target) : null;

  return {
    element: resolved
      ? () => resolveTourTarget(step.target!) ?? resolved
      : step.target,
    popover: {
      title: step.title,
      description: step.content,
      side: step.placement ? PLACEMENT_MAP[step.placement] : undefined,
      showButtons: [],
      showProgress: false,
    },
  };
}

export function buildDriveSteps(steps: TourStep[]): DriveStep[] {
  return steps.map(buildDriveStep);
}

export interface EnhanceTourPopoverOptions {
  popover: PopoverDOM;
  stepIndex: number;
  totalSteps: number;
  /** Compact cover strip for branded tours */
  showBrandHero?: boolean;
  /** Per-tour Guide hero image */
  coverSrc?: string;
  onRestart: () => void;
  onSnooze: () => void;
  onClose: () => void;
  onNext: () => void;
}

export function enhanceTourPopover({
  popover,
  stepIndex,
  totalSteps,
  showBrandHero = false,
  coverSrc,
  onRestart,
  onSnooze,
  onClose,
  onNext,
}: EnhanceTourPopoverOptions): void {
  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex >= totalSteps - 1;
  const showRestart = stepIndex >= 2;
  const stepLabel = `${stepIndex + 1} of ${totalSteps}`;

  popover.wrapper.classList.add("bqi-tour-popover");

  if (showBrandHero) {
    popover.wrapper.classList.add("bqi-tour-popover--has-hero");
    popover.wrapper
      .querySelectorAll(".bqi-tour-brand-hero")
      .forEach((node) => node.remove());
    const hero = createTourBrandHeroElement(true, coverSrc);
    // Insert before title so chrome stays: hero → title → description → footer
    popover.wrapper.insertBefore(hero, popover.title);
  } else {
    popover.wrapper.classList.remove("bqi-tour-popover--has-hero");
  }

  popover.closeButton.setAttribute("aria-label", "Close tour");
  popover.closeButton.style.display = "flex";
  popover.closeButton.onclick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    onClose();
  };

  popover.footer.innerHTML = "";
  popover.footer.className = "bqi-tour-footer";
  popover.footer.style.display = "grid";

  const leftGroup = document.createElement("div");
  leftGroup.className = "bqi-tour-footer-left";

  if (isFirstStep) {
    const snoozeBtn = document.createElement("button");
    snoozeBtn.type = "button";
    snoozeBtn.className = "bqi-tour-text-btn";
    snoozeBtn.textContent = "Snooze";
    snoozeBtn.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      onSnooze();
    };
    leftGroup.append(snoozeBtn);
  } else if (showRestart) {
    const restartBtn = document.createElement("button");
    restartBtn.type = "button";
    restartBtn.className = "bqi-tour-text-btn";
    restartBtn.textContent = "Restart";
    restartBtn.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      onRestart();
    };
    leftGroup.append(restartBtn);
  }

  const centerGroup = document.createElement("span");
  centerGroup.className = "bqi-tour-progress";
  centerGroup.textContent = stepLabel;

  const rightGroup = document.createElement("div");
  rightGroup.className = "bqi-tour-footer-right";

  const actionBtn = document.createElement("button");
  actionBtn.type = "button";
  actionBtn.className = "bqi-tour-primary-btn";
  actionBtn.textContent = isLastStep ? "Done" : "Next";
  actionBtn.onclick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    onNext();
  };
  rightGroup.append(actionBtn);

  popover.footer.append(leftGroup, centerGroup, rightGroup);
}
