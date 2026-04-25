import { BayesianModel, CredibleInterval, EmpiricalDist, DegenerateDistributionError } from "./types"

export type LogNormalParams = { muLog: number; sigmaLog: number; nPrior: number }
export type RevenueObs = { monthlyRevenueUsd: number[]; monthsCount: number }

const Z_80 = 1.2815515655446004
const Z_RANGE = 2 * Z_80
const MIN_SIGMA_OBS = 0.01   // floor to avoid divide-by-zero in precision-weighted mean

function priorFromEmpirical(empirical: EmpiricalDist, effectiveN: number): LogNormalParams {
  if (!(empirical.p50 > 0)) throw new DegenerateDistributionError(empirical)
  if (!(empirical.p10 > 0) || !(empirical.p90 > 0)) throw new DegenerateDistributionError(empirical)
  if (empirical.p90 <= empirical.p10) throw new DegenerateDistributionError(empirical)
  const muLog = Math.log(empirical.p50)
  const sigmaLog = (Math.log(empirical.p90) - Math.log(empirical.p10)) / Z_RANGE
  if (!(sigmaLog > 0)) throw new DegenerateDistributionError(empirical)
  return { muLog, sigmaLog, nPrior: Math.max(1, effectiveN) }
}

function posterior(prior: LogNormalParams, obs: RevenueObs): CredibleInterval {
  if (obs.monthsCount === 0 || obs.monthlyRevenueUsd.length === 0) {
    return priorAsInterval(prior)
  }
  const logs = obs.monthlyRevenueUsd.filter((x) => x > 0).map(Math.log)
  if (logs.length === 0) return priorAsInterval(prior)

  const muObs = logs.reduce((s, x) => s + x, 0) / logs.length
  const sigmaObs = logs.length > 1 ? Math.sqrt(variance(logs, muObs)) : MIN_SIGMA_OBS
  const effectiveSigmaObs = Math.max(sigmaObs, MIN_SIGMA_OBS)

  const tauPrior = prior.nPrior / (prior.sigmaLog * prior.sigmaLog)
  const tauObs = logs.length / (effectiveSigmaObs * effectiveSigmaObs)
  const muPost = (tauPrior * prior.muLog + tauObs * muObs) / (tauPrior + tauObs)
  const sigmaPost = Math.sqrt(1 / (tauPrior + tauObs))

  const mean = Math.exp(muPost + (sigmaPost * sigmaPost) / 2)
  const ci_low = Math.exp(muPost - 1.96 * sigmaPost)
  const ci_high = Math.exp(muPost + 1.96 * sigmaPost)
  return { mean, ci_low, ci_high, sampleSize: prior.nPrior + logs.length }
}

function priorAsInterval(prior: LogNormalParams): CredibleInterval {
  const mean = Math.exp(prior.muLog + (prior.sigmaLog * prior.sigmaLog) / 2)
  const ci_low = Math.exp(prior.muLog - 1.96 * prior.sigmaLog)
  const ci_high = Math.exp(prior.muLog + 1.96 * prior.sigmaLog)
  return { mean, ci_low, ci_high, sampleSize: prior.nPrior }
}

function variance(xs: number[], mean: number): number {
  const n = xs.length
  if (n < 2) return 0
  let s = 0
  for (const x of xs) {
    const d = x - mean
    s += d * d
  }
  return s / (n - 1)
}

export const lognormalModel: BayesianModel<LogNormalParams, RevenueObs> = {
  name: "lognormal-mom",
  priorFromEmpirical,
  posterior,
  priorAsInterval,
}
