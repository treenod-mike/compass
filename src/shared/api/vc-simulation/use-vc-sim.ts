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
    const lstmForCompute: LstmSnapshot = snapshotHasGame
      ? LSTM_SNAPSHOT
      : LSTM_SNAPSHOT
    const result = computeVcSimulation(input.offer, {
      gameId: input.gameId,
      lstmSnapshot: lstmForCompute,
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
