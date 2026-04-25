export type EmpiricalDist = { p10: number; p50: number; p90: number }

export type CredibleInterval = {
  mean: number
  ci_low: number
  ci_high: number
  sampleSize: number
}

export type Validity =
  | { valid: true }
  | {
      valid: false
      reason:
        | "insufficient_installs"
        | "insufficient_history"
        | "prior_unavailable"
        | "prior_invalid_n"
        | "prior_degenerate"
        | "prior_stale"
        | "engine_error"
      need?: number
      have?: number
      detail?: string
    }

// NOTE: validity-wrapped interval is defined in `src/shared/api/mmp/types.ts`,
// where posterior outputs may be null when validity fails. The pure engine always
// returns CredibleInterval (never null fields), so no wrapper is exported from here.

export interface BayesianModel<TPriorParams, TObservation> {
  name: string
  priorFromEmpirical: (empirical: EmpiricalDist, effectiveN: number) => TPriorParams
  posterior: (prior: TPriorParams, obs: TObservation) => CredibleInterval
  priorAsInterval: (prior: TPriorParams) => CredibleInterval
}

export class DegenerateDistributionError extends Error {
  constructor(public readonly empirical: EmpiricalDist) {
    super(`Degenerate empirical distribution: p10=${empirical.p10}, p90=${empirical.p90}`)
    this.name = "DegenerateDistributionError"
  }
}
