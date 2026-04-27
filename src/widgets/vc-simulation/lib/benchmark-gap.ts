import type { AppState, CohortSummary } from "@/shared/api/appsflyer"
import type { Offer } from "@/shared/api/vc-simulation"

/**
 * Benchmark vs actual LTV gap disclosure.
 *
 * The simulator runs on puzzle/casual production benchmarks (ARPDAU $0.30–0.50,
 * retention from the LSTM P50 curve). This helper compares those benchmark
 * assumptions against what the connected AppsFlyer snapshot actually shows,
 * surfacing one ratio + tone so the decision-maker can read the simulator
 * output as conservative / on-target / optimistic for their game.
 *
 * Limitation (current phase 1): CohortSummary does not aggregate UA spend
 * at the cohort level, so we compare LTV-per-install only (CPI excluded).
 * A future PR adds cohort-level UA-spend aggregation for the full LTV/CPI
 * ratio specified in the design doc.
 */

export type ToneKey =
  | "match"
  | "modestUp"
  | "strongUp"
  | "modestDown"
  | "strongDown"

export type BenchmarkGap = {
  /** "active" when AF is connected with usable data, otherwise "disconnected". */
  status: "active" | "disconnected"
  /** Selected ratio as a fraction (0.33 = +33% above simulated). null if not derivable. */
  gap: number | null
  /** Which time window drove the selection. */
  selected: "d30" | "cumulative" | null
  /** D30-cohort gap as a fraction. null if no D30-mature cohorts yet. */
  d30Gap: number | null
  /** Cumulative-since-launch gap as a fraction. */
  cumGap: number | null
  /** Days since the earliest cohort install in the snapshot. */
  daysFromLaunch: number | null
  /** Threshold tone for chip / narrative coloring. */
  tone: ToneKey | null
}

// Compute.ts midpoints — keep these in sync if simulateOnePath ranges change.
const SIM_ARPDAU_MID = 0.40
const SIM_RET_SUM_D30 = 5.5

function daysSince(yyyymmdd: string, today = new Date()): number {
  const d = new Date(yyyymmdd + "T00:00:00Z")
  const ms = today.getTime() - d.getTime()
  return Math.max(0, Math.floor(ms / 86400000))
}

export function bucketTone(gap: number): ToneKey {
  if (gap > 0.30) return "strongUp"
  if (gap > 0.10) return "modestUp"
  if (gap >= -0.10) return "match"
  if (gap >= -0.30) return "modestDown"
  return "strongDown"
}

/**
 * Rough estimate of cumulative simulated LTV-per-install for a given horizon.
 * Fit against the LSTM fixture's Σret(1..N×30) at common horizon points;
 * fine for disclosure-level chip but not a substitute for direct compute.ts
 * derivation when precision matters.
 */
function simulatedCumLtvPerInstall(horizonMonths: number): number {
  // Σret(1..30) ≈ 5.5  → LTV(D30) ≈ $2.20
  // Σret(1..360) ≈ 20  → LTV(D360) ≈ $8.00
  // Past 12 months retention is largely flat → diminishing slope.
  if (horizonMonths <= 12) {
    const ratio = horizonMonths / 12
    return 2.20 + (8.0 - 2.20) * ratio
  }
  return 8.0 + 0.5 * (horizonMonths - 12)
}

export function computeBenchmarkGap(
  state: AppState | null,
  summary: CohortSummary | null,
  offer: Offer,
  today: Date = new Date(),
): BenchmarkGap {
  const isActive = state?.status === "active" || state?.status === "stale"

  if (!isActive || !summary || summary.cohorts.length === 0) {
    return {
      status: "disconnected",
      gap: null,
      selected: null,
      d30Gap: null,
      cumGap: null,
      daysFromLaunch: null,
      tone: null,
    }
  }

  const firstCohortDate = summary.cohorts[0].cohortDate
  const daysFromLaunch = daysSince(firstCohortDate, today)

  const totalInstalls = summary.cohorts.reduce((s, c) => s + c.installs, 0)
  const totalRevenue = summary.revenue.total.sumUsd

  // Cumulative LTV per install vs simulated cumulative LTV per install
  // (over the full simulator horizon).
  const cumLtvPerInstall = totalInstalls > 0 ? totalRevenue / totalInstalls : null
  const simCumLtv = simulatedCumLtvPerInstall(offer.horizonMonths)
  const cumGap =
    cumLtvPerInstall !== null && simCumLtv > 0
      ? cumLtvPerInstall / simCumLtv - 1
      : null

  // D30 LTV per install: revenue from cohorts that have already aged past 30
  // days, divided by installs in those cohorts. Revenue is allocated
  // proportionally because CohortSummary keeps revenue at the daily level
  // rather than partitioned by install cohort. Phase-2 aggregation can
  // sharpen this.
  const d30Cohorts = summary.cohorts.filter(
    (c) => daysSince(c.cohortDate, today) >= 30,
  )
  const d30Installs = d30Cohorts.reduce((s, c) => s + c.installs, 0)
  const d30RevenueProxy =
    totalInstalls > 0 ? totalRevenue * (d30Installs / totalInstalls) : 0
  const d30LtvPerInstall = d30Installs > 0 ? d30RevenueProxy / d30Installs : null
  const simD30Ltv = SIM_ARPDAU_MID * SIM_RET_SUM_D30
  const d30Gap =
    d30LtvPerInstall !== null && simD30Ltv > 0
      ? d30LtvPerInstall / simD30Ltv - 1
      : null

  // Maturity-based selection per spec §2.2.
  let selected: BenchmarkGap["selected"] = null
  let gap: number | null = null
  if (daysFromLaunch < 90 && d30Gap !== null) {
    selected = "d30"
    gap = d30Gap
  } else if (cumGap !== null) {
    selected = "cumulative"
    gap = cumGap
  } else if (d30Gap !== null) {
    selected = "d30"
    gap = d30Gap
  }

  return {
    status: "active",
    gap,
    selected,
    d30Gap,
    cumGap,
    daysFromLaunch,
    tone: gap !== null ? bucketTone(gap) : null,
  }
}

export function toneClass(tone: ToneKey): string {
  switch (tone) {
    case "match":
      return "text-muted-foreground"
    case "modestUp":
      return "text-success"
    case "strongUp":
      return "text-success font-semibold"
    case "modestDown":
      return "text-warning"
    case "strongDown":
      return "text-destructive font-semibold"
  }
}

export function formatGapPct(gap: number): string {
  const sign = gap >= 0 ? "+" : ""
  return `${sign}${(gap * 100).toFixed(0)}%`
}
