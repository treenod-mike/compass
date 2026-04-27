import type { AppState, CohortSummary } from "@/shared/api/appsflyer"
import type { Offer } from "@/shared/api/vc-simulation"

/**
 * Benchmark vs actual LTV/CPI gap disclosure.
 *
 * The simulator runs on puzzle/casual production benchmarks (ARPDAU $0.30–0.50,
 * CPI $2.5–3.5, retention from the LSTM P50 curve). This helper compares those
 * benchmark assumptions against what the connected AppsFlyer snapshot actually
 * shows, surfacing one ratio + tone so the decision-maker can read the
 * simulator output as conservative / on-target / optimistic for their game.
 *
 * Phase 2 (2026-04-27): now compares LTV/CPI against simulated LTV/CPI per the
 * design spec §3, after CohortSummary started aggregating UA spend per cohort.
 * When summary.spend.totalUsd is null (FX-unsupported home_currency) or 0
 * (organic-only), we surface that explicitly via spendStatus rather than
 * silently falling back to LTV-only.
 */

export type ToneKey =
  | "match"
  | "modestUp"
  | "strongUp"
  | "modestDown"
  | "strongDown"

export type SpendStatus =
  | "ok"                  // FX-supported + non-zero paid installs → LTV/CPI computable
  | "fxUnsupported"       // home_currency outside USD/KRW
  | "noPaidInstalls"      // organic-only or every cohort had null/zero cost

export type BenchmarkGap = {
  /** "active" when AF is connected with usable data, otherwise "disconnected". */
  status: "active" | "disconnected"
  /** Selected ratio as a fraction (0.33 = +33% above simulated). null if not derivable. */
  gap: number | null
  /** Which time window drove the selection. */
  selected: "d30" | "cumulative" | null
  /** D30-cohort gap as a fraction. null if no D30-mature cohorts yet or spend unmeasurable. */
  d30Gap: number | null
  /** Cumulative-since-launch gap as a fraction. */
  cumGap: number | null
  /** Days since the earliest cohort install in the snapshot. */
  daysFromLaunch: number | null
  /** Threshold tone for chip / narrative coloring. */
  tone: ToneKey | null
  /** Why the LTV/CPI ratio was (or wasn't) computed. */
  spendStatus: SpendStatus | null
  /** Actual LTV/CPI from the snapshot (per-window). null when spend unusable. */
  d30LtvPerCpi: number | null
  cumLtvPerCpi: number | null
  /** Simulated LTV/CPI midpoint reference (deterministic, no Monte Carlo). */
  simD30LtvPerCpi: number
  simCumLtvPerCpi: number
}

// Simulator midpoints. Keep these in sync with simulateOnePath ranges.
// Source: VC simulator compute.ts puzzle/casual production defaults.
//   ARPDAU: $0.30–0.50 → mid $0.40
//   CPI:    $2.5–$3.5  → mid $3.0
//   Σret(1..30)  ≈ 5.5
//   Σret(1..360) ≈ 20  (past 12 months retention is largely flat)
const SIM_ARPDAU_MID = 0.40
const SIM_CPI_MID = 3.0
const SIM_RET_SUM_D30 = 5.5
const SIM_RET_SUM_D360 = 20

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
 * Σret(1..N days) interpolated against the LSTM P50 fixture's two anchor
 * points (D30 → 5.5, D360 → 20). 12 months is the inflection: past it
 * retention is largely flat, so the slope drops. Outputs Σret in days.
 */
function simulatedRetSum(horizonMonths: number): number {
  if (horizonMonths <= 12) {
    const ratio = horizonMonths / 12
    return SIM_RET_SUM_D30 + (SIM_RET_SUM_D360 - SIM_RET_SUM_D30) * ratio
  }
  // Beyond 12 months, add 1.25 to the retention sum per extra month
  // (≈ 0.5 LTV / ARPDAU_mid 0.40, matching the legacy phase-1 fit).
  return SIM_RET_SUM_D360 + 1.25 * (horizonMonths - 12)
}

