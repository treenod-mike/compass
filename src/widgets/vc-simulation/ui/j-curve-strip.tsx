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
    <div className="rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary">
      <div className="text-xs text-muted-foreground mb-2">
        {t("vc.baseline.gap")} (Baseline ② − ①, $K)
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <ComposedChart data={data}>
          <XAxis dataKey="month" fontSize={10} stroke="var(--muted-foreground)" />
          <YAxis fontSize={10} stroke="var(--muted-foreground)" />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "0.75rem",
              fontSize: 12,
            }}
            labelFormatter={(m) => `${m}${t("vc.unit.months")}`}
          />
          <ReferenceLine y={0} stroke="var(--border)" />
          {breakEven != null && breakEven > 0 && (
            <ReferenceLine
              x={breakEven}
              stroke="var(--success)"
              strokeDasharray="3 3"
              label={{ value: t("vc.kpi.jcurveBreakEven"), fontSize: 10, fill: "var(--success)" }}
            />
          )}
          <Bar dataKey="gap" fill="var(--primary)" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
