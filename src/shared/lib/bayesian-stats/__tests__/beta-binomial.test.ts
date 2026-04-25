import { describe, it, expect } from "vitest"
import { betaBinomialModel } from "../beta-binomial"
import { betaQuantile } from "../beta-quantile"
import { DegenerateDistributionError } from "../types"

describe("Beta-Binomial model", () => {
  describe("priorFromEmpirical (Method of Moments, capped α+β)", () => {
    it("recovers approximate α,β from known empirical quantiles", () => {
      // Input plausibly close to Beta(8,2): mean ~0.8
      const prior = betaBinomialModel.priorFromEmpirical(
        { p10: 0.6395, p50: 0.8204, p90: 0.9296 },
        20,
      )
      expect(prior.alpha / (prior.alpha + prior.beta)).toBeCloseTo(0.8, 1)
      // cap: α+β ≤ 20
      expect(prior.alpha + prior.beta).toBeLessThanOrEqual(20 + 1e-6)
    })

    it("caps α+β at effectiveN", () => {
      // Tight distribution would naturally give α+β much larger than effectiveN
      const prior = betaBinomialModel.priorFromEmpirical(
        { p10: 0.55, p50: 0.60, p90: 0.65 },
        50,
      )
      expect(prior.alpha + prior.beta).toBeLessThanOrEqual(50 + 1e-6)
    })

    it("throws DegenerateDistributionError on p90 <= p10", () => {
      expect(() =>
        betaBinomialModel.priorFromEmpirical({ p10: 0.5, p50: 0.5, p90: 0.5 }, 20),
      ).toThrow(DegenerateDistributionError)
    })

    it("throws DegenerateDistributionError when variance too large (mu*(1-mu) <= variance)", () => {
      // very wide distribution: p10=0.01, p90=0.99, p50=0.5 → variance would exceed max
      expect(() =>
        betaBinomialModel.priorFromEmpirical({ p10: 0.01, p50: 0.5, p90: 0.99 }, 20),
      ).toThrow(DegenerateDistributionError)
    })
  })

  describe("posterior (Beta-Binomial conjugate)", () => {
    it("n=0 → posterior mean = prior mean", () => {
      const prior = { alpha: 8, beta: 2 }
      const post = betaBinomialModel.posterior(prior, { n: 0, k: 0 })
      expect(post.mean).toBeCloseTo(0.8, 6)
    })

    it("n=large → posterior mean → observed rate", () => {
      const prior = { alpha: 8, beta: 2 }   // prior mean 0.8
      const post = betaBinomialModel.posterior(prior, { n: 100_000, k: 30_000 })
      expect(post.mean).toBeCloseTo(0.3, 3)
    })

    it("n small → shrinkage (posterior between prior and observed)", () => {
      const prior = { alpha: 8, beta: 2 }
      const post = betaBinomialModel.posterior(prior, { n: 10, k: 3 })
      // observed rate = 0.3, prior mean = 0.8 → shrinkage region
      expect(post.mean).toBeGreaterThan(0.3)
      expect(post.mean).toBeLessThan(0.8)
    })

    it("CI matches betaQuantile call on posterior params", () => {
      const prior = { alpha: 10, beta: 40 }
      const post = betaBinomialModel.posterior(prior, { n: 100, k: 25 })
      // Posterior: Beta(35, 115). betaQuantile is already tested in Task 1.2.
      expect(post.ci_low).toBeCloseTo(betaQuantile(35, 115, 0.025), 6)
      expect(post.ci_high).toBeCloseTo(betaQuantile(35, 115, 0.975), 6)
    })

    it("sampleSize = prior pseudo-counts + observed n (rounded)", () => {
      const prior = { alpha: 8, beta: 2 }
      const post = betaBinomialModel.posterior(prior, { n: 100, k: 30 })
      expect(post.sampleSize).toBe(110)
    })
  })

  describe("priorAsInterval", () => {
    it("returns prior mean and 95% CI from Beta(α,β)", () => {
      const prior = { alpha: 8, beta: 2 }
      const interval = betaBinomialModel.priorAsInterval(prior)
      expect(interval.mean).toBeCloseTo(0.8, 6)
      expect(interval.ci_low).toBeGreaterThan(0.4)
      expect(interval.ci_high).toBeLessThan(1.0)
      expect(interval.ci_low).toBeCloseTo(betaQuantile(8, 2, 0.025), 6)
      expect(interval.ci_high).toBeCloseTo(betaQuantile(8, 2, 0.975), 6)
    })
  })
})
