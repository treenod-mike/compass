// src/shared/api/composite/__tests__/roas-payback.test.ts
// 19 cases pinned to spec §5 (algorithm) and §6 (status machine).
// Numerical assertions are derived inline above each non-trivial expectation
// so future regressions can be debugged without reverse-engineering the
// curve constants.
import { describe, expect, it } from "vitest"
import type { CohortSummary } from "../../appsflyer"
import type { RevenueSnapshot } from "../../lstm/revenue-snapshot"
import { computeRealKpi } from "../roas-payback"
import type { RealKpiInput } from "../types"

const MOCK_FALLBACK: RealKpiInput["mockFallback"] = {
  roas: { p10: 100, p50: 142, p90: 180 },
  payback: { p10: 35, p50: 47, p90: 62 },
}

const NOW = new Date("2026-04-27T00:00:00Z")

function makeSnapshot(opts: {
  generatedDaysAgo?: number
  gameId?: string
  installsAssumption?: number
  curve?: (d: number) => { p10: number; p50: number; p90: number }
  horizon?: number
} = {}): RevenueSnapshot {
  const generatedAt = new Date(NOW.getTime() - (opts.generatedDaysAgo ?? 1) * 86_400_000).toISOString()
  const gameId = opts.gameId ?? "poco"
  const installsAssumption = opts.installsAssumption ?? 1000
  const horizon = opts.horizon ?? 365
  const curve = opts.curve ?? ((d: number) => ({
    p10: 8 * d * 0.8,
    p50: 8 * d,
    p90: 8 * d * 1.2,
  }))
  const points = Array.from({ length: horizon }, (_, i) => {
    const d = i + 1
    const c = curve(d)
    return {
      day: d,
      dauP50: 100,
      revenueP10: c.p10,
      revenueP50: c.p50,
      revenueP90: c.p90,
    }
  })
  return {
    schema_version: "1.0",
    generated_at: generatedAt,
    source_retention_at: generatedAt,
    arpdau: { perGame: { [gameId]: 0.4 }, currency: "USD", windowDays: 14 },
    installsAssumption: { perGame: { [gameId]: installsAssumption }, method: "trailing-14d-mean" },
    forecast: { [gameId]: { points } },
  }
}

function makeCohortSummary(opts: {
  installs?: number
  spendUsd?: number | null
  observedRevenueUsd?: number
  basisDays?: number
} = {}): CohortSummary {
  const installs = opts.installs ?? 1000
  // Use === undefined check so explicit `spendUsd: null` (fxUnsupported case) is preserved.
  const spendUsd = opts.spendUsd === undefined ? 2500 : opts.spendUsd
  const observedRevenueUsd = opts.observedRevenueUsd ?? 200
  const basisDays = opts.basisDays ?? 14
  const cohortDate = new Date(NOW.getTime() - basisDays * 86_400_000).toISOString().slice(0, 10)
  return {
    updatedAt: NOW.toISOString(),
    cohorts: [
      {
        cohortDate,
        installs,
        retainedByDay: { d1: null, d7: null, d30: null },
        uaSpendUsd: spendUsd,
      },
    ],
    revenue: {
      daily: [],
      total: { sumUsd: observedRevenueUsd, purchasers: Math.floor(installs * 0.05) },
    },
    spend: {
      totalUsd: spendUsd,
      homeCurrency: spendUsd === null ? "JPY" : "USD",
    },
  }
}

