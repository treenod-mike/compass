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

function simulateOnePath(
  offer: Offer,
  sources: Sources,
  rng: () => number,
  withExperiment: boolean
): number[] {
  const cashflow: number[] = []
  let cumulative = sources.appsflyerInitialCash + offer.investmentUsd

  const uaBudgetTotal = offer.investmentUsd * (offer.uaSharePct / 100)
  const opsBudgetTotal = offer.investmentUsd * ((100 - offer.uaSharePct) / 100)
  const monthlyUa = uaBudgetTotal / offer.horizonMonths
  const monthlyOps = opsBudgetTotal / offer.horizonMonths

  const CPI = 2.5 + rng() * 1.0
  const ARPDAU = 0.15 + rng() * 0.1

  const expDeltaLtv =
    withExperiment && sources.bayesianPosterior ? sources.bayesianPosterior.deltaLtv : 0
  const expCostMonthly = withExperiment ? monthlyUa * 0.1 : 0
  const expEffectStartMonth = 6

  cashflow.push(cumulative)
  for (let t = 1; t <= offer.horizonMonths; t++) {
    const installs = monthlyUa / CPI
    const liftFactor = t >= expEffectStartMonth ? 1 + expDeltaLtv : 1
    let cohortRev = 0
    for (let d = 1; d <= 30; d++) {
      const ret = interpolateRetention(sources.lstmSnapshot, sources.gameId, d, "p50")
      cohortRev += installs * ret * ARPDAU * liftFactor
    }
    const cost = monthlyUa + monthlyOps + expCostMonthly
    cumulative += cohortRev - cost
    cashflow.push(cumulative)
  }
  return cashflow
}

export function computeVcSimulation(offer: Offer, sources: Sources): VcSimResult {
  const seed = JSON.stringify({ offer, gameId: sources.gameId })
  const rng = makeSeededRng(seed)

  const samplesA: number[][] = []
  const samplesB: number[][] = []
  for (let i = 0; i < MONTE_CARLO_SAMPLES; i++) {
    samplesA.push(simulateOnePath(offer, sources, rng, false))
    samplesB.push(simulateOnePath(offer, sources, rng, true))
  }

  const baselineA = buildBaseline(samplesA, offer)
  const baselineB = buildBaseline(samplesB, offer)
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

function buildBaseline(samples: number[][], offer: Offer): BaselineResult {
  const months = samples[0].length
  const runway: RunwayPoint[] = []
  for (let m = 0; m < months; m++) {
    const slice = samples.map((s) => s[m])
    runway.push({
      month: m,
      p10: percentile(slice, 0.1),
      p50: percentile(slice, 0.5),
      p90: percentile(slice, 0.9),
    })
  }
  const irrs: number[] = []
  for (const path of samples) {
    const monthlyNet = path.slice(1).map((v, i) => v - path[i])
    const flows = [-offer.investmentUsd, ...monthlyNet]
    const irr = computeIrr(flows)
    if (Number.isFinite(irr)) irrs.push(irr)
  }
  const p50Irr = irrs.length > 0 ? percentile(irrs, 0.5) : NaN
  const finalCash = percentile(
    samples.map((s) => s[months - 1]),
    0.5
  )
  const p50Moic = finalCash / offer.investmentUsd
  const paybackMonths = findPaybackMonth(samples, offer.investmentUsd)

  return { runway, irrDistribution: irrs, p50Irr, p50Moic, paybackMonths }
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

function findPaybackMonth(samples: number[][], initial: number): number | null {
  const target = initial
  const months = samples[0].length
  for (let m = 0; m < months; m++) {
    const p50 = percentile(
      samples.map((s) => s[m]),
      0.5
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
