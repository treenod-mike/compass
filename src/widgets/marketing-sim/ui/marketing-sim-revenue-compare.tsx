"use client"

import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts"
import type { MarketingSimResult } from "@/shared/api/marketing-sim"

type Props = {
  targetResult: MarketingSimResult | null
  observedResult: MarketingSimResult | null
  targetArpdauUsd: number
  observedArpdauUsd: number
  height?: number
}

export function MarketingSimRevenueCompare({
  targetResult,
  observedResult,
  targetArpdauUsd,
  observedArpdauUsd,
  height = 280,
}: Props) {
  if (!targetResult || !observedResult) {
    return (
      <div
        className="flex items-center justify-center rounded-[var(--radius-card)] border border-dashed border-[var(--bg-3)] bg-[var(--bg-1)] text-xs text-[var(--fg-2)]"
        style={{ height }}
      >
        CPI 또는 retention 데이터 없음 — 매출 비교 곡선을 그릴 수 없습니다
      </div>
    )
  }

  const data = targetResult.daily.map((p, i) => ({
    day: p.day,
    targetRevenue: p.revenueP50,
    observedRevenue: observedResult.daily[i]?.revenueP50 ?? 0,
    dau: p.dauP50,
  }))

  const arpdauDelta = targetArpdauUsd - observedArpdauUsd
  const showDelta = Math.abs(arpdauDelta) > 0.005

  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--bg-3)] bg-[var(--bg-1)] p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-bold text-[var(--fg-0)]">일별 매출 · DAU</h2>
        {showDelta && (
          <span className="text-[10px] text-[var(--fg-2)]">
            {arpdauDelta > 0 ? "▲" : "▼"} ARPDAU{" "}
            <span className="font-bold tabular-nums text-[var(--fg-1)]">
              ${observedArpdauUsd.toFixed(2)} → ${targetArpdauUsd.toFixed(2)}
            </span>
          </span>
        )}
      </div>
      <div style={{ width: "100%", height }}>
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 10, right: 24, bottom: 8, left: 8 }}>
            <CartesianGrid stroke="var(--bg-3)" strokeDasharray="2 4" />
            <XAxis
              dataKey="day"
              tick={{ fontSize: 10, fill: "var(--fg-2)" }}
              tickFormatter={(d) => `D+${d}`}
              interval={Math.floor(data.length / 6)}
            />
            <YAxis
              yAxisId="rev"
              tick={{ fontSize: 10, fill: "var(--fg-2)" }}
              tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`}
              width={48}
            />
            <YAxis
              yAxisId="dau"
              orientation="right"
              tick={{ fontSize: 10, fill: "var(--fg-2)" }}
              tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${Math.round(v)}`}
              width={44}
            />
            <Tooltip
              contentStyle={{
                background: "var(--bg-1)",
                border: "1px solid var(--bg-3)",
                borderRadius: 4,
                fontSize: 11,
              }}
              formatter={(v, name) => {
                const num = Number(v)
                const label = String(name)
                if (label === "DAU") return [Math.round(num).toLocaleString(), label]
                return [`$${Math.round(num).toLocaleString()}`, label]
              }}
              labelFormatter={(d) => `Day +${d}`}
            />
            <Legend
              wrapperStyle={{ fontSize: 10, paddingTop: 8 }}
              iconSize={10}
            />
            <Line
              yAxisId="rev"
              type="monotone"
              dataKey="targetRevenue"
              name={`매출 (목표 ARPDAU $${targetArpdauUsd.toFixed(2)})`}
              stroke="#1A7FE8"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              yAxisId="rev"
              type="monotone"
              dataKey="observedRevenue"
              name={`매출 (관측 ARPDAU $${observedArpdauUsd.toFixed(2)})`}
              stroke="#6B7280"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              dot={false}
              isAnimationActive={false}
            />
            <Line
              yAxisId="dau"
              type="monotone"
              dataKey="dau"
              name="DAU"
              stroke="#9CA3AF"
              strokeWidth={1}
              dot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
