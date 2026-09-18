"use client";

import Lottie from "lottie-react";
import { FileText, Upload } from "lucide-react";
import { useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const EMPTY_DOCUMENTS_LOTTIE_SRC = "/lottie/empty-documents.json";

let emptyDocumentsLottieCache: object | null | undefined;
let emptyDocumentsLottiePromise: Promise<object | null> | null = null;

function loadEmptyDocumentsLottie(): Promise<object | null> {
  if (emptyDocumentsLottieCache !== undefined) {
    return Promise.resolve(emptyDocumentsLottieCache);
  }
  if (!emptyDocumentsLottiePromise) {
    emptyDocumentsLottiePromise = fetch(EMPTY_DOCUMENTS_LOTTIE_SRC)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: object | null) => {
        emptyDocumentsLottieCache = data;
        return data;
      })
      .catch(() => {
        emptyDocumentsLottieCache = null;
        return null;
      });
  }
  return emptyDocumentsLottiePromise;
}

type DocumentsEmptyStateProps = {
  categoryLabel: string;
  hasSearch: boolean;
  className?: string;
  /** Opens the upload dialog when provided. */
  onUpload?: () => void;
};

export function DocumentsEmptyState({
  categoryLabel,
  hasSearch,
  className,
  onUpload,
}: DocumentsEmptyStateProps) {
  const prefersReducedMotion = useReducedMotion();
  const [animationData, setAnimationData] = useState<object | null>(
    () => emptyDocumentsLottieCache ?? null
  );

  useEffect(() => {
    if (prefersReducedMotion) return;
    let cancelled = false;
    loadEmptyDocumentsLottie().then((data) => {
      if (!cancelled && data) setAnimationData(data);
    });
    return () => {
      cancelled = true;
    };
  }, [prefersReducedMotion]);

  const libraryPhrase =
    categoryLabel.toLowerCase() === "all"
      ? "your library"
      : `the ${categoryLabel.toLowerCase()} library`;

  return (
    <div
      className={cn(
        "relative flex min-h-[320px] flex-col items-center justify-center overflow-hidden px-6 py-16 text-center",
        className
      )}
    >
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{
          background:
            "radial-gradient(ellipse 70% 55% at 50% 42%, rgba(49,205,255,0.10) 0%, rgba(39,33,86,0.05) 45%, transparent 72%)",
        }}
      />
      <div
        className="pointer-events-none absolute left-1/2 top-[38%] h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#272156]/[0.04] blur-2xl"
        aria-hidden
      />

      <div className="relative z-[1] flex flex-col items-center">
        <div className="mb-1 h-[140px] w-[140px]" aria-hidden>
          {animationData && !prefersReducedMotion ? (
            <Lottie
              animationData={animationData}
              loop
              className="h-full w-full"
            />
          ) : (
            <StaticDocumentsMark />
          )}
        </div>

        <h2 className="text-base font-semibold tracking-tight text-[#272156]">
          {hasSearch ? "No matching documents" : "No documents yet"}
        </h2>
        <p className="mt-1.5 max-w-[280px] text-sm leading-relaxed text-muted-foreground">
          {hasSearch
            ? "Try a different search or clear filters to see the full library."
            : `Upload a policy, handbook, template, or form to start ${libraryPhrase}.`}
        </p>

        {!hasSearch && onUpload ? (
          <Button
            type="button"
            size="sm"
            className="mt-5 bg-[#31CDFF] text-white hover:bg-[#31CDFF]/90"
            onClick={onUpload}
          >
            <Upload className="mr-1.5 h-3.5 w-3.5" aria-hidden />
            Upload Document
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function StaticDocumentsMark() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-[#272156]/10">
        <FileText className="h-9 w-9 text-[#272156]/70" strokeWidth={1.5} />
      </div>
    </div>
  );
}
