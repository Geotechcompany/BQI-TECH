export function DashboardOverviewSkeleton() {
  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="h-44 animate-pulse rounded-2xl bg-muted sm:h-52" />
      <div className="h-36 animate-pulse rounded-2xl bg-muted" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="h-28 animate-pulse rounded-2xl bg-muted sm:h-32"
          />
        ))}
      </div>
      <div className="h-36 animate-pulse rounded-2xl bg-muted sm:h-40" />
    </div>
  );
}
