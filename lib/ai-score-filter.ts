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
  { label: "All scores", value: "all" },
  { label: "Not Ranked", value: "not_ranked" },
  { label: "Strong Fit (88+)", value: "strong" },
  { label: "Good Fit (72–87)", value: "good" },
  { label: "Moderate Fit (52–71)", value: "moderate" },
  { label: "Weak Fit (<52)", value: "weak" },
];

export function matchesAiScoreFilter(
  score: number | null | undefined,
  filter: string
): boolean {
  if (!filter || filter === "all") return true;
  if (filter === "not_ranked") return score == null;
  if (filter === "ranked") return score != null;
  if (score == null) return false;
  if (filter === "strong") return score >= 88;
  if (filter === "good") return score >= 72 && score < 88;
  if (filter === "moderate") return score >= 52 && score < 72;
  if (filter === "weak") return score < 52;
  return true;
}
