"use client"

import type { Offer } from "@/shared/api/vc-simulation"
import { useLocale } from "@/shared/i18n"

type Props = { offer: Offer }

export function DerivedStats({ offer }: Props) {
  const { t } = useLocale()
  const equityPct = (offer.investmentUsd / offer.postMoneyUsd) * 100
  const preMoneyUsd = offer.postMoneyUsd - offer.investmentUsd
  return (
    <div className="mt-4 pt-4 border-t border-border space-y-2">
      <Row label={t("vc.field.derived.equity")} value={`${equityPct.toFixed(1)}%`} />
      <Row label={t("vc.field.derived.preMoney")} value={`$${(preMoneyUsd / 1_000_000).toFixed(1)}M`} />
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono tabular-nums text-foreground">{value}</span>
    </div>
  )
}
