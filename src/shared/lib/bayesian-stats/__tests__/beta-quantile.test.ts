import { describe, it, expect } from "vitest"
import { betaQuantile } from "../beta-quantile"

describe("betaQuantile", () => {
  it("Beta(1,1) = uniform → quantile(p) = p", () => {
    expect(betaQuantile(1, 1, 0.25)).toBeCloseTo(0.25, 6)
    expect(betaQuantile(1, 1, 0.50)).toBeCloseTo(0.50, 6)
    expect(betaQuantile(1, 1, 0.75)).toBeCloseTo(0.75, 6)
  })

  it("Beta(8,2): matches exact closed-form CDF reference", () => {
    // Exact CDF for Beta(8,2): F(x) = 9x^8 - 8x^9 (integer params)
    // Verified: F(0.5175) = 0.025000, F(0.8204) = 0.500000, F(0.9719) = 0.975000
    // NOTE: Task spec scipy values [0.4822, 0.8212, 0.9783] were incorrect —
    // F(0.4822) = 0.01503, not 0.025. Correct values derived from exact CDF.
    expect(betaQuantile(8, 2, 0.025)).toBeCloseTo(0.5175, 3)
    expect(betaQuantile(8, 2, 0.5)).toBeCloseTo(0.8204, 3)
    expect(betaQuantile(8, 2, 0.975)).toBeCloseTo(0.9719, 3)
  })

  it("Beta(35,115): matches exact CDF reference", () => {
    // Verified via regularizedIncompleteBeta bisection (100 iter):
    // incBeta(35,115, 0.1694) = 0.025000, incBeta(35,115, 0.3040) = 0.975000
    // NOTE: Task spec values [0.1765, 0.3060] were incorrect.
    expect(betaQuantile(35, 115, 0.025)).toBeCloseTo(0.1694, 3)
    expect(betaQuantile(35, 115, 0.975)).toBeCloseTo(0.3040, 3)
  })

  it("throws on invalid p", () => {
    expect(() => betaQuantile(1, 1, -0.1)).toThrow()
    expect(() => betaQuantile(1, 1, 1.1)).toThrow()
  })

  it("throws on non-positive shape params", () => {
    expect(() => betaQuantile(0, 1, 0.5)).toThrow()
    expect(() => betaQuantile(1, -1, 0.5)).toThrow()
  })
})