describe("computeRealKpi — status gating", () => {
  it("returns mock + ML1 when cohortSummary is null", () => {
    const r = computeRealKpi({
      gameId: "poco",
      cohortSummary: null,
      revenueSnapshot: makeSnapshot(),
      mockFallback: MOCK_FALLBACK,
      now: NOW,
    })
    expect(r.status).toBe("mock")
    expect(r.freshness).toBe("ML1")
    expect(r.roas).toEqual(MOCK_FALLBACK.roas)
    expect(r.payback).toEqual(MOCK_FALLBACK.payback)
  })

  it("returns fxUnsupported + ML2 when spend.totalUsd is null", () => {
    const r = computeRealKpi({
      gameId: "poco",
      cohortSummary: makeCohortSummary({ spendUsd: null }),
      revenueSnapshot: makeSnapshot(),
      mockFallback: MOCK_FALLBACK,
      now: NOW,
    })
    expect(r.status).toBe("fxUnsupported")
    expect(r.freshness).toBe("ML2")
    expect(r.spendUsd).toBeNull()
  })

  it("returns insufficient + ML1 when basisDays < 14", () => {
    const r = computeRealKpi({
      gameId: "poco",
      cohortSummary: makeCohortSummary({ basisDays: 7 }),
      revenueSnapshot: makeSnapshot(),
      mockFallback: MOCK_FALLBACK,
      now: NOW,
    })
    expect(r.status).toBe("insufficient")
    expect(r.freshness).toBe("ML1")
    expect(r.basisDays).toBe(7)
  })

  it("returns mock + ML2 when snapshot is stale (>7d)", () => {
    const r = computeRealKpi({
      gameId: "poco",
      cohortSummary: makeCohortSummary(),
      revenueSnapshot: makeSnapshot({ generatedDaysAgo: 8 }),
      mockFallback: MOCK_FALLBACK,
      now: NOW,
    })
    expect(r.status).toBe("mock")
    expect(r.freshness).toBe("ML2")
  })

  it("returns mock + ML2 when forecast for gameId is missing", () => {
    const r = computeRealKpi({
      gameId: "missing-game",
      cohortSummary: makeCohortSummary(),
      revenueSnapshot: makeSnapshot({ gameId: "poco" }),
      mockFallback: MOCK_FALLBACK,
      now: NOW,
    })
    expect(r.status).toBe("mock")
    expect(r.freshness).toBe("ML2")
  })

  it("returns insufficient + ML1 when installs is 0", () => {
    const r = computeRealKpi({
      gameId: "poco",
      cohortSummary: makeCohortSummary({ installs: 0, spendUsd: 0 }),
      revenueSnapshot: makeSnapshot(),
      mockFallback: MOCK_FALLBACK,
      now: NOW,
    })
    expect(r.status).toBe("insufficient")
    expect(r.freshness).toBe("ML1")
  })

  it("returns real + null badge when all gates pass", () => {
    const r = computeRealKpi({
      gameId: "poco",
      cohortSummary: makeCohortSummary({ installs: 1000, spendUsd: 2500, observedRevenueUsd: 200, basisDays: 14 }),
      revenueSnapshot: makeSnapshot({ installsAssumption: 1000 }),
      mockFallback: MOCK_FALLBACK,
      now: NOW,
    })
    expect(r.status).toBe("real")
    expect(r.freshness).toBeNull()
  })
})

