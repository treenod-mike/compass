import { describe, it, expect } from "vitest"
import {
  InvalidObservationError,
  InvalidPriorWeightError,
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
