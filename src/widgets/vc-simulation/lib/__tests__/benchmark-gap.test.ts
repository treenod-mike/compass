import { describe, expect, test } from "vitest"
import {
  bucketTone,
  computeBenchmarkGap,
  formatGapPct,
  toneClass,
} from "../benchmark-gap"
import type { CohortSummary, AppState } from "@/shared/api/appsflyer"
import { DEFAULT_OFFER } from "@/shared/api/vc-simulation"

const FAKE_TODAY = new Date("2026-04-27T00:00:00Z")

const baseState: AppState = {
  appId: "com.test.game",
  status: "active",
  progress: { step: 5, total: 5, rowsFetched: 1000 },
  lastSyncAt: "2026-04-27T00:00:00.000Z",
  callsUsedToday: 4,
  callsResetAt: "2026-04-28T00:00:00.000Z",
  syncLock: null,
  failureHistory: [],
}

function makeSummary(overrides: Partial<CohortSummary> = {}): CohortSummary {
  // Default fixture: 1800 installs, $5000 revenue, $3000 USD spend.
  // → cumulative LTV/CPI = (5000/1800) / (3000/1800) = 5000/3000 = 1.667
  // → simulated LTV/CPI for default 12mo horizon ≈ 8.0/3.0 = 2.667
  // → gap ≈ 1.667/2.667 - 1 ≈ -0.375 (strongDown bucket)
  const base: CohortSummary = {
    updatedAt: "2026-04-27T00:00:00.000Z",
    cohorts: [
      {
        cohortDate: "2026-04-01",
        installs: 1000,
        retainedByDay: { d1: 450, d7: 230, d30: 110 },
        uaSpendUsd: 1700,
      },
      {
        cohortDate: "2026-03-15",
        installs: 800,
        retainedByDay: { d1: 360, d7: 184, d30: 88 },
        uaSpendUsd: 1300,
      },
    ],
    revenue: {
      daily: [],
      total: { sumUsd: 5000, purchasers: 200 },
    },
    spend: { totalUsd: 3000, homeCurrency: "USD" },
  }
  return { ...base, ...overrides }
}

describe("bucketTone", () => {
  test("ranges map to correct keys", () => {
    expect(bucketTone(0.5)).toBe("strongUp")
    expect(bucketTone(0.20)).toBe("modestUp")
    expect(bucketTone(0.0)).toBe("match")
    expect(bucketTone(-0.10)).toBe("match")
    expect(bucketTone(-0.20)).toBe("modestDown")
    expect(bucketTone(-0.50)).toBe("strongDown")
  })
})

describe("computeBenchmarkGap — disconnected fallback", () => {
  test("status null returns disconnected", () => {
    const r = computeBenchmarkGap(null, null, DEFAULT_OFFER, FAKE_TODAY)
    expect(r.status).toBe("disconnected")
    expect(r.gap).toBeNull()
    expect(r.tone).toBeNull()
  })

  test("backfilling state returns disconnected", () => {
    const state: AppState = { ...baseState, status: "backfilling" }
    const r = computeBenchmarkGap(state, makeSummary(), DEFAULT_OFFER, FAKE_TODAY)
    expect(r.status).toBe("disconnected")
  })

  test("active state with no cohorts returns disconnected", () => {
    const r = computeBenchmarkGap(
      baseState,
      makeSummary({ cohorts: [] }),
      DEFAULT_OFFER,
      FAKE_TODAY,
    )
    expect(r.status).toBe("disconnected")
  })
})

