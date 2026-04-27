"use client"

import { clsx } from "clsx"
import { useLocale, type TranslationKey } from "@/shared/i18n"
import type { LeverKey } from "../lib/sensitivity"

type Props = {
  leverKey: LeverKey
  /** "70%", "18mo", "+30%" — short label for the lever's new value. */
  newValueLabel: string
  newBep: number | null
  /** months. negative = shorter (good), positive = longer (worse), null = miss. */
  delta: number | null
  /**
   * Renders a "다른 입력은 BEP에 영향 없음" callout instead of the normal
   * scenario card. Used when a third If/Then slot has no meaningful
   * scenario to show (e.g. no experiment data available).
   */
  invariantHint?: boolean
}

export function IfThenCard({
  leverKey,
  newValueLabel,
  newBep,
  delta,
  invariantHint,
}: Props) {
  const { t } = useLocale()

  if (invariantHint) {
    return (
      <div className="rounded-2xl border border-border/60 bg-muted/30 p-4">
        <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground break-keep">
          {t("vc.insights.ifThen.invariantTitle")}
        </div>
        <div className="mt-2 text-xs text-muted-foreground/80 leading-snug break-keep">
          {t("vc.insights.ifThen.invariantBody")}
        </div>
      </div>
    )
  }

  const labelKey = `vc.insights.lever.${leverKey}` as TranslationKey
  const directionKey: TranslationKey =
    delta != null && delta < 0
      ? "vc.insights.ifThen.shorter"
      : delta != null && delta > 0
        ? "vc.insights.ifThen.longer"
        : "vc.insights.ifThen.unchanged"

  const deltaSign = delta != null && delta > 0 ? "+" : ""

  return (
    <div className="rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground break-keep">
          {t(labelKey)}
        </span>
        <span className="text-[10px] font-mono tabular-nums text-muted-foreground">
          → {newValueLabel}
        </span>
      </div>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span
          className="text-[18px] md:text-[22px] font-extrabold tabular-nums leading-none text-foreground"
          style={{ letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}
        >
          {newBep != null ? newBep : "—"}
        </span>
        <span className="text-xs text-muted-foreground">
          {newBep != null ? t("vc.unit.months") : t("vc.insights.ifThen.miss")}
        </span>
      </div>
      <div
        className={clsx(
          "mt-2 text-[11px] font-medium tabular-nums",
          delta != null && delta < 0 && "text-success",
          delta != null && delta > 0 && "text-destructive",
          (delta == null || delta === 0) && "text-muted-foreground",
        )}
      >
        {delta != null
          ? `${deltaSign}${delta}${t("vc.unit.months")} · ${t(directionKey)}`
          : t("vc.insights.ifThen.toMiss")}
      </div>
    </div>
  )
}
