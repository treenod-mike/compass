export * from "./types"
export * from "./version"
export * from "./effective-sample-size"
export { betaBinomialModel } from "./beta-binomial"
export type { BetaParams, BinomialObs } from "./beta-binomial"
export { lognormalModel } from "./lognormal"
export type { LogNormalParams, RevenueObs } from "./lognormal"
export { validatePriorBasic, validateRetentionPosterior, validateRevenuePosterior } from "./validity"
export { METRIC_MODELS } from "./metric-registry"
export type { MetricKey, MetricModelMap } from "./metric-registry"

// W9 Phase 2 — retention forecast util
export {
  bayesianRetentionPosterior,
  retentionForecast,
  InvalidObservationError,
  InvalidPriorWeightError,
} from "./retention"
export type { RetentionForecastPoint } from "./retention"
export {
  fitPowerLaw,
  extrapolatePowerLawCurve,
  NonDecreasingCurveError,
  MaxDayOutOfRangeError,
} from "./power-law"
export type { PowerLawFit } from "./power-law"
