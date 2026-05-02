"use client"

import { motion } from "framer-motion"
import { useLocale } from "@/shared/i18n"
import type { ExperimentVariant } from "@/shared/api/mock-data"
import { ChartTooltip } from "@/shared/ui/chart-tooltip"
import { ExpandButton } from "@/shared/ui/expand-button"
import { useChartExpand } from "@/shared/hooks/use-chart-expand"
import { ROLLOUT_HISTORY_COLORS } from "@/shared/config/chart-colors"
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"
import { CHART_TYPO } from "@/shared/config/chart-typography"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/shared/ui/card"

const C = ROLLOUT_HISTORY_COLORS

type RolloutHistoryTimelineProps = {
  variant: ExperimentVariant
  expanded?: boolean
  onToggle?: () => void
  compact?: boolean
}

export function RolloutHistoryTimeline({ variant, expanded: externalExpanded, onToggle: externalToggle, compact = false }: RolloutHistoryTimelineProps) {
  const { t } = useLocale()
  const { expanded, toggle, gridClassName, chartHeight } = useChartExpand({ baseHeight: 320, expanded: externalExpanded, onToggle: externalToggle })

  if (!variant.rollout_history || variant.rollout_history.length === 0) {
    return (
      <motion.div layout className={gridClassName} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}>
        <Card className="rounded-2xl hover:border-primary transition-colors h-full">
          <CardHeader className="pb-2">
            <div className="flex flex-row justify-between items-start gap-4 flex-wrap">
              <div className="flex-1 min-w-0">
                <CardTitle className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground break-keep">
                  {t("exp.rolloutHistory")}
                </CardTitle>
              </div>
              <div className="shrink-0">
                <ExpandButton expanded={expanded} onToggle={toggle} />
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-caption text-[var(--fg-2)]">No rollout history yet</p>
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  const chartBody = (
    <div className="flex-1" style={{ minHeight: chartHeight }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={variant.rollout_history} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="4 4" stroke={C.grid} vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ ...CHART_TYPO.axisLabel, fill: C.axis }}
            axisLine={{ stroke: C.border }}
            tickLine={false}
            tickFormatter={(v) => v.slice(5)}
          />
          <YAxis
            yAxisId="pct"
            tick={{ ...CHART_TYPO.axisTick, fill: C.axis }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${v}%`}
            domain={[0, 100]}
          />
          <YAxis
            yAxisId="ltv"
            orientation="right"
            tick={{ ...CHART_TYPO.axisTick, fill: C.axis }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `$${v}`}
          />
          <Tooltip content={<ChartTooltip />} />
          <Legend wrapperStyle={{ ...CHART_TYPO.legend }} />
          <Bar yAxisId="pct" dataKey="percentage" fill={C.bar} fillOpacity={0.5} radius={[4, 4, 0, 0]} barSize={20} name="% Rollout" animationBegin={200} animationDuration={800} animationEasing="ease-out" />
          <Line yAxisId="ltv" type="monotone" dataKey="cumulative_ltv" stroke={C.line} strokeWidth={2.5} dot={{ r: 3.5, fill: "#FFFFFF", stroke: C.line, strokeWidth: 2 }} name="Cumulative LTV ($)" animationBegin={400} animationDuration={1000} animationEasing="ease-out" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )

  if (compact) {
    return <div className="flex flex-col h-full">{chartBody}</div>
  }

  return (
    <motion.div layout className={gridClassName} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}>
      <Card className="rounded-2xl hover:border-primary transition-colors h-full flex flex-col">
        <CardHeader className="pb-2">
          <div className="flex flex-row justify-between items-start gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground break-keep">
                {t("exp.rolloutHistory")}
              </CardTitle>
              <CardDescription className="mt-1 text-[11px] text-muted-foreground/80 break-keep">
                {variant.name} · % Rollout + Cumulative LTV
              </CardDescription>
            </div>
            <div className="shrink-0">
              <ExpandButton expanded={expanded} onToggle={toggle} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0 flex-1 flex flex-col">
          {chartBody}
        </CardContent>
      </Card>
    </motion.div>
  )
}
