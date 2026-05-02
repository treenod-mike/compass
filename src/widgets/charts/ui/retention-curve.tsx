"use client"

/*
  RetentionCurve — Compass's signature chart.
  --------------------------------------------
  Refactored 2026-04-07 to the new design language:
  - No gradient wrapper, no glow
  - Hard-coded hex values now match the design tokens in globals.css
    (recharts SVG attrs don't reliably resolve CSS var() at runtime)
  - Higher data-ink ratio: fewer decorative borders, neutral grid
  - P50 dots now solid (observed) — more honest than hollow dots

  Migrated 2026-04-13 to shared infrastructure:
  - Colors from RETENTION_CURVE_COLORS (chart-colors.ts)
  - ChartHeader, ChartTooltip, ExpandButton, useChartExpand

  Redesigned 2026-04-29 to Gameboard pattern:
  - Card wrapper (rounded-2xl hover:border-primary)
  - CardHeader with CardTitle + CardDescription
  - Soft P10–P90 area gradient via SVG linearGradient
  - compact?: boolean prop
*/

import { useState, useMemo } from "react"
import { motion } from "framer-motion"
import { useLocale } from "@/shared/i18n"
import type { RetentionDataPoint } from "@/shared/api/mock-data"
import { ChartTooltip, TooltipDot } from "@/shared/ui/chart-tooltip"
import { ExpandButton } from "@/shared/ui/expand-button"
import { useChartExpand } from "@/shared/hooks/use-chart-expand"
import { RETENTION_CURVE_COLORS } from "@/shared/config/chart-colors"
import { CHART_TYPO } from "@/shared/config/chart-typography"
import { getPrior } from "@/shared/api/prior-data"
import { betaBinomialModel } from "@/shared/lib/bayesian-stats/beta-binomial"
import { useLiveAfData } from "@/widgets/dashboard/lib/use-live-af-data"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/shared/ui/card"
import {
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Legend,
} from "recharts"

// Validity thresholds per spec §6
const RETENTION_N_THRESHOLD = { 1: 25, 7: 80, 30: 200 } as const

type RetentionCurveProps = {
  data: RetentionDataPoint[]
  asymptoticDay: number
  expanded?: boolean
  onToggle?: () => void
  compact?: boolean
}

const C = RETENTION_CURVE_COLORS

/*
  Custom SVG label for the Asymptotic Arrival reference line.
  Renders a hover-interactive label with a tooltip card that appears
  on mouseEnter. Standard Recharts <ReferenceLine label={...}> is
  static SVG text with zero interactivity — this replaces it.
*/
function AsymptoticLabel({
  viewBox,
  text,
  description,
}: {
  viewBox?: { x?: number; y?: number }
  text: string
  description: string
}) {
  const [hovered, setHovered] = useState(false)
  const x = viewBox?.x ?? 0
  const y = (viewBox?.y ?? 0) - 6

  return (
    <g
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ cursor: "pointer" }}
    >
      {/* Invisible wider hit area for easier hovering */}
      <rect
        x={x - 40}
        y={y - 14}
        width={80}
        height={20}
        fill="transparent"
      />
      {/* Label text */}
      <text
        x={x}
        y={y}
        textAnchor="middle"
        fontSize={CHART_TYPO.axisLabel.fontSize}
        fontWeight={500}
        fontFamily={CHART_TYPO.annotation.fontFamily}
        fill={C.asymptotic}
      >
        {text}
      </text>

      {/* Tooltip card on hover */}
      {hovered && (
        <foreignObject x={x - 120} y={y - 68} width={240} height={56}>
          <div
            style={{
              background: C.bg,
              border: `1px solid ${C.border}`,
              borderRadius: 6,
              padding: "8px 10px",
              fontSize: 11,
              lineHeight: 1.45,
              color: "#4B5563",
              boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
            }}
          >
            <strong style={{ color: C.asymptotic }}>{text}</strong>
            <br />
            {description}
          </div>
        </foreignObject>
      )}
    </g>
  )
}

