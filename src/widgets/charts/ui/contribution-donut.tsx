"use client"

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts"
import { ChartHeader } from "@/shared/ui/chart-header"
import { ChartTooltip, TooltipDot } from "@/shared/ui/chart-tooltip"
import { PALETTE, MMM_COLORS } from "@/shared/config/chart-colors"
import { CHART_TYPO } from "@/shared/config/chart-typography"
import { useLocale } from "@/shared/i18n"
import type { MmmContribution, ChannelKey } from "@/shared/api/mmm-data"

type ContributionDonutProps = {
  contribution: MmmContribution
}

const CHANNEL_LABEL_KEY = {
  "meta": "mmm.channel.meta",
  "google": "mmm.channel.google",
  "tiktok": "mmm.channel.tiktok",
  "apple-search": "mmm.channel.appleSearch",
} as const

export function ContributionDonut({ contribution }: ContributionDonutProps) {
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

  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--bg-1)] p-6">
      <ChartHeader
        title={t("mmm.contribution.title")}
        subtitle={t("mmm.contribution.center.pct").replace("{{pct}}", String(organicPct))}
      />

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

      <p className="mt-4 text-sm text-[var(--fg-1)] leading-relaxed break-keep">
        {contribution.interpretation[locale]}
      </p>
    </div>
  )
}
