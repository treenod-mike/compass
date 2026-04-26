import { describe, it, expect } from "vitest"
import { computeMarketingSim, interpolateRetention } from "../compute"
import type { MarketingSimInput, RetentionKeypoint } from "../types"

const realisticKeypoints: RetentionKeypoint[] = [
  { day: 1, p10: 0.38, p50: 0.45, p90: 0.52 },
  { day: 7, p10: 0.18, p50: 0.23, p90: 0.28 },
  { day: 30, p10: 0.08, p50: 0.11, p90: 0.15 },
  { day: 90, p10: 0.04, p50: 0.06, p90: 0.08 },
]

const baseInput: MarketingSimInput = {
  uaBudgetUsdPerDay: 1000,
  cpiUsd: 4.0,
  retentionKeypoints: realisticKeypoints,
  targetArpdauUsd: 0.55,
  horizonDays: 90,
}

describe("interpolateRetention", () => {
  it("returns exact value at a keypoint", () => {
    const r = interpolateRetention(realisticKeypoints, 7)
    expect(r.p50).toBeCloseTo(0.23, 5)
  })

  it("interpolates log-linearly between two keypoints", () => {
    // Between day 1 (0.45) and day 7 (0.23) — geometric midpoint sqrt(7) ≈ 2.65
    // log(2.65) / log(7) ≈ 0.5
    const r = interpolateRetention(realisticKeypoints, Math.round(Math.sqrt(7)))
    expect(r.p50).toBeGreaterThan(0.23)
    expect(r.p50).toBeLessThan(0.45)
  })

  it("clamps to last keypoint when day > max", () => {
    const r = interpolateRetention(realisticKeypoints, 365)
    expect(r.p50).toBeCloseTo(0.06, 5)
  })

  it("returns single keypoint value when only one provided", () => {
    const single: RetentionKeypoint[] = [{ day: 7, p10: 0.2, p50: 0.25, p90: 0.3 }]
    const r = interpolateRetention(single, 30)
    expect(r.p50).toBe(0.25)
  })

  it("preserves band ordering P10 <= P50 <= P90", () => {
    for (const day of [1, 5, 14, 30, 60, 90]) {
      const r = interpolateRetention(realisticKeypoints, day)
      expect(r.p10).toBeLessThanOrEqual(r.p50)
      expect(r.p50).toBeLessThanOrEqual(r.p90)
    }
  })

  it("throws on empty keypoints", () => {
    expect(() => interpolateRetention([], 1)).toThrow()
  })

  it("throws on non-positive day", () => {
    expect(() => interpolateRetention(realisticKeypoints, 0)).toThrow()
    expect(() => interpolateRetention(realisticKeypoints, -1)).toThrow()
  })
})

describe("computeMarketingSim — basic shape", () => {
  it("computes installsPerDay = budget / CPI", () => {
    const r = computeMarketingSim(baseInput)
    expect(r.installsPerDay).toBeCloseTo(250, 5)
  })

  it("emits one row per horizon day", () => {
    const r = computeMarketingSim({ ...baseInput, horizonDays: 30 })
    expect(r.daily).toHaveLength(30)
    expect(r.daily[0].day).toBe(1)
    expect(r.daily[29].day).toBe(30)
  })

  it("cumulativeSpend = budget × day", () => {
    const r = computeMarketingSim(baseInput)
    expect(r.daily[6].cumulativeSpend).toBeCloseTo(7000, 5)
    expect(r.daily[29].cumulativeSpend).toBeCloseTo(30000, 5)
  })

  it("preserves band ordering on revenue and ROAS for every day", () => {
    const r = computeMarketingSim(baseInput)
    for (const p of r.daily) {
      expect(p.revenueP10).toBeLessThanOrEqual(p.revenueP50)
      expect(p.revenueP50).toBeLessThanOrEqual(p.revenueP90)
      expect(p.roasP10).toBeLessThanOrEqual(p.roasP50)
      expect(p.roasP50).toBeLessThanOrEqual(p.roasP90)
    }
  })

  it("DAU is monotonically non-decreasing as cohorts accumulate", () => {
    const r = computeMarketingSim(baseInput)
    for (let i = 1; i < r.daily.length; i++) {
      expect(r.daily[i].dauP50).toBeGreaterThanOrEqual(r.daily[i - 1].dauP50 - 1e-6)
    }
  })

  it("totalRevenueP50 = sum of daily revenueP50", () => {
    const r = computeMarketingSim({ ...baseInput, horizonDays: 30 })
    const sum = r.daily.reduce((acc, p) => acc + p.revenueP50, 0)
    expect(r.totalRevenueP50).toBeCloseTo(sum, 5)
  })
})

