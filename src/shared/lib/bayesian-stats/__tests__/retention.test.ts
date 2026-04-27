import { describe, it, expect } from "vitest"
import {
  InvalidObservationError,
  InvalidPriorWeightError,
  bayesianRetentionPosterior,
} from "../retention"

describe("retention error classes", () => {
  it("InvalidObservationError carries k and n", () => {
    const err = new InvalidObservationError({ k: 5, n: 3 })
    expect(err.name).toBe("InvalidObservationError")
    expect(err.message).toContain("k=5")
    expect(err.message).toContain("n=3")
  })

  it("InvalidPriorWeightError carries the bad weight", () => {
    const err = new InvalidPriorWeightError(-0.5)
    expect(err.name).toBe("InvalidPriorWeightError")
    expect(err.message).toContain("-0.5")
  })
})

describe("bayesianRetentionPosterior", () => {
  const prior = { alpha: 2, beta: 8 }

  it("default weight=1: posterior = Beta(2+k, 8+n-k), p50 ≈ mean", () => {
    const result = bayesianRetentionPosterior({
      prior,
      observation: { k: 80, n: 100 },
    })
    expect(result.posterior.alpha).toBeCloseTo(82, 5)
    expect(result.posterior.beta).toBeCloseTo(28, 5)
    expect(result.p50).toBeCloseTo(0.7455, 2)
    expect(result.p10).toBeLessThan(result.p50)
    expect(result.p90).toBeGreaterThan(result.p50)
    expect(result.p10).toBeGreaterThan(0.65)
    expect(result.p90).toBeLessThan(0.85)
  })

  it("priorWeight=0.5 halves prior pseudo-counts", () => {
    const result = bayesianRetentionPosterior({
      prior,
      observation: { k: 80, n: 100 },
      priorWeight: 0.5,
    })
    expect(result.posterior.alpha).toBeCloseTo(81, 5)  // 2*0.5 + 80
    expect(result.posterior.beta).toBeCloseTo(24, 5)   // 8*0.5 + 20
  })

  it("n=0 returns weighted prior unchanged", () => {
    const result = bayesianRetentionPosterior({
      prior,
      observation: { k: 0, n: 0 },
    })
    expect(result.posterior.alpha).toBeCloseTo(2, 5)
    expect(result.posterior.beta).toBeCloseTo(8, 5)
  })

  it("k > n throws InvalidObservationError", () => {
    expect(() =>
      bayesianRetentionPosterior({ prior, observation: { k: 50, n: 30 } }),
    ).toThrow(InvalidObservationError)
  })

  it("priorWeight ≤ 0 throws InvalidPriorWeightError", () => {
    expect(() =>
      bayesianRetentionPosterior({ prior, observation: { k: 50, n: 100 }, priorWeight: 0 }),
    ).toThrow(InvalidPriorWeightError)
    expect(() =>
      bayesianRetentionPosterior({ prior, observation: { k: 50, n: 100 }, priorWeight: -1 }),
    ).toThrow(InvalidPriorWeightError)
  })

  it("p10 ≤ p50 ≤ p90 invariant for skewed prior", () => {
    const skewedPrior = { alpha: 1.2, beta: 18 }  // mean ~ 0.06
    const result = bayesianRetentionPosterior({
      prior: skewedPrior,
      observation: { k: 5, n: 100 },
    })
    expect(result.p10).toBeLessThanOrEqual(result.p50)
    expect(result.p50).toBeLessThanOrEqual(result.p90)
  })
})
