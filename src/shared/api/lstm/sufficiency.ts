import type { CohortSummary } from "../appsflyer/types"
import { getPrior } from "../prior-data"

export type SufficiencyReason =
  | "insufficient_cohort_history"
  | "insufficient_revenue_history"
  | "dead_d30_retention"
  | "missing_genre_meta"
  | "unknown_genre_prior"

export type SufficiencyResult =
  | { ok: true; gameId: string; genreKey: string }
  | { ok: false; gameId: string; reason: SufficiencyReason }

const MIN_COHORT_DAYS = 30
const MIN_REVENUE_DAYS = 14

export function checkSufficiency(
  cohortSummary: CohortSummary,
  appsMeta: { appId: string; genre?: string; region?: string },
): SufficiencyResult {
  const { appId, genre, region } = appsMeta
  if (cohortSummary.cohorts.length < MIN_COHORT_DAYS) {
    return { ok: false, gameId: appId, reason: "insufficient_cohort_history" }
  }
  if (cohortSummary.revenue.daily.length < MIN_REVENUE_DAYS) {
    return { ok: false, gameId: appId, reason: "insufficient_revenue_history" }
  }
  // Use the most recent cohort with a NON-NULL d30. The freshest cohort's d30
  // is usually still null because day-30 retention isn't observable yet.
  const cohortsWithD30 = cohortSummary.cohorts.filter(
    (c) => c.retainedByDay.d30 !== null,
  )
  if (cohortsWithD30.length > 0) {
    const latestWithD30 = cohortsWithD30[cohortsWithD30.length - 1]!
    if (latestWithD30.retainedByDay.d30 === 0) {
      return { ok: false, gameId: appId, reason: "dead_d30_retention" }
    }
  }
  if (!genre || !region) {
    return { ok: false, gameId: appId, reason: "missing_genre_meta" }
  }
  if (!getPrior({ genre, region })) {
    return { ok: false, gameId: appId, reason: "unknown_genre_prior" }
  }
  return { ok: true, gameId: appId, genreKey: `${genre}:${region}` }
}
