import { describe, it, expect } from "vitest"
import { getPrior, listAvailablePriors } from "../prior-data"

describe("prior-data bundle", () => {
  it("Merge:JP bundle is available", () => {
    const keys = listAvailablePriors()
    expect(keys).toContainEqual({ genre: "Merge", region: "JP" })
  })

  it("getPrior returns bundle with effectiveN", () => {
    const bundle = getPrior({ genre: "Merge", region: "JP" })
    expect(bundle).not.toBeNull()
    expect(bundle!.effectiveN).toBeGreaterThan(0)
    expect(bundle!.effectiveN).toBeLessThanOrEqual(100)
  })

  it("revenue is in plain USD (not cents)", () => {
    // Merge×JP Top 20의 90일 수익 중간값은 $10M~$5B 범위 (cents 아님)
    const bundle = getPrior({ genre: "Merge", region: "JP" })!
    const revenueP50 = bundle.monthlyRevenueUsd.p50
    expect(revenueP50).toBeGreaterThan(1_000_000)
    expect(revenueP50).toBeLessThan(5_000_000_000)
  })

  it("retention values are fractions in [0,1]", () => {
    const bundle = getPrior({ genre: "Merge", region: "JP" })!
    expect(bundle.retention.d1.p50).toBeGreaterThan(0)
    expect(bundle.retention.d1.p50).toBeLessThan(1)
    expect(bundle.retention.d30.p50).toBeGreaterThan(0)
    expect(bundle.retention.d30.p50).toBeLessThan(1)
  })

  it("null-safe getPrior for unknown key", () => {
    expect(getPrior({ genre: "Unknown", region: "XX" })).toBeNull()
  })
})
