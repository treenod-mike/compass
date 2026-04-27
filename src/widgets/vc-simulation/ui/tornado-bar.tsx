"use client"

import { useLocale, type TranslationKey } from "@/shared/i18n"
import type { LeverImpact } from "../lib/sensitivity"

type Props = { impacts: LeverImpact[] }

/**
 * Horizontal bars showing each lever's BEP-impact magnitude when swung
 * up or down. Sorted descending; BEP-invariant levers explicitly labeled
 * "no impact" rather than hidden.
 */
export function TornadoBar({ impacts }: Props) {
  const { t } = useLocale()

  const magnitude = (i: LeverImpact) =>
    Math.max(Math.abs(i.bepDeltaUp ?? 0), Math.abs(i.bepDeltaDown ?? 0))

  const sorted = [...impacts].sort((a, b) => {
    if (a.invariant && !b.invariant) return 1
    if (!a.invariant && b.invariant) return -1
    return magnitude(b) - magnitude(a)
  })

  const maxAbs = Math.max(...sorted.map(magnitude), 1)

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground mb-1 break-keep">
        {t("vc.insights.tornado.title")}
      </div>
      <div className="text-[11px] text-muted-foreground/80 mb-4 break-keep">
        {t("vc.insights.tornado.subtitle")}
      </div>
      <div className="space-y-2.5">
        {sorted.map((impact) => {
          const labelKey = `vc.insights.lever.${impact.leverKey}` as TranslationKey
          const m = magnitude(impact)
          const widthPct = (m / maxAbs) * 100
          return (
            <div key={impact.leverKey} className="flex items-center gap-3 text-xs">
              <div className="w-32 shrink-0 text-muted-foreground break-keep">
                {t(labelKey)}
              </div>
              <div className="flex-1 relative h-5 bg-muted/30 rounded-md overflow-hidden">
                {!impact.invariant && (
                  <div
                    className="absolute left-0 top-0 h-full bg-primary/70 rounded-md"
                    style={{ width: `${widthPct}%` }}
                  />
                )}
              </div>
              <div className="w-24 shrink-0 text-right font-mono tabular-nums">
                {impact.invariant ? (
                  <span className="text-muted-foreground/60">
                    {t("vc.insights.tornado.invariant")}
                  </span>
                ) : (
                  <span className="text-foreground">
                    ±{m}
                    {t("vc.unit.months")}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
