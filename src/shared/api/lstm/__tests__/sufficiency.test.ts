import { describe, it, expect } from "vitest"
import { checkSufficiency } from "../sufficiency"
import type { CohortSummary } from "../../appsflyer/types"

const buildSummary = (cohortDays: number, revenueDays: number, lastD30: number | null): CohortSummary => ({
  updatedAt: new Date().toISOString(),
  cohorts: Array.from({ length: cohortDays }, (_, i) => ({
    cohortDate: `2026-03-${String(i + 1).padStart(2, "0")}`,
    installs: 100,
    retainedByDay: { d1: 50, d7: 25, d30: i === cohortDays - 1 ? lastD30 : 10 },
  })),
  revenue: {
    daily: Array.from({ length: revenueDays }, (_, i) => ({
      date: `2026-03-${String(i + 1).padStart(2, "0")}`,
      sumUsd: 30,
      purchasers: 5,
    })),
    total: { sumUsd: revenueDays * 30, purchasers: revenueDays * 5 },
  },
})

describe("checkSufficiency", () => {
  it("returns ok when 30+ cohorts, 14+ revenue days, D30>0, genre+region present, prior known", () => {
    const r = checkSufficiency(buildSummary(30, 14, 10), {
      appId: "x",
      genre: "Merge",
      region: "JP",
    })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.genreKey).toBe("Merge:JP")
  })

  it("rejects insufficient cohort history (<30d)", () => {
    const r = checkSufficiency(buildSummary(20, 14, 10), {
      appId: "x",
      genre: "Merge",
      region: "JP",
    })
    expect(r).toEqual({ ok: false, gameId: "x", reason: "insufficient_cohort_history" })
  })

  it("rejects insufficient revenue history (<14d)", () => {
    const r = checkSufficiency(buildSummary(30, 7, 10), {
      appId: "x",
      genre: "Merge",
      region: "JP",
    })
    expect(r).toEqual({ ok: false, gameId: "x", reason: "insufficient_revenue_history" })
  })

  it("rejects dead D30 retention (latest cohort D30=0)", () => {
    const r = checkSufficiency(buildSummary(30, 14, 0), {
      appId: "x",
      genre: "Merge",
      region: "JP",
    })
    expect(r).toEqual({ ok: false, gameId: "x", reason: "dead_d30_retention" })
  })

  it("rejects missing genre", () => {
    const r = checkSufficiency(buildSummary(30, 14, 10), { appId: "x", region: "JP" })
    expect(r).toEqual({ ok: false, gameId: "x", reason: "missing_genre_meta" })
  })

  it("rejects unknown genre/region prior", () => {
    const r = checkSufficiency(buildSummary(30, 14, 10), {
      appId: "x",
      genre: "Unknown",
      region: "ZZ",
    })
    expect(r).toEqual({ ok: false, gameId: "x", reason: "unknown_genre_prior" })
  })

  it("ok when latest cohort d30 is null but earlier cohort has d30 > 0", () => {
    const summary: CohortSummary = {
      updatedAt: new Date().toISOString(),
      cohorts: Array.from({ length: 30 }, (_, i) => ({
        cohortDate: `2026-03-${String(i + 1).padStart(2, "0")}`,
        installs: 100,
        retainedByDay: { d1: 50, d7: 25, d30: i < 25 ? 10 : null },
      })),
      revenue: {
        daily: Array.from({ length: 14 }, (_, i) => ({
          date: `2026-03-${String(i + 1).padStart(2, "0")}`,
          sumUsd: 30,
          purchasers: 5,
        })),
        total: { sumUsd: 14 * 30, purchasers: 14 * 5 },
      },
    }
    const r = checkSufficiency(summary, { appId: "x", genre: "Merge", region: "JP" })
    expect(r.ok).toBe(true)
  })

  it("rejects dead_d30 when latest non-null d30 is 0 even if recent cohorts are null", () => {
    const summary: CohortSummary = {
      updatedAt: new Date().toISOString(),
      cohorts: Array.from({ length: 30 }, (_, i) => ({
        cohortDate: `2026-03-${String(i + 1).padStart(2, "0")}`,
        installs: 100,
        retainedByDay: { d1: 50, d7: 25, d30: i < 24 ? 10 : i === 24 ? 0 : null },
      })),
      revenue: {
        daily: Array.from({ length: 14 }, (_, i) => ({
          date: `2026-03-${String(i + 1).padStart(2, "0")}`,
          sumUsd: 30,
          purchasers: 5,
        })),
        total: { sumUsd: 14 * 30, purchasers: 14 * 5 },
      },
    }
    const r = checkSufficiency(summary, { appId: "x", genre: "Merge", region: "JP" })
    expect(r).toEqual({ ok: false, gameId: "x", reason: "dead_d30_retention" })
  })
})
