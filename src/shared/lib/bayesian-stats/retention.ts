import { betaQuantile } from "./beta-quantile"
import type { BetaParams, BinomialObs } from "./beta-binomial"
// Task 5 (retentionForecast) will re-enable these:
// import { betaBinomialModel } from "./beta-binomial"
// import type { EmpiricalDist } from "./types"

export class InvalidObservationError extends Error {
  constructor(public readonly observation: BinomialObs) {
    super(`Invalid observation: k=${observation.k} > n=${observation.n}`)
    this.name = "InvalidObservationError"
  }
}

export class InvalidPriorWeightError extends Error {
  constructor(public readonly weight: number) {
    super(`priorWeight must be > 0, got ${weight}`)
    this.name = "InvalidPriorWeightError"
  }
}

export function bayesianRetentionPosterior(args: {
  prior: BetaParams
  observation: BinomialObs
  priorWeight?: number
}): {
  posterior: BetaParams
  p10: number
  p50: number
  p90: number
} {
  const { prior, observation, priorWeight = 1 } = args
  if (!(priorWeight > 0)) throw new InvalidPriorWeightError(priorWeight)
  if (observation.k > observation.n) throw new InvalidObservationError(observation)

  const posterior: BetaParams = {
    alpha: prior.alpha * priorWeight + observation.k,
    beta: prior.beta * priorWeight + (observation.n - observation.k),
  }
  return {
    posterior,
    p10: betaQuantile(posterior.alpha, posterior.beta, 0.1),
    p50: betaQuantile(posterior.alpha, posterior.beta, 0.5),
    p90: betaQuantile(posterior.alpha, posterior.beta, 0.9),
  }
}
