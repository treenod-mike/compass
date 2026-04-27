// src/shared/api/composite/roas-payback.ts
import type { RealKpiInput, RealKpiResult } from "./types"

export function computeRealKpi(input: RealKpiInput): RealKpiResult {
  return {
    roas: input.mockFallback.roas,
    payback: input.mockFallback.payback,
    status: "mock",
    basisDays: 0,
    observedRevenueUsd: 0,
    forecastRevenueUsd: 0,
    spendUsd: null,
    freshness: "ML1",
  }
}