export function RetentionCurve({
  data,
  asymptoticDay,
  expanded: externalExpanded,
  onToggle: externalToggle,
  compact = false,
}: RetentionCurveProps) {
  const { t, locale } = useLocale()
  const { expanded, toggle, gridClassName, chartHeight } = useChartExpand({
    baseHeight: 384,
    expanded: externalExpanded,
    onToggle: externalToggle,
  })

  const { summary } = useLiveAfData()

  // Compute Bayesian prior + posterior bands per retention day
  const bayesianBands = useMemo(() => {
    const prior = getPrior({ genre: "Merge", region: "JP" })
    if (!prior) return null

    const cohorts = summary?.cohorts ?? []

    function computeDay(
      dayKey: "d1" | "d7" | "d30",
      priorDist: { p10: number; p50: number; p90: number },
      threshold: number,
    ) {
      const priorParams = betaBinomialModel.priorFromEmpirical(priorDist, prior!.effectiveN)
      const priorInterval = betaBinomialModel.priorAsInterval(priorParams)

      const measurable = cohorts.filter((c) => c.retainedByDay[dayKey] !== null)
      const trials = measurable.reduce((s, c) => s + c.installs, 0)
      const successes = measurable.reduce((s, c) => s + (c.retainedByDay[dayKey] ?? 0), 0)
      const ml3 = trials < threshold

      let posteriorInterval = null
      if (!ml3 && trials > 0) {
        try {
          posteriorInterval = betaBinomialModel.posterior(priorParams, { n: trials, k: successes })
        } catch {
          posteriorInterval = null
        }
      }

      // Convert fractions → percentages for the chart
      const pct = (x: number) => x * 100
      return {
        prior: { p10: pct(priorInterval.ci_low), p50: pct(priorInterval.mean), p90: pct(priorInterval.ci_high) },
        posterior: posteriorInterval
          ? { p10: pct(posteriorInterval.ci_low), p50: pct(posteriorInterval.mean), p90: pct(posteriorInterval.ci_high) }
          : null,
        ml3,
      }
    }

    return {
      1:  computeDay("d1",  prior.retention.d1,  RETENTION_N_THRESHOLD[1]),
      7:  computeDay("d7",  prior.retention.d7,  RETENTION_N_THRESHOLD[7]),
      30: computeDay("d30", prior.retention.d30, RETENTION_N_THRESHOLD[30]),
    }
  }, [summary])

  // ML3 flag: true if D1 (smallest threshold) has insufficient installs
  const ml3 = bayesianBands?.[1]?.ml3 ?? false

  const chartData = data.map((d) => {
    const band = bayesianBands?.[d.day as 1 | 7 | 30]
    // Prefer Bayesian prior band; fall back to mock data
    const priorBand = band?.prior
    // If we have a Bayesian posterior, overlay as posteriorP50/P10/P90
    const postBand = band?.posterior
    return {
      day: `D${d.day}`,
      p90: priorBand?.p90 ?? d.p90,
      p75: d.p75,
      p50: priorBand?.p50 ?? d.p50,
      p25: d.p25,
      p10: priorBand?.p10 ?? d.p10,
      genre: d.genre,
      // Posterior overlay (null when ML3 or no data)
      postP90: postBand?.p90 ?? null,
      postP50: postBand?.p50 ?? null,
      postP10: postBand?.p10 ?? null,
    }
  })

  const chartBody = (
    <div className="flex-1" style={{ minHeight: chartHeight }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            {/* Soft gradient for the outer P10–P90 band */}
            <linearGradient id="retentionBandGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={C.p50} stopOpacity={0.18} />
              <stop offset="100%" stopColor={C.p50} stopOpacity={0.04} />
            </linearGradient>
            {/* Soft gradient for the inner P25–P75 band */}
            <linearGradient id="retentionInnerGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={C.p50} stopOpacity={0.28} />
              <stop offset="100%" stopColor={C.p50} stopOpacity={0.08} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="2 4" stroke={C.grid} vertical={false} />
          <XAxis
            dataKey="day"
            tick={{ ...CHART_TYPO.axisTick, fill: C.axis }}
            axisLine={{ stroke: C.border }}
            tickLine={false}
          />
          <YAxis
            tick={{ ...CHART_TYPO.axisTick, fill: C.axis }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => `${v}%`}
            domain={[0, 50]}
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

          {/* Outer band: P10–P90 (widest, soft gradient) */}
          <Area
            type="monotone"
            dataKey="p90"
            stroke="none"
            fill="url(#retentionBandGrad)"
            animationBegin={200}
            animationDuration={1200}
            animationEasing="ease-out"
          />
          <Area type="monotone" dataKey="p10" stroke="none" fill="none" />

          {/* Inner band: P25–P75 (tighter, slightly denser gradient) */}
          <Area
            type="monotone"
            dataKey="p75"
            stroke="none"
            fill="url(#retentionInnerGrad)"
            animationBegin={200}
            animationDuration={1200}
            animationEasing="ease-out"
          />
          <Area type="monotone" dataKey="p25" stroke="none" fill="none" />

          {/* Genre benchmark: subordinate neutral dashed line */}
          <Line
            type="monotone"
            dataKey="genre"
            stroke={C.benchmark}
            strokeWidth={1.25}
            strokeDasharray="4 3"
            dot={false}
            name={t("chart.genreAvg")}
            animationBegin={400}
            animationDuration={1000}
            animationEasing="ease-out"
          />

          {/* P50 median: primary signal line, solid observed dots */}
          <Line
            type="monotone"
            dataKey="p50"
            stroke={C.p50}
            strokeWidth={2}
            dot={{ r: 3, fill: C.p50, stroke: C.p50, strokeWidth: 0 }}
            activeDot={{ r: 5, fill: C.p50 }}
            name={t("chart.p50")}
            animationBegin={400}
            animationDuration={1000}
            animationEasing="ease-out"
          />

          {/* Posterior overlay: Bayesian updated bands (only when sample ≥ threshold) */}
          {!ml3 && (
            <>
              <Area
                type="monotone"
                dataKey="postP90"
                stroke="none"
                fill={C.p50}
                fillOpacity={0.12}
                connectNulls={false}
                legendType="none"
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="postP10"
                stroke="none"
                fill="#FFFFFF"
                connectNulls={false}
                legendType="none"
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="postP50"
                stroke={C.p50}
                strokeWidth={2.5}
                strokeDasharray="6 3"
                dot={false}
                connectNulls={false}
                name="Posterior P50"
                animationBegin={600}
                animationDuration={900}
                animationEasing="ease-out"
              />
            </>
          )}

          {/* Asymptotic arrival marker — custom interactive label */}
          <ReferenceLine
            x={`D${asymptoticDay}`}
            stroke={C.asymptotic}
            strokeDasharray="2 4"
            strokeOpacity={0.7}
            label={
              <AsymptoticLabel
                text={t("chart.asymptotic")}
                description={t("info.asymptotic")}
              />
            }
          />

          <Legend
            verticalAlign="bottom"
            height={32}
            iconSize={10}
            wrapperStyle={{ ...CHART_TYPO.legend, color: C.axis }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )

  if (compact) {
    return <div className="flex flex-col h-full">{chartBody}</div>
  }

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
                {`${t("chart.retention")} — D1 to D60`}
              </CardTitle>
              <CardDescription className="mt-1 text-[11px] text-muted-foreground/80 break-keep">
                {ml3
                  ? (locale === "ko" ? "장르 사전 확률만 표시 (샘플 부족)" : "Genre prior only (sample too small)")
                  : (locale === "ko" ? "2026-03 코호트 · P10 / P50 / P90" : "2026-03 cohort · P10 / P50 / P90")}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {ml3 && (
                <span className="rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide bg-[var(--bg-3)] text-[var(--fg-3)]">
                  ML3 · Sample too small
                </span>
              )}
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
