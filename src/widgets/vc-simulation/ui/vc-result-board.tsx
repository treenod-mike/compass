"use client"

import type { VcSimResult } from "@/shared/api/vc-simulation"
import { VcKpiStrip } from "./vc-kpi-strip"
import { DualBaselineRunwayChart } from "./dual-baseline-runway-chart"
import { IrrHistogramPair } from "./irr-histogram-pair"

type Props = { result: VcSimResult }

export function VcResultBoard({ result }: Props) {
  return (
    <div className="space-y-4">
      <VcKpiStrip result={result} />
      <DualBaselineRunwayChart
        result={result}
        hurdleLine={(result.offer.hurdleRate * result.offer.investmentUsd) / 1000}
      />
      <IrrHistogramPair result={result} />
    </div>
  )
}
