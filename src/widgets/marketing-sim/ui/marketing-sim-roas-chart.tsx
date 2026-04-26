"use client"

import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ReferenceDot,
} from "recharts"
import type { MarketingSimResult } from "@/shared/api/marketing-sim"

type Props = {
  result: MarketingSimResult | null
  height?: number
}

export function MarketingSimRoasChart({ result, height = 280 }: Props) {
  if (!result) {
    return (
      <div
        className="flex items-center justify-center rounded-[var(--radius-card)] border border-dashed border-[var(--bg-3)] bg-[var(--bg-1)] text-xs text-[var(--fg-2)]"
        style={{ height }}
      >
        CPI 또는 retention 데이터 없음 — ROAS 곡선을 그릴 수 없습니다
      </div>
    )
  }

  const data = result.daily.map((p) => ({
    day: p.day,
    roasP10: p.roasP10,
    roasP50: p.roasP50,
    roasP90: p.roasP90,
  }))

  const paybackDay = result.paybackDayP50
  const paybackRoas = paybackDay !== null ? data.find((d) => d.day === paybackDay)?.roasP50 : null

  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--bg-3)] bg-[var(--bg-1)] p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-bold text-[var(--fg-0)]">Cumulative ROAS</h2>
        <span className="text-[10px] text-[var(--fg-2)]">
          P10/P50/P90 · break-even = ROAS 100%
        </span>
      </div>
      <div style={{ width: "100%", height }}>
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 10, right: 16, bottom: 8, left: 0 }}>
            <CartesianGrid stroke="var(--bg-3)" strokeDasharray="2 4" />
            <XAxis
              dataKey="day"
              tick={{ fontSize: 10, fill: "var(--fg-2)" }}
              tickFormatter={(d) => `D+${d}`}
              interval={Math.floor(data.length / 6)}
            />
            <YAxis
              tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
              tick={{ fontSize: 10, fill: "var(--fg-2)" }}
              width={48}
            />
            <Tooltip
              contentStyle={{
                background: "var(--bg-1)",
                border: "1px solid var(--bg-3)",
                borderRadius: 4,
                fontSize: 11,
              }}
              formatter={(v) => `${(Number(v) * 100).toFixed(1)}%`}
              labelFormatter={(d) => `Day +${d}`}
            />
            <Area
              type="monotone"
              dataKey="roasP90"
              stroke="none"
              fill="#1A7FE8"
              fillOpacity={0.18}
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="roasP10"
              stroke="none"
              fill="var(--bg-1)"
              fillOpacity={1}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="roasP50"
              stroke="#1A7FE8"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
            <ReferenceLine
              y={1}
              stroke="var(--signal-positive)"
              strokeDasharray="3 3"
              label={{
                value: "break-even",
                position: "right",
                fill: "var(--signal-positive)",
                fontSize: 10,
              }}
            />
            {paybackDay !== null && paybackRoas !== null && (
              <ReferenceDot
                x={paybackDay}
                y={paybackRoas}
                r={4}
                fill="var(--signal-positive)"
                stroke="var(--bg-1)"
                strokeWidth={2}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
