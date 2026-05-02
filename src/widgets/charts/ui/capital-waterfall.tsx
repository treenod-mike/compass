"use client"

import { useMemo } from "react"
import { motion } from "framer-motion"
import { useLocale } from "@/shared/i18n"
import type { CapitalWaterfallStep } from "@/shared/api/mock-data"
import { ChartTooltip, TooltipDot } from "@/shared/ui/chart-tooltip"
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
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Cell,
  Tooltip,
} from "recharts"

type CapitalWaterfallProps = {
  data: CapitalWaterfallStep[]
  expanded?: boolean
  onToggle?: () => void
  compact?: boolean
}

const PALETTE = {
  inflow:     "#02a262",
  outflow:    "#d22030",
  netPos:     "#1A7FE8",
  netNeg:     "#8B2A1F",
  running:    "#6B7280",
  grid:       "#ECECE8",
  axis:       "#6B7280",
  border:     "#E2E2DD",
}

type WaterfallRow = {
  label: string
  base: number
  visible: number
  value: number
  runningTotal: number
  type: "inflow" | "outflow" | "net"
}

function buildWaterfallRows(data: CapitalWaterfallStep[], locale: "ko" | "en"): WaterfallRow[] {
  let running = 0
  return data.map((step) => {
    let base: number
    let visible: number

    if (step.type === "inflow") {
      base = running
      visible = step.value
      running += step.value
    } else if (step.type === "outflow") {
      // value is negative; bar hangs down from running total
      running += step.value // running decreases
      base = running        // base is the lower end
      visible = Math.abs(step.value)
    } else {
      // net: start from 0
      base = step.value < 0 ? step.value : 0
      visible = Math.abs(step.value)
      running = step.value
    }

    return {
      label: step.label[locale],
      base,
      visible,
      value: step.value,
      runningTotal: running,
      type: step.type,
    }
  })
}

function getBarColor(row: WaterfallRow): string {
  if (row.type === "inflow")  return PALETTE.inflow
  if (row.type === "outflow") return PALETTE.outflow
  return row.value >= 0 ? PALETTE.netPos : PALETTE.netNeg
}

type LegendChipProps = { color: string; label: string; shape?: "square" | "line" }

function LegendChip({ color, label, shape = "square" }: LegendChipProps) {
  return (
    <div className="flex items-center gap-1.5">
      {shape === "square" ? (
        <span
          aria-hidden
          style={{
            width: 10,
            height: 10,
            borderRadius: 2,
            background: color,
            display: "inline-block",
          }}
        />
      ) : (
        <span
          aria-hidden
          style={{
            width: 14,
            height: 0,
            borderTop: `1.5px dashed ${color}`,
            display: "inline-block",
          }}
        />
      )}
      <span className="text-[11px] text-[var(--fg-2)]">{label}</span>
    </div>
  )
}

function getBarFill(row: WaterfallRow): string {
  if (row.type === "inflow")  return "url(#inflowGrad)"
  if (row.type === "outflow") return "url(#outflowGrad)"
  return row.value >= 0 ? "url(#netPosGrad)" : "url(#netNegGrad)"
}

