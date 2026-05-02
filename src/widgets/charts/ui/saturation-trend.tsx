"use client"

import { motion } from "framer-motion"
import { useLocale } from "@/shared/i18n"
import type { SaturationTrendPoint } from "@/shared/api/mock-data"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts"
import { SATURATION_TREND_COLORS } from "@/shared/config/chart-colors"
import { ChartTooltip } from "@/shared/ui/chart-tooltip"
import { ExpandButton } from "@/shared/ui/expand-button"
import { useChartExpand } from "@/shared/hooks/use-chart-expand"
import { CHART_TYPO } from "@/shared/config/chart-typography"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/shared/ui/card"

const C = SATURATION_TREND_COLORS

type SaturationTrendChartProps = {
  data: SaturationTrendPoint[]
  expanded?: boolean
  onToggle?: () => void
  compact?: boolean
}

export function SaturationTrendChart({
  data,
  expanded: externalExpanded,
  onToggle: externalToggle,
  compact = false,
}: SaturationTrendChartProps) {
  const { t } = useLocale()
  const { expanded, toggle, gridClassName, chartHeight } = useChartExpand({
    baseHeight: 320,
    expanded: externalExpanded,
    onToggle: externalToggle,
  })

  const chartBody = (
    <div className="flex-1" style={{ minHeight: chartHeight }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="thresholdGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={C.threshold} stopOpacity={0.3} />
              <stop offset="100%" stopColor={C.threshold} stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id="myRevGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={C.myRevenue} stopOpacity={0.4} />
              <stop offset="100%" stopColor={C.myRevenue} stopOpacity={0.1} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="4 4" stroke={C.grid} vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ ...CHART_TYPO.axisTick, fill: C.axis }}
            axisLine={{ stroke: C.border }}
            tickLine={false}
          />
          <YAxis
            tick={{ ...CHART_TYPO.axisTick, fill: C.axis }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `$${v}K`}
          />
          <Tooltip
            content={
              <ChartTooltip
                render={({ payload, label }) => (
                  <>
                    {label != null && (
                      <div style={{ ...CHART_TYPO.tooltipTitle, color: "#0A0A0A", marginBottom: 4 }}>
                        {label}
                      </div>
                    )}
                    {payload.map((item, i) => (
                      <div
                        key={i}
                        style={{ display: "flex", alignItems: "center", fontSize: 12, lineHeight: 1.6 }}
                      >
                        {item.color && (
                          <span
                            style={{
                              display: "inline-block",
                              width: 8,
                              height: 8,
                              borderRadius: "50%",
                              backgroundColor: item.color,
                              marginRight: 6,
                              flexShrink: 0,
                            }}
                          />
                        )}
                        <span style={{ color: "#6B7280" }}>{item.name}</span>
                        <span
                          style={{
                            marginLeft: "auto",
                            paddingLeft: 12,
                            ...CHART_TYPO.tooltipValue,
                            color: "#0A0A0A",
                          }}
                        >
                          ${item.value}K
                        </span>
                      </div>
                    ))}
                  </>
                )}
              />
            }
          />
          <Legend wrapperStyle={{ ...CHART_TYPO.legend }} />
          <Area
            type="monotone"
            dataKey="topGrossingThreshold"
            stroke={C.threshold}
            strokeWidth={2}
            fill="url(#thresholdGrad)"
            name={t("market.entryThreshold")}
            animationBegin={200}
            animationDuration={1200}
          />
          <Area
            type="monotone"
            dataKey="myRevenue"
            stroke={C.myRevenue}
            strokeWidth={2.5}
            fill="url(#myRevGrad)"
            name={t("market.myRevenue")}
            animationBegin={400}
            animationDuration={1200}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )

  // --- Compact mode: no Card wrapper ---
  if (compact) {
    return <div className="flex flex-col h-full">{chartBody}</div>
  }

  // --- Full mode: Gameboard-pattern Card wrapper ---
  return (
    <motion.div
      layout
      className={gridClassName}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
    >
      <Card className="rounded-2xl hover:border-primary transition-colors h-full flex flex-col">
        <CardHeader className="pb-2">
          <div className="flex flex-row justify-between items-start gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground break-keep">
                {t("market.saturationTrend")}
              </CardTitle>
              <CardDescription className="mt-1 text-[11px] text-muted-foreground/80 break-keep">
                선택된 게임 vs 매출 상위권 기준선
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <ExpandButton expanded={expanded} onToggle={toggle} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col flex-1 pt-0">
          {chartBody}
        </CardContent>
      </Card>
    </motion.div>
  )
}
