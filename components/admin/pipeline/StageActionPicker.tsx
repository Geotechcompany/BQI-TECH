"use client";

import { useMemo, useState } from "react";
import { ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { StageActionType } from "@/types/pipeline-settings";
import { STAGE_ACTION_CATALOG } from "./stage-action-catalog";

interface StageActionPickerProps {
  onSelect: (type: StageActionType) => void;
  disabled?: boolean;
}

export function StageActionPicker({
  onSelect,
  disabled = false,
}: StageActionPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return STAGE_ACTION_CATALOG;
    return STAGE_ACTION_CATALOG.filter(
      (item) =>
        item.label.toLowerCase().includes(normalized) ||
        item.description.toLowerCase().includes(normalized)
    );
  }, [query]);

  return (
    // modal: Popover portals outside Dialog; without this, Dialog RemoveScroll
    // blocks wheel/touch on the portaled CommandList.
    <Popover
      modal
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          <span className="truncate text-muted-foreground">
            Available Stage Actions
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
        onWheel={(event) => event.stopPropagation()}
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search stage actions..."
            value={query}
            onValueChange={setQuery}
          />
          <CommandList className="max-h-[min(300px,var(--radix-popover-content-available-height))] overscroll-contain">
            <CommandEmpty>No stage actions match your search.</CommandEmpty>
            <CommandGroup>
              {filtered.map((item) => {
                const Icon = item.icon;
                return (
                  <CommandItem
                    key={item.type}
                    value={item.type}
                    onSelect={() => {
                      onSelect(item.type);
                      setOpen(false);
                      setQuery("");
                    }}
                    className="items-start gap-2 py-2"
                  >
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#31CDFF]/15 text-[#272055]">
                      <Icon className="h-3.5 w-3.5" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-[#272055]">
                        {item.label}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {item.description}
                      </span>
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
