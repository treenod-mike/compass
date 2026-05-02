"use client"

import { ParentSize } from "@visx/responsive"
import { Group } from "@visx/group"
import { scaleLinear } from "@visx/scale"
import { AreaClosed, LinePath, Line } from "@visx/shape"
import { AxisBottom, AxisLeft } from "@visx/axis"
import { curveMonotoneX } from "@visx/curve"
import type { RunwayPoint } from "@/shared/api/mock-data"
import type { VcSimResult } from "@/shared/api/vc-simulation"
import { useLocale } from "@/shared/i18n"
import { RUNWAY_FAN_COLORS as C } from "@/shared/config/chart-colors"
import { CHART_TYPO } from "@/shared/config/chart-typography"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/shared/ui/card"

type Props = { result: VcSimResult; hurdleLine?: number }

const MARGIN = { top: 24, right: 32, bottom: 40, left: 56 }
const GRADIENT_ID = "runway-band-gradient"

type InnerProps = {
  points: RunwayPoint[]
  initialCash: number
  width: number
  height: number
  hurdleLine?: number
}

function InnerChart({ points, initialCash, width, height, hurdleLine }: InnerProps) {
  if (width < 50) return null

  const innerWidth = width - MARGIN.left - MARGIN.right
  const innerHeight = height - MARGIN.top - MARGIN.bottom

  const xMax = Math.max(...points.map((p) => p.month))
  const yMin = Math.min(...points.map((p) => p.p10))
  const yMax = Math.max(...points.map((p) => p.p90))
  const yPadding = (yMax - yMin) * 0.05

  const xScale = scaleLinear<number>({
    domain: [0, xMax],
    range: [0, innerWidth],
  })

  const yScale = scaleLinear<number>({
    domain: [yMin - yPadding, yMax + yPadding],
    range: [innerHeight, 0],
    nice: true,
  })

  const cashOutThreshold = 0
  const thresholdY = yScale(cashOutThreshold)
  const cashOutTop = Math.min(thresholdY, innerHeight)

  return (
    <svg width={width} height={height}>
      <defs>
        <linearGradient id={GRADIENT_ID} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--brand, var(--primary))" stopOpacity={0.18} />
          <stop offset="100%" stopColor="var(--brand, var(--primary))" stopOpacity={0.02} />
        </linearGradient>
      </defs>

      <Group left={MARGIN.left} top={MARGIN.top}>
        {/* Cash-out zone background (below zero threshold) */}
        {cashOutTop < innerHeight && (
          <>
            <rect
              x={0}
              y={cashOutTop}
              width={innerWidth}
              height={innerHeight - cashOutTop}
              fill={C.cashOut}
            />
            <Line
              from={{ x: 0, y: thresholdY }}
              to={{ x: innerWidth, y: thresholdY }}
              stroke={C.cashOutBorder}
              strokeWidth={1}
              strokeDasharray="2 4"
              strokeOpacity={0.6}
            />
          </>
        )}

        {/* Horizontal gridlines */}
        {yScale.ticks(5).map((tick) => (
          <Line
            key={`grid-${tick}`}
            from={{ x: 0, y: yScale(tick) }}
            to={{ x: innerWidth, y: yScale(tick) }}
            stroke={C.grid}
            strokeWidth={1}
            strokeDasharray="2 4"
          />
        ))}

        {/* P10–P90 fan band with soft gradient fill */}
        <AreaClosed<RunwayPoint>
          data={points}
          x={(d) => xScale(d.month)}
          y={(d) => yScale(d.p90)}
          y0={(d) => yScale(d.p10)}
          yScale={yScale}
          fill={`url(#${GRADIENT_ID})`}
          curve={curveMonotoneX}
          defined={(d) => d.p10 != null && d.p90 != null}
        />

        {/* P90 upper boundary (subtle dashed stroke) */}
        <LinePath<RunwayPoint>
          data={points}
          x={(d) => xScale(d.month)}
          y={(d) => yScale(d.p90)}
          stroke={C.p50}
          strokeWidth={1}
          strokeOpacity={0.25}
          strokeDasharray="3 3"
          curve={curveMonotoneX}
        />

        {/* P10 lower boundary (subtle dashed stroke) */}
        <LinePath<RunwayPoint>
          data={points}
          x={(d) => xScale(d.month)}
          y={(d) => yScale(d.p10)}
          stroke={C.p50}
          strokeWidth={1}
          strokeOpacity={0.25}
          strokeDasharray="3 3"
          curve={curveMonotoneX}
        />

        {/* P50 median line (primary signal) */}
        <LinePath<RunwayPoint>
          data={points}
          x={(d) => xScale(d.month)}
          y={(d) => yScale(d.p50)}
          stroke={C.p50}
          strokeWidth={2}
          curve={curveMonotoneX}
        />

        {/* Optional hurdle line */}
        {hurdleLine != null && (
          <Line
            from={{ x: xScale.range()[0], y: yScale(hurdleLine) }}
            to={{ x: xScale.range()[1], y: yScale(hurdleLine) }}
            stroke="var(--signal-caution)"
            strokeWidth={1}
            strokeDasharray="2 4"
          />
        )}

        {/* P50 data dots */}
        {points.map((p) => (
          <circle
            key={`p50-dot-${p.month}`}
            cx={xScale(p.month)}
            cy={yScale(p.p50)}
            r={2.5}
            fill={C.p50}
          />
        ))}

        {/* Axes */}
        <AxisBottom
          top={innerHeight}
          scale={xScale}
          numTicks={points.length}
          tickFormat={(v) => {
            const point = points.find((p) => p.month === Number(v))
            return point?.label ?? ""
          }}
          stroke={C.border}
          tickStroke={C.border}
          tickLabelProps={() => ({
            fill: C.axis,
            ...CHART_TYPO.axisTick,
            textAnchor: "middle" as const,
          })}
        />
        <AxisLeft
          scale={yScale}
          numTicks={5}
          tickFormat={(v) => `$${Number(v).toFixed(0)}K`}
          stroke="transparent"
          tickStroke="transparent"
          tickLabelProps={() => ({
            fill: C.axis,
            ...CHART_TYPO.axisTick,
            textAnchor: "end" as const,
            dx: "-0.25em",
            dy: "0.25em",
          })}
        />

        {/* Initial cash annotation (top-left) */}
        <text
          x={4}
          y={-8}
          textAnchor="start"
          fill={C.axis}
          {...CHART_TYPO.annotation}
        >
          {`$${initialCash.toFixed(0)}K initial`}
        </text>
      </Group>
    </svg>
  )
}

