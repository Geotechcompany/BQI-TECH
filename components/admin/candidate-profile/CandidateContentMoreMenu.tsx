"use client";

import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/** Overflow content sections that have live UI. Add items only when wired. */
export const CONTENT_MORE_SECTIONS = [
  { value: "applicant-insight", label: "Applicant Insight" },
] as const;

export type ContentMoreSectionValue =
  (typeof CONTENT_MORE_SECTIONS)[number]["value"];

export function isContentMoreSection(
  value: string
): value is ContentMoreSectionValue {
  return CONTENT_MORE_SECTIONS.some((section) => section.value === value);
}

export interface CandidateContentMoreMenuProps {
  activeValue: string;
  onSelect: (value: ContentMoreSectionValue) => void;
  triggerClassName?: string;
  showApplicantInsight?: boolean;
}

export function CandidateContentMoreMenu({
  activeValue,
  onSelect,
  triggerClassName,
  showApplicantInsight = true,
}: CandidateContentMoreMenuProps) {
  const sections = CONTENT_MORE_SECTIONS.filter((section) => {
    if (section.value === "applicant-insight") return showApplicantInsight;
    return true;
  });

  if (sections.length === 0) {
    return null;
  }

  const isActive = sections.some((section) => section.value === activeValue);
  const activeLabel = isActive
    ? sections.find((section) => section.value === activeValue)?.label
    : null;

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1 rounded-none border-b-2 border-transparent px-3 py-2.5 text-sm text-muted-foreground outline-none transition-colors hover:text-[#272055] focus-visible:ring-2 focus-visible:ring-[#31CDFF]/40",
            isActive && "border-[#31CDFF] text-[#272055]",
            triggerClassName
          )}
          aria-label={
            activeLabel ? `More sections, ${activeLabel} selected` : "More sections"
          }
          data-tour="candidate-content-more"
        >
          More
          <ChevronDown className="h-3.5 w-3.5 opacity-70" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        {sections.map((section) => (
          <DropdownMenuItem
            key={section.value}
            className={cn(
              "cursor-pointer text-[#272055] focus:bg-[#272055]/5 focus:text-[#272055]",
              activeValue === section.value && "bg-[#272055]/5 font-medium"
            )}
            onSelect={() => onSelect(section.value)}
          >
            {section.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
