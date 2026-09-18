"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  Search,
  LayoutDashboard,
  Inbox,
  ListTodo,
  MessagesSquare,
  CalendarDays,
  ChartColumnIncreasing,
  HelpCircle,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { adminNavSections, flattenAdminNavLinks } from "@/lib/admin-nav";
import { useAuth } from "@/contexts/AuthContext";
import {
  filterAdminMenuSections,
  hasAdminModule,
  type AdminModuleKey,
} from "@/lib/admin-permissions";
import { LAST_PIPELINE_JOB_KEY } from "@/components/admin/pipeline/pipeline-utils";
import { cn } from "@/lib/utils";

type SearchDestination = {
  name: string;
  href: string;
  icon: LucideIcon;
  group: string;
  keywords?: string;
  moduleKey?: AdminModuleKey;
  /** When set, any matching module grants access */
  anyModuleKeys?: AdminModuleKey[];
};

const PRIMARY_DESTINATIONS: SearchDestination[] = [
  {
    name: "Overview",
    href: "/admin/overview",
    icon: LayoutDashboard,
    group: "Pages",
    moduleKey: "overview",
    keywords: "dashboard home",
  },
  {
    name: "Inbox",
    href: "/admin/inbox",
    icon: Inbox,
    group: "Pages",
    moduleKey: "candidates",
    keywords: "messages mail",
  },
  {
    name: "Tasks",
    href: "/admin/tasks",
    icon: ListTodo,
    group: "Pages",
    moduleKey: "candidates",
    keywords: "todo",
  },
  {
    name: "Communications",
    href: "/admin/communications",
    icon: MessagesSquare,
    group: "Pages",
    anyModuleKeys: ["email_broadcast", "candidates"],
    keywords: "email chat",
  },
  {
    name: "Calendar",
    href: "/admin/calendar",
    icon: CalendarDays,
    group: "Pages",
    moduleKey: "candidates",
    keywords: "schedule interviews",
  },
  {
    name: "Reports",
    href: "/admin/reports",
    icon: ChartColumnIncreasing,
    group: "Pages",
    moduleKey: "overview",
    keywords: "analytics metrics",
  },
  {
    name: "Help",
    href: "/admin/help",
    icon: HelpCircle,
    group: "Pages",
    moduleKey: "help",
    keywords: "docs support guide",
  },
];

function useIsMac() {
  const [isMac, setIsMac] = useState(false);
  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad|iPod/i.test(navigator.platform));
  }, []);
  return isMac;
}

function canAccessDestination(
  dest: SearchDestination,
  role: string | undefined,
  modules: string[] | undefined
) {
  if (dest.anyModuleKeys?.length) {
    return dest.anyModuleKeys.some((key) => hasAdminModule(role, modules, key));
  }
  if (dest.moduleKey) {
    return hasAdminModule(role, modules, dest.moduleKey);
  }
  return true;
}

export const ADMIN_SEARCH_OPEN_EVENT = "bqi:admin-search-open";

export function openAdminCommandSearch() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(ADMIN_SEARCH_OPEN_EVENT));
}

export function AdminCommandSearch({ className }: { className?: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const isMac = useIsMac();
  const [open, setOpen] = useState(false);
  const [pipelineHref, setPipelineHref] = useState("/admin/job-postings");

  useEffect(() => {
    try {
      const lastJobId = localStorage.getItem(LAST_PIPELINE_JOB_KEY);
      if (lastJobId) {
        setPipelineHref(`/admin/jobs/${lastJobId}/pipeline`);
      }
    } catch {
      // ignore
    }
  }, [open]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "/" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    const onOpenEvent = () => setOpen(true);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener(ADMIN_SEARCH_OPEN_EVENT, onOpenEvent);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener(ADMIN_SEARCH_OPEN_EVENT, onOpenEvent);
    };
  }, []);

  const destinations = useMemo(() => {
    const role = user?.role;
    const modules = user?.adminModules;
    const pages = PRIMARY_DESTINATIONS.filter((dest) =>
      canAccessDestination(dest, role, modules)
    );

    const sections = flattenAdminNavLinks(
      filterAdminMenuSections(adminNavSections, role, modules)
    ).map((item) => ({
      name: item.name,
      href: item.name === "Pipeline" ? pipelineHref : item.href,
      icon: item.icon as LucideIcon,
      group: item.group,
      moduleKey: item.moduleKey,
      anyModuleKeys: item.anyModuleKeys,
      keywords: item.group.toLowerCase(),
    }));

    const seen = new Set(pages.map((p) => `${p.name}:${p.href}`));
    const uniqueSections = sections.filter((item) => {
      const key = `${item.name}:${item.href}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return [...pages, ...uniqueSections];
  }, [user?.role, user?.adminModules, pipelineHref]);

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
        aria-label="Search BQI HR"
      >
        <Search className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-[#272156] dark:group-hover:text-foreground" />
        <span className="min-w-0 flex-1 truncate">Search BQI HR</span>
        <kbd className="pointer-events-none hidden shrink-0 items-center gap-0.5 rounded border border-border/70 bg-muted/50 px-1.5 py-0.5 font-sans text-[10px] font-medium text-muted-foreground sm:inline-flex">
          {shortcutLabel}
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search pages, tools…" />
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
