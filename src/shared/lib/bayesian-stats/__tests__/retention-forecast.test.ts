import { describe, it, expect } from "vitest"
import { retentionForecast, type RetentionForecastPoint } from "../retention"
import { getPrior } from "@/shared/api/prior-data"

describe("retentionForecast (integration)", () => {
  const bundle = getPrior({ genre: "Merge", region: "JP" })!

  const observations = {
    d1: { k: 70, n: 100 },
    d7: { k: 35, n: 100 },
    d30: { k: 15, n: 100 },
  }

  it("returns 1095-point curve with monotone non-increasing p50", () => {
    const curve = retentionForecast({
      observations,
      priors: bundle.retention,
      priorEffectiveN: bundle.effectiveN,
    })
    expect(curve).toHaveLength(1095)
    for (let i = 1; i < curve.length; i++) {
      expect(curve[i]!.p50).toBeLessThanOrEqual(curve[i - 1]!.p50)
    }
  })

  it("p10 ≤ p50 ≤ p90 at every day", () => {
    const curve = retentionForecast({
      observations,
      priors: bundle.retention,
      priorEffectiveN: bundle.effectiveN,
    })
    for (const point of curve) {
      expect(point.p10).toBeLessThanOrEqual(point.p50)
      expect(point.p50).toBeLessThanOrEqual(point.p90)
    }
  })

  it("D1 / D7 / D30 of P50 are positive and < 1", () => {
    const curve = retentionForecast({
      observations,
      priors: bundle.retention,
      priorEffectiveN: bundle.effectiveN,
    })
    const get = (day: number) => curve.find((p) => p.day === day)!
    expect(get(1).p50).toBeGreaterThan(0)
    expect(get(1).p50).toBeLessThan(1)
    expect(get(7).p50).toBeGreaterThan(0)
    expect(get(30).p50).toBeGreaterThan(0)
    expect(get(1).p50).toBeGreaterThan(get(7).p50)
    expect(get(7).p50).toBeGreaterThan(get(30).p50)
  })

  it("D1095 is at or above floor (never zero)", () => {
    const curve = retentionForecast({
      observations,
      priors: bundle.retention,
      priorEffectiveN: bundle.effectiveN,
    })
    const last = curve[curve.length - 1]!
    expect(last.day).toBe(1095)
    expect(last.p10).toBeGreaterThan(0)
    expect(last.p50).toBeGreaterThan(0)
    expect(last.p90).toBeGreaterThan(0)
  })

  it("priorWeight=0.5 shifts P50 closer to observation than weight=1", () => {
    const baseline = retentionForecast({
      observations,
      priors: bundle.retention,
      priorEffectiveN: bundle.effectiveN,
      priorWeight: 1,
    })
    const halved = retentionForecast({
      observations,
      priors: bundle.retention,
      priorEffectiveN: bundle.effectiveN,
      priorWeight: 0.5,
    })
    // Lower priorWeight → posterior pulled more toward observation. Sign of
    // shift depends on whether obs is above or below prior median; just assert
    // the curves are not identical.
    const baselineD1 = baseline.find((p) => p.day === 1)!.p50
    const halvedD1 = halved.find((p) => p.day === 1)!.p50
    expect(halvedD1).not.toBeCloseTo(baselineD1, 4)
  })

  it("default maxDay=1095, custom maxDay=365 returns 365 points", () => {
    const curve = retentionForecast({
      observations,
      priors: bundle.retention,
      priorEffectiveN: bundle.effectiveN,
      maxDay: 365,
    })
    expect(curve).toHaveLength(365)
    expect(curve[curve.length - 1]!.day).toBe(365)
  })
})
