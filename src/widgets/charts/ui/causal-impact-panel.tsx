"use client"

import { motion } from "framer-motion"
import { useLocale } from "@/shared/i18n"
import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, Legend,
} from "recharts"
import { PALETTE } from "@/shared/config/chart-colors"
import { CHART_TYPO } from "@/shared/config/chart-typography"
import { ChartTooltip } from "@/shared/ui/chart-tooltip"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/shared/ui/card"

type Series = { date: string; observed: number; counterfactual: number; cfLow: number; cfHigh: number }

type Props = {
  actionLabel: string
  actionDate: string
  metric: string
  series: Series[]
  ate: number
  ateLow: number
  ateHigh: number
  probability: number
  compact?: boolean
}

export function CausalImpactPanel({
  actionLabel, actionDate, metric, series, ate, ateLow, ateHigh, probability, compact = false,
}: Props) {
  const { t } = useLocale()

  const bandData = series.map((s) => ({
    date: s.date,
    observed: s.observed,
    counterfactual: s.counterfactual,
    band: [s.cfLow, s.cfHigh],
  }))

  const statsBlock = (
    <div className="mb-4 grid grid-cols-3 gap-3 text-xs">
      <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-2)] px-3 py-2">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{t("chart.causalImpact.ate")}</div>
        <div className="mt-1 text-lg font-semibold text-foreground">+{ate.toFixed(1)}pp</div>
        <div className="text-[10px] text-muted-foreground">90% CI: [{ateLow.toFixed(1)}, {ateHigh.toFixed(1)}]</div>
      </div>
      <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-2)] px-3 py-2">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{t("chart.causalImpact.probability")}</div>
        <div className="mt-1 text-lg font-semibold" style={{ color: PALETTE.positive }}>
          {(probability * 100).toFixed(0)}%
        </div>
        <div className="text-[10px] text-muted-foreground">{t("chart.causalImpact.probSubtitle")}</div>
      </div>
      <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-2)] px-3 py-2">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{t("chart.causalImpact.verdict")}</div>
        <div className="mt-1 text-sm font-semibold" style={{ color: PALETTE.positive }}>
          {t("chart.causalImpact.verdict.real")}
        </div>
        <div className="text-[10px] text-muted-foreground">{t("chart.causalImpact.verdict.subtitle")}</div>
      </div>
    </div>
  )

  const chartBody = (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={bandData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="cfBand" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={PALETTE.benchmark} stopOpacity={0.28} />
            <stop offset="100%" stopColor={PALETTE.benchmark} stopOpacity={0.06} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="4 4" stroke={PALETTE.grid} vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ ...CHART_TYPO.axisTick, fill: PALETTE.axis }}
          axisLine={{ stroke: PALETTE.border }}
          tickLine={false}
          tickFormatter={(v: string) => v.slice(5)}
        />
        <YAxis
          tick={{ ...CHART_TYPO.axisTick, fill: PALETTE.axis }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => `${v}%`}
          domain={["dataMin - 1", "dataMax + 1"]}
        />
        <Tooltip content={<ChartTooltip />} />
        <Legend wrapperStyle={{ ...CHART_TYPO.legend, color: PALETTE.fg2 }} />
        <Area
          type="monotone"
          dataKey="band"
          name={t("chart.causalImpact.cfBand")}
          stroke="none"
          fill="url(#cfBand)"
          animationDuration={800}
        />
        <Line
          type="monotone"
          dataKey="counterfactual"
          name={t("chart.causalImpact.counterfactual")}
          stroke={PALETTE.benchmark}
          strokeDasharray="4 4"
          strokeWidth={1.5}
          dot={false}
          animationDuration={800}
        />
        <Line
          type="monotone"
          dataKey="observed"
          name={t("chart.causalImpact.observed")}
          stroke={PALETTE.observed}
          strokeWidth={2}
          dot={{ r: 2.5, fill: PALETTE.observed }}
          animationDuration={1000}
        />
        <ReferenceLine x={actionDate} stroke={PALETTE.p50} strokeDasharray="3 3" label={{ value: t("chart.causalImpact.executionPoint"), position: "top", ...CHART_TYPO.annotationText, fill: PALETTE.p50 }} />
      </ComposedChart>
    </ResponsiveContainer>
  )

  if (compact) {
    return (
      <div>
        {statsBlock}
        {chartBody}
      </div>
    )
  }

  return (
    <motion.div layout transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}>
      <Card className="rounded-2xl hover:border-primary transition-colors h-full">
        <CardHeader className="pb-2">
          <div className="flex flex-row justify-between items-start gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground break-keep">
                {t("chart.causalImpact")}
              </CardTitle>
              <CardDescription className="mt-1 text-[11px] text-muted-foreground/80 break-keep">
                {t("info.causalImpact")} · {actionLabel} · {actionDate} · {metric}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {statsBlock}
          {chartBody}
        </CardContent>
      </Card>
    </motion.div>
  )
}
