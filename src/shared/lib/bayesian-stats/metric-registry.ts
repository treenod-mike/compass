import { BayesianModel } from "./types"
import { betaBinomialModel, BetaParams, BinomialObs } from "./beta-binomial"
import { lognormalModel, LogNormalParams, RevenueObs } from "./lognormal"

export type MetricKey =
  | "retention_d1"
  | "retention_d7"
  | "retention_d30"
  | "monthly_revenue_usd"

export type MetricModelMap = {
  retention_d1: BayesianModel<BetaParams, BinomialObs>
  retention_d7: BayesianModel<BetaParams, BinomialObs>
  retention_d30: BayesianModel<BetaParams, BinomialObs>
  monthly_revenue_usd: BayesianModel<LogNormalParams, RevenueObs>
}

export const METRIC_MODELS: MetricModelMap = {
  retention_d1: betaBinomialModel,
  retention_d7: betaBinomialModel,
  retention_d30: betaBinomialModel,
  monthly_revenue_usd: lognormalModel,
}
