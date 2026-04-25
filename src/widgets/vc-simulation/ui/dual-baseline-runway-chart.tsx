"use client"

import type { VcSimResult } from "@/shared/api/vc-simulation"
import { RunwayFanChart } from "@/widgets/charts"
import { useLocale } from "@/shared/i18n"

type Props = { result: VcSimResult; hurdleLine?: number }

export function DualBaselineRunwayChart({ result, hurdleLine }: Props) {
  const { t } = useLocale()
  const toFanData = (runway: VcSimResult["baselineA"]["runway"]) => ({
    points: runway.map((p) => ({
      month: p.month,
      label: `M${p.month}`,
      p10: p.p10 / 1000,
      p50: p.p50 / 1000,
      p90: p.p90 / 1000,
    })),
    initialCash: result.offer.investmentUsd / 1000,
    cashOutThreshold: 0,
    p50CashOutMonth: -1,
    probCashOut: 0,
  })

  return (
    <RunwayFanChart
      data={toFanData(result.baselineA.runway)}
      overlay={{ data: toFanData(result.baselineB.runway), dashed: true }}
      hurdleLine={hurdleLine}
      title={`${t("vc.baseline.withoutExperiment")} · ${t("vc.baseline.withExperiment")}`}
      locale="ko"
      height={280}
    />
  )
}
