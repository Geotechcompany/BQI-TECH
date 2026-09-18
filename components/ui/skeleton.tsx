import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted/60", className)}
      {...props}
    />
  )
}

function TableSkeleton({
  rows = 8,
  columns = 5,
  className,
  showCheckbox = false,
}: {
  rows?: number
  columns?: number
  className?: string
  showCheckbox?: boolean
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-border/70 bg-card",
        className
      )}
    >
      <div
        className="grid gap-3 border-b border-border/60 bg-muted/30 px-4 py-3"
        style={{
          gridTemplateColumns: showCheckbox
            ? `1.5rem repeat(${columns}, minmax(0, 1fr))`
            : `repeat(${columns}, minmax(0, 1fr))`,
        }}
      >
        {showCheckbox ? <Skeleton className="h-4 w-4 rounded" /> : null}
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-3.5 w-[70%]" />
        ))}
      </div>
      <div className="divide-y divide-border/50">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="grid items-center gap-3 px-4 py-3.5"
            style={{
              gridTemplateColumns: showCheckbox
                ? `1.5rem repeat(${columns}, minmax(0, 1fr))`
                : `repeat(${columns}, minmax(0, 1fr))`,
            }}
          >
            {showCheckbox ? <Skeleton className="h-4 w-4 rounded" /> : null}
            {Array.from({ length: columns }).map((_, j) => (
              <div key={j} className="flex items-center gap-2 min-w-0">
                {j === 0 ? (
                  <>
                    <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-[75%]" />
                      <Skeleton className="h-3 w-[45%]" />
                    </div>
                  </>
                ) : (
                  <Skeleton
                    className={cn(
                      "h-3.5",
                      j % 3 === 0 ? "w-[55%]" : j % 2 === 0 ? "w-[70%]" : "w-[40%]"
                    )}
                  />
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function CardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card p-6 space-y-4",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-4 rounded-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  )
}

function CardGridSkeleton({
  count = 6,
  className,
}: {
  count?: number
  className?: string
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3",
        className
      )}
    >
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  )
}

function StatsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  )
}

function FormSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-6", className)}>
      <div className="space-y-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-10 w-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-10 w-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-32 w-full" />
      </div>
      <div className="flex justify-end space-x-3">
        <Skeleton className="h-10 w-20" />
        <Skeleton className="h-10 w-24" />
      </div>
    </div>
  )
}

function PageSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <StatsSkeleton />
      <div className="bg-card rounded-lg border border-border p-6">
        <div className="space-y-4">
          <Skeleton className="h-6 w-32" />
          <TableSkeleton />
        </div>
      </div>
    </div>
  )
}

function ListSkeleton({
  items = 5,
  className,
}: {
  items?: number
  className?: string
}) {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  )
}

function ListRowSkeleton({
  rows = 8,
  className,
  showAvatar = true,
}: {
  rows?: number
  className?: string
  showAvatar?: boolean
}) {
  return (
    <div className={cn("divide-y divide-border/50", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-2.5">
          {showAvatar ? (
            <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
          ) : (
            <Skeleton className="h-4 w-4 shrink-0 rounded" />
          )}
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-[55%]" />
            <Skeleton className="h-3 w-[80%]" />
          </div>
          <Skeleton className="h-3 w-12 shrink-0" />
        </div>
      ))}
    </div>
  )
}

const CHART_BAR_HEIGHTS = [48, 72, 36, 88, 54, 64, 40]

