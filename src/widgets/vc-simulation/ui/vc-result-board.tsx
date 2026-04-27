"use client"

import type { VcSimResult } from "@/shared/api/vc-simulation"
import { VcKpiStrip } from "./vc-kpi-strip"
import { CumulativeRoasChart } from "./cumulative-roas-chart"
import { DualBaselineRunwayChart } from "./dual-baseline-runway-chart"

type Props = { result: VcSimResult }

export function VcResultBoard({ result }: Props) {
  return (
    <div className="space-y-4">
      <VcKpiStrip result={result} />
      <CumulativeRoasChart result={result} />
      <DualBaselineRunwayChart
        result={result}
        hurdleLine={(result.offer.hurdleRate * result.offer.investmentUsd) / 1000}
      />
    </div>
  )
}
