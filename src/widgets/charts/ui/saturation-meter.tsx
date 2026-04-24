"use client"

import { motion } from "framer-motion"
import { MMM_COLORS } from "@/shared/config/chart-colors"
import { useLocale } from "@/shared/i18n"
import type { MmmPortfolio } from "@/shared/api/mmm-data"

type SaturationMeterProps = {
  portfolio: MmmPortfolio
}

function tierColor(pct: number): string {
  if (pct < 33) return MMM_COLORS.channels.google.line   // green
  if (pct < 66) return MMM_COLORS.saturationPoint        // caution
  return "#d22030"                                        // risk red
}

function tierLabelKey(pct: number): "mmm.saturation.tier.low" | "mmm.saturation.tier.medium" | "mmm.saturation.tier.high" {
  if (pct < 33) return "mmm.saturation.tier.low"
  if (pct < 66) return "mmm.saturation.tier.medium"
  return "mmm.saturation.tier.high"
}

export function SaturationMeter({ portfolio }: SaturationMeterProps) {
  const { t, locale } = useLocale()
  const pct = Math.round(portfolio.saturationWeighted * 100)
  const fill = tierColor(pct)
  const tierLabel = t(tierLabelKey(pct))

  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--bg-1)] p-6">
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-[var(--fg-2)] uppercase tracking-wide">
            {t("mmm.saturation.meter.label")}
          </h3>
        </div>
        <div className="flex items-baseline gap-2">
          <span
            className="text-3xl font-extrabold text-[var(--fg-0)]"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {pct}%
          </span>
          <span className="text-sm font-semibold" style={{ color: fill }}>
            · {tierLabel}
          </span>
        </div>
      </div>

      <div className="relative h-6 rounded-full bg-[var(--bg-2)] overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: fill }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>

      <div className="relative h-4 mt-1 text-[10px] font-semibold text-[var(--fg-3)]">
        <span className="absolute left-[33%] -translate-x-1/2">33%</span>
        <span className="absolute left-[66%] -translate-x-1/2">66%</span>
      </div>

      <p className="mt-4 text-sm text-[var(--fg-1)] leading-relaxed break-keep">
        {portfolio.saturationInterpretation[locale]}
      </p>
    </div>
  )
}
