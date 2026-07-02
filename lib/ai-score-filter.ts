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
  { label: "Strong Fit (85+)", value: "strong" },
  { label: "Good Fit (70–84)", value: "good" },
  { label: "Moderate Fit (50–69)", value: "moderate" },
  { label: "Weak Fit (<50)", value: "weak" },
];
