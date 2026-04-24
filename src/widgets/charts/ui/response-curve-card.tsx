"use client"

import { useState, useMemo } from "react"
import { motion } from "framer-motion"
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { ChartHeader } from "@/shared/ui/chart-header"
import { ChartTooltip, TooltipDot } from "@/shared/ui/chart-tooltip"
import { ExpandButton } from "@/shared/ui/expand-button"
import { MethodologyModal } from "@/shared/ui/methodology-modal"
import { MMM_COLORS } from "@/shared/config/chart-colors"
import { CHART_TYPO } from "@/shared/config/chart-typography"
import { useLocale } from "@/shared/i18n"
import { cn } from "@/shared/lib/utils"
import type { MmmChannel, ChannelKey } from "@/shared/api/mmm-data"

type ResponseCurveCardProps = {
  channel: MmmChannel
  expanded: boolean
  onToggle: () => void
  gridClassName?: string
}

const TRANSITION = { duration: 0.3, ease: [0.16, 1, 0.3, 1] as const }

const CHANNEL_LABEL_KEY: Record<ChannelKey, "mmm.channel.meta" | "mmm.channel.google" | "mmm.channel.tiktok" | "mmm.channel.appleSearch"> = {
  "meta": "mmm.channel.meta",
  "google": "mmm.channel.google",
  "tiktok": "mmm.channel.tiktok",
  "apple-search": "mmm.channel.appleSearch",
}

/** Linear-interpolate p50(spend) from the grid. */
function interpolateP50(
  grid: readonly number[],
  p50: readonly number[],
  spend: number,
): number {
  if (spend <= grid[0]) return p50[0]
  if (spend >= grid[grid.length - 1]) return p50[p50.length - 1]
  for (let i = 0; i < grid.length - 1; i++) {
    if (spend >= grid[i] && spend <= grid[i + 1]) {
      const t = (spend - grid[i]) / (grid[i + 1] - grid[i])
      return p50[i] + t * (p50[i + 1] - p50[i])
    }
  }
  return p50[p50.length - 1]
}

