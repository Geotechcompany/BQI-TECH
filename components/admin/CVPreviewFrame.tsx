"use client";

import { useEffect, useMemo, useState } from "react";
import { FileTextIcon } from "lucide-react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";

function buildProxyUrl(cvUrl: string): string {
  try {
    const parsed = new URL(cvUrl);
    return `/api/proxy?url=${encodeURIComponent(parsed.toString())}`;
  } catch {
    return "";
  }
}

function isPdfMagic(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46
  );
}

/** Chrome / PDF.js open params — document only, no thumbnail nav pane */
function buildPdfViewerSrc(objectUrl: string, page: number): string {
  const params = [
    "toolbar=1",
    "navpanes=0",
    "scrollbar=1",
    "view=FitH",
    `page=${Math.max(1, page)}`,
  ];
  return `${objectUrl}#${params.join("&")}`;
}

interface CVPreviewFrameProps {
  cvUrl: string;
  title?: string;
  className?: string;
  /** 1-based page hint for PDF viewers that honor #page=N */
  page?: number;
}

export function CVPreviewFrame({
  cvUrl,
  title = "CV Preview",
  className = "w-full h-full",
  page = 1,
}: CVPreviewFrameProps) {
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const proxyUrl = useMemo(() => buildProxyUrl(cvUrl), [cvUrl]);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    async function loadPreview() {
      if (!proxyUrl) {
        setError(true);
        setIsLoading(false);
        return;
      }

      setError(false);
      setIsLoading(true);
      setPreviewSrc(null);

      const maxAttempts = 3;
      let lastError: unknown;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const response = await fetch(proxyUrl, {
            credentials: "include",
            cache: "no-store",
          });

          if (!response.ok) {
            throw new Error(`Preview failed (${response.status})`);
          }

          const buffer = await response.arrayBuffer();
          if (cancelled) return;

          const bytes = new Uint8Array(buffer);
          if (!isPdfMagic(bytes)) {
            // Non-PDF (docx/doc/etc.) or HTML interstitial — cannot render inline.
            throw new Error("Document is not a PDF");
          }

          const blob = new Blob([buffer], { type: "application/pdf" });
          objectUrl = URL.createObjectURL(blob);
          setPreviewSrc(objectUrl);
          setIsLoading(false);
          return;
        } catch (err) {
          lastError = err;
          if (attempt < maxAttempts) {
            await new Promise((resolve) => setTimeout(resolve, 350 * attempt));
          }
        }
      }

      if (!cancelled) {
        console.warn("CV preview failed:", lastError);
        setError(true);
        setIsLoading(false);
      }
    }

    loadPreview();

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [proxyUrl, cvUrl]);

  const iframeSrc = useMemo(
    () => (previewSrc ? buildPdfViewerSrc(previewSrc, page) : null),
    [previewSrc, page]
  );

  if (error) {
    return (
      <div
        className={`flex h-full min-h-[calc(100vh-16rem)] flex-col items-center justify-center gap-3 border-dashed border-gray-200 bg-white p-6 text-center ${className}`}
      >
        <FileTextIcon className="h-10 w-10 text-gray-400" />
        <p className="text-sm text-gray-600">
          Unable to preview this document inline.
        </p>
        <Link
          href={cvUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-[#31CDFF] underline"
        >
          Open in new tab
        </Link>
      </div>
    );
  }

  return (
    <div
      className={`relative flex h-full min-h-[calc(100vh-16rem)] flex-col overflow-hidden bg-white ${className}`}
    >
      {isLoading && (
        <div className="absolute inset-0 z-10 flex flex-col gap-3 bg-white p-6">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="min-h-0 flex-1 w-full rounded-md" />
          <div className="space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-[90%]" />
            <Skeleton className="h-3 w-[75%]" />
          </div>
        </div>
      )}
      {iframeSrc ? (
        <iframe
          title={title}
          src={iframeSrc}
          className="h-full min-h-[inherit] w-full flex-1 border-0"
          style={{ minHeight: "inherit" }}
          referrerPolicy="no-referrer"
          allow="fullscreen"
        />
      ) : null}
    </div>
  );
}
