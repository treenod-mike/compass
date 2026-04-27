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
  const base: CohortSummary = {
    updatedAt: "2026-04-27T00:00:00.000Z",
    cohorts: [
      {
        cohortDate: "2026-04-01",
        installs: 1000,
        retainedByDay: { d1: 450, d7: 230, d30: 110 },
      },
      {
        cohortDate: "2026-03-15",
        installs: 800,
        retainedByDay: { d1: 360, d7: 184, d30: 88 },
      },
    ],
    revenue: {
      daily: [],
      total: { sumUsd: 5000, purchasers: 200 },
    },
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
        },
      ],
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
        },
      ],
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
