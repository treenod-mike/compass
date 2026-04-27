import type { CohortSummary } from "../appsflyer/types"
import type { EmpiricalDist } from "../../lib/bayesian-stats"
import { retentionForecast, type RetentionForecastPoint } from "../../lib/bayesian-stats/retention"
import { estimateArpdau } from "./arpdau"

export type RevenueForecastPoint = {
  day: number
  dauP50: number
  revenueP10: number
  revenueP50: number
  revenueP90: number
}

export type ForecastResult = {
  retentionCurve: RetentionForecastPoint[]
  revenueForecast: RevenueForecastPoint[]
  arpdauUsd: number
  installsAssumption: number
  effectiveDays: number
}

const RETENTION_MAX_DAY = 1095
const DEFAULT_HORIZON = 365
const ARPDAU_WINDOW = 14

export function buildGameForecast(args: {
  cohortSummary: CohortSummary
  appsMeta: { appId: string; genre: string; region: string }
  prior: { d1: EmpiricalDist; d7: EmpiricalDist; d30: EmpiricalDist }
  priorEffectiveN: number
  horizonDays?: number
}): ForecastResult {
  const { cohortSummary, prior, priorEffectiveN } = args
  const horizonDays = args.horizonDays ?? DEFAULT_HORIZON

  const observations = aggregateBinomialObs(cohortSummary)

  const retentionCurve = retentionForecast({
    observations,
    priors: prior,
    priorEffectiveN,
    maxDay: RETENTION_MAX_DAY,
  })

  const { arpdauUsd, effectiveDays } = estimateArpdau({
    revenueDaily: cohortSummary.revenue.daily,
    cohorts: cohortSummary.cohorts,
    windowDays: ARPDAU_WINDOW,
  })

  const installsAssumption = trailingMeanInstalls(cohortSummary, ARPDAU_WINDOW)

  const revenueForecast = buildRevenueForecast({
    retentionCurve,
    arpdauUsd,
    installsAssumption,
    horizonDays,
  })

  return { retentionCurve, revenueForecast, arpdauUsd, installsAssumption, effectiveDays }
}

function aggregateBinomialObs(summary: CohortSummary) {
  let n_d1 = 0, k_d1 = 0
  let n_d7 = 0, k_d7 = 0
  let n_d30 = 0, k_d30 = 0
  for (const c of summary.cohorts) {
    if (c.retainedByDay.d1 !== null) {
      n_d1 += c.installs
      k_d1 += c.retainedByDay.d1
    }
    if (c.retainedByDay.d7 !== null) {
      n_d7 += c.installs
      k_d7 += c.retainedByDay.d7
    }
    if (c.retainedByDay.d30 !== null) {
      n_d30 += c.installs
      k_d30 += c.retainedByDay.d30
    }
  }
  return {
    d1: { n: n_d1, k: k_d1 },
    d7: { n: n_d7, k: k_d7 },
    d30: { n: n_d30, k: k_d30 },
  }
}

function trailingMeanInstalls(summary: CohortSummary, windowDays: number): number {
  const last = summary.cohorts.slice(-windowDays)
  if (last.length === 0) return 0
  const sum = last.reduce((s, c) => s + c.installs, 0)
  return sum / last.length
}

function buildRevenueForecast(args: {
  retentionCurve: RetentionForecastPoint[]
  arpdauUsd: number
  installsAssumption: number
  horizonDays: number
}): RevenueForecastPoint[] {
  const { retentionCurve, arpdauUsd, installsAssumption, horizonDays } = args
  // day starts at 1 to satisfy RevenueSnapshotSchema's `day: positive int` and
  // `points.max(365)`. Total points = horizonDays (default 365).
  const out: RevenueForecastPoint[] = []
  for (let t = 1; t <= horizonDays; t++) {
    let dauP10 = 0, dauP50 = 0, dauP90 = 0
    const maxAge = Math.min(t, retentionCurve.length)
    for (let age = 0; age <= maxAge; age++) {
      if (age === 0) {
        dauP10 += installsAssumption
        dauP50 += installsAssumption
        dauP90 += installsAssumption
        continue
      }
      const r = retentionCurve[age - 1]!
      dauP10 += installsAssumption * r.p10
      dauP50 += installsAssumption * r.p50
      dauP90 += installsAssumption * r.p90
    }
    let p10 = dauP10 * arpdauUsd
    let p50 = dauP50 * arpdauUsd
    let p90 = dauP90 * arpdauUsd
    if (p10 > p50) p10 = p50
    if (p90 < p50) p90 = p50
    out.push({ day: t, dauP50, revenueP10: p10, revenueP50: p50, revenueP90: p90 })
  }
  return out
}
