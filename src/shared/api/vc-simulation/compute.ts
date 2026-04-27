import type { Offer, LstmSnapshot, VcSimResult, BaselineResult, RunwayPoint } from "./types"
import { MONTE_CARLO_SAMPLES } from "./defaults"

// --- seeded RNG (mulberry32) ---
export function makeSeededRng(seed: string): () => number {
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  let s = h >>> 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function interpolateRetention(
  snapshot: LstmSnapshot,
  gameId: string,
  day: number,
  percentile: "p10" | "p50" | "p90"
): number {
  const pred = snapshot.predictions[gameId]
  if (!pred) return 0
  const pts = pred.points
  if (day <= pts[0].day) return pts[0][percentile]
  if (day >= pts[pts.length - 1].day) return pts[pts.length - 1][percentile]
  for (let i = 0; i < pts.length - 1; i++) {
    if (day >= pts[i].day && day <= pts[i + 1].day) {
      const t = (day - pts[i].day) / (pts[i + 1].day - pts[i].day)
      return pts[i][percentile] * (1 - t) + pts[i + 1][percentile] * t
    }
  }
  return pts[0][percentile]
}

type Sources = {
  gameId: string
  lstmSnapshot: LstmSnapshot
  bayesianPosterior: { deltaLtv: number } | null
  appsflyerInitialCash: number
}

type SimulationPath = {
  /** Net cash position per month. */
  cash: number[]
  /** Cumulative gross revenue per month (monotonic non-decreasing). */
  cumRevenue: number[]
}

/**
 * Pre-compute the sum of daily retention over each 30-day age window:
 *   ageWindow[k] = Σ_{d = k*30+1 .. (k+1)*30} ret(d)
 * Multiplying by monthlyInstalls × ARPDAU yields the revenue contribution
 * of a single cohort while it is `k` months old.
 */
function buildAgeWindows(
  snapshot: LstmSnapshot,
  gameId: string,
  horizonMonths: number,
): number[] {
  const windows: number[] = []
  for (let k = 0; k < horizonMonths; k++) {
    let s = 0
    for (let d = k * 30 + 1; d <= (k + 1) * 30; d++) {
      s += interpolateRetention(snapshot, gameId, d, "p50")
    }
    windows.push(s)
  }
  return windows
}

function simulateOnePath(
  offer: Offer,
  sources: Sources,
  rng: () => number,
  withExperiment: boolean,
): SimulationPath {
  const cash: number[] = []
  const cumRevenue: number[] = []
  let cumulative = sources.appsflyerInitialCash + offer.investmentUsd
  let cumRev = 0

  const uaBudgetTotal = offer.investmentUsd * (offer.uaSharePct / 100)
  const opsBudgetTotal = offer.investmentUsd * ((100 - offer.uaSharePct) / 100)
  const monthlyUa = uaBudgetTotal / offer.horizonMonths
  const monthlyOps = opsBudgetTotal / offer.horizonMonths

  // Industry CPI/ARPDAU ranges for puzzle/casual mobile games (Liftoff/AppsFlyer).
  const CPI = 2.5 + rng() * 1.0          // [$2.5, $3.5]
  const ARPDAU = 0.30 + rng() * 0.20     // [$0.30, $0.50]
  const monthlyInstalls = monthlyUa / CPI

  const expDeltaLtv =
    withExperiment && sources.bayesianPosterior ? sources.bayesianPosterior.deltaLtv : 0
  const expCostMonthly = withExperiment ? monthlyUa * 0.1 : 0
  const expEffectStartMonth = 6

  const ageWindow = buildAgeWindows(sources.lstmSnapshot, sources.gameId, offer.horizonMonths)

  cash.push(cumulative)
  cumRevenue.push(0)

  for (let t = 1; t <= offer.horizonMonths; t++) {
    // Sum revenue from every cohort installed in months 1..t.
    // A cohort installed at month c is `t - c` months old this month and
    // contributes monthlyInstalls × ageWindow[t-c] × ARPDAU × liftFactor.
    let monthRev = 0
    for (let c = 1; c <= t; c++) {
      const ageMonths = t - c
      const liftFactor = c >= expEffectStartMonth ? 1 + expDeltaLtv : 1
      monthRev += monthlyInstalls * ageWindow[ageMonths] * ARPDAU * liftFactor
    }
    const cost = monthlyUa + monthlyOps + expCostMonthly
    cumulative += monthRev - cost
    cumRev += monthRev
    cash.push(cumulative)
    cumRevenue.push(cumRev)
  }
  return { cash, cumRevenue }
}

export function computeVcSimulation(offer: Offer, sources: Sources): VcSimResult {
  const seed = JSON.stringify({ offer, gameId: sources.gameId })
  const rng = makeSeededRng(seed)

  const cashSamplesA: number[][] = []
  const revSamplesA: number[][] = []
  const cashSamplesB: number[][] = []
  const revSamplesB: number[][] = []
  for (let i = 0; i < MONTE_CARLO_SAMPLES; i++) {
    const a = simulateOnePath(offer, sources, rng, false)
    cashSamplesA.push(a.cash)
    revSamplesA.push(a.cumRevenue)
    const b = simulateOnePath(offer, sources, rng, true)
    cashSamplesB.push(b.cash)
    revSamplesB.push(b.cumRevenue)
  }

  const baselineA = buildBaseline(cashSamplesA, revSamplesA, offer)
  const baselineB = buildBaseline(cashSamplesB, revSamplesB, offer)
  const gap = baselineB.runway.map((pt, i) => pt.p50 - baselineA.runway[i].p50)
  const jCurveBreakEven = findBreakEvenMonth(gap)

  return {
    offer,
    baselineA,
    baselineB,
    gap,
    jCurveBreakEvenMonth: jCurveBreakEven,
    dataSourceBadge: "real",
  }
}

function percentile(arr: number[], p: number): number {
  const sorted = [...arr].sort((a, b) => a - b)
  const idx = Math.floor(sorted.length * p)
  return sorted[Math.min(sorted.length - 1, idx)]
}

function buildBaseline(
  cashSamples: number[][],
  revSamples: number[][],
  offer: Offer,
): BaselineResult {
  const months = cashSamples[0].length
  const runway: RunwayPoint[] = []
  const cumulativeRevenue: RunwayPoint[] = []
  for (let m = 0; m < months; m++) {
    const cashSlice = cashSamples.map((s) => s[m])
    runway.push({
      month: m,
      p10: percentile(cashSlice, 0.1),
      p50: percentile(cashSlice, 0.5),
      p90: percentile(cashSlice, 0.9),
    })
    const revSlice = revSamples.map((s) => s[m])
    cumulativeRevenue.push({
      month: m,
      p10: percentile(revSlice, 0.1),
      p50: percentile(revSlice, 0.5),
      p90: percentile(revSlice, 0.9),
    })
  }
  const irrs: number[] = []
  for (const path of cashSamples) {
    const monthlyNet = path.slice(1).map((v, i) => v - path[i])
    const flows = [-offer.investmentUsd, ...monthlyNet]
    const irr = computeIrr(flows)
    if (Number.isFinite(irr)) irrs.push(irr)
  }
  const p50Irr = irrs.length > 0 ? percentile(irrs, 0.5) : NaN
  const finalCash = percentile(
    cashSamples.map((s) => s[months - 1]),
    0.5,
  )
  const p50Moic = finalCash / offer.investmentUsd
  // Payback = first month where P50 cumulative revenue meets investment.
  // This aligns with the chart's BEP definition (revenue-based, monotonic),
  // and avoids the prior "initial cash trap" where cash[0] already exceeded
  // the threshold by virtue of appsflyerInitialCash being added at start.
  const paybackMonths = findRevenueBepMonth(revSamples, offer.investmentUsd)

  return { runway, cumulativeRevenue, irrDistribution: irrs, p50Irr, p50Moic, paybackMonths }
}

function computeIrr(flows: number[]): number {
  let rate = 0.01
  for (let iter = 0; iter < 50; iter++) {
    let npv = 0
    let dnpv = 0
    for (let t = 0; t < flows.length; t++) {
      const disc = Math.pow(1 + rate, t)
      npv += flows[t] / disc
      dnpv -= (t * flows[t]) / (disc * (1 + rate))
    }
    if (Math.abs(dnpv) < 1e-10) return NaN
    const newRate = rate - npv / dnpv
    if (Math.abs(newRate - rate) < 1e-6) return Math.pow(1 + newRate, 12) - 1
    rate = newRate
  }
  return NaN
}

/**
 * First month at which P50 cumulative gross revenue ≥ target.
 * Skips month 0 (cumulative revenue is always 0 at start).
 */
function findRevenueBepMonth(revSamples: number[][], target: number): number | null {
  const months = revSamples[0].length
  for (let m = 1; m < months; m++) {
    const p50 = percentile(
      revSamples.map((s) => s[m]),
      0.5,
    )
    if (p50 >= target) return m
  }
  return null
}

function findBreakEvenMonth(gap: number[]): number | null {
  if (gap[gap.length - 1] <= 0) return null
  if (gap[0] >= 0) return 0
  for (let i = 1; i < gap.length; i++) {
    if (gap[i - 1] < 0 && gap[i] >= 0) return i
  }
  return null
}
