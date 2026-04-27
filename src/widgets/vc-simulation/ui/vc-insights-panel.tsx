"use client"

import { useMemo } from "react"
import type { VcSimResult } from "@/shared/api/vc-simulation"
import { LSTM_SNAPSHOT } from "@/shared/api/vc-simulation"
import { useLocale } from "@/shared/i18n"
import {
  buildIfThenScenarios,
  tornadoSensitivity,
  type SimContext,
} from "../lib/sensitivity"
import { DecisionSentence } from "./decision-sentence"
import { IfThenCard } from "./if-then-card"
import { TornadoBar } from "./tornado-bar"

type Props = {
  result: VcSimResult
  gameId: string
  appsflyerInitialCash: number
  bayesianDeltaLtv: number | null
}

/**
 * Insights panel — converts the simulator from passive analytical tool into
 * actively prescriptive guide. Sits between VcKpiStrip and CumulativeRoasChart
 * in the result board.
 *
 * Sweeps run client-side via computeVcSimulation (not the React hook) and are
 * memoized on the offer + context inputs. Total compute budget per memo:
 * 8 simulations × ~50ms = ~400ms.
 */
export function VcInsightsPanel({
  result,
  gameId,
  appsflyerInitialCash,
  bayesianDeltaLtv,
}: Props) {
  const { t } = useLocale()

  const ctx: SimContext = {
    gameId,
    lstmSnapshot: LSTM_SNAPSHOT,
    appsflyerInitialCash,
    bayesianDeltaLtv,
  }
  const ctxKey = `${gameId}:${appsflyerInitialCash}:${bayesianDeltaLtv ?? 0}`
  const offerKey = JSON.stringify(result.offer)

  const scenarios = useMemo(
    () => buildIfThenScenarios(result.offer, ctx),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [offerKey, ctxKey],
  )
  const impacts = useMemo(
    () => tornadoSensitivity(result.offer, ctx),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [offerKey, ctxKey],
  )

  // 3rd If/Then slot: experiment scenario when bayesian data exists,
  // otherwise an explicit "BEP-invariant levers" callout.
  const hasExperimentData = bayesianDeltaLtv != null && bayesianDeltaLtv !== 0

  return (
    <div className="space-y-4">
      <DecisionSentence result={result} />

      <div className="grid grid-cols-3 gap-3">
        <IfThenCard
          leverKey={scenarios[0].leverKey}
          newValueLabel={scenarios[0].newValueLabel}
          newBep={scenarios[0].newBep}
          delta={scenarios[0].delta}
        />
        <IfThenCard
          leverKey={scenarios[1].leverKey}
          newValueLabel={scenarios[1].newValueLabel}
          newBep={scenarios[1].newBep}
          delta={scenarios[1].delta}
        />
        {hasExperimentData ? (
          <IfThenCard
            leverKey={scenarios[2].leverKey}
            newValueLabel={scenarios[2].newValueLabel}
            newBep={scenarios[2].newBep}
            delta={scenarios[2].delta}
          />
        ) : (
          <IfThenCard
            leverKey="deltaLtv"
            newValueLabel=""
            newBep={null}
            delta={null}
            invariantHint
          />
        )}
      </div>

      <TornadoBar impacts={impacts} />

      <div className="text-[11px] text-muted-foreground/70 break-keep px-1">
        {t("vc.insights.assumptions")}
      </div>
    </div>
  )
}
