"use client"

import { useState, useMemo } from "react"
import {
  computeMarketingSim,
  type MarketingSimResult,
  type RetentionKeypoint,
} from "@/shared/api/marketing-sim"
import { lookupCpiDetailed, type CountryCode, type Genre, type Platform } from "@/shared/api/cpi-benchmarks"
import retentionSnapshot from "@/shared/api/data/lstm/retention-snapshot.json"

const DEFAULT_GAME_ID = "poko_merge"
const DEFAULT_ARPDAU_USD = 0.55
const HORIZON_DAYS = 90

function extractKeypoints(gameId: string): RetentionKeypoint[] {
  const game = (retentionSnapshot as any).predictions?.[gameId]
  if (!game?.points) return []
  return game.points.map((p: { day: number; p10: number; p50: number; p90: number }) => ({
    day: p.day,
    p10: p.p10,
    p50: p.p50,
    p90: p.p90,
  }))
}

export type MarketingSimState = {
  country: CountryCode
  genre: Genre
  platform: Platform
  uaBudgetUsdPerDay: number
  targetArpdauUsd: number
}

export type MarketingSimDerived = {
  cpiUsd: number | null
  cpiUsedFallback: boolean
  result: MarketingSimResult | null
  observedRevenueResult: MarketingSimResult | null
}

export const DEFAULT_STATE: MarketingSimState = {
  country: "JP",
  genre: "merge",
  platform: "ios",
  uaBudgetUsdPerDay: 1000,
  targetArpdauUsd: DEFAULT_ARPDAU_USD,
}

export function useMarketingSim(initial: Partial<MarketingSimState> = {}) {
  const [state, setState] = useState<MarketingSimState>({ ...DEFAULT_STATE, ...initial })

  const keypoints = useMemo(() => extractKeypoints(DEFAULT_GAME_ID), [])

  const cpiLookup = useMemo(
    () => lookupCpiDetailed(state.country, state.genre, state.platform),
    [state.country, state.genre, state.platform],
  )

  const result = useMemo<MarketingSimResult | null>(() => {
    if (!cpiLookup || keypoints.length === 0) return null
    return computeMarketingSim({
      uaBudgetUsdPerDay: state.uaBudgetUsdPerDay,
      cpiUsd: cpiLookup.cpi,
      retentionKeypoints: keypoints,
      targetArpdauUsd: state.targetArpdauUsd,
      horizonDays: HORIZON_DAYS,
    })
  }, [cpiLookup, keypoints, state.uaBudgetUsdPerDay, state.targetArpdauUsd])

  const observedRevenueResult = useMemo<MarketingSimResult | null>(() => {
    if (!cpiLookup || keypoints.length === 0) return null
    return computeMarketingSim({
      uaBudgetUsdPerDay: state.uaBudgetUsdPerDay,
      cpiUsd: cpiLookup.cpi,
      retentionKeypoints: keypoints,
      targetArpdauUsd: DEFAULT_ARPDAU_USD,
      horizonDays: HORIZON_DAYS,
    })
  }, [cpiLookup, keypoints, state.uaBudgetUsdPerDay])

  const derived: MarketingSimDerived = {
    cpiUsd: cpiLookup?.cpi ?? null,
    cpiUsedFallback: cpiLookup?.usedFallbackGenre ?? false,
    result,
    observedRevenueResult,
  }

  return {
    state,
    setState,
    derived,
    HORIZON_DAYS,
    OBSERVED_ARPDAU: DEFAULT_ARPDAU_USD,
  }
}
