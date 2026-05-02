"use client"

import { motion } from "framer-motion"
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts"
import { ChartTooltip, TooltipDot } from "@/shared/ui/chart-tooltip"
import { PALETTE, MMM_COLORS } from "@/shared/config/chart-colors"
import { CHART_TYPO } from "@/shared/config/chart-typography"
import { useLocale } from "@/shared/i18n"
import type { MmmContribution, ChannelKey } from "@/shared/api/mmm-data"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/shared/ui/card"

type ContributionDonutProps = {
  contribution: MmmContribution
  compact?: boolean
}

const CHANNEL_LABEL_KEY = {
  "meta": "mmm.channel.meta",
  "google": "mmm.channel.google",
  "tiktok": "mmm.channel.tiktok",
  "apple-search": "mmm.channel.appleSearch",
} as const

export function ContributionDonut({ contribution, compact = false }: ContributionDonutProps) {
  const { t, locale } = useLocale()
  const total = contribution.totalInstalls
  const organicPct = total > 0 ? Math.round((contribution.organic / total) * 100) : 0

  const slices = [
    {
      name: t("mmm.contribution.organic.label"),
      value: contribution.organic,
      color: PALETTE.benchmark,
    },
    ...(Object.entries(contribution.paid) as Array<[ChannelKey, number]>).map(
      ([key, value]) => ({
        name: t(CHANNEL_LABEL_KEY[key]),
        value,
        color: MMM_COLORS.channels[key].line,
      }),
    ),
  ]

  const chartBody = (
    <div className="grid grid-cols-[1fr_1fr] gap-6 items-center">
      <div style={{ height: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              innerRadius={60}
              outerRadius={100}
              paddingAngle={2}
              dataKey="value"
              strokeWidth={0}
            >
              {slices.map((s, i) => (
                <Cell key={i} fill={s.color} />
              ))}
            </Pie>
            <Tooltip
              content={
                <ChartTooltip
                  render={({ payload }) => (
                    <div>
                      {payload.map((p, i) => {
                        const v = typeof p.value === "number" ? p.value : 0
                        const pct = total > 0 ? Math.round((v / total) * 100) : 0
                        return (
                          <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, ...CHART_TYPO.tooltipLabel, lineHeight: 1.6 }}>
                            <TooltipDot color={p.color ?? PALETTE.fg2} />
                            <span style={{ color: PALETTE.fg2 }}>{p.name}</span>
                            <span style={{ marginLeft: "auto", paddingLeft: 12, ...CHART_TYPO.tooltipValue, color: PALETTE.fg0 }}>
                              {v.toLocaleString()} ({pct}%)
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                />
              }
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-col gap-2">
        {slices.map((s) => {
          const pct = total > 0 ? Math.round((s.value / total) * 100) : 0
          return (
            <div key={s.name} className="flex items-center gap-2 text-sm">
              <span className="inline-block w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: s.color }} />
              <span className="font-medium text-[var(--fg-1)] flex-1 truncate">{s.name}</span>
              <span className="text-[var(--fg-2)]" style={{ fontVariantNumeric: "tabular-nums" }}>
                {s.value.toLocaleString()}
              </span>
              <span
                className="text-xs text-[var(--fg-2)] w-10 text-right"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {pct}%
              </span>
            </div>
          )
        })}
        <div className="mt-2 pt-2 border-t border-[var(--border-default)] flex items-center gap-2 text-sm font-bold">
          <span className="flex-1 text-[var(--fg-0)]">{t("mmm.contribution.total")}</span>
          <span className="text-[var(--fg-0)]" style={{ fontVariantNumeric: "tabular-nums" }}>
            {total.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  )

  const interpretation = (
    <p className="mt-4 text-sm text-[var(--fg-1)] leading-relaxed break-keep">
      {contribution.interpretation[locale]}
    </p>
  )

  // --- Compact mode: no Card wrapper ---
  if (compact) {
    return (
      <div className="flex flex-col">
        {chartBody}
        {interpretation}
      </div>
    )
  }

  // --- Full mode: Gameboard-pattern Card wrapper ---
  return (
    <motion.div layout transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}>
      <Card className="rounded-2xl hover:border-primary transition-colors">
        <CardHeader className="pb-2">
          <div className="flex flex-row justify-between items-start gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground break-keep">
                {t("mmm.contribution.title")}
              </CardTitle>
              <CardDescription className="mt-1 text-[11px] text-muted-foreground/80 break-keep">
                {t("mmm.contribution.center.pct").replace("{{pct}}", String(organicPct))}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {chartBody}
          {interpretation}
        </CardContent>
      </Card>
    </motion.div>
  )
}
