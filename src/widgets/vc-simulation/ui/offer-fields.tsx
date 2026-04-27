"use client"

import type { Offer } from "@/shared/api/vc-simulation"
import { useLocale } from "@/shared/i18n"

type Props = { offer: Offer; onChange: (patch: Partial<Offer>) => void }

export function OfferFields({ offer, onChange }: Props) {
  const { t } = useLocale()
  return (
    <div className="space-y-3">
      <NumberField
        label={t("vc.field.investment")}
        sub="USD"
        value={offer.investmentUsd}
        step={100_000}
        formatter={(n) => `$${(n / 1_000_000).toFixed(1)}M`}
        onChange={(v) => onChange({ investmentUsd: v })}
      />
      <NumberField
        label={t("vc.field.postMoney")}
        sub="USD"
        value={offer.postMoneyUsd}
        step={500_000}
        formatter={(n) => `$${(n / 1_000_000).toFixed(1)}M`}
        onChange={(v) => onChange({ postMoneyUsd: v })}
      />
      <NumberField
        label={t("vc.field.exitMultiple")}
        sub="×"
        value={offer.exitMultiple}
        step={0.5}
        formatter={(n) => `${n.toFixed(1)}×`}
        onChange={(v) => onChange({ exitMultiple: v })}
      />
      <NumberField
        label={t("vc.field.hurdleRate")}
        sub="% (연)"
        value={offer.hurdleRate * 100}
        step={1}
        formatter={(n) => `${n.toFixed(0)}%`}
        onChange={(v) => onChange({ hurdleRate: v / 100 })}
      />
    </div>
  )
}

function NumberField({
  label,
  sub,
  value,
  step,
  formatter,
  onChange,
}: {
  label: string
  sub: string
  value: number
  step: number
  formatter: (n: number) => string
  onChange: (v: number) => void
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-muted-foreground flex justify-between">
        <span>{label}</span>
        <span className="text-muted-foreground/70">{sub}</span>
      </label>
      <input
        type="number"
        value={value}
        step={step}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="bg-background border border-border rounded-md px-2 py-1.5 text-sm font-mono tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary"
      />
      <div className="text-[11px] text-muted-foreground/70 font-mono tabular-nums text-right">{formatter(value)}</div>
    </div>
  )
}
