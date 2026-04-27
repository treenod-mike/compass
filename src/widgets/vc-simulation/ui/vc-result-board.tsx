"use client"

import type { VcSimResult } from "@/shared/api/vc-simulation"
import { DecisionSentence } from "./decision-sentence"
import { CumulativeRoasChart } from "./cumulative-roas-chart"
import { VcResultTabs } from "./vc-result-tabs"

type Props = {
  result: VcSimResult
  gameId: string
  appsflyerInitialCash: number
  bayesianDeltaLtv: number | null
}

/**
 * Result panel hierarchy:
 *   1. DecisionSentence — one-line verdict, always visible.
 *   2. CumulativeRoasChart — primary visualization, always visible.
 *   3. VcResultTabs — secondary info (insights / KPI / cash-flow) compressed
 *      into a tab strip so the decision-maker isn't shown everything at once.
 */
export function VcResultBoard({
  result,
  gameId,
  appsflyerInitialCash,
  bayesianDeltaLtv,
}: Props) {
  return (
    <div className="space-y-4">
      <DecisionSentence result={result} />
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
