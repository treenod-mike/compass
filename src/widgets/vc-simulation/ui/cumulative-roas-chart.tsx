"use client"

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
import type { VcSimResult } from "@/shared/api/vc-simulation"
import { useLocale } from "@/shared/i18n"

type Props = { result: VcSimResult }

/**
 * CumulativeRoasChart — VC 시뮬레이터 핵심 시각화.
 *
 * "내가 입력한 조건으로 누적 ROAS가 언제 BEP(100%)를 뚫는가" 단일 질문에
 * 답하는 차트. 실험 비교(A vs B)는 본질이 아니므로 baselineB(실험 반영)
 * 단일 곡선만 표시한다.
 *
 * - p50 = derived `runway[m].p50 / investment * 100`
 * - 100% 가로선 = BEP(본전선)
 * - paybackMonths = ROAS가 100%를 처음 넘는 월 → vertical 마커
 * - 100% 미만 영역 → destructive 톤(적자), 이상 → success 톤(흑자)
 */
export function CumulativeRoasChart({ result }: Props) {
  const { t } = useLocale()
  const investment = result.offer.investmentUsd
  const data = result.baselineB.runway.map((p) => ({
    month: p.month,
    p10: (p.p10 / investment) * 100,
    p50: (p.p50 / investment) * 100,
    p90: (p.p90 / investment) * 100,
  }))
  const breakEven = result.baselineB.paybackMonths
  const breakEvenP50 =
    breakEven != null && data[breakEven] ? data[breakEven].p50 : null

  // y-axis: 0 → ceil(max p90 / 50) * 50, 최소 BEP 100%는 항상 보이게.
  const maxP90 = Math.max(...data.map((d) => d.p90), 100)
  const yMax = Math.max(100, Math.ceil(maxP90 / 50) * 50)

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
        <div className="text-right shrink-0">
          <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground break-keep">
            {t("vc.chart.cumulativeRoas.headerLabel")}
          </div>
          <div
            className="mt-1.5 text-[28px] md:text-[32px] font-extrabold leading-none tabular-nums text-foreground"
            style={{ letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}
          >
            {breakEven != null
              ? `${breakEven}${t("vc.unit.months")}`
              : t("vc.chart.cumulativeRoas.noRecovery")}
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
            tickFormatter={(m) => `M${m}`}
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
            labelFormatter={(m) => `M${m}`}
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
          {breakEven != null && breakEven > 0 && (
            <>
              <ReferenceLine
                x={breakEven}
                stroke="var(--success)"
                strokeWidth={2}
                strokeDasharray="4 3"
                label={{
                  value: `M${breakEven} ${t("vc.chart.cumulativeRoas.crossover")}`,
                  position: "top",
                  fontSize: 11,
                  fill: "var(--success)",
                  offset: 6,
                }}
              />
              {breakEvenP50 != null && (
                <ReferenceDot
                  x={breakEven}
                  y={breakEvenP50}
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
    </div>
  )
}
