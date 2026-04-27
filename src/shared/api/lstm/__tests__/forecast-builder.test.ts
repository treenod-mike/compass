import { describe, it, expect } from "vitest"
import { buildGameForecast } from "../forecast-builder"
import type { CohortSummary } from "../../appsflyer/types"
import type { EmpiricalDist } from "../../../lib/bayesian-stats"

const PRIOR: { d1: EmpiricalDist; d7: EmpiricalDist; d30: EmpiricalDist } = {
  d1: { p10: 0.4, p50: 0.55, p90: 0.65 },
  d7: { p10: 0.18, p50: 0.28, p90: 0.38 },
  d30: { p10: 0.06, p50: 0.11, p90: 0.18 },
}

const realisticSummary: CohortSummary = {
  updatedAt: "2026-04-26T00:00:00Z",
  cohorts: Array.from({ length: 32 }, (_, i) => ({
    cohortDate: `2026-03-${String((i % 30) + 1).padStart(2, "0")}`,
    installs: 800,
    retainedByDay: { d1: 480, d7: 240, d30: 96 },
    uaSpendUsd: null,
  })),
  revenue: {
    daily: Array.from({ length: 14 }, (_, i) => ({
      date: `2026-04-${String(i + 1).padStart(2, "0")}`,
      sumUsd: 4500,
      purchasers: 120,
    })),
    total: { sumUsd: 14 * 4500, purchasers: 14 * 120 },
  },
  spend: { totalUsd: null, homeCurrency: "USD" },
}

describe("buildGameForecast", () => {
  it("produces 1095-day retention curve and 365-point revenue forecast (day 1..365)", () => {
    const r = buildGameForecast({
      cohortSummary: realisticSummary,
      appsMeta: { appId: "x", genre: "Merge", region: "JP" },
      prior: PRIOR,
      priorEffectiveN: 30,
    })
    expect(r.retentionCurve.length).toBe(1095)
    expect(r.revenueForecast.length).toBe(365)
    expect(r.revenueForecast[0]!.day).toBe(1)
    expect(r.revenueForecast[364]!.day).toBe(365)
    expect(r.arpdauUsd).toBeGreaterThan(0)
    expect(r.installsAssumption).toBe(800)
  })

  it("enforces P10 ≤ P50 ≤ P90 at every retention point", () => {
    const r = buildGameForecast({
      cohortSummary: realisticSummary,
      appsMeta: { appId: "x", genre: "Merge", region: "JP" },
      prior: PRIOR,
      priorEffectiveN: 30,
    })
    for (const pt of r.retentionCurve) {
      expect(pt.p10).toBeLessThanOrEqual(pt.p50)
      expect(pt.p50).toBeLessThanOrEqual(pt.p90)
    }
  })

  it("enforces P10 ≤ P50 ≤ P90 at every revenue point", () => {
    const r = buildGameForecast({
      cohortSummary: realisticSummary,
      appsMeta: { appId: "x", genre: "Merge", region: "JP" },
      prior: PRIOR,
      priorEffectiveN: 30,
    })
    for (const pt of r.revenueForecast) {
      expect(pt.revenueP10).toBeLessThanOrEqual(pt.revenueP50)
      expect(pt.revenueP50).toBeLessThanOrEqual(pt.revenueP90)
    }
  })

  it("returns arpdau=0 and zeroed revenue forecast when no revenue (does not throw)", () => {
    const noRevenue: CohortSummary = {
      ...realisticSummary,
      revenue: {
        daily: Array.from({ length: 14 }, (_, i) => ({
          date: `2026-04-${String(i + 1).padStart(2, "0")}`,
          sumUsd: 0,
          purchasers: 0,
        })),
        total: { sumUsd: 0, purchasers: 0 },
      },
    }
    const r = buildGameForecast({
      cohortSummary: noRevenue,
      appsMeta: { appId: "x", genre: "Merge", region: "JP" },
      prior: PRIOR,
      priorEffectiveN: 30,
    })
    expect(r.arpdauUsd).toBe(0)
    expect(r.revenueForecast.every((p) => p.revenueP50 === 0)).toBe(true)
  })
})
