"use client";

interface TourStepFooterProps {
  stepIndex: number;
  totalSteps: number;
  onSnooze: () => void;
  onNext: () => void;
  onRestart?: () => void;
}

export function TourStepFooter({
  stepIndex,
  totalSteps,
  onSnooze,
  onNext,
  onRestart,
}: TourStepFooterProps) {
  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex >= totalSteps - 1;
  const showRestart = stepIndex >= 2 && onRestart;

  return (
    <footer className="bqi-tour-footer">
      <div className="bqi-tour-footer-left">
        {isFirstStep ? (
          <button type="button" className="bqi-tour-text-btn" onClick={onSnooze}>
            Snooze
          </button>
        ) : showRestart ? (
          <button type="button" className="bqi-tour-text-btn" onClick={onRestart}>
            Restart
          </button>
        ) : null}
      </div>

      <span className="bqi-tour-progress">
        {stepIndex + 1} of {totalSteps}
      </span>

      <div className="bqi-tour-footer-right">
        <button type="button" className="bqi-tour-primary-btn" onClick={onNext}>
          {isLastStep ? "Done" : "Next"}
        </button>
      </div>
    </footer>
  );
}
