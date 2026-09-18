"use client";

import type { Employee } from "@/types/employee";
import { format, parseISO } from "date-fns";

export function ActivityTab({ employee }: { employee: Employee }) {
  const sorted = [...employee.activity].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Recent activity on this employee record.
      </p>
      {sorted.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No activity logged yet.
        </p>
      ) : (
      <ol className="relative space-y-5 border-l border-border pl-5">
        {sorted.map((entry) => {
          let when = entry.date;
          try {
            when = format(parseISO(entry.date), "MMM d, yyyy · HH:mm");
          } catch {
            /* keep raw */
          }
          return (
            <li key={entry.id} className="relative">
              <span className="absolute -left-[1.4rem] top-1.5 h-2.5 w-2.5 rounded-full bg-[#272156] ring-4 ring-background dark:bg-[#31CDFF]" />
              <p className="text-xs text-muted-foreground">{when}</p>
              <p className="text-sm font-medium text-foreground">
                {entry.action}
              </p>
              <p className="text-sm text-muted-foreground">
                {entry.actor}
                {entry.detail ? ` — ${entry.detail}` : ""}
              </p>
            </li>
          );
        })}
      </ol>
      )}
    </div>
  );
}
