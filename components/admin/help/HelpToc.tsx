"use client";

import { useEffect, useState } from "react";
import { HelpTocItem } from "@/lib/help/types";
import { cn } from "@/lib/utils";

interface HelpTocProps {
  items: HelpTocItem[];
  variant: "inline" | "sidebar";
}

export function HelpToc({ items, variant }: HelpTocProps) {
  const [activeId, setActiveId] = useState<string>(items[0]?.id ?? "");

  useEffect(() => {
    if (items.length === 0) return;

    const headings = items
      .map((item) => document.getElementById(item.id))
      .filter((el): el is HTMLElement => Boolean(el));

    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (a, b) =>
              (a.target as HTMLElement).offsetTop -
              (b.target as HTMLElement).offsetTop
          );
        if (visible[0]?.target?.id) {
          setActiveId(visible[0].target.id);
        }
      },
      {
        rootMargin: "-20% 0px -65% 0px",
        threshold: [0, 0.25, 1],
      }
    );

    for (const heading of headings) {
      observer.observe(heading);
    }

    return () => observer.disconnect();
  }, [items]);

  if (items.length === 0) return null;

  const list = (
    <ul className="space-y-2">
      {items.map((item) => {
        const isActive = item.id === activeId;
        return (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              className={cn(
                "block text-sm leading-snug transition-colors",
                isActive
                  ? "font-medium text-[#272055]"
                  : "text-[#272055]/65 hover:text-[#2563eb]",
                variant === "sidebar" &&
                  cn(
                    "border-l-2 pl-3",
                    isActive
                      ? "border-[#31CDFF]"
                      : "border-transparent hover:border-[#31CDFF]/40"
                  )
              )}
            >
              {item.text}
            </a>
          </li>
        );
      })}
    </ul>
  );

  if (variant === "inline") {
    return (
      <div className="rounded-lg border border-[#272055]/10 bg-[#f7f8fb] px-4 py-4">
        <p className="mb-3 text-sm font-semibold text-[#272055]">
          In this article:
        </p>
        {list}
      </div>
    );
  }

  return (
    <nav
      aria-label="On this page"
      className="sticky top-28 hidden max-h-[calc(100vh-8rem)] overflow-y-auto lg:block"
    >
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#272055]/50">
        On this page
      </p>
      {list}
    </nav>
  );
}
