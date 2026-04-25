"use client"

import { useMemo } from "react"
import type { Offer, VcSimResult, LstmSnapshot } from "./types"
import { computeVcSimulation } from "./compute"
import { LstmSnapshotSchema } from "./types"
import lstmJson from "../data/lstm/retention-snapshot.json"

const LSTM_SNAPSHOT: LstmSnapshot = LstmSnapshotSchema.parse(lstmJson)

export function isLstmStale(now: Date = new Date(), maxDays = 30): boolean {
  const generated = new Date(LSTM_SNAPSHOT.generated_at)
  return (now.getTime() - generated.getTime()) / 86400000 > maxDays
}

type UseVcSimInput = {
  gameId: string
  offer: Offer
  appsflyerInitialCash: number
  bayesianDeltaLtv: number | null
}

export function useVcSimulation(input: UseVcSimInput): VcSimResult {
  return useMemo(() => {
    const snapshotHasGame = !!LSTM_SNAPSHOT.predictions[input.gameId]
    // TODO: when snapshotHasGame === false, compute.ts returns retention=0 for
    // all months → meaningless monotonic cash decay. Page should render an
    // explicit empty-state instead of the chart. For now we feed the snapshot
    // anyway and rely on dataSourceBadge="default" as a weak signal. Future:
    // implement genre-benchmark fallback or no-data UI.
    const result = computeVcSimulation(input.offer, {
      gameId: input.gameId,
      lstmSnapshot: LSTM_SNAPSHOT,
      bayesianPosterior: input.bayesianDeltaLtv != null ? { deltaLtv: input.bayesianDeltaLtv } : null,
      appsflyerInitialCash: input.appsflyerInitialCash,
    })
    return {
      ...result,
      dataSourceBadge: snapshotHasGame
        ? (isLstmStale() ? "benchmark" : "real")
        : "default",
    }
  }, [input.gameId, JSON.stringify(input.offer), input.appsflyerInitialCash, input.bayesianDeltaLtv])
}