/**
 * DualBaselineRunwayChart — Gameboard-pattern wrapper around the runway fan.
 *
 * Uses Card + CardHeader (title + subtitle) matching the CumulativeRoasChart
 * redesign pattern (PR #47). Inlines the visx chart logic from RunwayFanChart
 * to apply a soft gradient to the P10–P90 uncertainty band.
 *
 * baselineB (experiment-reflected) single fan only — A/B comparison is noise
 * for the VC simulator's core question.
 */
export function DualBaselineRunwayChart({ result, hurdleLine }: Props) {
  const { t } = useLocale()

  const points = result.baselineB.runway.map((p) => ({
    month: p.month,
    label: `M${p.month}`,
    p10: p.p10 / 1000,
    p50: p.p50 / 1000,
    p90: p.p90 / 1000,
  }))

  const initialCash = result.offer.investmentUsd / 1000
  const horizonMonths = result.offer.horizonMonths

  const subtitle = `$${initialCash.toFixed(0)}K · P10 / P50 / P90 · ${horizonMonths}mo`

  return (
    <Card className="rounded-2xl hover:border-primary transition-colors">
      <CardHeader>
        <div className="min-w-0 flex-1">
          <CardTitle className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground break-keep">
            {t("vc.runway.title")}
          </CardTitle>
          <CardDescription className="mt-1.5 text-[11px] text-muted-foreground/80 break-keep">
            {subtitle}
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div style={{ width: "100%", height: 220 }}>
          <ParentSize>
            {({ width, height }) => (
              <InnerChart
                points={points}
                initialCash={initialCash}
                width={width}
                height={height}
                hurdleLine={hurdleLine}
              />
            )}
          </ParentSize>
        </div>
      </CardContent>
    </Card>
  )
}
