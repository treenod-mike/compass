import { betaQuantile } from "./beta-quantile"
import {
  BayesianModel,
  CredibleInterval,
  DegenerateDistributionError,
  EmpiricalDist,
} from "./types"

export type BetaParams = { alpha: number; beta: number }
export type BinomialObs = { n: number; k: number }

// z-score for P10/P90 on standard normal: z(0.9) = 1.2815515655446004
const Z_80 = 1.2815515655446004
const Z_RANGE = 2 * Z_80   // ≈ 2.5631

function priorFromEmpirical(empirical: EmpiricalDist, effectiveN: number): BetaParams {
  if (empirical.p90 <= empirical.p10) throw new DegenerateDistributionError(empirical)
  const mu = empirical.p50
  if (!(mu > 0 && mu < 1)) throw new DegenerateDistributionError(empirical)

  const sigma = (empirical.p90 - empirical.p10) / Z_RANGE
  const variance = sigma * sigma
  const maxVariance = mu * (1 - mu)
  if (variance >= maxVariance) throw new DegenerateDistributionError(empirical)

  const rawTotal = (mu * (1 - mu)) / variance - 1
  // rawTotal < 1 means α+β < 1: improper / degenerate Beta
  if (rawTotal < 1) throw new DegenerateDistributionError(empirical)
  const alphaRaw = mu * rawTotal
  const betaRaw = (1 - mu) * rawTotal

  const scale = effectiveN > 0 && rawTotal > effectiveN ? effectiveN / rawTotal : 1
  return { alpha: alphaRaw * scale, beta: betaRaw * scale }
}

function posterior(prior: BetaParams, obs: BinomialObs): CredibleInterval {
  const aPost = prior.alpha + obs.k
  const bPost = prior.beta + (obs.n - obs.k)
  const mean = aPost / (aPost + bPost)
  const ci_low = betaQuantile(aPost, bPost, 0.025)
  const ci_high = betaQuantile(aPost, bPost, 0.975)
  const sampleSize = Math.round(prior.alpha + prior.beta + obs.n)
  return { mean, ci_low, ci_high, sampleSize }
}

function priorAsInterval(prior: BetaParams): CredibleInterval {
  const mean = prior.alpha / (prior.alpha + prior.beta)
  const ci_low = betaQuantile(prior.alpha, prior.beta, 0.025)
  const ci_high = betaQuantile(prior.alpha, prior.beta, 0.975)
  const sampleSize = Math.round(prior.alpha + prior.beta)
  return { mean, ci_low, ci_high, sampleSize }
}

export const betaBinomialModel: BayesianModel<BetaParams, BinomialObs> = {
  name: "beta-binomial",
  priorFromEmpirical,
  posterior,
  priorAsInterval,
}
