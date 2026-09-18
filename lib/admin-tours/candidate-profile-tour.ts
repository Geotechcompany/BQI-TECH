import type { TourDefinition } from "./types";

export const candidateProfileTour: TourDefinition = {
  id: "candidate-profile",
  label: "Candidate profile",
  autoStart: false,
  brandHero: true,
  steps: [
    {
      type: "modal",
      title: "Candidate profile",
      content:
        "Review one applicant in context: stage, resume, BQI Intelligence score, and notes for this position.",
      secondaryContent: "Press Guide in the header to run this walkthrough again.",
      illustration: "brand-hero",
    },
    {
      target: '[data-tour="candidate-header"]',
      title: "Candidate actions",
      content:
        "Change stage, run BQI Intelligence, open More for move or archive, and navigate siblings from here.",
      placement: "bottom",
    },
    {
      target: '[data-tour="candidate-ai-rank"]',
      title: "BQI Intelligence",
      content:
        "Score fit against the job requirements to get a rank, strengths, and gaps for shortlisting.",
      placement: "left",
    },
    {
      target: '[data-tour="candidate-status"]',
      title: "Stage controls",
      content:
        "Update application status from these controls. Changes sync to the pipeline board and Candidates list.",
      placement: "bottom",
    },
    {
      target: '[data-tour="candidate-resume"]',
      title: "Resume and documents",
      content:
        "Open the Resume / CV tab to review attachments or upload a resume when the application arrived without one.",
      placement: "right",
    },
  ],
};
