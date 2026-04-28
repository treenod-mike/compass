"use client"
import { useMemo } from "react"
import { useLiveAfData } from "./use-live-af-data"
import { loadRevenueSnapshot } from "@/shared/api/lstm/revenue-snapshot"
import { computeRealKpi } from "@/shared/api/composite/roas-payback"
import type {
  RealKpiInput,
  RealKpiResult,
} from "@/shared/api/composite/types"

export function useRealKpi(
  gameId: string,
  mockFallback: RealKpiInput["mockFallback"],
): RealKpiResult {
  const { summary, state } = useLiveAfData()
  // Treat 'backfilling' as if cohort isn't ready yet — keeps computeRealKpi pure.
  const cohortSummary = state?.status === "backfilling" ? null : summary
  return useMemo(
    () =>
      computeRealKpi({
        gameId,
        cohortSummary,
        revenueSnapshot: loadRevenueSnapshot(),
        mockFallback,
      }),
    [gameId, cohortSummary, mockFallback],
  )
}
