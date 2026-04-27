import { betaQuantile } from "./beta-quantile"
import { betaBinomialModel, type BetaParams, type BinomialObs } from "./beta-binomial"
import { fitPowerLaw, extrapolatePowerLawCurve } from "./power-law"
import type { EmpiricalDist } from "./types"

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

export type RetentionForecastPoint = {
  day: number
  p10: number
  p50: number
  p90: number
}

export function retentionForecast(args: {
  observations: { d1: BinomialObs; d7: BinomialObs; d30: BinomialObs }
  priors: { d1: EmpiricalDist; d7: EmpiricalDist; d30: EmpiricalDist }
  priorEffectiveN: number
  priorWeight?: number
  maxDay?: number
}): RetentionForecastPoint[] {
  const { observations, priors, priorEffectiveN, priorWeight = 1, maxDay = 1095 } = args

  // 1. Convert each EmpiricalDist prior → BetaParams via existing engine.
  const priorBeta = {
    d1: betaBinomialModel.priorFromEmpirical(priors.d1, priorEffectiveN),
    d7: betaBinomialModel.priorFromEmpirical(priors.d7, priorEffectiveN),
    d30: betaBinomialModel.priorFromEmpirical(priors.d30, priorEffectiveN),
  }

  // 2. Compute 80% band posterior at each anchor day.
  const post = {
    d1: bayesianRetentionPosterior({ prior: priorBeta.d1, observation: observations.d1, priorWeight }),
    d7: bayesianRetentionPosterior({ prior: priorBeta.d7, observation: observations.d7, priorWeight }),
    d30: bayesianRetentionPosterior({ prior: priorBeta.d30, observation: observations.d30, priorWeight }),
  }

  // 3. Floor: fit power-law on prior medians (p50), evaluate at day 365, divide by 3.
  const priorFitForFloor = fitPowerLaw([
    { day: 1, value: priors.d1.p50 },
    { day: 7, value: priors.d7.p50 },
    { day: 30, value: priors.d30.p50 },
  ])
  const floor = (priorFitForFloor.a * Math.pow(365, -priorFitForFloor.b)) / 3

  // 4. Fit power-law for each band quantile.
  const fits = {
    p10: fitPowerLaw([
      { day: 1, value: post.d1.p10 },
      { day: 7, value: post.d7.p10 },
      { day: 30, value: post.d30.p10 },
    ]),
    p50: fitPowerLaw([
      { day: 1, value: post.d1.p50 },
      { day: 7, value: post.d7.p50 },
      { day: 30, value: post.d30.p50 },
    ]),
    p90: fitPowerLaw([
      { day: 1, value: post.d1.p90 },
      { day: 7, value: post.d7.p90 },
      { day: 30, value: post.d30.p90 },
    ]),
  }

  // 5. Extrapolate each band, with shared floor.
  const curveP10 = extrapolatePowerLawCurve({ fit: fits.p10, maxDay, floor })
  const curveP50 = extrapolatePowerLawCurve({ fit: fits.p50, maxDay, floor })
  const curveP90 = extrapolatePowerLawCurve({ fit: fits.p90, maxDay, floor })

  // 6. Zip into RetentionForecastPoint[].
  const out: RetentionForecastPoint[] = new Array(maxDay)
  for (let i = 0; i < maxDay; i++) {
    out[i] = {
      day: i + 1,
      p10: curveP10[i]!,
      p50: curveP50[i]!,
      p90: curveP90[i]!,
    }
  }
  return out
}
