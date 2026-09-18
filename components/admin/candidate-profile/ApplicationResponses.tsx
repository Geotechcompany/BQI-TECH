"use client";

import Link from "next/link";
import { FileTextIcon } from "lucide-react";
import type { Application } from "@/types/application";
import { isLikelyUrl, isResumeQuestion } from "./application-helpers";

interface ApplicationResponsesProps {
  application: Application;
  excludeResumeQuestions?: boolean;
}

export function ApplicationResponses({
  application,
  excludeResumeQuestions = false,
}: ApplicationResponsesProps) {
  const answers = application.answers?.filter((answer) => {
    if (!excludeResumeQuestions) return true;
    return !isResumeQuestion(answer?.questionText);
  });

  if (!answers?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
        <FileTextIcon className="mb-3 h-10 w-10 opacity-40" aria-hidden />
        <p className="text-sm">No questionnaire responses for this application.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {answers.map((answer, index) => (
        <div key={`${answer.questionId}-${index}`} className="group relative">
          <div className="border-l-2 border-[#31CDFF]/40 pl-4 sm:pl-5">
            <p className="mb-2 text-sm font-medium leading-relaxed text-[#272055]">
              {answer.questionText}
            </p>
            {!isResumeQuestion(answer?.questionText) ||
            !isLikelyUrl(answer?.answer) ? (
              <div className="rounded-lg bg-muted/40 p-3 text-sm leading-relaxed text-foreground break-words sm:p-4">
                {answer.answer || "No answer provided"}
              </div>
            ) : (
              <div className="rounded-lg bg-muted/40 p-3 text-sm break-all sm:p-4">
                <Link
                  href={String(answer.answer)}
                  target="_blank"
                  className="text-[#31CDFF] underline underline-offset-2"
                >
                  {String(answer.answer)}
                </Link>
                <p className="mt-2 text-xs text-muted-foreground">
                  Open the Resume / CV tab to preview this document.
                </p>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
