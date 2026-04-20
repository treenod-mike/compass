import type { TopGame, Snapshot } from "../schemas/snapshot.js";

export function percentile(values: Array<number | null>, p: number): number {
  const clean = values.filter((v): v is number => typeof v === "number" && !Number.isNaN(v));
  if (clean.length === 0) throw new Error("percentile: empty array after filtering");
  if (p < 0 || p > 1) throw new Error(`percentile: p must be in [0,1], got ${p}`);
  const sorted = [...clean].sort((a, b) => a - b);
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo]!;
  const frac = idx - lo;
  return sorted[lo]! * (1 - frac) + sorted[hi]! * frac;
}

function dist(values: Array<number | null>) {
  return {
    p10: percentile(values, 0.1),
    p50: percentile(values, 0.5),
    p90: percentile(values, 0.9),
  };
}

function avgMonthly(monthly: Array<{ month: string; value: number }>): number | null {
  if (monthly.length === 0) return null;
  return monthly.reduce((s, m) => s + m.value, 0) / monthly.length;
}

export function computeGenrePrior(games: TopGame[]): Snapshot["genrePrior"] {
  const d1 = games.map((g) => g.retention.d1);
  const d7 = games.map((g) => g.retention.d7);
  const d30 = games.map((g) => g.retention.d30);
  const monthlyRevs = games.map((g) => avgMonthly(g.revenue.monthly));
  const monthlyDls = games.map((g) => avgMonthly(g.downloads.monthly));

  return {
    retention: { d1: dist(d1), d7: dist(d7), d30: dist(d30) },
    monthlyRevenueUsd: dist(monthlyRevs),
    monthlyDownloads: dist(monthlyDls),
  };
}
