"use client"

import { useMemo } from "react"
import type { RevenueForecastPoint as ChartPoint } from "../mock-data"
import { loadRevenueSnapshot } from "./revenue-snapshot"
import { resolveSnapshotGameId } from "./game-id"
import {
  buildRevenueForecastVm,
  type RevenueForecastVm,
} from "./revenue-forecast-vm"

export function useRevenueForecast(
  gameId: string,
  mockPoints: ChartPoint[],
): RevenueForecastVm {
  return useMemo(
    () =>
      buildRevenueForecastVm({
        gameId: resolveSnapshotGameId(gameId),
        snapshot: loadRevenueSnapshot(),
        mockPoints,
        now: new Date(),
      }),
    [gameId, mockPoints],
  )
}