describe("computeBenchmarkGap — active path", () => {
  test("active returns numeric gap and tone", () => {
    const r = computeBenchmarkGap(baseState, makeSummary(), DEFAULT_OFFER, FAKE_TODAY)
    expect(r.status).toBe("active")
    expect(r.daysFromLaunch).toBeGreaterThan(0)
    expect(r.gap).not.toBeNull()
    expect(r.tone).not.toBeNull()
  })

  test("daysFromLaunch < 90 selects d30 when available", () => {
    const sum = makeSummary({
      cohorts: [
        // earliest cohort 60 days ago → daysFromLaunch = 60
        {
          cohortDate: "2026-02-26",
          installs: 1000,
          retainedByDay: { d1: 450, d7: 230, d30: 110 },
          uaSpendUsd: 2000,
        },
      ],
      spend: { totalUsd: 2000, homeCurrency: "USD" },
    })
    const r = computeBenchmarkGap(baseState, sum, DEFAULT_OFFER, FAKE_TODAY)
    expect(r.daysFromLaunch).toBe(60)
    expect(r.selected).toBe("d30")
  })

  test("daysFromLaunch >= 90 selects cumulative", () => {
    const sum = makeSummary({
      cohorts: [
        // earliest cohort 120 days ago
        {
          cohortDate: "2025-12-28",
          installs: 5000,
          retainedByDay: { d1: 2200, d7: 1100, d30: 500 },
          uaSpendUsd: 10_000,
        },
      ],
      spend: { totalUsd: 10_000, homeCurrency: "USD" },
    })
    const r = computeBenchmarkGap(baseState, sum, DEFAULT_OFFER, FAKE_TODAY)
    expect(r.daysFromLaunch).toBe(120)
    expect(r.selected).toBe("cumulative")
  })

  test("stale state still computes (treated as active for disclosure)", () => {
    const state: AppState = { ...baseState, status: "stale" }
    const r = computeBenchmarkGap(state, makeSummary(), DEFAULT_OFFER, FAKE_TODAY)
    expect(r.status).toBe("active")
  })
})

describe("formatGapPct", () => {
  test("formats with sign and rounded percent", () => {
    expect(formatGapPct(0.33)).toBe("+33%")
    expect(formatGapPct(-0.07)).toBe("-7%")
    expect(formatGapPct(0)).toBe("+0%")
  })
})

describe("toneClass", () => {
  test("returns Tailwind class strings per tone", () => {
    expect(toneClass("match")).toContain("muted-foreground")
    expect(toneClass("modestUp")).toContain("success")
    expect(toneClass("strongUp")).toContain("success")
    expect(toneClass("modestDown")).toContain("warning")
    expect(toneClass("strongDown")).toContain("destructive")
  })
})

