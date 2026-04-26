// Task 2 will use these imports — re-add when implementing bayesianRetentionPosterior:
// import { betaQuantile } from "./beta-quantile"
// import { betaBinomialModel, type BetaParams } from "./beta-binomial"
// import type { EmpiricalDist } from "./types"
import type { BinomialObs } from "./beta-binomial"

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
