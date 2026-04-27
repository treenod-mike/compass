"use client"

import type { VcSimResult } from "@/shared/api/vc-simulation"
import { VcKpiStrip } from "./vc-kpi-strip"
import { VcInsightsPanel } from "./vc-insights-panel"
import { CumulativeRoasChart } from "./cumulative-roas-chart"
import { DualBaselineRunwayChart } from "./dual-baseline-runway-chart"

type Props = {
  result: VcSimResult
  gameId: string
  appsflyerInitialCash: number
  bayesianDeltaLtv: number | null
}

export function VcResultBoard({
  result,
  gameId,
  appsflyerInitialCash,
  bayesianDeltaLtv,
}: Props) {
  return (
    <div className="space-y-4">
      <VcKpiStrip result={result} />
      <VcInsightsPanel
        result={result}
        gameId={gameId}
        appsflyerInitialCash={appsflyerInitialCash}
        bayesianDeltaLtv={bayesianDeltaLtv}
      />
      <CumulativeRoasChart result={result} />
      <DualBaselineRunwayChart
        result={result}
        hurdleLine={(result.offer.hurdleRate * result.offer.investmentUsd) / 1000}
      />
    </div>
  )
}
