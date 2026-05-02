"use client"

import { motion } from "framer-motion"
import { useLocale } from "@/shared/i18n"
import type { ExperimentVariant } from "@/shared/api/mock-data"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ErrorBar, ResponsiveContainer } from "recharts"
import { VARIANT_IMPACT_COLORS } from "@/shared/config/chart-colors"
import { CHART_TYPO } from "@/shared/config/chart-typography"
import { ChartTooltip } from "@/shared/ui/chart-tooltip"
import { ExpandButton } from "@/shared/ui/expand-button"
import { useChartExpand } from "@/shared/hooks/use-chart-expand"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/shared/ui/card"

const C = VARIANT_IMPACT_COLORS

type VariantImpactChartProps = {
  variants: ExperimentVariant[]
  expanded?: boolean
  onToggle?: () => void
  compact?: boolean
}

function colorForStatus(status: string): string {
  if (status === "shipped" || status === "winner") return C.shipped
  if (status === "reverted" || status === "loser") return C.reverted
  if (status === "control") return C.control
  return C.running
}

export function VariantImpactChart({ variants, expanded: externalExpanded, onToggle: externalToggle, compact = false }: VariantImpactChartProps) {
  const { t } = useLocale()
  const { expanded, toggle, gridClassName, chartHeight } = useChartExpand({ baseHeight: 320, expanded: externalExpanded, onToggle: externalToggle })

  const data = variants.map(v => ({
    name: v.name,
    ltv: v.ltv_delta,
    error: [v.ltv_delta - v.ltv_ci_low, v.ltv_ci_high - v.ltv_delta],
    status: v.status,
    sampleSize: v.sample_size,
  }))

  const chartBody = (
    <div className="flex-1" style={{ minHeight: chartHeight }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 10, right: 30, left: 120, bottom: 10 }}>
          <CartesianGrid strokeDasharray="4 4" stroke={C.grid} horizontal={false} />
          <XAxis
            type="number"
            tick={{ ...CHART_TYPO.axisTick, fill: C.axis }}
            axisLine={{ stroke: C.border }}
            tickLine={false}
            tickFormatter={(v) => `$${v.toFixed(2)}`}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ ...CHART_TYPO.axisTick, fill: C.label }}
            axisLine={false}
            tickLine={false}
            width={115}
          />
          <Tooltip
            content={
              <ChartTooltip
                render={({ payload, label }) => (
                  <>
                    {label != null && (
                      <div style={{ ...CHART_TYPO.tooltipTitle, color: "#0A0A0A", marginBottom: 4 }}>{label}</div>
                    )}
                    {payload.map((item, i) => {
                      if (String(item.dataKey ?? item.name) === "ltv") {
                        return (
                          <div key={i} style={{ ...CHART_TYPO.tooltipLabel, color: "#6B7280" }}>
                            ΔLTV: <span style={{ ...CHART_TYPO.tooltipValue, color: "#0A0A0A" }}>${Number(item.value).toFixed(2)}</span>
                          </div>
                        )
                      }
                      return (
                        <div key={i} style={{ ...CHART_TYPO.tooltipLabel, color: "#6B7280" }}>
                          {String(item.name)}: <span style={{ ...CHART_TYPO.tooltipValue, color: "#0A0A0A" }}>{String(item.value)}</span>
                        </div>
                      )
                    })}
                  </>
                )}
              />
            }
          />
          <Bar dataKey="ltv" radius={[0, 6, 6, 0]} barSize={22} animationBegin={200} animationDuration={1000} animationEasing="ease-out">
            {data.map((entry, i) => (
              <Cell key={i} fill={colorForStatus(entry.status)} />
            ))}
            <ErrorBar dataKey="error" width={8} strokeWidth={2} stroke={C.errorBar} direction="x" />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )

  if (compact) {
    return <div className="flex flex-col h-full">{chartBody}</div>
  }

  return (
    <motion.div layout className={`${gridClassName} h-full`}>
      <Card className="rounded-2xl hover:border-primary transition-colors h-full flex flex-col">
        <CardHeader className="pb-2">
          <div className="flex flex-row justify-between items-start gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground break-keep">
                {t("exp.variantImpact")}
              </CardTitle>
              <CardDescription className="mt-1 text-[11px] text-muted-foreground/80 break-keep">
                ΔLTV per variant · 95% CI
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
