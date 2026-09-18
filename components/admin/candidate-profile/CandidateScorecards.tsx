"use client";

import { useEffect, useState } from "react";
import { ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const RATING_OPTIONS = [
  { value: 1, label: "1 · No" },
  { value: 2, label: "2 · Weak" },
  { value: 3, label: "3 · Mixed" },
  { value: 4, label: "4 · Yes" },
  { value: 5, label: "5 · Strong" },
] as const;

function scorecardStorageKey(applicationId: string) {
  return `candidate-scorecard-${applicationId}`;
}

interface CandidateScorecardsProps {
  applicationId: string;
  candidateName: string;
}

export function CandidateScorecards({
  applicationId,
  candidateName,
}: CandidateScorecardsProps) {
  const [thoughts, setThoughts] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(scorecardStorageKey(applicationId));
      if (!raw) {
        setThoughts("");
        setRating(null);
        setSavedAt(null);
        return;
      }
      const parsed = JSON.parse(raw) as {
        thoughts?: string;
        rating?: number | null;
        savedAt?: string | null;
      };
      setThoughts(parsed.thoughts || "");
      setRating(typeof parsed.rating === "number" ? parsed.rating : null);
      setSavedAt(parsed.savedAt || null);
    } catch {
      setThoughts("");
      setRating(null);
      setSavedAt(null);
    }
  }, [applicationId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const payload = {
          thoughts,
          rating,
          savedAt: new Date().toISOString(),
        };
        localStorage.setItem(
          scorecardStorageKey(applicationId),
          JSON.stringify(payload)
        );
        setSavedAt(payload.savedAt);
      } catch {
        // localStorage unavailable
      }
    }, 400);
    return () => window.clearTimeout(timer);
  }, [applicationId, thoughts, rating]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
      <div>
        <div className="mb-1 flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-[#272055]/60" aria-hidden />
          <h3 className="text-sm font-semibold text-[#272055]">Scorecard</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Rate {candidateName} for this position. Saved on this device until team
          scorecards sync to the server.
        </p>
      </div>

      <div className="space-y-2">
        <label
          htmlFor={`scorecard-thoughts-${applicationId}`}
          className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
        >
          Thoughts
        </label>
        <Textarea
          id={`scorecard-thoughts-${applicationId}`}
          value={thoughts}
          onChange={(event) => setThoughts(event.target.value)}
          placeholder="What stood out? Strengths, concerns, next steps…"
          className="min-h-[160px] resize-y"
        />
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Overall rating
        </p>
        <div className="flex flex-wrap gap-2">
          {RATING_OPTIONS.map((option) => {
            const selected = rating === option.value;
            return (
              <Button
                key={option.value}
                type="button"
                variant="outline"
                size="sm"
                className={cn(
                  "h-9 border-[#272055]/20 text-[#272055]",
                  selected &&
                    "border-[#272055] bg-[#272055] text-white hover:bg-[#272055] hover:text-white"
                )}
                onClick={() =>
                  setRating((current) =>
                    current === option.value ? null : option.value
                  )
                }
              >
                {option.label}
              </Button>
            );
          })}
        </div>
      </div>

      {savedAt ? (
        <p className="text-xs text-muted-foreground">
          Saved locally · {new Date(savedAt).toLocaleString()}
        </p>
      ) : null}
    </div>
  );
}