function fmtMoney(usd: number): string {
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(1)}M`
  if (usd >= 1_000) return `$${(usd / 1_000).toFixed(0)}K`
  return `$${usd.toFixed(0)}`
}

export function ResponseCurveCard({
  channel,
  expanded,
  onToggle,
  gridClassName = "",
}: ResponseCurveCardProps) {
  const { t } = useLocale()
  const [methodologyOpen, setMethodologyOpen] = useState(false)

  const channelColors = MMM_COLORS.channels[channel.key]
  const gradientId = `mmm-band-${channel.key}`

  const chartData = useMemo(() => {
    const { spendGrid, p10, p50, p90 } = channel.responseCurve
    return spendGrid.map((spend, i) => ({
      spend,
      p10: p10[i],
      p50: p50[i],
      bandRange: p90[i] - p10[i],
      p90: p90[i],
    }))
  }, [channel.responseCurve])

  const currentRevenue = useMemo(
    () =>
      interpolateP50(
        channel.responseCurve.spendGrid,
        channel.responseCurve.p50,
        channel.currentSpend,
      ),
    [channel.responseCurve, channel.currentSpend],
  )

  // Saturation % = how far through the Hill curve we are.
  // "Half-saturation" K is where revenue = β/2. By spend=2K we're at ~67% of ceiling.
  // Approximate position: currentSpend / (2·K) * 100%, clamped to [0, 100].
  const saturationPct = useMemo(
    () => Math.min(100, (channel.currentSpend / (channel.saturation.halfSaturation * 2)) * 100),
    [channel.currentSpend, channel.saturation.halfSaturation],
  )

  const chartHeight = expanded ? 360 : 180

  return (
    <motion.div
      layout
      transition={TRANSITION}
      className={cn(
        "rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--bg-1)] p-5 h-full flex flex-col",
        gridClassName,
      )}
    >
      <ChartHeader
        title={t(CHANNEL_LABEL_KEY[channel.key])}
        subtitle={
          expanded
            ? `${t("mmm.metric.currentSpend")} ${fmtMoney(channel.currentSpend)} · mCPI $${channel.marginal.cpi.toFixed(2)}`
            : undefined
        }
        actions={
          <div className="flex items-center gap-2">
            {expanded && (
              <button
                type="button"
                onClick={() => setMethodologyOpen(true)}
                className="rounded-[var(--radius-inline)] px-2 py-1 text-[11px] font-medium text-[var(--fg-2)] hover:bg-[var(--bg-3)] hover:text-[var(--fg-0)] transition-colors"
              >
                📊 {t("mmm.methodology.cta")}
              </button>
            )}
            <ExpandButton expanded={expanded} onToggle={onToggle} />
          </div>
        }
      />

      <div className="flex-1" style={{ minHeight: chartHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 10, right: 16, left: expanded ? 8 : 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={channelColors.line} stopOpacity={0.3} />
                <stop offset="100%" stopColor={channelColors.line} stopOpacity={0.04} />
              </linearGradient>
            </defs>

            {expanded && (
              <CartesianGrid strokeDasharray="4 4" stroke={MMM_COLORS.grid} vertical={false} />
            )}

            <XAxis
              dataKey="spend"
              type="number"
              domain={["dataMin", "dataMax"]}
              tick={expanded ? { ...CHART_TYPO.axisTick, fill: MMM_COLORS.axis } : false}
              axisLine={{ stroke: MMM_COLORS.border }}
              tickLine={false}
              tickFormatter={(v: number) => fmtMoney(v)}
              height={expanded ? 28 : 8}
            />
            <YAxis
              tick={expanded ? { ...CHART_TYPO.axisTick, fill: MMM_COLORS.axis } : false}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => fmtMoney(v)}
              width={expanded ? 48 : 0}
            />

            <Tooltip
              content={
                <ChartTooltip
                  render={({ payload, label }) => {
                    const p50 = payload.find((p) => p.dataKey === "p50")?.value
                    const p10 = payload.find((p) => p.dataKey === "p10")?.value
                    const p90 = payload.find((p) => p.dataKey === "p90")?.value
                    return (
                      <div>
                        <div style={{ ...CHART_TYPO.tooltipTitle, color: MMM_COLORS.fg0, marginBottom: 4 }}>
                          Spend {typeof label === "number" ? fmtMoney(label) : label}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, ...CHART_TYPO.tooltipLabel, lineHeight: 1.6 }}>
                          <TooltipDot color={channelColors.line} />
                          <span style={{ color: MMM_COLORS.fg2 }}>Revenue (p50)</span>
                          <span style={{ marginLeft: "auto", paddingLeft: 12, ...CHART_TYPO.tooltipValue, color: MMM_COLORS.fg0 }}>
                            {typeof p50 === "number" ? fmtMoney(p50) : "—"}
                          </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, ...CHART_TYPO.tooltipLabel, lineHeight: 1.6, color: MMM_COLORS.fg2 }}>
                          <span style={{ width: 8, display: "inline-block" }} />
                          <span>p10 – p90</span>
                          <span style={{ marginLeft: "auto", paddingLeft: 12, ...CHART_TYPO.tooltipValue }}>
                            {typeof p10 === "number" && typeof p90 === "number"
                              ? `${fmtMoney(p10)} – ${fmtMoney(p90)}`
                              : "—"}
                          </span>
                        </div>
                      </div>
                    )
                  }}
                />
              }
            />

            {/* p10–p90 band rendered via stacked areas */}
            <Area
              type="monotone"
              dataKey="p10"
              stackId="band"
              stroke="none"
              fill="transparent"
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="bandRange"
              stackId="band"
              stroke="none"
              fill={`url(#${gradientId})`}
              animationDuration={900}
              animationEasing="ease-out"
            />

            {/* p50 median line */}
            <Line
              type="monotone"
              dataKey="p50"
              stroke={channelColors.line}
              strokeWidth={2.5}
              dot={false}
              animationDuration={900}
              animationEasing="ease-out"
            />

            {/* Current position marker */}
            <ReferenceDot
              x={channel.currentSpend}
              y={currentRevenue}
              r={expanded ? 6 : 4}
              fill={MMM_COLORS.currentPosition}
              stroke="#ffffff"
              strokeWidth={2}
            />

            {/* Expanded-only reference lines */}
            {expanded && (
              <>
                <ReferenceLine
                  x={channel.saturation.halfSaturation}
                  stroke={MMM_COLORS.saturationPoint}
                  strokeDasharray="4 4"
                  label={{
                    value: t("mmm.ref.saturationPoint"),
                    position: "top",
                    fontSize: 10,
                    fill: MMM_COLORS.saturationPoint,
                  }}
                />
                <ReferenceLine
                  x={channel.currentSpend}
                  stroke={MMM_COLORS.currentPosition}
                  strokeDasharray="2 3"
                  strokeOpacity={0.6}
                />
              </>
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Metrics strip — 2-col compact / 4-col expanded */}
      <div className={cn("mt-4 grid gap-2", expanded ? "grid-cols-4" : "grid-cols-2")}>
        <MetricTile
          label={t("mmm.metric.mCPI")}
          value={`$${channel.marginal.cpi.toFixed(2)}`}
          tone={
            channel.marginal.cpi > channel.benchmark.marketMedianCpi * 1.15
              ? "warn"
              : "neutral"
          }
        />
        <MetricTile
          label={t("mmm.metric.saturation")}
          value={`${saturationPct.toFixed(0)}%`}
          tone={saturationPct >= 70 ? "warn" : "neutral"}
        />
        {expanded && (
          <>
            <MetricTile
              label={t("mmm.metric.currentSpend")}
              value={fmtMoney(channel.currentSpend)}
            />
            <MetricTile
              label={t("mmm.metric.marketMedian")}
              value={`$${channel.benchmark.marketMedianCpi.toFixed(2)}`}
            />
          </>
        )}
      </div>

      <MethodologyModal
        open={methodologyOpen}
        onOpenChange={setMethodologyOpen}
        title={t("mmm.methodology.title")}
      >
        <div className="space-y-5 text-sm leading-relaxed text-[var(--fg-1)]">
          <section>
            <h4 className="text-base font-semibold text-[var(--fg-0)] mb-1">
              {t("mmm.methodology.adstock.title")}
            </h4>
            <p>{t("mmm.methodology.adstock.body")}</p>
          </section>
          <section>
            <h4 className="text-base font-semibold text-[var(--fg-0)] mb-1">
              {t("mmm.methodology.saturation.title")}
            </h4>
            <p>{t("mmm.methodology.saturation.body")}</p>
          </section>
          <section>
            <h4 className="text-base font-semibold text-[var(--fg-0)] mb-1">
              {t("mmm.methodology.bayesian.title")}
            </h4>
            <p>{t("mmm.methodology.bayesian.body")}</p>
          </section>
          <section>
            <h4 className="text-base font-semibold text-[var(--fg-0)] mb-1">
              {t("mmm.methodology.limitations.title")}
            </h4>
            <p className="text-[var(--fg-2)] italic">{t("mmm.methodology.limitations.body")}</p>
          </section>
        </div>
      </MethodologyModal>
    </motion.div>
  )
}

type MetricTone = "neutral" | "warn"

function MetricTile({
  label,
  value,
  tone = "neutral",
}: {
  label: string
  value: string
  tone?: MetricTone
}) {
  return (
    <div className="rounded-[var(--radius-inline)] bg-[var(--bg-2)] px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--fg-2)] truncate">
        {label}
      </div>
      <div
        className={cn(
          "text-base font-bold",
          tone === "warn" ? "text-[var(--signal-caution)]" : "text-[var(--fg-0)]",
        )}
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {value}
      </div>
    </div>
  )
}
