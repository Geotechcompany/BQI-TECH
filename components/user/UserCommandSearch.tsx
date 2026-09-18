"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { Briefcase, Search } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { menuSections } from "@/components/user/UserDashboardSidebar";
import { userApi } from "@/lib/api-backend";
import type { JobPosting } from "@/types/jobPosting";
import { cn } from "@/lib/utils";

type SearchDestination = {
  name: string;
  href: string;
  icon: LucideIcon;
  group: string;
  keywords?: string;
};

function useIsMac() {
  const [isMac, setIsMac] = useState(false);
  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad|iPod/i.test(navigator.platform));
  }, []);
  return isMac;
}

export const USER_SEARCH_OPEN_EVENT = "bqi:user-search-open";

export function openUserCommandSearch() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(USER_SEARCH_OPEN_EVENT));
}

export function UserCommandSearch({ className }: { className?: string }) {
  const router = useRouter();
  const isMac = useIsMac();
  const [open, setOpen] = useState(false);
  const [jobDestinations, setJobDestinations] = useState<SearchDestination[]>(
    []
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "/" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    const onOpenEvent = () => setOpen(true);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener(USER_SEARCH_OPEN_EVENT, onOpenEvent);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener(USER_SEARCH_OPEN_EVENT, onOpenEvent);
    };
  }, []);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    const loadJobs = async () => {
      try {
        const response = await userApi.getJobs({ skip: 0, limit: 50 });
        if (cancelled || !response?.jobs) return;
        setJobDestinations(
          (response.jobs as JobPosting[]).map((job) => ({
            name: job.title,
            href: `/dashboard/apply/${job.id}`,
            icon: Briefcase,
            group: "Open jobs",
            keywords: [job.department, job.location, "job apply"]
              .filter(Boolean)
              .join(" "),
          }))
        );
      } catch {
        if (!cancelled) setJobDestinations([]);
      }
    };

    void loadJobs();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const destinations = useMemo(() => {
    const pages = menuSections.flatMap((section) =>
      section.items.map((item) => ({
        name: item.name,
        href: item.href,
        icon: item.icon,
        group: section.title,
        keywords: `${section.title} ${item.id}`.toLowerCase(),
      }))
    );
    return [...pages, ...jobDestinations];
  }, [jobDestinations]);

  const grouped = useMemo(() => {
    const map = new Map<string, SearchDestination[]>();
    for (const dest of destinations) {
      const list = map.get(dest.group) ?? [];
      list.push(dest);
      map.set(dest.group, list);
    }
    return Array.from(map.entries());
  }, [destinations]);

  const runCommand = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router]
  );

  const shortcutLabel = isMac ? "⌘ + /" : "Ctrl + /";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "group flex h-9 w-full max-w-[22rem] items-center gap-2 rounded-md border border-border/80 bg-white px-3 text-left text-sm text-muted-foreground shadow-sm transition-colors",
          "hover:border-[#272156]/25 hover:text-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#272156]/25 focus-visible:ring-offset-1",
          "dark:bg-background dark:hover:bg-muted/40",
          className
        )}
        aria-label="Search dashboard"
      >
        <Search className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-[#272156] dark:group-hover:text-foreground" />
        <span className="min-w-0 flex-1 truncate">Search dashboard</span>
        <kbd className="pointer-events-none hidden shrink-0 items-center gap-0.5 rounded border border-border/70 bg-muted/50 px-1.5 py-0.5 font-sans text-[10px] font-medium text-muted-foreground sm:inline-flex">
          {shortcutLabel}
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search pages and jobs…" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          {grouped.map(([group, items], index) => (
            <div key={group}>
              {index > 0 ? <CommandSeparator /> : null}
              <CommandGroup heading={group}>
                {items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <CommandItem
                      key={`${group}-${item.name}-${item.href}`}
                      value={`${item.name} ${item.group} ${item.keywords ?? ""}`}
                      onSelect={() => runCommand(item.href)}
                      className="gap-2 data-[selected=true]:bg-[#272156]/8 data-[selected=true]:text-foreground"
                    >
                      <Icon className="h-4 w-4 shrink-0 text-[#272156]/70 dark:text-foreground/70" />
                      <span>{item.name}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </div>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  );
}
