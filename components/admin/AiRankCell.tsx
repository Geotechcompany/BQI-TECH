"use client";

import type { AiRankRequirement } from "@/types/application";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

function getScoreStyles(score: number): string {
  if (score >= 88) return "bg-emerald-100 text-emerald-800 ring-emerald-200";
  if (score >= 72) return "bg-violet-100 text-violet-800 ring-violet-200";
  if (score >= 52) return "bg-amber-100 text-amber-800 ring-amber-200";
  return "bg-red-100 text-red-800 ring-red-200";
}

function formatAiRankScore(score: number): string {
  return Number.isInteger(score) ? String(score) : score.toFixed(1);
}

function matchLabel(match: AiRankRequirement["match"]): string {
  const labels: Record<AiRankRequirement["match"], string> = {
    full: "Met",
    partial: "Partial",
    weak: "Weak",
    none: "Missing",
    unknown: "Not evidenced",
  };
  return labels[match] ?? match;
}

function matchStyles(match: AiRankRequirement["match"]): string {
  const styles: Record<AiRankRequirement["match"], string> = {
    full: "text-emerald-700",
    partial: "text-amber-700",
    weak: "text-orange-700",
    none: "text-red-700",
    unknown: "text-gray-600",
  };
  return styles[match] ?? "text-gray-600";
}

interface AiRankScoreCellProps {
  score?: number;
  recommendation?: string;
  summary?: string;
  scoreReason?: string;
  requirements?: AiRankRequirement[];
  onRank?: () => void;
  isRanking?: boolean;
  disabledReason?: string;
}

export function AiRankScoreCell({
  score,
  recommendation,
  summary,
  scoreReason,
  requirements,
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

  const hasNotes = Boolean(summary || scoreReason || requirements?.length);

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex flex-col gap-1 cursor-default">
            <span
              className={`inline-flex w-fit items-center px-2.5 py-1 rounded-full text-xs font-bold ring-1 ring-inset ${getScoreStyles(score)}`}
            >
              {formatAiRankScore(score)}/100
            </span>
            {recommendation && (
              <span className="text-[11px] text-muted-foreground line-clamp-1 max-w-[120px]">
                {recommendation}
              </span>
            )}
          </div>
        </TooltipTrigger>
        {hasNotes && (
          <TooltipContent side="top" className="max-w-md p-0 overflow-hidden">
            <div className="max-h-80 overflow-y-auto p-3 space-y-2">
              {recommendation && (
                <p className="font-medium text-sm">{recommendation}</p>
              )}
              {summary && (
                <p className="text-xs leading-relaxed text-foreground">{summary}</p>
              )}
              {scoreReason && (
                <p className="text-xs text-muted-foreground leading-relaxed">
                  <span className="font-medium text-foreground">Score: </span>
                  {scoreReason}
                </p>
              )}
              {requirements && requirements.length > 0 && (
                <div className="space-y-1.5 pt-1 border-t">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                    Requirements ({requirements.length})
                  </p>
                  {requirements.slice(0, 6).map((req, index) => (
                    <div key={index} className="text-xs leading-snug">
                      <span className={`font-medium ${matchStyles(req.match)}`}>
                        {matchLabel(req.match)}
                      </span>
                      <span className="text-muted-foreground">
                        {" "}
                        · {req.jdQuote || req.requirement}
                      </span>
                      {req.evidence && req.evidence !== "not evidenced" && (
                        <p className="text-muted-foreground mt-0.5 pl-2 border-l-2 border-muted">
                          {req.evidence}
                        </p>
                      )}
                    </div>
                  ))}
                  {requirements.length > 6 && (
                    <p className="text-[11px] text-muted-foreground">
                      +{requirements.length - 6} more in application view
                    </p>
                  )}
                </div>
              )}
            </div>
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  );
}
