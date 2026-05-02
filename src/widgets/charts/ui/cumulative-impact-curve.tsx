"use client"

import { motion } from "framer-motion"
import { useLocale } from "@/shared/i18n"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts"
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

type Row = { date: string; actual: number; baseline: number }

type Props = {
  data: Row[]
  compact?: boolean
}

export function CumulativeImpactCurve({ data, compact = false }: Props) {
  const { t } = useLocale()

  const last = data[data.length - 1]
  const gap = last ? (last.actual - last.baseline).toFixed(1) : "0"

  const chartBody = (
    <ResponsiveContainer width="100%" height={compact ? 180 : 240}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="cumActual" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={PALETTE.p50} stopOpacity={0.35} />
            <stop offset="100%" stopColor={PALETTE.p50} stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="cumBaseline" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={PALETTE.benchmark} stopOpacity={0.18} />
            <stop offset="100%" stopColor={PALETTE.benchmark} stopOpacity={0.02} />
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
          tickFormatter={(v: number) => `${v}`}
        />
        <Tooltip content={<ChartTooltip />} />
        <Legend wrapperStyle={{ ...CHART_TYPO.legend, color: PALETTE.fg2 }} />
        <Area
          type="monotone"
          dataKey="baseline"
          name={t("chart.cumulativeImpact.baseline")}
          stroke={PALETTE.benchmark}
          strokeDasharray="4 4"
          strokeWidth={1.5}
          fill="url(#cumBaseline)"
          animationDuration={800}
        />
        <Area
          type="monotone"
          dataKey="actual"
          name={t("chart.cumulativeImpact.actual")}
          stroke={PALETTE.p50}
          strokeWidth={2}
          fill="url(#cumActual)"
          animationDuration={1000}
        />
      </AreaChart>
    </ResponsiveContainer>
  )

  if (compact) {
    return <div>{chartBody}</div>
  }

  return (
    <motion.div layout transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}>
      <Card className="rounded-2xl hover:border-primary transition-colors h-full">
        <CardHeader className="pb-2">
          <div className="flex flex-row justify-between items-start gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground break-keep">
                {t("chart.cumulativeImpact")}
              </CardTitle>
              <CardDescription className="mt-1 text-[11px] text-muted-foreground/80 break-keep">
                {t("info.cumulativeImpact")} · {t("insight.cumulativeImpact").replace("{{gap}}", gap)}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {chartBody}
        </CardContent>
      </Card>
    </motion.div>
  )
}
