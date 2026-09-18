"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { format, isToday, isTomorrow, parseISO } from "date-fns";
import { Calendar } from "lucide-react";
import { adminApi } from "@/lib/api-backend";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export interface AgendaItem {
  id: string;
  type: "interview" | "assessment" | "reminder" | string;
  title: string;
  subtitle?: string | null;
  startsAt: string;
  applicationId?: string;
  jobId?: string | null;
  href?: string | null;
}

function formatAgendaWhen(startsAt: string): string {
  try {
    const date = parseISO(startsAt);
    if (Number.isNaN(date.getTime())) return startsAt;
    const time = format(date, "h:mm a");
    if (isToday(date)) return `Today · ${time}`;
    if (isTomorrow(date)) return `Tomorrow · ${time}`;
    return `${format(date, "MMM d")} · ${time}`;
  } catch {
    return startsAt;
  }
}

async function fetchMyAgenda(): Promise<AgendaItem[]> {
  const response = (await adminApi.getMyAgenda({ limit: 10 })) as {
    items?: AgendaItem[];
  };
  return response?.items || [];
}

export function MyAgendaWidget({ className }: { className?: string }) {
  const { data: items = [], isLoading, isError } = useQuery({
    queryKey: ["admin-my-agenda"],
    queryFn: fetchMyAgenda,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm",
        className
      )}
      aria-label="My Agenda"
      data-tour="overview-agenda"
    >
      <header className="flex items-center gap-2 border-b border-border/50 px-4 py-3">
        <Calendar className="h-4 w-4 text-foreground/80" aria-hidden />
        <h2 className="text-sm font-semibold text-foreground">My Agenda</h2>
      </header>

      <div className="p-3">
        {isLoading ? (
          <div className="space-y-2 rounded-lg bg-muted/30 p-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : isError ? (
          <div className="flex min-h-[140px] flex-col items-center justify-center rounded-lg bg-muted/40 px-4 py-8 text-center">
            <p className="text-sm text-muted-foreground">
              Could not load your agenda.
            </p>
          </div>
        ) : items.length === 0 ? (
          <div className="flex min-h-[140px] flex-col items-center justify-center rounded-lg bg-muted/40 px-4 py-8 text-center">
            <Calendar
              className="mb-3 h-10 w-10 text-muted-foreground/45"
              strokeWidth={1.5}
              aria-hidden
            />
            <p className="text-sm text-muted-foreground">No upcoming meetings</p>
          </div>
        ) : (
          <ul className="max-h-64 space-y-0.5 overflow-y-auto">
            {items.map((item) => {
              const content = (
                <>
                  <span className="block truncate text-sm font-medium text-foreground">
                    {item.title}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    {formatAgendaWhen(item.startsAt)}
                    {item.subtitle ? ` · ${item.subtitle}` : ""}
                  </span>
                </>
              );

              return (
                <li key={item.id}>
                  {item.href ? (
                    <Link
                      href={item.href}
                      className="block rounded-md px-2.5 py-2 transition hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {content}
                    </Link>
                  ) : (
                    <div className="rounded-md px-2.5 py-2">{content}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