describe("computeBenchmarkGap — Phase 2 LTV/CPI ratio comparison", () => {
  test("computes cumulative LTV/CPI from revenue/spend (installs cancel)", () => {
    // Default fixture: $5000 revenue / $3000 spend = 1.667 actual LTV/CPI.
    // Sim 12mo midpoint: 0.40 × 20 / 3.0 ≈ 2.667.
    // Gap = 1.667/2.667 - 1 ≈ -0.375 → strongDown.
    const r = computeBenchmarkGap(baseState, makeSummary(), DEFAULT_OFFER, FAKE_TODAY)
    expect(r.cumLtvPerCpi).toBeCloseTo(5000 / 3000, 3)
    expect(r.simCumLtvPerCpi).toBeCloseTo(2.667, 2)
    expect(r.cumGap).toBeCloseTo(5000 / 3000 / 2.667 - 1, 2)
    expect(r.spendStatus).toBe("ok")
  })

  test("FX-unsupported (spend.totalUsd null) sets spendStatus and nulls all gaps", () => {
    const sum = makeSummary({
      spend: { totalUsd: null, homeCurrency: "JPY" },
      cohorts: [
        {
          cohortDate: "2026-04-01",
          installs: 1000,
          retainedByDay: { d1: 450, d7: 230, d30: 110 },
          uaSpendUsd: null,
        },
      ],
    })
    const r = computeBenchmarkGap(baseState, sum, DEFAULT_OFFER, FAKE_TODAY)
    expect(r.spendStatus).toBe("fxUnsupported")
    expect(r.cumLtvPerCpi).toBeNull()
    expect(r.d30LtvPerCpi).toBeNull()
    expect(r.gap).toBeNull()
    expect(r.tone).toBeNull()
  })

  test("organic-only (spend.totalUsd = 0) sets spendStatus = noPaidInstalls", () => {
    const sum = makeSummary({
      spend: { totalUsd: 0, homeCurrency: "USD" },
      cohorts: [
        {
          cohortDate: "2026-04-01",
          installs: 1000,
          retainedByDay: { d1: 450, d7: 230, d30: 110 },
          uaSpendUsd: 0,
        },
      ],
    })
    const r = computeBenchmarkGap(baseState, sum, DEFAULT_OFFER, FAKE_TODAY)
    expect(r.spendStatus).toBe("noPaidInstalls")
    expect(r.cumLtvPerCpi).toBeNull()
    expect(r.gap).toBeNull()
  })

  test("modestUp tone when actual cumulative LTV/CPI is +20% above simulated", () => {
    // Sim cumulative = 2.667. Actual = 1.2 × 2.667 = 3.20.
    // Use a single mature cohort (>90d ago) so the auto-selected window is
    // cumulative, isolating the cumulative-bucket tone assertion.
    const sum = makeSummary({
      cohorts: [
        {
          cohortDate: "2025-12-28", // 120 days before FAKE_TODAY
          installs: 1000,
          retainedByDay: { d1: 450, d7: 230, d30: 110 },
          uaSpendUsd: 1000,
        },
      ],
      revenue: { daily: [], total: { sumUsd: 3200, purchasers: 200 } },
      spend: { totalUsd: 1000, homeCurrency: "USD" },
    })
    const r = computeBenchmarkGap(baseState, sum, DEFAULT_OFFER, FAKE_TODAY)
    expect(r.selected).toBe("cumulative")
    expect(r.cumLtvPerCpi).toBeCloseTo(3.20, 2)
    expect(r.cumGap).toBeCloseTo(0.20, 2)
    expect(r.tone).toBe("modestUp")
  })

  test("D30 LTV/CPI uses cohort-attributed spend, not proportional allocation", () => {
    // Spec §2.3 Phase 2 detail: spend is now cohort-attributed exactly,
    // while revenue is still proportional.
    const sum = makeSummary({
      cohorts: [
        // d30-mature cohort 60 days ago, $1000 spend, 500 installs
        {
          cohortDate: "2026-02-26",
          installs: 500,
          retainedByDay: { d1: 250, d7: 125, d30: 60 },
          uaSpendUsd: 1000,
        },
        // recent cohort 10 days ago, NOT mature, $500 spend, 200 installs
        {
          cohortDate: "2026-04-17",
          installs: 200,
          retainedByDay: { d1: 90, d7: null, d30: null },
          uaSpendUsd: 500,
        },
      ],
      revenue: { daily: [], total: { sumUsd: 1400, purchasers: 50 } },
      spend: { totalUsd: 1500, homeCurrency: "USD" },
    })
    const r = computeBenchmarkGap(baseState, sum, DEFAULT_OFFER, FAKE_TODAY)
    // d30 share of installs = 500/700, revenueProxy = 1400 × 500/700 = 1000
    // d30Spend = 1000 (cohort-attributed)
    // d30LtvPerCpi = 1000/1000 = 1.0
    // simD30 ≈ 0.733 → gap ≈ +0.36 (strongUp)
    expect(r.d30LtvPerCpi).toBeCloseTo(1.0, 2)
    expect(r.simD30LtvPerCpi).toBeCloseTo(0.733, 2)
    expect(r.d30Gap).toBeCloseTo(1.0 / 0.733 - 1, 2)
  })

  test("simulated midpoints follow spec §3.3 formula (ARPDAU × Σret / CPI)", () => {
    const r = computeBenchmarkGap(baseState, makeSummary(), DEFAULT_OFFER, FAKE_TODAY)
    // Σret(D30) = 5.5 → simD30 = 0.40 × 5.5 / 3.0 ≈ 0.733
    expect(r.simD30LtvPerCpi).toBeCloseTo((0.40 * 5.5) / 3.0, 3)
  })
})

describe("formatLtvPerCpi", () => {
  test("rounds to 2 decimal places", async () => {
    const { formatLtvPerCpi } = await import("../benchmark-gap")
    expect(formatLtvPerCpi(1.6666)).toBe("1.67")
    expect(formatLtvPerCpi(0.7333)).toBe("0.73")
  })
})
