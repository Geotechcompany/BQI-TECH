"use client";

import { Sparkles } from "lucide-react";
import type { Application } from "@/types/application";
import { GenerateButton } from "@/components/ui/generate-button";
import { AI_UNCONFIGURED_MESSAGE } from "@/contexts/AiStatusContext";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { aiMatchBadgeClass, aiMatchLabel } from "./application-helpers";

export interface ApplicantInsightPanelProps {
  application: Application;
  isRanking: boolean;
  aiUnconfigured: boolean;
  onGenerateScore: () => void;
}

export function ApplicantInsightPanel({
  application,
  isRanking,
  aiUnconfigured,
  onGenerateScore,
}: ApplicantInsightPanelProps) {
  const hasScore = application.aiRankScore != null;

  const generateButton = (
    <span title={aiUnconfigured ? AI_UNCONFIGURED_MESSAGE : undefined}>
      <GenerateButton
        label={hasScore ? "Re-score" : "Generate Score"}
        generatingLabel="Scoring…"
        isGenerating={isRanking}
        onClick={onGenerateScore}
        disabled={isRanking || aiUnconfigured}
        className="text-sm"
      />
    </span>
  );

  if (!hasScore) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
        <Sparkles className="mb-4 h-12 w-12 text-[#272055]/25" aria-hidden />
        <p className="text-sm font-medium text-[#272055]">No BQI Intelligence score yet</p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Generate a BQI Intelligence score to evaluate this candidate against the position requirements.
        </p>
        <div className="mt-4">{generateButton}</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[#272055]">Applicant Insight</h3>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="inline-flex rounded-full bg-violet-100 px-2.5 py-0.5 text-sm font-semibold text-violet-800">
              {application.aiRankScore}/100
              {application.aiRankRecommendation
                ? ` · ${application.aiRankRecommendation}`
                : ""}
            </span>
            {application.aiRankedAt ? (
              <span className="text-xs text-muted-foreground">
                Ranked {formatDate(application.aiRankedAt)}
              </span>
            ) : null}
          </div>
        </div>
        {generateButton}
      </div>

      {application.aiRankSummary ? (
        <p className="text-sm leading-relaxed text-foreground">
          {application.aiRankSummary}
        </p>
      ) : null}

      {application.aiRankScoreReason ? (
        <p className="border-l-2 border-violet-200 pl-3 text-sm text-muted-foreground">
          <span className="font-medium text-[#272055]">Why this score: </span>
          {application.aiRankScoreReason}
        </p>
      ) : null}

      {(application.aiRankStrengths?.length || application.aiRankGaps?.length) ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {application.aiRankStrengths && application.aiRankStrengths.length > 0 ? (
            <div>
              <p className="mb-1 text-sm font-medium text-emerald-700">Strengths</p>
              <ul className="list-inside list-disc space-y-0.5 text-sm text-foreground">
                {application.aiRankStrengths.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {application.aiRankGaps && application.aiRankGaps.length > 0 ? (
            <div>
              <p className="mb-1 text-sm font-medium text-amber-700">Gaps</p>
              <ul className="list-inside list-disc space-y-0.5 text-sm text-foreground">
                {application.aiRankGaps.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {application.aiRankRequirements && application.aiRankRequirements.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-[#272055]">Requirement assessment</p>
          <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
            {application.aiRankRequirements.map((req, index) => (
              <div
                key={index}
                className="rounded-lg border border-[#272055]/10 bg-[#f8f9fb] p-3 text-sm"
              >
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex rounded-full border px-2 py-0.5 text-xs font-medium",
                      aiMatchBadgeClass(req.match)
                    )}
                  >
                    {aiMatchLabel(req.match)}
                  </span>
                  {req.criticality === 3 ? (
                    <span className="text-[11px] font-medium text-red-600">Must-have</span>
                  ) : null}
                  {req.score != null ? (
                    <span className="text-[11px] text-muted-foreground">{req.score}/100</span>
                  ) : null}
                </div>
                <p className="font-medium leading-snug text-[#272055]">{req.requirement}</p>
                {req.evidence ? (
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    <span className="font-medium text-[#272055]">Evidence: </span>
                    {req.evidence}
                  </p>
                ) : null}
                {req.gapNote ? (
                  <p className="mt-1 text-xs text-amber-800">
                    <span className="font-medium">Gap: </span>
                    {req.gapNote}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
