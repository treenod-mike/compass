// src/shared/api/composite/__tests__/roas-payback.test.ts
// RED phase — 19 cases for computeRealKpi.
// All cases are it.skip until Task 4 impl lands; precommit-gate.sh runs
// `npm test`, so failing tests would block the TDD RED commit. Skip-then-
// unskip is the explicitly recommended fallback in the Task 3 plan.
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
  const spendUsd = opts.spendUsd ?? 2500
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
  it.skip("returns mock + ML1 when cohortSummary is null", () => {
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

  it.skip("returns fxUnsupported + ML2 when spend.totalUsd is null", () => {
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

  it.skip("returns insufficient + ML1 when basisDays < 14", () => {
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

  it.skip("returns mock + ML2 when snapshot is stale (>7d)", () => {
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

  it.skip("returns mock + ML2 when forecast for gameId is missing", () => {
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

  it.skip("returns insufficient + ML1 when installs is 0", () => {
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

  it.skip("returns real + null badge when all gates pass", () => {
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

  it.skip("observedRevenueUsd is preserved verbatim from cohortSummary", () => {
    const r = computeRealKpi({
      gameId: "poco",
      cohortSummary: makeCohortSummary({ installs: 1000, observedRevenueUsd: 200, basisDays: 14 }),
      revenueSnapshot: makeSnapshot({ installsAssumption: 1000, curve: flatCurve }),
      mockFallback: MOCK_FALLBACK,
      now: NOW,
    })
    expect(r.observedRevenueUsd).toBe(200)
  })

  it.skip("forecastRevenueUsd equals (cumPerInstall(horizon, P50) − observedPerInstall) × installs", () => {
    const r = computeRealKpi({
      gameId: "poco",
      cohortSummary: makeCohortSummary({ installs: 1000, observedRevenueUsd: 200, basisDays: 14 }),
      revenueSnapshot: makeSnapshot({ installsAssumption: 1000, curve: flatCurve, horizon: 365 }),
      mockFallback: MOCK_FALLBACK,
      now: NOW,
    })
    expect(r.forecastRevenueUsd).toBeCloseTo(351, 1)
  })

  it.skip("when basisDays === horizon, no forecast tail is added (forecastRevenueUsd ≈ 0)", () => {
    const r = computeRealKpi({
      gameId: "poco",
      cohortSummary: makeCohortSummary({ installs: 1000, observedRevenueUsd: 500, basisDays: 365 }),
      revenueSnapshot: makeSnapshot({ installsAssumption: 1000, curve: flatCurve, horizon: 365 }),
      mockFallback: MOCK_FALLBACK,
      now: NOW,
    })
    expect(r.forecastRevenueUsd).toBeCloseTo(0, 1)
  })

  it.skip("ROAS scales linearly with cumulative-revenue / spend", () => {
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
  const split = (_d: number) => ({ p10: 0.5, p50: 1.0, p90: 2.0 })

  it.skip("observed revenue > 0 yields shorter payback than the zero-observed equivalent (splice baseline)", () => {
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

  it.skip("payback.p50 with mid curve sits between p10 and p90", () => {
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

  it.skip("revenue.P10 always maps to payback.p90 (slowest)", () => {
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

  it.skip("demotes to insufficient when P50 misses horizon", () => {
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

  it.skip("caps payback.p90 at horizon when only P10 misses", () => {
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
  it.skip("returns insufficient when spend === 0", () => {
    const r = computeRealKpi({
      gameId: "poco",
      cohortSummary: makeCohortSummary({ installs: 1000, spendUsd: 0 }),
      revenueSnapshot: makeSnapshot(),
      mockFallback: MOCK_FALLBACK,
      now: NOW,
    })
    expect(r.status).toBe("insufficient")
  })

  it.skip("returns insufficient when installs === 0 (avoids divide-by-zero)", () => {
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
  it.skip("returns mockFallback values verbatim for every non-real status", () => {
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