/** LTV/CPI midpoint = ARPDAU_mid × Σret / CPI_mid (spec §3.3). */
function simulatedLtvPerCpi(horizonMonths: number): number {
  return (SIM_ARPDAU_MID * simulatedRetSum(horizonMonths)) / SIM_CPI_MID
}

/** D30 LTV/CPI midpoint = ARPDAU_mid × Σret(1..30) / CPI_mid ≈ 0.733. */
function simulatedD30LtvPerCpi(): number {
  return (SIM_ARPDAU_MID * SIM_RET_SUM_D30) / SIM_CPI_MID
}

function disconnected(): BenchmarkGap {
  return {
    status: "disconnected",
    gap: null,
    selected: null,
    d30Gap: null,
    cumGap: null,
    daysFromLaunch: null,
    tone: null,
    spendStatus: null,
    d30LtvPerCpi: null,
    cumLtvPerCpi: null,
    simD30LtvPerCpi: simulatedD30LtvPerCpi(),
    simCumLtvPerCpi: 0,
  }
}

export function computeBenchmarkGap(
  state: AppState | null,
  summary: CohortSummary | null,
  offer: Offer,
  today: Date = new Date(),
): BenchmarkGap {
  const isActive = state?.status === "active" || state?.status === "stale"

  if (!isActive || !summary || summary.cohorts.length === 0) {
    return disconnected()
  }

  const firstCohortDate = summary.cohorts[0].cohortDate
  const daysFromLaunch = daysSince(firstCohortDate, today)

  const totalInstalls = summary.cohorts.reduce((s, c) => s + c.installs, 0)
  const totalRevenue = summary.revenue.total.sumUsd
  const totalSpendUsd = summary.spend?.totalUsd ?? null

  const simCumLtvPerCpi = simulatedLtvPerCpi(offer.horizonMonths)
  const simD30 = simulatedD30LtvPerCpi()

  // Spend status — derived once, used for both windows.
  let spendStatus: SpendStatus
  if (totalSpendUsd === null) {
    spendStatus = "fxUnsupported"
  } else if (totalSpendUsd === 0) {
    spendStatus = "noPaidInstalls"
  } else {
    spendStatus = "ok"
  }

  // Cumulative LTV/CPI: revenue / spend (installs cancel).
  const cumLtvPerCpi =
    spendStatus === "ok" && totalSpendUsd! > 0
      ? totalRevenue / totalSpendUsd!
      : null
  const cumGap =
    cumLtvPerCpi !== null && simCumLtvPerCpi > 0
      ? cumLtvPerCpi / simCumLtvPerCpi - 1
      : null

  // D30 LTV/CPI: same proportional-allocation limitation as Phase 1 — revenue
  // is summary-wide, not cohort-attributed, so we proxy by install share.
  // Spend, however, is cohort-attributed since Phase 2, so d30Spend is exact
  // (sum of d30-mature cohorts' uaSpendUsd).
  const d30MatureCohorts = summary.cohorts.filter(
    (c) => daysSince(c.cohortDate, today) >= 30,
  )
  const d30Installs = d30MatureCohorts.reduce((s, c) => s + c.installs, 0)
  const d30SpendUsd =
    spendStatus === "ok"
      ? d30MatureCohorts.reduce((s, c) => s + (c.uaSpendUsd ?? 0), 0)
      : null
  const d30RevenueProxy =
    totalInstalls > 0 ? totalRevenue * (d30Installs / totalInstalls) : 0
  const d30LtvPerCpi =
    d30SpendUsd !== null && d30SpendUsd > 0
      ? d30RevenueProxy / d30SpendUsd
      : null
  const d30Gap =
    d30LtvPerCpi !== null && simD30 > 0 ? d30LtvPerCpi / simD30 - 1 : null

  // Maturity-based selection per spec §2.2 (90-day threshold).
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
    spendStatus,
    d30LtvPerCpi,
    cumLtvPerCpi,
    simD30LtvPerCpi: simD30,
    simCumLtvPerCpi,
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

export function formatLtvPerCpi(value: number): string {
  return value.toFixed(2)
}
