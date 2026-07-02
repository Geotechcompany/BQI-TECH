"use client";

import { useEffect, useMemo, useState } from "react";
import { FileTextIcon, Loader2 } from "lucide-react";
import Link from "next/link";

function buildProxyUrl(cvUrl: string): string {
  try {
    const parsed = new URL(cvUrl);
    return `/api/proxy?url=${encodeURIComponent(parsed.toString())}`;
  } catch {
    return "";
  }
}

interface CVPreviewFrameProps {
  cvUrl: string;
  title?: string;
  className?: string;
}

export function CVPreviewFrame({
  cvUrl,
  title = "CV Preview",
  className = "w-full h-full",
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

      try {
        const response = await fetch(proxyUrl, {
          credentials: "include",
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`Preview failed (${response.status})`);
        }

        const blob = await response.blob();
        if (cancelled) return;

        objectUrl = URL.createObjectURL(blob);
        setPreviewSrc(objectUrl);
      } catch {
        if (!cancelled) {
          setError(true);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadPreview();

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [proxyUrl]);

  if (error) {
    return (
      <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-gray-200 bg-white p-6 text-center">
        <FileTextIcon className="h-10 w-10 text-gray-400" />
        <p className="text-sm text-gray-600">
          Unable to preview this document inline.
        </p>
        <Link
          href={cvUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-blue-600 underline"
        >
          Open in new tab
        </Link>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden rounded-lg bg-white ${className}`}>
      {isLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading CV...
          </div>
        </div>
      )}
      {previewSrc ? (
        <iframe
          title={title}
          src={previewSrc}
          className="h-full w-full border-0"
          referrerPolicy="no-referrer"
          allow="fullscreen"
        />
      ) : null}
    </div>
  );
}