function ChartSkeleton() {
  return (
    <div className="bg-card rounded-lg border border-border p-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="flex items-end gap-2 h-28">
          {CHART_BAR_HEIGHTS.map((height, i) => (
            <Skeleton
              key={i}
              className="flex-1 rounded-t-sm"
              style={{ height: `${height}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function PipelineSkeleton({
  columns = 5,
  cardsPerColumn = 3,
  className,
}: {
  columns?: number
  cardsPerColumn?: number
  className?: string
}) {
  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-36" />
        <Skeleton className="ml-auto h-9 w-28" />
      </div>
      <div className="flex gap-3 overflow-hidden pb-2">
        {Array.from({ length: columns }).map((_, col) => (
          <div
            key={col}
            className="w-64 shrink-0 rounded-xl border border-border/70 bg-muted/20 p-3"
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-6 rounded-full" />
            </div>
            <div className="space-y-2.5">
              {Array.from({ length: cardsPerColumn }).map((_, card) => (
                <div
                  key={card}
                  className="space-y-2 rounded-lg border border-border/60 bg-card p-3"
                >
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-7 w-7 rounded-full" />
                    <Skeleton className="h-3.5 w-[60%]" />
                  </div>
                  <Skeleton className="h-3 w-[80%]" />
                  <div className="flex gap-2">
                    <Skeleton className="h-5 w-12 rounded-full" />
                    <Skeleton className="h-5 w-10 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function InboxSplitSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex min-h-[calc(100vh-12rem)] w-full flex-1 overflow-hidden rounded-xl border border-border/70 bg-card",
        className
      )}
    >
      <aside className="flex w-full max-w-sm flex-col border-r border-border/60 bg-muted/20 md:w-[22rem]">
        <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="ml-auto h-3 w-6" />
        </div>
        <ListRowSkeleton rows={7} className="min-h-0 flex-1" />
      </aside>
      <section className="hidden min-w-0 flex-1 flex-col md:flex">
        <div className="flex items-center gap-3 border-b border-border/60 px-5 py-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-56" />
          </div>
          <Skeleton className="h-8 w-24" />
        </div>
        <div className="space-y-3 px-5 py-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="space-y-2 rounded-lg border border-border/60 p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-[70%]" />
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function ApplicantsSplitSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 overflow-hidden rounded-lg border border-border/70 bg-card",
        className
      )}
    >
      <aside className="flex w-full max-w-[17rem] flex-col border-r border-border/60 bg-muted/15">
        <div className="space-y-2 border-b border-border/60 p-3">
          <Skeleton className="h-8 w-full rounded-md" />
          <div className="flex gap-1">
            <Skeleton className="h-7 flex-1 rounded-md" />
            <Skeleton className="h-7 flex-1 rounded-md" />
          </div>
        </div>
        <div className="divide-y divide-border/50">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="space-y-2 px-3 py-2.5">
              <Skeleton className="h-3.5 w-[85%]" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="ml-auto h-5 w-7 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </aside>
      <section className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-3 border-b border-border/60 px-4 py-3">
          <Skeleton className="h-9 w-9 rounded-full" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-4 w-44" />
            <Skeleton className="h-3 w-56" />
          </div>
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-20" />
        </div>
        <div className="grid min-h-0 flex-1 gap-4 p-4 lg:grid-cols-2">
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-9 w-full" />
              </div>
            ))}
          </div>
          <div className="space-y-3 rounded-lg border border-border/60 p-3">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-[min(28rem,50vh)] w-full rounded-md" />
          </div>
        </div>
      </section>
    </div>
  )
}

function NotificationListSkeleton({
  rows = 6,
  className,
}: {
  rows?: number
  className?: string
}) {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex gap-3 rounded-xl border border-border/60 bg-card p-4"
        >
          <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-[45%]" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-[30%]" />
          </div>
          <Skeleton className="h-6 w-6 shrink-0 rounded" />
        </div>
      ))}
    </div>
  )
}

function WizardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("mx-auto max-w-4xl space-y-6 p-6", className)}>
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-2 flex-1 rounded-full" />
        ))}
      </div>
      <div className="rounded-xl border border-border/70 bg-card p-6">
        <FormSkeleton />
      </div>
    </div>
  )
}

export {
  Skeleton,
  TableSkeleton,
  CardSkeleton,
  CardGridSkeleton,
  StatsSkeleton,
  FormSkeleton,
  PageSkeleton,
  ListSkeleton,
  ListRowSkeleton,
  ChartSkeleton,
  PipelineSkeleton,
  InboxSplitSkeleton,
  ApplicantsSplitSkeleton,
  NotificationListSkeleton,
  WizardSkeleton,
}
