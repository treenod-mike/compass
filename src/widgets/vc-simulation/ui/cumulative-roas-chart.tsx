"use client"

import { useState } from "react"
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  ReferenceLine,
  ReferenceArea,
  ReferenceDot,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts"
import { clsx } from "clsx"
import type { VcSimResult } from "@/shared/api/vc-simulation"
import { useLocale, type TranslationKey } from "@/shared/i18n"
import { useLiveAfData } from "@/widgets/dashboard/lib/use-live-af-data"
import {
  computeBenchmarkGap,
  formatGapPct,
  toneClass,
} from "../lib/benchmark-gap"

type Props = { result: VcSimResult }
type Granularity = "monthly" | "quarterly"

/**
 * CumulativeRoasChart — VC 시뮬레이터 핵심 시각화.
 *
 * 결정권자 친화 ROAS 정의: 누적 매출 / 투자금 × 100 (단조 증가).
 * 100% 도달 = 매출만으로 투자금을 회수한 시점 (BEP).
 * baselineB(실험 반영) 단일 곡선만 표시. A/B 비교는 시뮬레이터 본질이 아님.
 *
 * X축 단위: monthly / quarterly 토글. compute가 month 단위라 daily는
 * false precision이라 옵션에서 제외.
 */
export function CumulativeRoasChart({ result }: Props) {
  const { t } = useLocale()
  const [granularity, setGranularity] = useState<Granularity>("monthly")

  const investment = result.offer.investmentUsd
  const horizon = result.offer.horizonMonths

  const monthlyPoints = result.baselineB.cumulativeRevenue.map((p) => ({
    month: p.month,
    p10: (p.p10 / investment) * 100,
    p50: (p.p50 / investment) * 100,
    p90: (p.p90 / investment) * 100,
  }))

  // Quarterly mode: 데이터 자체를 분기 끝 시점으로 압축. M0, M3, M6, M9, M12.
  const data =
    granularity === "monthly"
      ? monthlyPoints
      : monthlyPoints.filter(
          (p) => p.month === 0 || p.month % 3 === 0 || p.month === horizon
        )

  // BEP는 항상 monthly 정확도로 검출 (quarterly mode에서도 정직한 시점).
  const bepIdx = monthlyPoints.findIndex((p) => p.p50 >= 100)
  const bepMonth = bepIdx > 0 ? monthlyPoints[bepIdx].month : null
  const bepP50 = bepMonth != null ? monthlyPoints[bepMonth].p50 : null

  const maxP90 = Math.max(...monthlyPoints.map((d) => d.p90), 100)
  const yMax = Math.max(100, Math.ceil(maxP90 / 50) * 50)

  const tickFormatter = (m: number) => {
    if (granularity === "monthly") return `M${m}`
    if (m === 0) return "M0"
    return `${m / 3}${t("vc.unit.quarter")}`
  }

  const { state, summary } = useLiveAfData()
  const benchmark = computeBenchmarkGap(state, summary, result.offer)

  return (
    <div className="rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground break-keep">
            {t("vc.chart.cumulativeRoas.title")}
          </div>
          <div className="mt-1.5 text-[11px] text-muted-foreground/80 break-keep">
            {t("vc.chart.cumulativeRoas.subtitle")}
          </div>
        </div>
        <div className="flex items-start gap-3 shrink-0">
          {/* Granularity toggle */}
          <div className="flex items-center rounded-md bg-muted p-0.5">
            {(["monthly", "quarterly"] as const).map((g) => (
              <button
                key={g}
                onClick={() => setGranularity(g)}
                className={clsx(
                  "text-[11px] font-medium px-2.5 py-1 rounded-[5px] transition-colors",
                  granularity === g
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t(`vc.chart.cumulativeRoas.granularity.${g}` as const)}
              </button>
            ))}
          </div>

          {/* BEP conclusion */}
          <div className="text-right">
            <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground break-keep">
              {t("vc.chart.cumulativeRoas.headerLabel")}
            </div>
            <div
              className="mt-1.5 text-[32px] md:text-[36px] font-extrabold leading-none tabular-nums text-foreground"
              style={{ letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}
            >
              {bepMonth != null
                ? `${bepMonth}${t("vc.unit.months")}`
                : t("vc.chart.cumulativeRoas.noRecovery")}
            </div>
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={240}>
        <ComposedChart data={data} margin={{ top: 12, right: 24, bottom: 4, left: 0 }}>
          {/* Adverse zone (below BEP) */}
          <ReferenceArea
            y1={0}
            y2={100}
            fill="var(--destructive)"
            fillOpacity={0.04}
          />
          {/* Profitable zone (above BEP) */}
          <ReferenceArea
            y1={100}
            y2={yMax}
            fill="var(--success)"
            fillOpacity={0.05}
          />

          <XAxis
            dataKey="month"
            fontSize={10}
            stroke="var(--muted-foreground)"
            tickFormatter={tickFormatter}
          />
          <YAxis
            fontSize={10}
            stroke="var(--muted-foreground)"
            domain={[0, yMax]}
            tickFormatter={(v) => `${v}%`}
            width={44}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "0.75rem",
              fontSize: 12,
            }}
            formatter={(value, name) => {
              const num = typeof value === "number" ? value : Number(value)
              const labelMap: Record<string, string> = {
                p50: t("vc.chart.cumulativeRoas.p50"),
                p10: t("vc.chart.cumulativeRoas.p10"),
                p90: t("vc.chart.cumulativeRoas.p90"),
              }
              const key = String(name)
              return [`${num.toFixed(0)}%`, labelMap[key] ?? key]
            }}
            labelFormatter={(m) => tickFormatter(Number(m))}
          />

          {/* Uncertainty band: paint p90 (top), then mask up to p10 with card bg.
              Net visual = p10–p90 ribbon. */}
          <Area
            dataKey="p90"
            stroke="none"
            fill="var(--primary)"
            fillOpacity={0.12}
            isAnimationActive={false}
          />
          <Area
            dataKey="p10"
            stroke="none"
            fill="var(--card)"
            fillOpacity={1}
            isAnimationActive={false}
          />

          <Line
            type="monotone"
            dataKey="p50"
            stroke="var(--primary)"
            strokeWidth={2.5}
            dot={false}
            isAnimationActive={false}
          />

          {/* BEP 100% horizontal line */}
          <ReferenceLine
            y={100}
            stroke="var(--foreground)"
            strokeWidth={1.5}
            label={{
              value: t("vc.chart.cumulativeRoas.bep"),
              position: "insideTopRight",
              fontSize: 11,
              fill: "var(--foreground)",
              offset: 4,
            }}
          />

          {/* Break-even vertical marker + dot at intersection */}
          {bepMonth != null && bepMonth > 0 && (
            <>
              <ReferenceLine
                x={bepMonth}
                stroke="var(--success)"
                strokeWidth={2}
                strokeDasharray="4 3"
                label={{
                  value: `${tickFormatter(bepMonth)} ${t("vc.chart.cumulativeRoas.crossover")}`,
                  position: "top",
                  fontSize: 11,
                  fill: "var(--success)",
                  offset: 6,
                }}
              />
              {bepP50 != null && (
                <ReferenceDot
                  x={bepMonth}
                  y={bepP50}
                  r={5}
                  fill="var(--success)"
                  stroke="var(--card)"
                  strokeWidth={2}
                />
              )}
            </>
          )}
        </ComposedChart>
      </ResponsiveContainer>

      {/* Benchmark vs actual gap chip — sits as a footer companion to the
          chart so the decision-maker sees at a glance whether the simulator's
          puzzle/casual benchmark assumptions align with their game's actuals. */}
      <div className="mt-3 pt-3 border-t border-border/60 flex items-center justify-between gap-3 text-[11px] flex-wrap">
        <span className="text-muted-foreground/80">
          {t("vc.gap.label")}
        </span>
        {benchmark.status === "active" && benchmark.gap !== null && benchmark.tone ? (
          <span className="flex items-baseline gap-2 font-mono tabular-nums">
            <span className="text-muted-foreground/70">
              {benchmark.selected === "d30"
                ? t("vc.gap.window.d30")
                : t("vc.gap.window.cumulative")}
            </span>
            <span className={toneClass(benchmark.tone)}>
              {formatGapPct(benchmark.gap)} ·{" "}
              {t(`vc.gap.tone.${benchmark.tone}` as TranslationKey)}
            </span>
          </span>
        ) : (
          <span className="text-muted-foreground/60">{t("vc.gap.disconnected")}</span>
        )}
      </div>
    </div>
  )
}
