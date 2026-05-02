"use client"

import { motion } from "framer-motion"
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Label,
} from "recharts"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/shared/ui/card"
import { ChartTooltip, TooltipDot } from "@/shared/ui/chart-tooltip"
import { MMM_COLORS, PALETTE } from "@/shared/config/chart-colors"
import { CHART_TYPO } from "@/shared/config/chart-typography"
import { useLocale } from "@/shared/i18n"
import { useSelectedGame } from "@/shared/store/selected-game"
import { useGameSettings } from "@/shared/store/game-settings"
import { lookupCpi } from "@/shared/api/cpi-benchmarks"
import type { MmmChannel } from "@/shared/api/mmm-data"

type CpiQuadrantProps = {
  channels: readonly MmmChannel[]
  compact?: boolean
}

const CHANNEL_LABEL_KEY = {
  "meta": "mmm.channel.meta",
  "google": "mmm.channel.google",
  "tiktok": "mmm.channel.tiktok",
  "apple-search": "mmm.channel.appleSearch",
} as const

function toPoint(c: MmmChannel, marketCpi: number) {
  const satPct = Math.min(100, (c.currentSpend / (c.saturation.halfSaturation * 2)) * 100)
  const devPct = ((c.marginal.cpi - marketCpi) / marketCpi) * 100
  // log10 of spend → bubble size range 200-800
  const spendSize = Math.log10(Math.max(c.currentSpend, 1)) * 120
  return {
    key: c.key,
    saturation: satPct,
    deviation: devPct,
    spendSize,
    spend: c.currentSpend,
    cpi: c.marginal.cpi,
  }
}

export function CpiQuadrant({ channels, compact = false }: CpiQuadrantProps) {
  const { t, locale } = useLocale()
  const gameId = useSelectedGame((s) => s.gameId)
  const settings = useGameSettings((s) => s.settings[gameId])

  // LevelPlay benchmark is genre × country (not per-channel). All channels
  // compare against the same market median for this game's market.
  // Platform fixed to "ios" for Phase 2 (channels carry no platform info).
  const marketCpi = settings ? lookupCpi(settings.country, settings.genre, "ios") : null

  if (marketCpi == null) {
    const noDataContent = (
      <div className="flex items-center justify-center h-full text-[var(--fg-3)] text-sm py-16">
        {t("mmm.benchmarkNoData")}
      </div>
    )

    if (compact) return noDataContent

    return (
      <Card className="rounded-2xl hover:border-primary transition-colors h-full flex flex-col">
        <CardHeader className="pb-2">
          <CardTitle className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground break-keep">
            {t("mmm.benchmark.quadrant.title")}
          </CardTitle>
          <CardDescription className="mt-1 text-[11px] text-muted-foreground/80 break-keep">
            {t("mmm.benchmark.quadrant.subtitle")}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col flex-1 pt-0">
          {noDataContent}
        </CardContent>
      </Card>
    )
  }

  const points = channels.map((c) => ({
    ...toPoint(c, marketCpi),
    name: t(CHANNEL_LABEL_KEY[c.key]),
    color: MMM_COLORS.channels[c.key].line,
  }))

  const chartBody = (
    <div className="flex-1 relative" style={{ minHeight: 300 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 20, right: 20, bottom: 40, left: 40 }}>
          <CartesianGrid strokeDasharray="4 4" stroke={MMM_COLORS.grid} />
          <XAxis
            type="number"
            dataKey="saturation"
            domain={[0, 100]}
            tick={{ ...CHART_TYPO.axisTick, fill: MMM_COLORS.axis }}
            axisLine={{ stroke: MMM_COLORS.border }}
            tickLine={false}
            tickFormatter={(v: number) => `${v}%`}
          >
            <Label value={t("mmm.metric.saturation")} position="bottom" offset={10} fontSize={11} fill={MMM_COLORS.fg2} />
          </XAxis>
          <YAxis
            type="number"
            dataKey="deviation"
            domain={[-60, 60]}
            tick={{ ...CHART_TYPO.axisTick, fill: MMM_COLORS.axis }}
            axisLine={{ stroke: MMM_COLORS.border }}
            tickLine={false}
            tickFormatter={(v: number) => `${v > 0 ? "+" : ""}${v}%`}
          >
            <Label value={t("mmm.benchmark.quadrant.yLabel")} angle={-90} position="insideLeft" fontSize={11} fill={MMM_COLORS.fg2} />
          </YAxis>
          <ZAxis type="number" dataKey="spendSize" range={[200, 800]} />
          <ReferenceLine x={50} stroke={MMM_COLORS.border} strokeDasharray="3 3" />
          <ReferenceLine y={0} stroke={MMM_COLORS.border} strokeDasharray="3 3" />
          <Tooltip
            cursor={{ strokeDasharray: "3 3" }}
            content={
              <ChartTooltip
                render={({ payload }) => {
                  const p = payload?.[0]?.payload as typeof points[number] | undefined
                  if (!p) return null
                  return (
                    <div>
                      <div style={{ ...CHART_TYPO.tooltipTitle, color: PALETTE.fg0, marginBottom: 4 }}>
                        {p.name}
                      </div>
                      <div style={{ ...CHART_TYPO.tooltipLabel, lineHeight: 1.6 }}>
                        <div style={{ display: "flex", gap: 6 }}>
                          <TooltipDot color={p.color} />
                          <span style={{ color: PALETTE.fg2 }}>Spend</span>
                          <span style={{ marginLeft: "auto", ...CHART_TYPO.tooltipValue, color: PALETTE.fg0 }}>
                            ${p.spend.toLocaleString()}
                          </span>
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          <span style={{ width: 8 }} />
                          <span style={{ color: PALETTE.fg2 }}>Sat / Dev</span>
                          <span style={{ marginLeft: "auto", ...CHART_TYPO.tooltipValue, color: PALETTE.fg0 }}>
                            {p.saturation.toFixed(0)}% / {p.deviation > 0 ? "+" : ""}{p.deviation.toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                }}
              />
            }
          />
          {points.map((p) => (
            <Scatter key={p.key} name={p.name} data={[p]} fill={p.color} />
          ))}
        </ScatterChart>
      </ResponsiveContainer>

      {/* Quadrant corner labels */}
      <div className="absolute inset-0 pointer-events-none text-[10px] font-semibold text-[var(--fg-3)]">
        <span className="absolute top-6 right-8 text-right max-w-[130px] leading-tight">{t("mmm.benchmark.quadrant.q.oversaturated")}</span>
        <span className="absolute top-6 left-12 max-w-[130px] leading-tight">{t("mmm.benchmark.quadrant.q.creative")}</span>
        <span className="absolute bottom-12 left-12 max-w-[130px] leading-tight">{t("mmm.benchmark.quadrant.q.optimal")}</span>
        <span className="absolute bottom-12 right-8 text-right max-w-[130px] leading-tight">{t("mmm.benchmark.quadrant.q.unicorn")}</span>
      </div>
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
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
    >
      <Card className="rounded-2xl hover:border-primary transition-colors h-full flex flex-col">
        <CardHeader className="pb-2">
          <div className="flex flex-row justify-between items-start gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground break-keep">
                {t("mmm.benchmark.quadrant.title")}
              </CardTitle>
              <CardDescription className="mt-1 text-[11px] text-muted-foreground/80 break-keep">
                {locale === "ko"
                  ? "채널별 포화도 vs CPI 벤치마크 이탈도"
                  : t("mmm.benchmark.quadrant.subtitle")}
              </CardDescription>
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
