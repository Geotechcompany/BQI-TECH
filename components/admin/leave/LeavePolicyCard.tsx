"use client";

import Link from "next/link";
import { Users } from "lucide-react";
import type { LeavePolicy } from "@/types/leave";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function formatUpdated(isoDate: string) {
  return new Date(isoDate).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

type LeavePolicyCardProps = {
  policy: LeavePolicy;
  className?: string;
};

export function LeavePolicyCard({ policy, className }: LeavePolicyCardProps) {
  return (
    <article
      className={cn(
        "flex flex-col rounded-xl border border-[#272156]/12 bg-card p-5 shadow-sm transition-shadow hover:shadow-md",
        className
      )}
    >
      <div className="flex flex-wrap gap-1.5">
        <span className="rounded-md bg-[#272156] px-2 py-0.5 text-xs font-medium text-white">
          {policy.region}
        </span>
        {policy.teamTags.map((tag) => (
          <span
            key={tag}
            className="rounded-md border border-[#31CDFF]/30 bg-[#31CDFF]/10 px-2 py-0.5 text-xs font-medium text-[#272156] dark:text-[#31CDFF]"
          >
            {tag}
          </span>
        ))}
      </div>

      <h3 className="mt-3 text-base font-semibold text-[#272156] dark:text-foreground">
        {policy.name}
      </h3>
      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
        {policy.description}
      </p>

      <dl className="mt-4 space-y-1.5 text-xs text-muted-foreground">
        <div className="flex justify-between gap-2">
          <dt>Accrual</dt>
          <dd className="text-right font-medium text-foreground">
            {policy.accrualRule}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Approval</dt>
          <dd className="text-right font-medium text-foreground">
            {policy.approvalFlow}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Carry-over</dt>
          <dd className="text-right font-medium text-foreground">
            {policy.carryOverDays} day{policy.carryOverDays === 1 ? "" : "s"}
          </dd>
        </div>
      </dl>

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-[#272156]/08 pt-4 mt-4">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Users className="h-3.5 w-3.5" strokeWidth={1.75} />
          <span>{policy.headcount} people</span>
          <span aria-hidden>·</span>
          <span>Updated {formatUpdated(policy.updatedAt)}</span>
        </div>
        <Button
          asChild
          size="sm"
          variant="outline"
          className="border-[#272156]/20 text-[#272156] hover:bg-[#31CDFF]/10 dark:text-foreground"
        >
          <Link href={`/admin/leave/policies?id=${policy.id}`}>Open</Link>
        </Button>
      </div>
    </article>
  );
}
