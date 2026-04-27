// src/shared/api/composite/types.ts
import type { CohortSummary } from "../appsflyer"
import type { RevenueSnapshot } from "../lstm/revenue-snapshot"

export type RealKpiStatus =
  | "real"
  | "insufficient"
  | "fxUnsupported"
  | "mock"

export type RealKpiFreshness = "ML1" | "ML2" | null

export type RealKpiBand = {
  p10: number
  p50: number
  p90: number
}

export type RealKpiInput = {
  gameId: string
  cohortSummary: CohortSummary | null
  revenueSnapshot: RevenueSnapshot
  mockFallback: {
    roas: RealKpiBand    // %
    payback: RealKpiBand // days
  }
  now?: Date
}

export type RealKpiResult = {
  roas: RealKpiBand            // %
  payback: RealKpiBand          // days (≤ horizon, capped)
  status: RealKpiStatus
  basisDays: number
  observedRevenueUsd: number
  forecastRevenueUsd: number
  spendUsd: number | null
  freshness: RealKpiFreshness
}
