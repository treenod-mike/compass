"use client"

import { motion } from "framer-motion"
import { useLocale } from "@/shared/i18n"
import type { RankingHistoryPoint } from "@/shared/api/mock-data"
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts"
import { RANKING_TREND_COLORS } from "@/shared/config/chart-colors"
import { CHART_TYPO } from "@/shared/config/chart-typography"
import { ChartTooltip, TooltipDot } from "@/shared/ui/chart-tooltip"
import { ExpandButton } from "@/shared/ui/expand-button"
import { useChartExpand } from "@/shared/hooks/use-chart-expand"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/shared/ui/card"

const C = RANKING_TREND_COLORS

type RankingTrendProps = {
  data: RankingHistoryPoint[]
  expanded?: boolean
  onToggle?: () => void
  compact?: boolean
}

export function RankingTrend({
  data,
  expanded: externalExpanded,
  onToggle: externalToggle,
  compact = false,
}: RankingTrendProps) {
  const { t } = useLocale()
  const { expanded, toggle, gridClassName, chartHeight } = useChartExpand({
    baseHeight: 280,
    expanded: externalExpanded,
    onToggle: externalToggle,
  })

  const chartBody = (
    <div className="flex-1" style={{ minHeight: chartHeight }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="rtLineGlow" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={C.line} stopOpacity={0.18} />
              <stop offset="100%" stopColor={C.line} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="4 4" stroke={C.grid} vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ ...CHART_TYPO.axisTick, fill: C.axis }}
            axisLine={{ stroke: C.border }}
            tickLine={false}
          />
          <YAxis
            reversed
            domain={[1, 10]}
            ticks={[1, 3, 5, 8, 10]}
            tick={{ ...CHART_TYPO.axisTick, fill: C.axis }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `#${v}`}
          />
          <Tooltip
            content={
              <ChartTooltip
                render={({ payload, label }) => (
                  <div>
                    {label != null && (
                      <div style={{ ...CHART_TYPO.tooltipTitle, color: "#0A0A0A", marginBottom: 4 }}>
                        {label}
                      </div>
                    )}
                    {payload.map((item, i) => (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          ...CHART_TYPO.tooltipLabel,
                          lineHeight: 1.6,
                        }}
                      >
                        <TooltipDot color={item.color ?? C.line} />
                        <span style={{ color: "#6B7280" }}>
                          {t("market.rankingTrend")}
                        </span>
                        <span
                          style={{
                            marginLeft: "auto",
                            paddingLeft: 12,
                            ...CHART_TYPO.tooltipValue,
                            color: "#0A0A0A",
                          }}
                        >
                          #{item.value}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              />
            }
          />
          {/* Soft area gradient under the rank line */}
          <Area
            type="monotone"
            dataKey="myRank"
            stroke="none"
            fill="url(#rtLineGlow)"
            animationBegin={200}
            animationDuration={1200}
            animationEasing="ease-out"
          />
          <ReferenceLine
            y={5}
            stroke={C.top5}
            strokeDasharray="3 3"
            strokeOpacity={0.5}
            label={{
              value: "Top 5",
              position: "right",
              ...CHART_TYPO.axisLabel,
              fontFamily: CHART_TYPO.annotation.fontFamily,
              fill: C.top5,
            }}
          />
          <Line
            type="monotone"
            dataKey="myRank"
            stroke={C.line}
            strokeWidth={3}
            dot={{ r: 4, fill: "#FFFFFF", stroke: C.line, strokeWidth: 2 }}
            animationBegin={400}
            animationDuration={1200}
            animationEasing="ease-out"
          />
        </ComposedChart>
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
                {t("market.rankingTrend")}
              </CardTitle>
              <CardDescription className="mt-1 text-[11px] text-muted-foreground/80 break-keep">
                선택된 게임 · 6개월 추세
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
