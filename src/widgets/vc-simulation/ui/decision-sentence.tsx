"use client"

import type { VcSimResult } from "@/shared/api/vc-simulation"
import { useLocale } from "@/shared/i18n"
import { clsx } from "clsx"

type Props = { result: VcSimResult }

/**
 * Page-level conclusion. One sentence at the top of the insights panel that
 * tells the decision-maker the verdict in plain language. Mirrors the
 * gameboard DecisionStoryCard hierarchy (32px font-extrabold).
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
    ? t("vc.insights.headline.hit").replace("{n}", String(bep))
    : t("vc.insights.headline.miss")

  return (
    <div
      className={clsx(
        "rounded-2xl border p-6 transition-colors",
        isHit
          ? "border-border bg-card hover:border-primary"
          : "border-destructive/40 bg-destructive/5",
      )}
    >
      <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground break-keep mb-3">
        {t("vc.insights.decisionLabel")}
      </div>
      <div
        className={clsx(
          "text-[24px] md:text-[28px] font-extrabold leading-tight break-keep",
          isHit ? "text-foreground" : "text-destructive",
        )}
        style={{ letterSpacing: "-0.02em" }}
      >
        {headline}
      </div>
      <div className="mt-4 flex flex-wrap items-baseline gap-x-6 gap-y-1 text-sm">
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
