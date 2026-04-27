"use client"

import type { VcSimResult } from "@/shared/api/vc-simulation"
import { useLocale } from "@/shared/i18n"
import { clsx } from "clsx"

type Props = { result: VcSimResult }

/**
 * One-line narrative verdict at the top of the result panel. Reframed from
 * verdict-as-headline (28-32px) to story-as-headline (16-18px) per the
 * typography-hierarchy spec — the only 32+px element on the page is the
 * ROAS chart BEP number, and this card carries the *story* explaining it.
 */
export function DecisionSentence({ result }: Props) {
  const { t } = useLocale()
  const bep = result.baselineB.paybackMonths
  const horizon = result.offer.horizonMonths
  const investment = result.offer.investmentUsd
  const finalRoas =
    ((result.baselineB.cumulativeRevenue.at(-1)?.p50 ?? 0) / investment) * 100
  const moic = result.baselineB.p50Moic
  const isHit = bep != null

  const headline = isHit
    ? t("vc.insights.headline.hit")
    : t("vc.insights.headline.miss")

  return (
    <div
      className={clsx(
        "rounded-2xl border p-5 transition-colors",
        isHit
          ? "border-border bg-card hover:border-primary"
          : "border-destructive/40 bg-destructive/5",
      )}
    >
      <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground break-keep mb-2">
        {t("vc.insights.decisionLabel")}
      </div>
      <div
        className={clsx(
          "text-[16px] md:text-[18px] font-medium leading-snug break-keep",
          isHit ? "text-foreground" : "text-destructive",
        )}
      >
        {headline}
      </div>
      <div className="mt-3 flex flex-wrap items-baseline gap-x-5 gap-y-1 text-xs">
        <span className="text-muted-foreground">
          {t("vc.insights.subFinalRoas").replace("{horizon}", String(horizon))}{" "}
          <span className="font-mono tabular-nums font-semibold text-foreground">
            {finalRoas.toFixed(0)}%
          </span>
        </span>
        <span className="text-muted-foreground">
          {t("vc.insights.subMoic")}{" "}
          <span className="font-mono tabular-nums font-semibold text-foreground">
            {Number.isFinite(moic) ? moic.toFixed(2) : "—"}×
          </span>
        </span>
      </div>
    </div>
  )
}
