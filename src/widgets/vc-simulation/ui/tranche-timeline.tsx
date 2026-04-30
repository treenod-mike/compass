"use client"

import { useLocale } from "@/shared/i18n"
import type { TrancheConfig } from "./tranche-config-panel"

type Props = {
  config: TrancheConfig
  totalInvestmentUsd: number
  horizonMonths: number
}

/**
 * Horizontal timeline visualization of tranche schedule.
 * v1: pure visual; reflects TrancheConfig values without affecting compute.
 */
export function TrancheTimeline({ config, totalInvestmentUsd, horizonMonths }: Props) {
  const { t } = useLocale()

  if (!config.enabled) return null

  const tranche1Usd = totalInvestmentUsd * (1 - config.tranche2Pct)
  const tranche2Usd = totalInvestmentUsd * config.tranche2Pct
  const tranche2Position = Math.min(100, (config.tranche2AtMonth / horizonMonths) * 100)

  const fmt = (usd: number) => {
    if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(1)}M`
    if (usd >= 1_000) return `$${Math.round(usd / 1_000)}K`
    return `$${usd.toFixed(0)}`
  }

  return (
    <div className="rounded-md border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-bold uppercase tracking-[0.08em] text-foreground">
          {t("vc.tranches.timeline")}
        </h4>
        <span className="text-[10px] text-muted-foreground tabular-nums">
          M0 → M{horizonMonths}
        </span>
      </div>

      <div className="relative h-12">
        {/* Track */}
        <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 bg-muted rounded-full" />

        {/* Tranche 1 marker — at start (M0) */}
        <div className="absolute left-0 top-0 flex flex-col items-start">
          <div className="size-3 rounded-full bg-primary border-2 border-card" style={{ marginTop: "18px" }} />
          <div className="text-[10px] text-foreground font-mono tabular-nums mt-1">
            {fmt(tranche1Usd)}
          </div>
        </div>

        {/* Tranche 2 marker — at trigger month */}
        <div className="absolute top-0 flex flex-col items-start" style={{ left: `${tranche2Position}%` }}>
          <div className="size-3 rounded-full bg-[var(--signal-caution)] border-2 border-card" style={{ marginTop: "18px" }} />
          <div className="text-[10px] text-foreground font-mono tabular-nums mt-1">
            {fmt(tranche2Usd)}
          </div>
        </div>
      </div>

      <div className="mt-2 text-[10px] text-muted-foreground">
        {t("vc.tranches.timelineHint")}
      </div>
    </div>
  )
}
