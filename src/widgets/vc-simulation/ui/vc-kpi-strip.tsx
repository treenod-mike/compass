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
    <div className="grid grid-cols-4 gap-3">
      <KpiCard label={t("vc.kpi.irr")} value={irrDisplay} tone={irrBelow ? "risk" : "positive"} />
      <KpiCard label={t("vc.kpi.moic")} value={moicDisplay} />
      <KpiCard label={t("vc.kpi.payback")} value={paybackDisplay} />
      <KpiCard label={t("vc.kpi.jcurveBreakEven")} value={jCurveDisplay} />
    </div>
  )
}

function KpiCard({ label, value, tone }: { label: string; value: string; tone?: "positive" | "risk" }) {
  return (
    <div className="border border-[var(--bg-4)] rounded-[var(--radius-card)] p-4 bg-[var(--bg-1)]">
      <div className="text-xs text-[var(--fg-2)]">{label}</div>
      <div className={clsx(
        "mt-2 text-2xl font-mono tabular-nums",
        tone === "risk" && "text-[var(--signal-risk)]",
        tone === "positive" && "text-[var(--fg-0)]",
      )}>
        {value}
      </div>
    </div>
  )
}
