"use client"

import type { VcSimResult } from "@/shared/api/vc-simulation"
import { CumulativeRoasChart } from "./cumulative-roas-chart"
import { VcResultTabs } from "./vc-result-tabs"

type Props = {
  result: VcSimResult
  gameId: string
  appsflyerInitialCash: number
  bayesianDeltaLtv: number | null
}

/**
 * Result panel: primary chart + tabbed secondary info. The decision sentence
 * is rendered at the page level (above the grid) per spec §5.
 */
export function VcResultBoard({
  result,
  gameId,
  appsflyerInitialCash,
  bayesianDeltaLtv,
}: Props) {
  return (
    <div className="space-y-4">
      <CumulativeRoasChart result={result} />
      <VcResultTabs
        result={result}
        gameId={gameId}
        appsflyerInitialCash={appsflyerInitialCash}
        bayesianDeltaLtv={bayesianDeltaLtv}
      />
    </div>
  )
}
