"use client"

import { ResponsiveContainer, ComposedChart, Bar, ReferenceLine, XAxis, YAxis, Tooltip } from "recharts"
import type { VcSimResult } from "@/shared/api/vc-simulation"
import { useLocale } from "@/shared/i18n"

type Props = { result: VcSimResult }

export function JCurveStrip({ result }: Props) {
  const { t } = useLocale()
  const data = result.gap.map((v, i) => ({ month: i, gap: v / 1000 }))
  const breakEven = result.jCurveBreakEvenMonth

  return (
    <div className="border border-[var(--bg-4)] rounded-[var(--radius-card)] p-4 bg-[var(--bg-1)]">
      <div className="text-xs text-[var(--fg-2)] mb-2">
        {t("vc.baseline.gap")} (Baseline ② − ①, $K)
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <ComposedChart data={data}>
          <XAxis dataKey="month" fontSize={10} stroke="var(--fg-3)" />
          <YAxis fontSize={10} stroke="var(--fg-3)" />
          <Tooltip
            contentStyle={{ backgroundColor: "var(--bg-1)", border: "1px solid var(--bg-4)", fontSize: 12 }}
            labelFormatter={(m) => `${m}${t("vc.unit.months")}`}
          />
          <ReferenceLine y={0} stroke="var(--fg-3)" />
          {breakEven != null && breakEven > 0 && (
            <ReferenceLine
              x={breakEven}
              stroke="var(--signal-positive)"
              strokeDasharray="3 3"
              label={{ value: t("vc.kpi.jcurveBreakEven"), fontSize: 10, fill: "var(--signal-positive)" }}
            />
          )}
          <Bar dataKey="gap" fill="var(--brand)" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
