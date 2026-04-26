"use client"

import type { MarketingSimResult } from "@/shared/api/marketing-sim"

type Props = {
  result: MarketingSimResult | null
  horizonDays: number
}

export function MarketingSimKpiTiles({ result, horizonDays }: Props) {
  if (!result) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="일일 설치" value="—" hint="CPI 데이터 없음" />
        <Tile label="Day-30 ROAS" value="—" />
        <Tile label="Payback 일자" value="—" />
        <Tile label={`${horizonDays}일 누적 매출`} value="—" />
      </div>
    )
  }

  const installsPerDay = Math.round(result.installsPerDay)
  const day30Roas = result.day30RoasP50
  const paybackDay = result.paybackDayP50
  const totalRevenue = Math.round(result.totalRevenueP50)

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Tile
        label="일일 설치"
        value={installsPerDay.toLocaleString()}
        hint="UA budget ÷ CPI"
      />
      <Tile
        label="Day-30 ROAS"
        value={day30Roas !== null ? `${(day30Roas * 100).toFixed(0)}%` : "—"}
        signal={day30Roas !== null ? (day30Roas >= 1 ? "positive" : day30Roas >= 0.5 ? "caution" : "risk") : null}
      />
      <Tile
        label="Payback 일자"
        value={paybackDay !== null ? `D+${paybackDay}` : `${horizonDays}일 내 미회수`}
        signal={paybackDay !== null ? (paybackDay <= 30 ? "positive" : paybackDay <= 60 ? "caution" : "risk") : "risk"}
      />
      <Tile
        label={`${horizonDays}일 누적 매출`}
        value={`$${totalRevenue.toLocaleString()}`}
        hint="P50 추정"
      />
    </div>
  )
}

type Signal = "positive" | "caution" | "risk" | null

function Tile({
  label,
  value,
  hint,
  signal = null,
}: {
  label: string
  value: string
  hint?: string
  signal?: Signal
}) {
  const valueColor =
    signal === "positive"
      ? "text-[var(--signal-positive)]"
      : signal === "caution"
        ? "text-[var(--signal-caution)]"
        : signal === "risk"
          ? "text-[var(--signal-risk)]"
          : "text-[var(--fg-0)]"

  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--bg-3)] bg-[var(--bg-1)] p-4">
      <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--fg-2)]">
        {label}
      </div>
      <div className={`mt-2 text-2xl font-extrabold tabular-nums ${valueColor}`}>{value}</div>
      {hint && <div className="mt-1 text-[10px] text-[var(--fg-2)]">{hint}</div>}
    </div>
  )
}