export function CapitalWaterfall({
  data,
  expanded: externalExpanded,
  onToggle: externalToggle,
  compact = false,
}: CapitalWaterfallProps) {
  const { t, locale } = useLocale()
  const { expanded, toggle, gridClassName, chartHeight } = useChartExpand({
    baseHeight: 320,
    expanded: externalExpanded,
    onToggle: externalToggle,
  })

  const rows = useMemo(
    () => buildWaterfallRows(data, locale as "ko" | "en"),
    [data, locale],
  )

  const chartBody = (
    <div className="flex-1" style={{ minHeight: chartHeight }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 16, right: 16, left: 8, bottom: 0 }}>
          <defs>
            <linearGradient id="inflowGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={PALETTE.inflow}  stopOpacity={1} />
              <stop offset="100%" stopColor={PALETTE.inflow}  stopOpacity={0.72} />
            </linearGradient>
            <linearGradient id="outflowGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={PALETTE.outflow} stopOpacity={1} />
              <stop offset="100%" stopColor={PALETTE.outflow} stopOpacity={0.72} />
            </linearGradient>
            <linearGradient id="netPosGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={PALETTE.netPos}  stopOpacity={1} />
              <stop offset="100%" stopColor={PALETTE.netPos}  stopOpacity={0.72} />
            </linearGradient>
            <linearGradient id="netNegGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={PALETTE.netNeg}  stopOpacity={1} />
              <stop offset="100%" stopColor={PALETTE.netNeg}  stopOpacity={0.72} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={PALETTE.grid} vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ ...CHART_TYPO.axisTick, fill: PALETTE.axis }}
            axisLine={{ stroke: PALETTE.border }}
            tickLine={false}
          />
          <YAxis
            tick={{ ...CHART_TYPO.axisTick, fill: PALETTE.axis }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}K`}
            width={52}
          />
          <Tooltip
            content={
              <ChartTooltip
                render={({ payload, label }) => {
                  const row = payload[0]?.payload as WaterfallRow | undefined
                  if (!row) return null
                  const color = getBarColor(row)
                  const sign = row.value > 0 ? "+" : ""
                  const runningSign = row.runningTotal > 0 ? "+" : ""
                  return (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "#0A0A0A", marginBottom: 6 }}>
                        {label}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, lineHeight: 1.6 }}>
                        <TooltipDot color={color} />
                        <span style={{ color: "#6B7280" }}>
                          {row.type === "inflow"
                            ? (locale === "ko" ? "유입" : "Inflow")
                            : row.type === "outflow"
                            ? (locale === "ko" ? "지출" : "Outflow")
                            : (locale === "ko" ? "순 포지션" : "Net Position")}
                        </span>
                        <span style={{
                          marginLeft: "auto",
                          paddingLeft: 12,
                          fontWeight: 600,
                          color,
                          fontVariantNumeric: CHART_TYPO.tooltipValue.fontVariantNumeric,
                          fontFamily: CHART_TYPO.tooltipValue.fontFamily,
                        }}>
                          {sign}${(Math.abs(row.value) / 1000).toFixed(1)}K
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, lineHeight: 1.6, marginTop: 2 }}>
                        <TooltipDot color={PALETTE.running} />
                        <span style={{ color: "#6B7280" }}>
                          {locale === "ko" ? "누적" : "Cumulative"}
                        </span>
                        <span style={{
                          marginLeft: "auto",
                          paddingLeft: 12,
                          fontWeight: 500,
                          color: "#374151",
                          fontVariantNumeric: CHART_TYPO.tooltipValue.fontVariantNumeric,
                          fontFamily: CHART_TYPO.tooltipValue.fontFamily,
                        }}>
                          {runningSign}${(Math.abs(row.runningTotal) / 1000).toFixed(1)}K
                        </span>
                      </div>
                    </div>
                  )
                }}
              />
            }
          />
          {/* Invisible base — lifts visible bar to correct position */}
          <Bar dataKey="base" stackId="stack" fill="transparent" isAnimationActive={false} />
          {/* Visible colored bar with gradient fill */}
          <Bar dataKey="visible" stackId="stack" radius={[3, 3, 0, 0]} animationBegin={200} animationDuration={800}>
            {rows.map((row, i) => (
              <Cell key={i} fill={getBarFill(row)} />
            ))}
          </Bar>
          {/* Cumulative running-total line overlay */}
          <Line
            type="monotone"
            dataKey="runningTotal"
            stroke={PALETTE.running}
            strokeWidth={1.5}
            strokeDasharray="4 4"
            dot={{ r: 2.5, fill: PALETTE.running, stroke: PALETTE.running }}
            activeDot={{ r: 4 }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )

  const legend = (
    <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1">
      <LegendChip color={PALETTE.inflow}  label={t("chart.legend.inflow")} />
      <LegendChip color={PALETTE.outflow} label={t("chart.legend.outflow")} />
      <LegendChip color={PALETTE.netPos}  label={t("chart.legend.netPos")} />
      <LegendChip color={PALETTE.netNeg}  label={t("chart.legend.netNeg")} />
      <LegendChip color={PALETTE.running} label={t("chart.legend.running")} shape="line" />
    </div>
  )

  // --- Compact mode: no Card wrapper ---
  if (compact) {
    return (
      <div className="flex flex-col h-full">
        {legend}
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
                {t("chart.capitalWaterfall")}
              </CardTitle>
              <CardDescription className="mt-1 text-[11px] text-muted-foreground/80 break-keep">
                {locale === "ko" ? "자본 유입·지출 및 누적 포지션" : "Capital inflows, outflows & cumulative position"}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <ExpandButton expanded={expanded} onToggle={toggle} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col flex-1 pt-0">
          {legend}
          {chartBody}
        </CardContent>
      </Card>
    </motion.div>
  )
}
