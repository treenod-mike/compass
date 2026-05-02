"use client"

import { motion } from "framer-motion"
import { useLocale } from "@/shared/i18n"
import type { ExperimentData } from "@/shared/api/mock-data"
import { ChartTooltip, TooltipDot } from "@/shared/ui/chart-tooltip"
import { ExpandButton } from "@/shared/ui/expand-button"
import { useChartExpand } from "@/shared/hooks/use-chart-expand"
import { EXPERIMENT_BAR_COLORS } from "@/shared/config/chart-colors"
import { CHART_TYPO } from "@/shared/config/chart-typography"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ResponsiveContainer } from "recharts"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/shared/ui/card"

type ExperimentBarProps = {
  data: ExperimentData[]
  compact?: boolean
}

const C = EXPERIMENT_BAR_COLORS

export function ExperimentBar({ data, compact = false }: ExperimentBarProps) {
  const { t } = useLocale()
  const { expanded, toggle, gridClassName, chartHeight } = useChartExpand({ baseHeight: 280 })

  const sorted = [...data].sort((a, b) => Math.abs(b.deltaLtv) - Math.abs(a.deltaLtv))

  const chartBody = (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <BarChart data={sorted} layout="vertical" margin={{ top: 5, right: 20, left: 100, bottom: 5 }}>
        <CartesianGrid strokeDasharray="4 4" stroke={C.grid} horizontal={false} />
        <XAxis type="number" tick={{ ...CHART_TYPO.axisTick, fill: C.axis }} axisLine={{ stroke: C.border }} tickLine={false} tickFormatter={(v: number) => `$${v}`} />
        <YAxis type="category" dataKey="name" tick={{ ...CHART_TYPO.axisTick, fill: C.label }} axisLine={false} tickLine={false} width={95} />
        <Tooltip
          content={
            <ChartTooltip
              render={({ payload, label }) => (
                <div>
                  {label != null && (
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#0A0A0A", marginBottom: 4 }}>
                      {label}
                    </div>
                  )}
                  {payload.map((p, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, lineHeight: 1.6 }}>
                      <TooltipDot color={p.color ?? C.positive} />
                      <span style={{ color: "#6B7280" }}>ΔLTV</span>
                      <span style={{ marginLeft: "auto", paddingLeft: 12, fontWeight: 500, color: "#0A0A0A", fontVariantNumeric: CHART_TYPO.tooltipValue.fontVariantNumeric, fontFamily: CHART_TYPO.tooltipValue.fontFamily }}>
                        {p.value != null ? `$${p.value}` : ""}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            />
          }
        />
        <Bar dataKey="deltaLtv" radius={[0, 4, 4, 0]} barSize={20} animationBegin={200} animationDuration={800} animationEasing="ease-out">
          {sorted.map((entry) => (
            <Cell key={entry.id} fill={entry.deltaLtv >= 0 ? C.positive : C.negative} fillOpacity={entry.status === "running" ? 0.5 : 1} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )

  if (compact) {
    return <div>{chartBody}</div>
  }

  return (
    <motion.div layout className={gridClassName} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}>
      <Card className="rounded-2xl hover:border-primary transition-colors h-full">
        <CardHeader className="pb-2">
          <div className="flex flex-row justify-between items-start gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground break-keep">
                {t("chart.experimentRoi")}
              </CardTitle>
              <CardDescription className="mt-1 text-[11px] text-muted-foreground/80 break-keep">
                {t("info.experimentRoi")}
              </CardDescription>
            </div>
            <div className="shrink-0">
              <ExpandButton expanded={expanded} onToggle={toggle} />
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
