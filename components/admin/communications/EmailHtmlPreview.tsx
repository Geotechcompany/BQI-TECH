"use client";

import { useEffect, useState } from "react";
import DOMPurify from "dompurify";
import { Skeleton } from "@/components/ui/skeleton";

const EMAIL_ALLOWED_TAGS = [
  "a",
  "b",
  "br",
  "div",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "i",
  "img",
  "li",
  "ol",
  "p",
  "span",
  "strong",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "tr",
  "u",
  "ul",
  "center",
  "font",
];

const EMAIL_ALLOWED_ATTR = [
  "href",
  "src",
  "alt",
  "title",
  "style",
  "class",
  "width",
  "height",
  "align",
  "valign",
  "bgcolor",
  "border",
  "cellpadding",
  "cellspacing",
  "role",
  "target",
  "rel",
  "colspan",
  "rowspan",
];

function sanitizeEmailHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: EMAIL_ALLOWED_TAGS,
    ALLOWED_ATTR: EMAIL_ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    ADD_ATTR: ["target", "rel"],
  });
}

function formatPlainEmailBody(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const withBreaks = escaped.replace(/\r\n|\r|\n/g, "<br />");
  return `<div style="font-size:15px;line-height:1.65;color:#374151;padding:24px 20px;">${withBreaks}</div>`;
}

export function EmailHtmlPreview({
  htmlBody,
  plainBody,
}: {
  htmlBody?: string | null;
  plainBody?: string | null;
}) {
  const [sanitized, setSanitized] = useState<string | null>(null);

  useEffect(() => {
    if (htmlBody?.trim()) {
      setSanitized(sanitizeEmailHtml(htmlBody));
      return;
    }
    if (plainBody?.trim()) {
      setSanitized(sanitizeEmailHtml(formatPlainEmailBody(plainBody)));
      return;
    }
    setSanitized("");
  }, [htmlBody, plainBody]);

  if (sanitized === null) {
    return (
      <div className="space-y-2 rounded-lg border bg-muted/20 px-3 py-4">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-[90%]" />
        <Skeleton className="h-3 w-[75%]" />
        <Skeleton className="h-3 w-[85%]" />
      </div>
    );
  }

  if (!sanitized) {
    return (
      <p className="px-1 py-6 text-center text-sm text-muted-foreground">
        No message body stored for this email.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border/80 bg-white shadow-sm">
      <div className="border-b border-border/60 bg-slate-50 px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">
        Recipient preview
      </div>
      <div
        className="max-h-[min(70vh,640px)] overflow-auto bg-[#F8FAFC] text-[15px] leading-relaxed text-slate-800 [&_a]:text-[#0EA5E9] [&_img]:max-w-full [&_table]:max-w-full"
        dangerouslySetInnerHTML={{ __html: sanitized }}
      />
    </div>
  );
}
