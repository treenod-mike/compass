import { describe, it, expect } from "vitest"
import { lognormalModel } from "../lognormal"

describe("Log-normal model", () => {
  describe("priorFromEmpirical", () => {
    it("recovers μ_log, σ_log from known log-normal", () => {
      // LogNormal(μ=10, σ=1): P50=e^10≈22026, P10=e^(10-1.2816)≈6118, P90=e^(10+1.2816)≈79305
      const prior = lognormalModel.priorFromEmpirical(
        { p10: 6118, p50: 22026, p90: 79305 },
        20,
      )
      expect(prior.muLog).toBeCloseTo(10.0, 1)
      expect(prior.sigmaLog).toBeCloseTo(1.0, 1)
      expect(prior.nPrior).toBe(20)
    })

    it("throws on degenerate (p50 <= 0)", () => {
      expect(() =>
        lognormalModel.priorFromEmpirical({ p10: 0, p50: 0, p90: 1 }, 20),
      ).toThrow()
    })

    it("throws on p90 <= p10", () => {
      expect(() =>
        lognormalModel.priorFromEmpirical({ p10: 100, p50: 100, p90: 100 }, 20),
      ).toThrow()
    })
  })

  describe("posterior (Normal-Normal conjugate on log-scale)", () => {
    it("n_obs=0 → posterior ≈ prior (as interval)", () => {
      const prior = { muLog: 10, sigmaLog: 1, nPrior: 20 }
      const post = lognormalModel.posterior(prior, { monthlyRevenueUsd: [], monthsCount: 0 })
      const priorInterval = lognormalModel.priorAsInterval(prior)
      expect(post.mean).toBeCloseTo(priorInterval.mean, 2)
    })

    it("n_obs large & constant → posterior mean ≈ observed value (within 1 OOM)", () => {
      const prior = { muLog: 10, sigmaLog: 1, nPrior: 20 }
      const observed = Array.from({ length: 100 }, () => 1_000_000)  // constant $1M
      const post = lognormalModel.posterior(prior, { monthlyRevenueUsd: observed, monthsCount: 100 })
      // posterior should be pulled strongly toward log(1M) ≈ 13.816
      expect(post.mean).toBeGreaterThan(500_000)
      expect(post.mean).toBeLessThan(2_000_000)
    })

    it("CI bounds are monotone (ci_low < mean < ci_high)", () => {
      const prior = { muLog: 10, sigmaLog: 1, nPrior: 20 }
      const post = lognormalModel.posterior(prior, {
        monthlyRevenueUsd: [1_000_000, 1_500_000, 800_000, 1_200_000],
        monthsCount: 4,
      })
      expect(post.ci_low).toBeLessThan(post.mean)
      expect(post.mean).toBeLessThan(post.ci_high)
    })
  })
})
