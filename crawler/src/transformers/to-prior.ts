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

// Same fallback rule used by both prior estimation and nonNullCount, so they
// agree on which games actually contribute a per-month value.
function periodRev(g: TopGame): number | null {
  return g.revenue.monthly.length > 0 ? avgMonthly(g.revenue.monthly) : g.revenue.last90dTotalUsd;
}
function periodDl(g: TopGame): number | null {
  return g.downloads.monthly.length > 0 ? avgMonthly(g.downloads.monthly) : g.downloads.last90dTotal;
}

export function computeGenrePrior(games: TopGame[]): Snapshot["genrePrior"] {
  const d1 = games.map((g) => g.retention.d1);
  const d7 = games.map((g) => g.retention.d7);
  const d30 = games.map((g) => g.retention.d30);
  const monthlyRevs = games.map(periodRev);
  const monthlyDls = games.map(periodDl);

  return {
    retention: { d1: dist(d1), d7: dist(d7), d30: dist(d30) },
    monthlyRevenueUsd: dist(monthlyRevs),
    monthlyDownloads: dist(monthlyDls),
  };
}

export function computeNonNullCount(games: TopGame[]): {
  retention_d1: number;
  retention_d7: number;
  retention_d30: number;
  monthlyRevenueUsd: number;
  monthlyDownloads: number;
} {
  return {
    retention_d1: games.filter((g) => typeof g.retention.d1 === "number").length,
    retention_d7: games.filter((g) => typeof g.retention.d7 === "number").length,
    retention_d30: games.filter((g) => typeof g.retention.d30 === "number").length,
    monthlyRevenueUsd: games.filter((g) => typeof periodRev(g) === "number").length,
    monthlyDownloads: games.filter((g) => typeof periodDl(g) === "number").length,
  };
}
