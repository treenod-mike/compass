"use client"

import type { VcSimResult } from "@/shared/api/vc-simulation"
import { useLocale } from "@/shared/i18n"
import { clsx } from "clsx"

type Props = { result: VcSimResult }

export function VcKpiStrip({ result }: Props) {
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

  return (
    <div className="grid grid-cols-4 gap-4">
      <KpiCard label={t("vc.kpi.irr")} value={irrDisplay} tone={irrBelow ? "risk" : "positive"} />
      <KpiCard label={t("vc.kpi.moic")} value={moicDisplay} />
      <KpiCard label={t("vc.kpi.payback")} value={paybackDisplay} />
      <KpiCard label={t("vc.kpi.jcurveBreakEven")} value={jCurveDisplay} />
    </div>
  )
}

function KpiCard({ label, value, tone }: { label: string; value: string; tone?: "positive" | "risk" }) {
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
    </div>
  )
}
