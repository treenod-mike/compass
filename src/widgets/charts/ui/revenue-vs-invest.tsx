"use client"

import { useMemo } from "react"
import { motion } from "framer-motion"
import { useLocale } from "@/shared/i18n"
import type { RevenueVsInvestPoint } from "@/shared/api/mock-data"
import { ChartTooltip, TooltipDot } from "@/shared/ui/chart-tooltip"
import { ExpandButton } from "@/shared/ui/expand-button"
import { useChartExpand } from "@/shared/hooks/use-chart-expand"
import { REVENUE_VS_INVEST_COLORS } from "@/shared/config/chart-colors"
import { CHART_TYPO } from "@/shared/config/chart-typography"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/shared/ui/card"

type RevenueVsInvestProps = {
  data: RevenueVsInvestPoint[]
  expanded?: boolean
  onToggle?: () => void
  compact?: boolean
}

const C = REVENUE_VS_INVEST_COLORS

export function RevenueVsInvest({
  data,
  expanded: externalExpanded,
  onToggle: externalToggle,
  compact = false,
}: RevenueVsInvestProps) {
  const { t, locale } = useLocale()
  const { expanded, toggle, gridClassName, chartHeight } = useChartExpand({
    baseHeight: 384,
    expanded: externalExpanded,
    onToggle: externalToggle,
  })

  // Find BEP crossing: first index where cumRevenue >= cumUaSpend
  const bepIndex = useMemo(
    () => data.findIndex((d) => d.cumRevenue >= d.cumUaSpend),
    [data],
  )

  const chartBody = (
    <div className="flex-1" style={{ minHeight: chartHeight }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 16, right: 20, left: 8, bottom: 0 }}>
          <defs>
            <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={C.revenue} stopOpacity={0.2} />
              <stop offset="100%" stopColor={C.revenue} stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="gradUaSpend" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={C.uaSpend} stopOpacity={0.15} />
              <stop offset="100%" stopColor={C.uaSpend} stopOpacity={0.02} />
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
            tickFormatter={(v: number) => `$${v}`}
            width={52}
          />

          <Tooltip
            content={
              <ChartTooltip
                render={({ payload, label }) => {
                  const d = payload[0]?.payload as RevenueVsInvestPoint | undefined
                  if (!d) return null
                  const gap = d.cumRevenue - d.cumUaSpend
                  const isPositive = gap >= 0
                  return (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "#0A0A0A", marginBottom: 6 }}>
                        {label}
                      </div>
                      {/* Monthly breakdown */}
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, lineHeight: 1.6 }}>
                        <TooltipDot color={C.revenue} />
                        <span style={{ color: "#6B7280" }}>{t("chart.monthlyRev")}</span>
                        <span style={{ marginLeft: "auto", paddingLeft: 12, fontWeight: 500, color: "#0A0A0A", fontVariantNumeric: CHART_TYPO.tooltipValue.fontVariantNumeric, fontFamily: CHART_TYPO.tooltipValue.fontFamily }}>
                          ${d.revenue}K
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, lineHeight: 1.6 }}>
                        <TooltipDot color={C.uaSpend} />
                        <span style={{ color: "#6B7280" }}>{t("chart.monthlySpend")}</span>
                        <span style={{ marginLeft: "auto", paddingLeft: 12, fontWeight: 500, color: "#0A0A0A", fontVariantNumeric: CHART_TYPO.tooltipValue.fontVariantNumeric, fontFamily: CHART_TYPO.tooltipValue.fontFamily }}>
                          ${d.uaSpend}K
                        </span>
                      </div>
                      {/* Divider */}
                      <div style={{ borderTop: "1px solid #E2E2DD", margin: "4px 0" }} />
                      {/* Cumulative */}
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, lineHeight: 1.6 }}>
                        <TooltipDot color={C.revenue} />
                        <span style={{ color: "#6B7280" }}>{t("chart.cumRevenue")}</span>
                        <span style={{ marginLeft: "auto", paddingLeft: 12, fontWeight: 600, color: "#0A0A0A", fontVariantNumeric: CHART_TYPO.tooltipValue.fontVariantNumeric, fontFamily: CHART_TYPO.tooltipValue.fontFamily }}>
                          ${d.cumRevenue}K
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, lineHeight: 1.6 }}>
                        <TooltipDot color={C.uaSpend} />
                        <span style={{ color: "#6B7280" }}>{t("chart.cumUaSpend")}</span>
                        <span style={{ marginLeft: "auto", paddingLeft: 12, fontWeight: 600, color: "#0A0A0A", fontVariantNumeric: CHART_TYPO.tooltipValue.fontVariantNumeric, fontFamily: CHART_TYPO.tooltipValue.fontFamily }}>
                          ${d.cumUaSpend}K
                        </span>
                      </div>
                      {/* Gap */}
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, lineHeight: 1.6, marginTop: 2 }}>
                        <TooltipDot color={isPositive ? C.profit : C.loss} />
                        <span style={{ color: "#6B7280" }}>
                          {isPositive
                            ? (locale === "ko" ? "회수 초과" : "Surplus")
                            : (locale === "ko" ? "미회수" : "Deficit")}
                        </span>
                        <span style={{
                          marginLeft: "auto",
                          paddingLeft: 12,
                          fontWeight: 700,
                          color: isPositive ? C.profit : C.loss,
                          fontVariantNumeric: CHART_TYPO.tooltipValue.fontVariantNumeric,
                          fontFamily: CHART_TYPO.tooltipValue.fontFamily,
                        }}>
                          {isPositive ? "+" : ""}{gap}K
                        </span>
                      </div>
                      {/* ROAS */}
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, lineHeight: 1.6, marginTop: 2, opacity: 0.7 }}>
                        <span style={{ color: "#6B7280", marginLeft: 14 }}>ROAS {d.roas}%</span>
                      </div>
                    </div>
                  )
                }}
              />
            }
          />

          {/* ── Cumulative UA Spend area (orange, behind) ── */}
          <Area
            type="monotone"
            dataKey="cumUaSpend"
            stroke={C.uaSpend}
            strokeWidth={2.5}
            fill="url(#gradUaSpend)"
            dot={{ r: 3, fill: "#FFFFFF", stroke: C.uaSpend, strokeWidth: 2 }}
            name={t("chart.cumUaSpend")}
            animationBegin={200}
            animationDuration={800}
            animationEasing="ease-out"
          />

          {/* ── Cumulative Revenue area (blue, front) ── */}
          <Area
            type="monotone"
            dataKey="cumRevenue"
            stroke={C.revenue}
            strokeWidth={2.5}
            fill="url(#gradRevenue)"
            dot={(props: Record<string, unknown>) => {
              const { cx, cy, index } = props as { cx: number; cy: number; index: number }
              const isBep = index === bepIndex
              if (isBep) {
                return (
                  <g key={index}>
                    {/* Pulsing ring */}
                    <circle cx={cx} cy={cy} r={10} fill={C.profit} fillOpacity={0.12} />
                    {/* Solid dot */}
                    <circle cx={cx} cy={cy} r={5} fill={C.profit} stroke="#FFFFFF" strokeWidth={2} />
                    {/* BEP label */}
                    <text
                      x={cx}
                      y={cy - 16}
                      textAnchor="middle"
                      {...CHART_TYPO.annotation}
                      fill={C.profit}
                    >
                      BEP
                    </text>
                  </g>
                )
              }
              return (
                <circle
                  key={index}
                  cx={cx}
                  cy={cy}
                  r={3}
                  fill="#FFFFFF"
                  stroke={C.revenue}
                  strokeWidth={2}
                />
              )
            }}
            name={t("chart.cumRevenue")}
            animationBegin={200}
            animationDuration={800}
            animationEasing="ease-out"
          />

          <Legend
            verticalAlign="bottom"
            height={36}
            iconSize={12}
            wrapperStyle={{ ...CHART_TYPO.legend, color: C.legend }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )

  // --- Compact mode: no Card wrapper ---
  if (compact) {
    return (
      <div className="flex flex-col h-full">
        {chartBody}
      </div>
    )
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
                {t("chart.rovsInvest")}
              </CardTitle>
              <CardDescription className="mt-1 text-[11px] text-muted-foreground/80 break-keep">
                {locale === "ko"
                  ? "누적 매출이 1월에 UA 투자를 추월 — 손익분기 도달."
                  : "Cumulative revenue overtook UA spend in Jan — break-even reached."}
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
