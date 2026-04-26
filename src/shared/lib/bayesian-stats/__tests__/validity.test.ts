import { describe, it, expect } from "vitest"
import {
  validatePriorBasic,
  validateRetentionPosterior,
  validateRevenuePosterior,
} from "../validity"

describe("validity gates", () => {
  describe("validatePriorBasic", () => {
    it("n >= 10 passes, n = 9 fails", () => {
      expect(validatePriorBasic({ nonNullCount: 10, p10: 0.1, p50: 0.3, p90: 0.5, ageDays: 1 })).toEqual({ valid: true })
      const r = validatePriorBasic({ nonNullCount: 9, p10: 0.1, p50: 0.3, p90: 0.5, ageDays: 1 })
      expect(r.valid).toBe(false)
      if (!r.valid) expect(r.reason).toBe("prior_invalid_n")
    })

    it("degenerate distribution (p90 <= p10) fails", () => {
      const r = validatePriorBasic({ nonNullCount: 20, p10: 0.3, p50: 0.3, p90: 0.3, ageDays: 1 })
      expect(r.valid).toBe(false)
      if (!r.valid) expect(r.reason).toBe("prior_degenerate")
    })

    it("ageDays > 30 fails", () => {
      const r = validatePriorBasic({ nonNullCount: 20, p10: 0.1, p50: 0.3, p90: 0.5, ageDays: 31 })
      expect(r.valid).toBe(false)
      if (!r.valid) expect(r.reason).toBe("prior_stale")
    })

    it("ageDays exactly 30 passes", () => {
      expect(validatePriorBasic({ nonNullCount: 20, p10: 0.1, p50: 0.3, p90: 0.5, ageDays: 30 })).toEqual({ valid: true })
    })
  })

  describe("validateRetentionPosterior", () => {
    it("D1: installs >= 25 passes, < 25 fails", () => {
      expect(validateRetentionPosterior({ installs: 25, retained: 15 }, 1)).toEqual({ valid: true })
      const r = validateRetentionPosterior({ installs: 24, retained: 14 }, 1)
      expect(r.valid).toBe(false)
      if (!r.valid) expect(r.reason).toBe("insufficient_installs")
    })

    it("D7: installs >= 80 passes, < 80 fails", () => {
      expect(validateRetentionPosterior({ installs: 80, retained: 20 }, 7)).toEqual({ valid: true })
      expect(validateRetentionPosterior({ installs: 79, retained: 20 }, 7).valid).toBe(false)
    })

    it("D30: installs >= 200 passes, < 200 fails", () => {
      expect(validateRetentionPosterior({ installs: 200, retained: 20 }, 30)).toEqual({ valid: true })
      expect(validateRetentionPosterior({ installs: 199, retained: 20 }, 30).valid).toBe(false)
    })
  })

  describe("validateRevenuePosterior", () => {
    it("monthsCount >= 3 and all revenues >= $1000 passes", () => {
      expect(validateRevenuePosterior({ monthlyRevenueUsd: [5000, 6000, 7000], monthsCount: 3 })).toEqual({ valid: true })
    })

    it("monthsCount < 3 fails", () => {
      const r = validateRevenuePosterior({ monthlyRevenueUsd: [5000, 6000], monthsCount: 2 })
      expect(r.valid).toBe(false)
      if (!r.valid) expect(r.reason).toBe("insufficient_history")
    })

    it("any monthly revenue < $1000 fails", () => {
      const r = validateRevenuePosterior({ monthlyRevenueUsd: [5000, 800, 7000], monthsCount: 3 })
      expect(r.valid).toBe(false)
      if (!r.valid) expect(r.reason).toBe("insufficient_history")
    })
  })
})