describe("computeMarketingSim — payback day", () => {
  it("finds payback day on the first day ROAS_p50 >= 1", () => {
    // Construct a degenerate case: huge ARPDAU so payback happens day 1
    const r = computeMarketingSim({ ...baseInput, targetArpdauUsd: 100 })
    expect(r.paybackDayP50).toBe(1)
    expect(r.daily[0].roasP50).toBeGreaterThanOrEqual(1)
  })

  it("returns null when ROAS_p50 never reaches 1", () => {
    // Tiny ARPDAU + short horizon → ROAS never crosses
    const r = computeMarketingSim({
      ...baseInput,
      targetArpdauUsd: 0.001,
      horizonDays: 30,
    })
    expect(r.paybackDayP50).toBeNull()
  })

  it("paybackDayP90 ≤ paybackDayP50 ≤ paybackDayP10 (when all defined)", () => {
    const r = computeMarketingSim({ ...baseInput, targetArpdauUsd: 5 })
    if (r.paybackDayP90 !== null && r.paybackDayP10 !== null && r.paybackDayP50 !== null) {
      expect(r.paybackDayP90).toBeLessThanOrEqual(r.paybackDayP50)
      expect(r.paybackDayP50).toBeLessThanOrEqual(r.paybackDayP10)
    }
  })
})

describe("computeMarketingSim — boundaries & invariants", () => {
  it("budget = 0 → installs = 0, all revenue = 0, payback = null", () => {
    const r = computeMarketingSim({ ...baseInput, uaBudgetUsdPerDay: 0 })
    expect(r.installsPerDay).toBe(0)
    expect(r.daily.every((p) => p.revenueP50 === 0)).toBe(true)
    expect(r.paybackDayP50).toBeNull()
    expect(r.daily.every((p) => p.cumulativeSpend === 0)).toBe(true)
  })

  it("CPI = 0 throws", () => {
    expect(() => computeMarketingSim({ ...baseInput, cpiUsd: 0 })).toThrow()
  })

  it("CPI < 0 throws", () => {
    expect(() => computeMarketingSim({ ...baseInput, cpiUsd: -1 })).toThrow()
  })

  it("ARPDAU = 0 → revenue = 0, payback = null", () => {
    const r = computeMarketingSim({ ...baseInput, targetArpdauUsd: 0 })
    expect(r.daily.every((p) => p.revenueP50 === 0)).toBe(true)
    expect(r.paybackDayP50).toBeNull()
  })

  it("horizonDays < 1 throws", () => {
    expect(() => computeMarketingSim({ ...baseInput, horizonDays: 0 })).toThrow()
  })

  it("horizonDays > 365 throws", () => {
    expect(() => computeMarketingSim({ ...baseInput, horizonDays: 366 })).toThrow()
  })

  it("non-integer horizonDays throws", () => {
    expect(() => computeMarketingSim({ ...baseInput, horizonDays: 30.5 })).toThrow()
  })

  it("empty retentionKeypoints throws", () => {
    expect(() => computeMarketingSim({ ...baseInput, retentionKeypoints: [] })).toThrow()
  })

  it("day30RoasP50 = null when horizon < 30", () => {
    const r = computeMarketingSim({ ...baseInput, horizonDays: 14 })
    expect(r.day30RoasP50).toBeNull()
  })

  it("day30RoasP50 = roasP50 of day 30 when horizon ≥ 30", () => {
    const r = computeMarketingSim({ ...baseInput, horizonDays: 90 })
    const d30 = r.daily.find((p) => p.day === 30)!
    expect(r.day30RoasP50).toBe(d30.roasP50)
  })
})
