"use client";

import { useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  JobDescriptionTemplate,
  searchJobDescriptionTemplates,
} from "@/lib/job-description-templates";

interface DescriptionTemplatePickerProps {
  onSelect: (template: JobDescriptionTemplate) => void;
  hasExistingContent: boolean;
  className?: string;
}

export function DescriptionTemplatePicker({
  onSelect,
  hasExistingContent,
  className,
}: DescriptionTemplatePickerProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [pendingTemplate, setPendingTemplate] =
    useState<JobDescriptionTemplate | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredTemplates = useMemo(
    () => searchJobDescriptionTemplates(query),
    [query]
  );

  const groupedTemplates = useMemo(() => {
    const groups = new Map<string, JobDescriptionTemplate[]>();
    for (const template of filteredTemplates) {
      const existing = groups.get(template.category) ?? [];
      existing.push(template);
      groups.set(template.category, existing);
    }
    return groups;
  }, [filteredTemplates]);

  const applyTemplate = (template: JobDescriptionTemplate) => {
    onSelect(template);
    setQuery("");
    setIsOpen(false);
    setPendingTemplate(null);
    inputRef.current?.blur();
  };

  const handleSelect = (template: JobDescriptionTemplate) => {
    if (hasExistingContent) {
      setPendingTemplate(template);
      return;
    }
    applyTemplate(template);
  };

  const handleBlur = (event: React.FocusEvent<HTMLDivElement>) => {
    const nextTarget = event.relatedTarget as Node | null;
    if (nextTarget && containerRef.current?.contains(nextTarget)) return;
    window.setTimeout(() => setIsOpen(false), 120);
  };

  return (
    <>
      <div
        ref={containerRef}
        className={cn("relative w-full sm:w-72", className)}
        onBlur={handleBlur}
      >
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#272055]/45" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            placeholder="Find a job description..."
            className="border-[#272055]/15 bg-white pl-9 focus-visible:ring-[#31CDFF]"
            aria-expanded={isOpen}
            aria-haspopup="listbox"
            aria-controls="job-description-template-list"
            role="combobox"
            autoComplete="off"
          />
        </div>

        {isOpen && (
          <div className="absolute right-0 z-50 mt-1.5 w-full overflow-hidden rounded-xl border border-[#272055]/10 bg-white shadow-lg sm:w-80">
            <Command shouldFilter={false} className="bg-white">
              <CommandList id="job-description-template-list">
                {filteredTemplates.length === 0 ? (
                  <CommandEmpty className="py-6 text-sm text-[#272055]/60">
                    No matching templates.
                  </CommandEmpty>
                ) : (
                  Array.from(groupedTemplates.entries()).map(
                    ([category, templates]) => (
                      <CommandGroup
                        key={category}
                        heading={category}
                        className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-[#272055]/50"
                      >
                        {templates.map((template) => (
                          <CommandItem
                            key={template.id}
                            value={template.id}
                            onMouseDown={(event) => event.preventDefault()}
                            onSelect={() => handleSelect(template)}
                            className="cursor-pointer px-3 py-2.5 aria-selected:bg-[#31CDFF]/10 aria-selected:text-[#272055]"
                          >
                            <span className="font-medium text-[#272055]">
                              {template.title}
                            </span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )
                  )
                )}
              </CommandList>
            </Command>
          </div>
        )}
      </div>

      <AlertDialog
        open={Boolean(pendingTemplate)}
        onOpenChange={(open) => {
          if (!open) setPendingTemplate(null);
        }}
      >
        <AlertDialogContent className="border-[#272055]/10">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#272055]">
              Replace current description?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Applying the {pendingTemplate?.title} template will replace the
              text already in the editor. You can still edit the description
              afterward.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep current text</AlertDialogCancel>
            <AlertDialogAction
              className="bg-[#272055] hover:bg-[#272055]/90"
              onClick={() => pendingTemplate && applyTemplate(pendingTemplate)}
            >
              Use template
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
