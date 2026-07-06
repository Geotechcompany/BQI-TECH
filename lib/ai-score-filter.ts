export type AiScoreFilterValue =
  | "all"
  | "not_ranked"
  | "ranked"
  | "strong"
  | "good"
  | "moderate"
  | "weak";

export const AI_SCORE_FILTER_OPTIONS: {
  label: string;
  value: AiScoreFilterValue;
}[] = [
  { label: "All AI Scores", value: "all" },
  { label: "Not Ranked", value: "not_ranked" },
  { label: "Strong Fit (88+)", value: "strong" },
  { label: "Good Fit (72–87)", value: "good" },
  { label: "Moderate Fit (52–71)", value: "moderate" },
  { label: "Weak Fit (<52)", value: "weak" },
];
