"use client"

import type { VcSimResult } from "@/shared/api/vc-simulation"
import { RunwayFanChart } from "@/widgets/charts"
import { useLocale } from "@/shared/i18n"

type Props = { result: VcSimResult; hurdleLine?: number }

/**
 * Single-baseline runway. 시뮬레이터는 입력 조건으로 본전 회수가 언제 되는지가
 * 본질이라 두 baseline 비교(실험 있음/없음)는 노이즈. baselineB(실험 반영)
 * 단일 fan만 표시한다.
 */
export function DualBaselineRunwayChart({ result, hurdleLine }: Props) {
  const { t } = useLocale()
  const fanData = {
    points: result.baselineB.runway.map((p) => ({
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
  }

  return (
    <RunwayFanChart
      data={fanData}
      hurdleLine={hurdleLine}
      title={t("vc.runway.title")}
      locale="ko"
      height={220}
    />
  )
}
