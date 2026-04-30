"use client"

import type { VcSimResult } from "@/shared/api/vc-simulation"
import { useLocale } from "@/shared/i18n"
import { clsx } from "clsx"

type Props = { result: VcSimResult; pinned?: VcSimResult | null }

export function VcKpiStrip({ result, pinned = null }: Props) {
  const { t } = useLocale()
  const { baselineB, offer } = result
  const irrBelow = Number.isFinite(baselineB.p50Irr) && baselineB.p50Irr < offer.hurdleRate
  const irrDisplay = Number.isFinite(baselineB.p50Irr)
    ? `${(baselineB.p50Irr * 100).toFixed(1)}%`
    : "—"
  const moicDisplay = Number.isFinite(baselineB.p50Moic)
    ? `${baselineB.p50Moic.toFixed(2)}×`
    : "—"
  const paybackDisplay = baselineB.paybackMonths != null
    ? `${baselineB.paybackMonths}${t("vc.unit.months")}`
    : t("vc.error.convergence")
  const jCurveDisplay = result.jCurveBreakEvenMonth === null
    ? t("vc.error.jcurveNoRecovery")
    : result.jCurveBreakEvenMonth === 0
      ? t("vc.error.jcurveNoDrop")
      : `${result.jCurveBreakEvenMonth}${t("vc.unit.months")}`

  const irrDelta = pinned && Number.isFinite(baselineB.p50Irr) && Number.isFinite(pinned.baselineB.p50Irr)
    ? formatPctDelta(baselineB.p50Irr, pinned.baselineB.p50Irr)
    : undefined
  const moicDelta = pinned && Number.isFinite(baselineB.p50Moic) && Number.isFinite(pinned.baselineB.p50Moic)
    ? formatXDelta(baselineB.p50Moic, pinned.baselineB.p50Moic)
    : undefined
  const paybackDelta = pinned ? formatMonthsDelta(baselineB.paybackMonths, pinned.baselineB.paybackMonths) : undefined
  const jCurveDelta = pinned ? formatMonthsDelta(result.jCurveBreakEvenMonth, pinned.jCurveBreakEvenMonth) : undefined

  return (
    <div className="grid grid-cols-4 gap-4">
      <KpiCard label={t("vc.kpi.irr")} value={irrDisplay} deltaText={irrDelta} tone={irrBelow ? "risk" : "positive"} />
      <KpiCard label={t("vc.kpi.moic")} value={moicDisplay} deltaText={moicDelta} />
      <KpiCard label={t("vc.kpi.payback")} value={paybackDisplay} deltaText={paybackDelta} />
      <KpiCard label={t("vc.kpi.jcurveBreakEven")} value={jCurveDisplay} deltaText={jCurveDelta} />
    </div>
  )
}

function formatPctDelta(curr: number, prev: number): string {
  const diff = (curr - prev) * 100
  return `${diff >= 0 ? "+" : ""}${diff.toFixed(1)}%pt`
}

function formatXDelta(curr: number, prev: number): string {
  const diff = curr - prev
  return `${diff >= 0 ? "+" : ""}${diff.toFixed(2)}×`
}

function formatMonthsDelta(curr: number | null, prev: number | null): string | undefined {
  if (curr == null || prev == null) return undefined
  const diff = curr - prev
  return `${diff >= 0 ? "+" : ""}${diff}mo`
}

function KpiCard({ label, value, deltaText, tone }: { label: string; value: string; deltaText?: string; tone?: "positive" | "risk" }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary">
      <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground break-keep">
        {label}
      </div>
      <div
        className={clsx(
          "mt-2.5 text-[22px] md:text-[24px] font-extrabold leading-none tabular-nums",
          tone === "risk" ? "text-destructive" : "text-foreground",
        )}
        style={{ letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}
      >
        {value}
      </div>
      {deltaText && (
        <div className="mt-1.5 text-[10px] text-muted-foreground tabular-nums">
          Δ {deltaText}
        </div>
      )}
    </div>
  )
}
