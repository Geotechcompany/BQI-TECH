"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Maximize2,
  Minimize2,
  Printer,
  Sparkles,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { CVPreviewFrame } from "@/components/admin/CVPreviewFrame";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ZOOM_STEPS = [0.75, 0.9, 1, 1.15, 1.35, 1.5] as const;
const BQI_NAVY = "#272055";

interface ResumeCvPanelProps {
  cvUrl: string | null | undefined;
  candidateName: string;
  emptyState: React.ReactNode;
  showResumeAudit?: boolean;
  onRunResumeAudit?: () => void;
  isAuditing?: boolean;
  auditDisabled?: boolean;
}

export function ResumeCvPanel({
  cvUrl,
  candidateName,
  emptyState,
  showResumeAudit = false,
  onRunResumeAudit,
  isAuditing = false,
  auditDisabled = false,
}: ResumeCvPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(1);
  const [zoomIndex, setZoomIndex] = useState(2);
  const [isExpanded, setIsExpanded] = useState(false);
  const zoom = ZOOM_STEPS[zoomIndex] ?? 1;

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsExpanded(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  const handlePrint = useCallback(() => {
    if (!cvUrl) return;
    const printWindow = window.open(cvUrl, "_blank", "noopener,noreferrer");
    if (!printWindow) return;
    const triggerPrint = () => {
      try {
        printWindow.focus();
        printWindow.print();
      } catch {
        // Browser may block print until the document loads
      }
    };
    printWindow.addEventListener("load", triggerPrint);
    window.setTimeout(triggerPrint, 1200);
  }, [cvUrl]);

  const toggleExpand = useCallback(async () => {
    const node = panelRef.current;
    if (!node) return;

    try {
      if (!document.fullscreenElement) {
        await node.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      setIsExpanded((current) => !current);
    }
  }, []);

  if (!cvUrl) {
    return <>{emptyState}</>;
  }

  return (
    <div
      ref={panelRef}
      className={cn(
        "flex min-h-0 flex-1 flex-col bg-white",
        isExpanded && "bg-[#1a1a1a] p-3"
      )}
    >
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 px-1 pb-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-[#272055]">Resume / CV</p>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
            Looks original!
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {showResumeAudit && onRunResumeAudit ? (
            <Button
              type="button"
              size="sm"
              className="h-8 gap-1.5 text-white hover:opacity-90"
              style={{ backgroundColor: BQI_NAVY }}
              disabled={auditDisabled || isAuditing}
              onClick={onRunResumeAudit}
            >
              {isAuditing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
              )}
              {isAuditing ? "Auditing…" : "Run Resume Audit"}
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            className="h-8 gap-1.5 text-white hover:opacity-90"
            style={{ backgroundColor: BQI_NAVY }}
            asChild
          >
            <Link href={cvUrl} target="_blank" rel="noopener noreferrer">
              Update Resume
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </div>

      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-[#272055]/15",
          "h-full min-h-[calc(100vh-14rem)]"
        )}
      >
        <div className="flex shrink-0 flex-wrap items-center gap-0.5 bg-[#323639] px-2 py-1 text-white">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-white/90 hover:bg-white/10 hover:text-white"
            aria-label="Previous page"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[4.5rem] select-none text-center text-xs font-medium tabular-nums text-white/90">
            Page {page}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-white/90 hover:bg-white/10 hover:text-white"
            aria-label="Next page"
            onClick={() => setPage((current) => current + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          <div className="mx-1.5 h-5 w-px bg-white/20" aria-hidden />

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-white/90 hover:bg-white/10 hover:text-white"
            aria-label="Zoom out"
            disabled={zoomIndex <= 0}
            onClick={() => setZoomIndex((current) => Math.max(0, current - 1))}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="min-w-[3rem] select-none text-center text-xs font-medium tabular-nums text-white/90">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-white/90 hover:bg-white/10 hover:text-white"
            aria-label="Zoom in"
            disabled={zoomIndex >= ZOOM_STEPS.length - 1}
            onClick={() =>
              setZoomIndex((current) =>
                Math.min(ZOOM_STEPS.length - 1, current + 1)
              )
            }
          >
            <ZoomIn className="h-4 w-4" />
          </Button>

          <div className="mx-1.5 h-5 w-px bg-white/20" aria-hidden />

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-white/90 hover:bg-white/10 hover:text-white"
            aria-label="Print resume"
            onClick={handlePrint}
          >
            <Printer className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-white/90 hover:bg-white/10 hover:text-white"
            aria-label={isExpanded ? "Exit fullscreen" : "Enter fullscreen"}
            onClick={() => void toggleExpand()}
          >
            {isExpanded ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
          <Link
            href={cvUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-[#31CDFF] hover:underline"
          >
            Open
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="min-h-0 flex-1 overflow-auto bg-[#525659]">
          <div
            className="origin-top-left transition-transform duration-150"
            style={{
              transform: `scale(${zoom})`,
              width: `${100 / zoom}%`,
              height: `${100 / zoom}%`,
              minHeight: "100%",
            }}
          >
            <CVPreviewFrame
              cvUrl={cvUrl}
              page={page}
              title={`${candidateName} CV`}
              className="h-full min-h-[calc(100vh-16rem)] w-full min-w-0 rounded-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
