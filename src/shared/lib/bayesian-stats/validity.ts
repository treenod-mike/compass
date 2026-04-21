import { Validity } from "./types"

const MIN_PRIOR_N = 10
const MAX_PRIOR_AGE_DAYS = 30

export function validatePriorBasic(args: {
  nonNullCount: number
  p10: number
  p50: number
  p90: number
  ageDays: number
}): Validity {
  if (args.nonNullCount < MIN_PRIOR_N) {
    return { valid: false, reason: "prior_invalid_n", need: MIN_PRIOR_N, have: args.nonNullCount }
  }
  if (!(args.p90 > args.p10)) {
    return { valid: false, reason: "prior_degenerate", detail: `p10=${args.p10} p90=${args.p90}` }
  }
  if (args.ageDays > MAX_PRIOR_AGE_DAYS) {
    return { valid: false, reason: "prior_stale", have: args.ageDays, need: MAX_PRIOR_AGE_DAYS }
  }
  return { valid: true }
}

const RETENTION_N_THRESHOLD: Record<1 | 7 | 30, number> = { 1: 25, 7: 80, 30: 200 }

export function validateRetentionPosterior(
  obs: { installs: number; retained: number },
  dayN: 1 | 7 | 30,
): Validity {
  const threshold = RETENTION_N_THRESHOLD[dayN]
  if (obs.installs < threshold) {
    return { valid: false, reason: "insufficient_installs", need: threshold, have: obs.installs }
  }
  return { valid: true }
}

const MIN_REVENUE_MONTHS = 3
const MIN_MONTHLY_REVENUE_USD = 1_000

export function validateRevenuePosterior(obs: { monthlyRevenueUsd: number[]; monthsCount: number }): Validity {
  if (obs.monthsCount < MIN_REVENUE_MONTHS) {
    return { valid: false, reason: "insufficient_history", need: MIN_REVENUE_MONTHS, have: obs.monthsCount }
  }
  const hasLowFloor = obs.monthlyRevenueUsd.some((r) => r < MIN_MONTHLY_REVENUE_USD)
  if (hasLowFloor) {
    return { valid: false, reason: "insufficient_history", detail: "monthly revenue below $1000 floor" }
  }
  return { valid: true }
}
