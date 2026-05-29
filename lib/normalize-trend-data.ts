export type TrendPoint = {
  date?: string;
  _id?: string;
  count?: number;
};

export type TrendSeries = {
  labels: string[];
  counts: number[];
};

function parseTrendDate(value: unknown): Date | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === "object" && value !== null && "$date" in value) {
    return parseTrendDate((value as { $date: unknown }).$date);
  }
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatShortDate(value: unknown): string {
  const date = parseTrendDate(value);
  if (!date) return "";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function normalizeTrendSeries(
  trends: TrendPoint[] | undefined,
  fallback: TrendSeries
): TrendSeries {
  if (!trends?.length) return fallback;

  const labels: string[] = [];
  const counts: number[] = [];
  let validDates = 0;

  for (const point of trends) {
    const rawDate = point.date ?? point._id;
    const label = formatShortDate(rawDate);
    if (label) validDates += 1;
    labels.push(label || String(rawDate ?? ""));
    counts.push(Number(point.count) || 0);
  }

  if (validDates === 0) return fallback;
  return { labels, counts };
}

export function trendSeriesHasActivity(series: TrendSeries): boolean {
  return series.counts.some((count) => count > 0);
}