describe("computeRealKpi — splice continuity", () => {
  const flatCurve = () => ({ p10: 0.8, p50: 1.0, p90: 1.2 })

  // Use spendUsd=300 so cpi=0.3 and the splice (observed 0.2 + flat tail) reaches it
  // around d=114 → status='real' → observedRevenueUsd is forwarded verbatim.
  it("observedRevenueUsd is preserved verbatim from cohortSummary", () => {
    const r = computeRealKpi({
      gameId: "poco",
      cohortSummary: makeCohortSummary({ installs: 1000, spendUsd: 300, observedRevenueUsd: 200, basisDays: 14 }),
      revenueSnapshot: makeSnapshot({ installsAssumption: 1000, curve: flatCurve }),
      mockFallback: MOCK_FALLBACK,
      now: NOW,
    })
    expect(r.observedRevenueUsd).toBe(200)
  })

  // spendUsd=300 → cpi=0.3, status='real' (firstHit P50 ≈ 114).
  // observedPerInstall = 200 / 1000 = 0.2
  // cumPerInstall(365, P50) = 0.2 + Σ_{k=15..365} 1.0 × (1/1000) = 0.2 + 351 × 0.001 = 0.551
  // forecastRevenueUsd = (0.551 − 0.2) × 1000 = 351
  it("forecastRevenueUsd equals (cumPerInstall(horizon, P50) − observedPerInstall) × installs", () => {
    const r = computeRealKpi({
      gameId: "poco",
      cohortSummary: makeCohortSummary({ installs: 1000, spendUsd: 300, observedRevenueUsd: 200, basisDays: 14 }),
      revenueSnapshot: makeSnapshot({ installsAssumption: 1000, curve: flatCurve, horizon: 365 }),
      mockFallback: MOCK_FALLBACK,
      now: NOW,
    })
    expect(r.forecastRevenueUsd).toBeCloseTo(351, 1)
  })

  // basisDays===horizon means cum(d) = observedPerInstall × (d/365) for all d (no forecast tail).
  // spendUsd=300 → cpi=0.3, observedPerInstall=0.5 → first hit at d≈219 → status='real'.
  // forecastRevenueUsd = cum(365, P50) × 1000 − observedRev = 0.5 × 1000 − 500 = 0.
  it("when basisDays === horizon, no forecast tail is added (forecastRevenueUsd ≈ 0)", () => {
    const r = computeRealKpi({
      gameId: "poco",
      cohortSummary: makeCohortSummary({ installs: 1000, spendUsd: 300, observedRevenueUsd: 500, basisDays: 365 }),
      revenueSnapshot: makeSnapshot({ installsAssumption: 1000, curve: flatCurve, horizon: 365 }),
      mockFallback: MOCK_FALLBACK,
      now: NOW,
    })
    expect(r.status).toBe("real")
    expect(r.forecastRevenueUsd).toBeCloseTo(0, 1)
  })

  // spend=600, observedRev=600, installs=1000 → cpi = 0.6, observedPerInstall = 0.6
  // cumPerInstall(365, P50) = 0.6 + (365 − 14) × 0.001 = 0.951
  // roas.p50 = 0.951 / 0.6 × 100 = 158.5%
  it("ROAS scales linearly with cumulative-revenue / spend", () => {
    const r = computeRealKpi({
      gameId: "poco",
      cohortSummary: makeCohortSummary({ installs: 1000, spendUsd: 600, observedRevenueUsd: 600, basisDays: 14 }),
      revenueSnapshot: makeSnapshot({ installsAssumption: 1000, curve: flatCurve }),
      mockFallback: MOCK_FALLBACK,
      now: NOW,
    })
    expect(r.roas.p50).toBeCloseTo(158.5, 1)
  })
})

describe("computeRealKpi — inverted band mapping", () => {
  const split = () => ({ p10: 0.5, p50: 1.0, p90: 2.0 })

  it("observed revenue > 0 yields shorter payback than the zero-observed equivalent (splice baseline)", () => {
    const withObserved = computeRealKpi({
      gameId: "poco",
      cohortSummary: makeCohortSummary({ installs: 1000, spendUsd: 100, observedRevenueUsd: 50, basisDays: 14 }),
      revenueSnapshot: makeSnapshot({ installsAssumption: 1000, curve: split }),
      mockFallback: MOCK_FALLBACK,
      now: NOW,
    })
    const zeroObserved = computeRealKpi({
      gameId: "poco",
      cohortSummary: makeCohortSummary({ installs: 1000, spendUsd: 100, observedRevenueUsd: 0, basisDays: 14 }),
      revenueSnapshot: makeSnapshot({ installsAssumption: 1000, curve: split }),
      mockFallback: MOCK_FALLBACK,
      now: NOW,
    })
    expect(withObserved.status).toBe("real")
    expect(zeroObserved.status).toBe("real")
    expect(withObserved.payback.p50).toBeLessThan(zeroObserved.payback.p50)
  })

  // cpi = spend / installs = 100 / 1000 = 0.1; observedRev = 0
  // split curve per-install daily: P10 = 0.0005, P50 = 0.001, P90 = 0.002 (since N = 1000)
  // cum(d, P90) ≥ 0.1 → (d − 14) × 0.002 ≥ 0.1 → d − 14 ≥ 50 → d = 64 → payback.p10 = 64
  // cum(d, P50) ≥ 0.1 → (d − 14) × 0.001 ≥ 0.1 → d − 14 ≥ 100 → d = 114 → payback.p50 = 114
  // cum(d, P10) ≥ 0.1 → (d − 14) × 0.0005 ≥ 0.1 → d − 14 ≥ 200 → d = 214 → payback.p90 = 214
  it("payback.p50 with mid curve sits between p10 and p90", () => {
    const r = computeRealKpi({
      gameId: "poco",
      cohortSummary: makeCohortSummary({ installs: 1000, spendUsd: 100, observedRevenueUsd: 0, basisDays: 14 }),
      revenueSnapshot: makeSnapshot({ installsAssumption: 1000, curve: split }),
      mockFallback: MOCK_FALLBACK,
      now: NOW,
    })
    expect(r.payback.p10).toBe(64)
    expect(r.payback.p50).toBe(114)
    expect(r.payback.p90).toBe(214)
  })

  it("revenue.P10 always maps to payback.p90 (slowest)", () => {
    const r = computeRealKpi({
      gameId: "poco",
      cohortSummary: makeCohortSummary({ installs: 1000, spendUsd: 100, observedRevenueUsd: 0, basisDays: 14 }),
      revenueSnapshot: makeSnapshot({ installsAssumption: 1000, curve: split }),
      mockFallback: MOCK_FALLBACK,
      now: NOW,
    })
    expect(r.payback.p90).toBeGreaterThan(r.payback.p50)
    expect(r.payback.p50).toBeGreaterThan(r.payback.p10)
  })
})

