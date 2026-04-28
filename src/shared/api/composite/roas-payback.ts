// src/shared/api/composite/roas-payback.ts
import type { CohortSummary } from "../appsflyer"
import type { RevenueSnapshot } from "../lstm/revenue-snapshot"
import type {
  RealKpiBand,
  RealKpiFreshness,
  RealKpiInput,
  RealKpiResult,
  RealKpiStatus,
} from "./types"

const MIN_BASIS_DAYS = 14
const SNAPSHOT_STALE_MS = 7 * 24 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

export function computeRealKpi(input: RealKpiInput): RealKpiResult {
  const { gameId, cohortSummary, revenueSnapshot, mockFallback } = input
  const now = input.now ?? new Date()

  if (cohortSummary === null) {
    return packMock("mock", "ML1", { basisDays: 0, spendUsd: null }, mockFallback)
  }

  const spend = cohortSummary.spend.totalUsd
  if (spend === null) {
    return packMock("fxUnsupported", "ML2", { basisDays: 0, spendUsd: null }, mockFallback)
  }

  const installs = cohortSummary.cohorts.reduce((s, c) => s + c.installs, 0)
  if (installs === 0 || spend <= 0) {
    return packMock("insufficient", "ML1", { basisDays: 0, spendUsd: spend }, mockFallback)
  }

  const basisDays = computeBasisDays(cohortSummary, now)
  if (basisDays < MIN_BASIS_DAYS) {
    return packMock("insufficient", "ML1", { basisDays, spendUsd: spend }, mockFallback)
  }

  const snapshotAge = now.getTime() - new Date(revenueSnapshot.generated_at).getTime()
  if (snapshotAge > SNAPSHOT_STALE_MS) {
    return packMock("mock", "ML2", { basisDays, spendUsd: spend }, mockFallback)
  }

  const game = revenueSnapshot.forecast[gameId]
  if (!game) {
    return packMock("mock", "ML2", { basisDays, spendUsd: spend }, mockFallback)
  }

  const N = revenueSnapshot.installsAssumption.perGame[gameId] ?? 1
  const horizon = game.points.length
  const observedRev = cohortSummary.revenue.total.sumUsd
  const cpi = spend / installs

  const cumP10 = (d: number) => cumPerInstall(d, "p10", basisDays, horizon, observedRev, installs, game.points, N)
  const cumP50 = (d: number) => cumPerInstall(d, "p50", basisDays, horizon, observedRev, installs, game.points, N)
  const cumP90 = (d: number) => cumPerInstall(d, "p90", basisDays, horizon, observedRev, installs, game.points, N)

  const roas: RealKpiBand = {
    p10: (cumP10(horizon) / cpi) * 100,
    p50: (cumP50(horizon) / cpi) * 100,
    p90: (cumP90(horizon) / cpi) * 100,
  }

  const hitP10 = firstHit(cumP10, cpi, horizon)
  const hitP50 = firstHit(cumP50, cpi, horizon)
  const hitP90 = firstHit(cumP90, cpi, horizon)

  if (hitP50 === null) {
    return packMock("insufficient", "ML1", { basisDays, spendUsd: spend }, mockFallback)
  }

  const payback: RealKpiBand = {
    p10: hitP90 ?? horizon,    // fast revenue → quick payback (P90 → p10)
    p50: hitP50,
    p90: hitP10 ?? horizon,    // slow revenue → late payback (P10 → p90)
  }

  const forecastRevenueUsd = cumP50(horizon) * installs - observedRev

  return {
    roas,
    payback,
    status: "real",
    basisDays,
    observedRevenueUsd: observedRev,
    forecastRevenueUsd,
    spendUsd: spend,
    freshness: null,
  }
}

function packMock(
  status: RealKpiStatus,
  freshness: RealKpiFreshness,
  meta: { basisDays: number; spendUsd: number | null },
  fallback: RealKpiInput["mockFallback"],
): RealKpiResult {
  return {
    roas: fallback.roas,
    payback: fallback.payback,
    status,
    basisDays: meta.basisDays,
    observedRevenueUsd: 0,
    forecastRevenueUsd: 0,
    spendUsd: meta.spendUsd,
    freshness,
  }
}

function computeBasisDays(cohortSummary: CohortSummary, now: Date): number {
  let weightedAgeDays = 0
  let totalInstalls = 0
  for (const c of cohortSummary.cohorts) {
    const cohortMs = new Date(`${c.cohortDate}T00:00:00Z`).getTime()
    const ageDays = (now.getTime() - cohortMs) / DAY_MS
    weightedAgeDays += ageDays * c.installs
    totalInstalls += c.installs
  }
  if (totalInstalls === 0) return 0
  return Math.floor(weightedAgeDays / totalInstalls)
}

function cumPerInstall(
  d: number,
  band: "p10" | "p50" | "p90",
  basisDays: number,
  horizon: number,
  observedRev: number,
  installs: number,
  points: RevenueSnapshot["forecast"][string]["points"],
  N: number,
): number {
  const observedPerInstall = observedRev / installs
  if (d <= basisDays) {
    return observedPerInstall * (d / basisDays)
  }
  let tail = 0
  const upTo = Math.min(d, horizon)
  for (let k = basisDays + 1; k <= upTo; k++) {
    const p = points[k - 1]
    const dailyPerInstall =
      band === "p10" ? p.revenueP10 / N
      : band === "p50" ? p.revenueP50 / N
      : p.revenueP90 / N
    tail += dailyPerInstall
  }
  return observedPerInstall + tail
}

function firstHit(
  cum: (d: number) => number,
  cpi: number,
  horizon: number,
): number | null {
  for (let d = 1; d <= horizon; d++) {
    if (cum(d) >= cpi) return d
  }
  return null
}
