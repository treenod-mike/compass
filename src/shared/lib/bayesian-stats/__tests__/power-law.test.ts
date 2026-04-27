import { describe, it, expect } from "vitest"
import { fitPowerLaw, NonDecreasingCurveError } from "../power-law"

describe("fitPowerLaw", () => {
  it("3-point retention curve: returns positive a, b", () => {
    const fit = fitPowerLaw([
      { day: 1, value: 0.5 },
      { day: 7, value: 0.3 },
      { day: 30, value: 0.15 },
    ])
    expect(fit.a).toBeCloseTo(0.53, 1)
    expect(fit.b).toBeCloseTo(0.35, 1)
  })

  it("non-decreasing curve throws NonDecreasingCurveError", () => {
    expect(() =>
      fitPowerLaw([
        { day: 1, value: 0.3 },
        { day: 7, value: 0.5 },
        { day: 30, value: 0.7 },
      ]),
    ).toThrow(NonDecreasingCurveError)
  })

  it("perfect power-law recovers exact a, b", () => {
    // r(t) = 0.6 × t^(-0.4)
    // r(1) = 0.6, r(10) = 0.6 × 10^-0.4 ≈ 0.2389, r(100) ≈ 0.0951
    const fit = fitPowerLaw([
      { day: 1, value: 0.6 },
      { day: 10, value: 0.6 * Math.pow(10, -0.4) },
      { day: 100, value: 0.6 * Math.pow(100, -0.4) },
    ])
    expect(fit.a).toBeCloseTo(0.6, 4)
    expect(fit.b).toBeCloseTo(0.4, 4)
  })

  it("rejects fewer than 2 points", () => {
    expect(() => fitPowerLaw([{ day: 1, value: 0.5 }])).toThrow()
  })

  it("rejects non-positive day or value", () => {
    expect(() =>
      fitPowerLaw([
        { day: 0, value: 0.5 },
        { day: 7, value: 0.3 },
      ]),
    ).toThrow()
    expect(() =>
      fitPowerLaw([
        { day: 1, value: 0 },
        { day: 7, value: 0.3 },
      ]),
    ).toThrow()
  })
})