describe("computeRealKpi — payback misses horizon", () => {
  const tooSlow = () => ({ p10: 0.0001, p50: 0.0002, p90: 0.001 })

  it("demotes to insufficient when P50 misses horizon", () => {
    const r = computeRealKpi({
      gameId: "poco",
      cohortSummary: makeCohortSummary({ installs: 1000, spendUsd: 10_000, observedRevenueUsd: 0, basisDays: 14 }),
      revenueSnapshot: makeSnapshot({ installsAssumption: 1000, curve: tooSlow }),
      mockFallback: MOCK_FALLBACK,
      now: NOW,
    })
    expect(r.status).toBe("insufficient")
    expect(r.payback).toEqual(MOCK_FALLBACK.payback)
  })

  it("caps payback.p90 at horizon when only P10 misses", () => {
    const onlyP10Slow = () => ({ p10: 0.0001, p50: 1.0, p90: 2.0 })
    const r = computeRealKpi({
      gameId: "poco",
      cohortSummary: makeCohortSummary({ installs: 1000, spendUsd: 100, observedRevenueUsd: 0, basisDays: 14 }),
      revenueSnapshot: makeSnapshot({ installsAssumption: 1000, curve: onlyP10Slow }),
      mockFallback: MOCK_FALLBACK,
      now: NOW,
    })
    expect(r.status).toBe("real")
    expect(r.payback.p90).toBe(365)
  })
})

describe("computeRealKpi — zero edge cases", () => {
  it("returns insufficient when spend === 0", () => {
    const r = computeRealKpi({
      gameId: "poco",
      cohortSummary: makeCohortSummary({ installs: 1000, spendUsd: 0 }),
      revenueSnapshot: makeSnapshot(),
      mockFallback: MOCK_FALLBACK,
      now: NOW,
    })
    expect(r.status).toBe("insufficient")
  })

  it("returns insufficient when installs === 0 (avoids divide-by-zero)", () => {
    const r = computeRealKpi({
      gameId: "poco",
      cohortSummary: makeCohortSummary({ installs: 0, spendUsd: 100 }),
      revenueSnapshot: makeSnapshot(),
      mockFallback: MOCK_FALLBACK,
      now: NOW,
    })
    expect(r.status).toBe("insufficient")
    expect(r.roas).toEqual(MOCK_FALLBACK.roas)
  })
})

describe("computeRealKpi — mockFallback pass-through", () => {
  it("returns mockFallback values verbatim for every non-real status", () => {
    const customFallback: RealKpiInput["mockFallback"] = {
      roas: { p10: 11, p50: 22, p90: 33 },
      payback: { p10: 44, p50: 55, p90: 66 },
    }
    const r = computeRealKpi({
      gameId: "poco",
      cohortSummary: null,
      revenueSnapshot: makeSnapshot(),
      mockFallback: customFallback,
      now: NOW,
    })
    expect(r.roas).toEqual(customFallback.roas)
    expect(r.payback).toEqual(customFallback.payback)
  })
})
