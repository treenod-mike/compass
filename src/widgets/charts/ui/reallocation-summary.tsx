"use client"

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList } from "recharts"
import { ChartHeader } from "@/shared/ui/chart-header"
import { ChartTooltip } from "@/shared/ui/chart-tooltip"
import { MMM_COLORS, PALETTE } from "@/shared/config/chart-colors"
import { CHART_TYPO } from "@/shared/config/chart-typography"
import { useLocale } from "@/shared/i18n"
import type { MmmChannel, MmmReallocation, ChannelKey } from "@/shared/api/mmm-data"

type ReallocationSummaryProps = {
  channels: readonly MmmChannel[]
  reallocation: MmmReallocation
}

const CHANNEL_LABEL_KEY = {
  "meta": "mmm.channel.meta",
  "google": "mmm.channel.google",
  "tiktok": "mmm.channel.tiktok",
  "apple-search": "mmm.channel.appleSearch",
} as const

function computeAfter(
  channels: readonly MmmChannel[],
  reallocation: MmmReallocation,
): Record<ChannelKey, number> {
  const after = Object.fromEntries(channels.map((c) => [c.key, c.currentSpend])) as Record<ChannelKey, number>
  for (const m of reallocation.moves) {
    if (after[m.from] == null) after[m.from] = 0
    if (after[m.to] == null) after[m.to] = 0
    after[m.from] -= m.amount
    after[m.to] += m.amount
  }
  return after
}

function fmtK(v: number): string {
  return `$${Math.round(v / 1000)}K`
}

export function ReallocationSummary({ channels, reallocation }: ReallocationSummaryProps) {
  const { t, locale } = useLocale()
  const after = computeAfter(channels, reallocation)
  const data = channels.map((c) => ({
    key: c.key,
    label: t(CHANNEL_LABEL_KEY[c.key]),
    Before: c.currentSpend,
    After: after[c.key],
  }))

  const totalBefore = data.reduce((s, d) => s + d.Before, 0)
  const totalAfter = data.reduce((s, d) => s + d.After, 0)

  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--bg-1)] p-6">
      <ChartHeader
        title={t("mmm.reallocation.title")}
        subtitle={
          locale === "ko"
            ? `${fmtK(reallocation.totalMoved)} 재배분 시 월 매출 +${fmtK(reallocation.expectedRevenueLift)} (+${reallocation.expectedRevenueLiftPct.toFixed(1)}%) 예상`
            : `${fmtK(reallocation.totalMoved)} reallocation → +${fmtK(reallocation.expectedRevenueLift)}/mo (+${reallocation.expectedRevenueLiftPct.toFixed(1)}%)`
        }
      />

      <div style={{ height: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 10, right: 60, left: 10, bottom: 10 }}>
            <XAxis
              type="number"
              tick={{ ...CHART_TYPO.axisTick, fill: MMM_COLORS.axis }}
              axisLine={{ stroke: MMM_COLORS.border }}
              tickLine={false}
              tickFormatter={(v: number) => fmtK(v)}
            />
            <YAxis
              type="category"
              dataKey="label"
              tick={{ ...CHART_TYPO.axisTick, fill: MMM_COLORS.axis }}
              axisLine={false}
              tickLine={false}
              width={90}
            />
            <Tooltip
              content={
                <ChartTooltip
                  render={({ payload, label }) => (
                    <div>
                      <div style={{ ...CHART_TYPO.tooltipTitle, color: PALETTE.fg0, marginBottom: 4 }}>{label}</div>
                      {payload.map((p, i) => (
                        <div key={i} style={{ ...CHART_TYPO.tooltipLabel, display: "flex", gap: 12 }}>
                          <span style={{ color: PALETTE.fg2 }}>{p.name}</span>
                          <span style={{ marginLeft: "auto", ...CHART_TYPO.tooltipValue, color: PALETTE.fg0 }}>
                            {typeof p.value === "number" ? fmtK(p.value) : ""}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                />
              }
            />
            <Bar dataKey="Before" fill={PALETTE.benchmark} name={t("mmm.reallocation.before")}>
              <LabelList
                dataKey="Before"
                position="right"
                formatter={(v: unknown) => (typeof v === "number" ? fmtK(v) : "")}
                style={{ ...CHART_TYPO.axisTick, fill: PALETTE.fg2 }}
              />
            </Bar>
            <Bar dataKey="After" fill={PALETTE.p50} name={t("mmm.reallocation.after")}>
              <LabelList
                dataKey="After"
                position="right"
                formatter={(v: unknown) => (typeof v === "number" ? fmtK(v) : "")}
                style={{ ...CHART_TYPO.axisTick, fill: PALETTE.fg0, fontWeight: 600 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 flex items-center justify-between text-xs text-[var(--fg-2)] flex-wrap gap-2">
        <span>
          {t("mmm.reallocation.totalMoved")}:{" "}
          <span className="font-bold text-[var(--fg-0)]" style={{ fontVariantNumeric: "tabular-nums" }}>
            {fmtK(reallocation.totalMoved)}
          </span>
        </span>
        <span>
          {t("signal.confidence")}:{" "}
          <span className="font-bold text-[var(--fg-0)]" style={{ fontVariantNumeric: "tabular-nums" }}>
            {Math.round(reallocation.confidence * 100)}%
          </span>
        </span>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>
          {t("mmm.reallocation.total")}: {fmtK(totalBefore)} → {fmtK(totalAfter)}
        </span>
      </div>
    </div>
  )
}
