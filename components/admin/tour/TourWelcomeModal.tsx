"use client";

import Link from "next/link";
import { X } from "lucide-react";
import type { TourStep } from "@/lib/admin-tours/types";
import { PipelineKanbanIllustration } from "./PipelineKanbanIllustration";
import { TourBrandHero } from "./TourBrandHero";
import { TourStepFooter } from "./TourStepFooter";

interface TourWelcomeModalProps {
  step: TourStep;
  stepIndex: number;
  totalSteps: number;
  /** Per-tour Guide intro image */
  coverSrc?: string;
  onSnooze: () => void;
  onClose: () => void;
  onNext: () => void;
  onRestart?: () => void;
}

function TourIllustration({ name }: { name: TourStep["illustration"] }) {
  if (name === "pipeline-kanban") {
    return <PipelineKanbanIllustration />;
  }
  return null;
}

export function TourWelcomeModal({
  step,
  stepIndex,
  totalSteps,
  coverSrc,
  onSnooze,
  onClose,
  onNext,
  onRestart,
}: TourWelcomeModalProps) {
  const showBrandHero =
    Boolean(coverSrc) || step.illustration === "brand-hero";
  const midIllustration =
    step.illustration && step.illustration !== "brand-hero"
      ? step.illustration
      : undefined;

  return (
    <div
      className="bqi-tour-modal-root"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bqi-tour-modal-title"
    >
      <button
        type="button"
        className="bqi-tour-modal-backdrop"
        aria-label="Close tour"
        onClick={onClose}
      />
      <div
        className={
          showBrandHero
            ? "bqi-tour-modal-card bqi-tour-modal-card--has-hero"
            : "bqi-tour-modal-card"
        }
      >
        {showBrandHero ? <TourBrandHero coverSrc={coverSrc} /> : null}

        <button
          type="button"
          className="bqi-tour-modal-close"
          aria-label="Close tour"
          onClick={onClose}
        >
          <X className="h-4 w-4" aria-hidden />
        </button>

        {step.title ? (
          <h2 id="bqi-tour-modal-title" className="bqi-tour-modal-title">
            {step.title}
          </h2>
        ) : null}

        <p className="bqi-tour-modal-body">{step.content}</p>

        {midIllustration ? (
          <div className="bqi-tour-modal-illustration">
            <TourIllustration name={midIllustration} />
          </div>
        ) : null}

        {step.secondaryContent ? (
          <p className="bqi-tour-modal-secondary">{step.secondaryContent}</p>
        ) : null}

        {step.learnMoreHref ? (
          <Link
            href={step.learnMoreHref}
            target="_blank"
            rel="noopener noreferrer"
            className="bqi-tour-modal-link"
          >
            Learn More
          </Link>
        ) : null}

        <TourStepFooter
          stepIndex={stepIndex}
          totalSteps={totalSteps}
          onSnooze={onSnooze}
          onNext={onNext}
          onRestart={onRestart}
        />
      </div>
    </div>
  );
}
