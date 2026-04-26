import type {
  MarketingSimDayPoint,
  MarketingSimInput,
  MarketingSimResult,
  RetentionBand,
  RetentionKeypoint,
} from "./types"

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function interpolateRetention(
  keypoints: RetentionKeypoint[],
  day: number,
): RetentionBand {
  if (keypoints.length === 0) {
    throw new Error("interpolateRetention: keypoints array is empty")
  }
  if (day <= 0) {
    throw new Error(`interpolateRetention: day must be positive (got ${day})`)
  }

  const sorted = [...keypoints].sort((a, b) => a.day - b.day)

  if (day <= sorted[0].day) {
    if (day === sorted[0].day || sorted[0].day === 0) {
      const k = sorted[0]
      return { p10: k.p10, p50: k.p50, p90: k.p90 }
    }
    // Below first keypoint: log-linear from (1, 1.0) anchor — install-day baseline
    const k = sorted[0]
    if (k.day <= 1) {
      return { p10: k.p10, p50: k.p50, p90: k.p90 }
    }
    const t = Math.log(day) / Math.log(k.day)
    return {
      p10: lerp(1.0, k.p10, t),
      p50: lerp(1.0, k.p50, t),
      p90: lerp(1.0, k.p90, t),
    }
  }

  if (day >= sorted[sorted.length - 1].day) {
    const k = sorted[sorted.length - 1]
    return { p10: k.p10, p50: k.p50, p90: k.p90 }
  }

  let lo = sorted[0]
  let hi = sorted[1]
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i].day <= day && day <= sorted[i + 1].day) {
      lo = sorted[i]
      hi = sorted[i + 1]
      break
    }
  }

  const logDay = Math.log(day)
  const logLo = Math.log(lo.day)
  const logHi = Math.log(hi.day)
  const t = (logDay - logLo) / (logHi - logLo)

  return {
    p10: lerp(lo.p10, hi.p10, t),
    p50: lerp(lo.p50, hi.p50, t),
    p90: lerp(lo.p90, hi.p90, t),
  }
}

function findPaybackDay(
  daily: MarketingSimDayPoint[],
  key: "roasP10" | "roasP50" | "roasP90",
): number | null {
  for (const p of daily) {
    if (p[key] >= 1) return p.day
  }
  return null
}

export function computeMarketingSim(input: MarketingSimInput): MarketingSimResult {
  if (input.cpiUsd <= 0) throw new Error("CPI must be positive")
  if (input.uaBudgetUsdPerDay < 0) throw new Error("UA budget cannot be negative")
  if (input.targetArpdauUsd < 0) throw new Error("ARPDAU cannot be negative")
  if (!Number.isInteger(input.horizonDays) || input.horizonDays < 1 || input.horizonDays > 365) {
    throw new Error("horizonDays must be an integer in [1, 365]")
  }
  if (input.retentionKeypoints.length === 0) {
    throw new Error("retentionKeypoints cannot be empty")
  }

  const installsPerDay = input.uaBudgetUsdPerDay / input.cpiUsd
  const spendPerDay = input.uaBudgetUsdPerDay

  // Precompute cumulative retention so DAU(t) is O(1) lookup.
  // cumulative_retention(t) = 1 + Σ_{a=1..t} retention(a)
  // The leading 1 is the day-0 cohort baseline (install day = 100%).
  const cumRetentionP10: number[] = [1]
  const cumRetentionP50: number[] = [1]
  const cumRetentionP90: number[] = [1]
  for (let a = 1; a <= input.horizonDays; a++) {
    const r = interpolateRetention(input.retentionKeypoints, a)
    cumRetentionP10.push(cumRetentionP10[a - 1] + r.p10)
    cumRetentionP50.push(cumRetentionP50[a - 1] + r.p50)
    cumRetentionP90.push(cumRetentionP90[a - 1] + r.p90)
  }

  const daily: MarketingSimDayPoint[] = []
  let cumP10 = 0,
    cumP50 = 0,
    cumP90 = 0

  for (let t = 1; t <= input.horizonDays; t++) {
    const dauP10 = installsPerDay * cumRetentionP10[t]
    const dauP50 = installsPerDay * cumRetentionP50[t]
    const dauP90 = installsPerDay * cumRetentionP90[t]

    const revP10 = dauP10 * input.targetArpdauUsd
    const revP50 = dauP50 * input.targetArpdauUsd
    const revP90 = dauP90 * input.targetArpdauUsd

    cumP10 += revP10
    cumP50 += revP50
    cumP90 += revP90

    const cumSpend = spendPerDay * t

    daily.push({
      day: t,
      dauP10,
      dauP50,
      dauP90,
      revenueP10: revP10,
      revenueP50: revP50,
      revenueP90: revP90,
      cumulativeRevenueP10: cumP10,
      cumulativeRevenueP50: cumP50,
      cumulativeRevenueP90: cumP90,
      cumulativeSpend: cumSpend,
      roasP10: cumSpend > 0 ? cumP10 / cumSpend : 0,
      roasP50: cumSpend > 0 ? cumP50 / cumSpend : 0,
      roasP90: cumSpend > 0 ? cumP90 / cumSpend : 0,
    })
  }

  const day30Point = daily.find((p) => p.day === 30)

  return {
    installsPerDay,
    spendPerDay,
    daily,
    paybackDayP10: findPaybackDay(daily, "roasP10"),
    paybackDayP50: findPaybackDay(daily, "roasP50"),
    paybackDayP90: findPaybackDay(daily, "roasP90"),
    totalRevenueP50: cumP50,
    day30RoasP50: day30Point ? day30Point.roasP50 : null,
  }
}
