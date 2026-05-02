"use client"

import { motion } from "framer-motion"
import { useLocale } from "@/shared/i18n"
import type { RetentionDataPoint } from "@/shared/api/mock-data"
import { ChartTooltip, TooltipDot } from "@/shared/ui/chart-tooltip"
import { ExpandButton } from "@/shared/ui/expand-button"
import { useChartExpand } from "@/shared/hooks/use-chart-expand"
import { MARKET_BENCHMARK_COLORS } from "@/shared/config/chart-colors"
import { CHART_TYPO } from "@/shared/config/chart-typography"
import { AreaChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts"
import { priorTopGames } from "@/shared/api/prior-data"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/shared/ui/card"

type MarketBenchmarkProps = {
  data: RetentionDataPoint[]
  expanded?: boolean
  onToggle?: () => void
  compact?: boolean
}

const C = MARKET_BENCHMARK_COLORS

// Top 5 ST games for D7 benchmark reference (retention as fraction → percentage)
const top5Benchmark = priorTopGames.slice(0, 5).map((g) => ({
  name: g.name,
  value: ((g.retention.d7 ?? g.retention.d1 ?? 0) * 100),
}))
// Use the median of top-5 D7 retention as the genre benchmark line value
const top5D7Median = top5Benchmark.map((g) => g.value).sort((a, b) => a - b)[Math.floor(top5Benchmark.length / 2)]

export function MarketBenchmark({
  data,
  expanded: externalExpanded,
  onToggle: externalToggle,
  compact = false,
}: MarketBenchmarkProps) {
  const { t } = useLocale()
  const { expanded, toggle, gridClassName, chartHeight } = useChartExpand({ baseHeight: 280, expanded: externalExpanded, onToggle: externalToggle })

  // Replace the genre benchmark value with real ST top-5 median
  const chartData = data.map((d) => ({
    day: `D${d.day}`,
    p50: d.p50,
    p10: d.p10,
    p90: d.p90,
    // For D7 row use the real ST median; for other days scale proportionally from p50 ratio
    genre: d.day === 7 ? top5D7Median : (d.genre / (data.find((r) => r.day === 7)?.genre || d.genre || 1)) * top5D7Median,
  }))

  const chartBody = (
    <div className="flex-1" style={{ minHeight: chartHeight }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="mbGenreBand" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={C.genre} stopOpacity={0.18} />
              <stop offset="100%" stopColor={C.genre} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="4 4" stroke={C.grid} vertical={false} />
          <XAxis dataKey="day" tick={{ ...CHART_TYPO.axisTick, fill: C.axis }} axisLine={{ stroke: C.border }} tickLine={false} />
          <YAxis tick={{ ...CHART_TYPO.axisTick, fill: C.axis }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${v}%`} domain={[0, 50]} />
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
                    {payload.map((p, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, ...CHART_TYPO.tooltipLabel, lineHeight: 1.6 }}>
                        <TooltipDot color={p.color ?? C.p50} />
                        <span style={{ color: "#6B7280" }}>{p.name}</span>
                        <span style={{ marginLeft: "auto", paddingLeft: 12, ...CHART_TYPO.tooltipValue, color: "#0A0A0A" }}>
                          {p.value != null ? `${p.value}%` : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              />
            }
          />
          <Area type="monotone" dataKey="p90" stroke="none" fill="url(#mbGenreBand)" name={t("chart.bandOuter")} animationBegin={200} animationDuration={1200} animationEasing="ease-out" />
          <Area type="monotone" dataKey="p10" stroke="none" fill="none" animationBegin={200} animationDuration={1200} animationEasing="ease-out" />
          <Line type="monotone" dataKey="genre" stroke={C.genre} strokeWidth={1.5} strokeDasharray="6 3" dot={false} name={t("chart.genreAvg")} animationBegin={400} animationDuration={1000} animationEasing="ease-out" />
          <Line type="monotone" dataKey="p50" stroke={C.p50} strokeWidth={2.5} dot={{ r: 3, fill: "#FFF", stroke: C.p50, strokeWidth: 2 }} name="포코머지" animationBegin={400} animationDuration={1000} animationEasing="ease-out" />
          <Legend verticalAlign="bottom" height={36} iconSize={12} wrapperStyle={{ ...CHART_TYPO.legend }} />
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
                {t("chart.benchmark")}
              </CardTitle>
              <CardDescription className="mt-1 text-[11px] text-muted-foreground/80 break-keep">
                포코머지 vs 퍼즐 장르
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
