import { describe, it, expect } from "vitest"
import { estimateArpdau } from "../arpdau"

const cohort = (date: string, installs: number, d1: number | null, d7: number | null, d30: number | null) => ({
  cohortDate: date,
  installs,
  retainedByDay: { d1, d7, d30 },
  uaSpendUsd: null,
})

describe("estimateArpdau", () => {
  it("returns sum(revenue)/sum(DAU) over 14d window", () => {
    const cohorts = Array.from({ length: 14 }, (_, i) =>
      cohort(`2026-04-${String(i + 1).padStart(2, "0")}`, 100, 50, 25, 10),
    )
    const revenueDaily = Array.from({ length: 14 }, (_, i) => ({
      date: `2026-04-${String(i + 1).padStart(2, "0")}`,
      sumUsd: 25,
    }))
    const r = estimateArpdau({ revenueDaily, cohorts, windowDays: 14 })
    expect(r.effectiveDays).toBe(14)
    expect(r.arpdauUsd).toBeGreaterThan(0)
    expect(Number.isFinite(r.arpdauUsd)).toBe(true)
  })

  it("returns 0 when DAU is zero across the window", () => {
    const cohorts = [cohort("2026-04-01", 0, 0, 0, 0)]
    const r = estimateArpdau({
      revenueDaily: [{ date: "2026-04-01", sumUsd: 100 }],
      cohorts,
      windowDays: 14,
    })
    expect(r.arpdauUsd).toBe(0)
    expect(r.effectiveDays).toBe(1)
  })

  it("returns 0 when revenue is zero", () => {
    const cohorts = [cohort("2026-04-01", 100, 50, 25, 10)]
    const r = estimateArpdau({
      revenueDaily: [{ date: "2026-04-01", sumUsd: 0 }],
      cohorts,
      windowDays: 14,
    })
    expect(r.arpdauUsd).toBe(0)
  })

  it("uses available days when window exceeds data", () => {
    const cohorts = Array.from({ length: 7 }, (_, i) =>
      cohort(`2026-04-${String(i + 1).padStart(2, "0")}`, 100, 50, 25, 10),
    )
    const revenueDaily = Array.from({ length: 7 }, (_, i) => ({
      date: `2026-04-${String(i + 1).padStart(2, "0")}`,
      sumUsd: 30,
    }))
    const r = estimateArpdau({ revenueDaily, cohorts, windowDays: 14 })
    expect(r.effectiveDays).toBe(7)
  })

  it("treats null retention as zero (no DAU contribution)", () => {
    const r = estimateArpdau({
      revenueDaily: [{ date: "2026-04-01", sumUsd: 50 }],
      cohorts: [cohort("2026-04-01", 100, null, null, null)],
      windowDays: 14,
    })
    expect(r.arpdauUsd).toBe(0)
  })
})
