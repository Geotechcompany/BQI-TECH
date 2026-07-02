"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

function getScoreStyles(score: number): string {
  if (score >= 85) return "bg-emerald-100 text-emerald-800 ring-emerald-200";
  if (score >= 70) return "bg-violet-100 text-violet-800 ring-violet-200";
  if (score >= 50) return "bg-amber-100 text-amber-800 ring-amber-200";
  return "bg-red-100 text-red-800 ring-red-200";
}

interface AiRankScoreCellProps {
  score?: number;
  recommendation?: string;
  onRank?: () => void;
  isRanking?: boolean;
  disabledReason?: string;
}

export function AiRankScoreCell({
  score,
  recommendation,
  onRank,
  isRanking = false,
  disabledReason,
}: AiRankScoreCellProps) {
  if (score == null) {
    if (!onRank) {
      return <span className="text-xs text-muted-foreground">Not ranked</span>;
    }

    return (
      <button
        type="button"
        onClick={onRank}
        disabled={isRanking || Boolean(disabledReason)}
        title={disabledReason}
        className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700 transition hover:bg-violet-100 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {isRanking ? "Ranking..." : "AI Rank"}
      </button>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex flex-col gap-1">
            <span
              className={`inline-flex w-fit items-center px-2.5 py-1 rounded-full text-xs font-bold ring-1 ring-inset ${getScoreStyles(score)}`}
            >
              {score}/100
            </span>
            {recommendation && (
              <span className="text-[11px] text-muted-foreground line-clamp-1 max-w-[120px]">
                {recommendation}
              </span>
            )}
          </div>
        </TooltipTrigger>
        {recommendation && (
          <TooltipContent side="top" className="max-w-xs">
            <p className="font-medium">{recommendation}</p>
            <p className="text-xs text-muted-foreground mt-1">AI fit recommendation</p>
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  );
}

