"use client"

import { Group } from "@visx/group"
import { scaleLinear, scaleBand } from "@visx/scale"
import { ParentSize } from "@visx/responsive"
import type { VcSimResult } from "@/shared/api/vc-simulation"
import { useLocale } from "@/shared/i18n"

type Props = { result: VcSimResult }

function histogram(
  vals: number[],
  bins: number,
  sharedMin?: number,
  sharedMax?: number,
): number[] {
  const filtered = vals.filter(Number.isFinite)
  if (filtered.length === 0) return new Array(bins).fill(0)
  const min = sharedMin ?? Math.min(...filtered)
  const max = sharedMax ?? Math.max(...filtered)
  const width = (max - min) / bins || 1
  const counts = new Array(bins).fill(0)
  for (const v of filtered) {
    // Clamp to valid bin range so out-of-bound values (when sharedMin/Max
    // are explicitly tighter) still land in the edge bins.
    const raw = Math.floor((v - min) / width)
    const idx = Math.min(bins - 1, Math.max(0, raw))
    counts[idx]++
  }
  return counts
}

export function IrrHistogramPair({ result }: Props) {
  const { t } = useLocale()
  const BINS = 20
  // Align bin edges across both panels so bin i of histA and histB cover
  // the SAME IRR range — required for honest side-by-side comparison.
  const allFinite = [
    ...result.baselineA.irrDistribution,
    ...result.baselineB.irrDistribution,
  ].filter(Number.isFinite)
  const combinedMin = allFinite.length > 0 ? Math.min(...allFinite) : 0
  const combinedMax = allFinite.length > 0 ? Math.max(...allFinite) : 1
  const histA = histogram(result.baselineA.irrDistribution, BINS, combinedMin, combinedMax)
  const histB = histogram(result.baselineB.irrDistribution, BINS, combinedMin, combinedMax)
  const maxCount = Math.max(...histA, ...histB, 1)

  return (
    <div className="grid grid-cols-2 gap-4 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary">
      <div>
        <div className="text-xs text-muted-foreground mb-2">{t("vc.baseline.withoutExperiment")}</div>
        <ParentSize>{({ width }) => <Histogram data={histA} maxCount={maxCount} width={width} height={140} color="var(--muted-foreground)" />}</ParentSize>
      </div>
      <div>
        <div className="text-xs text-muted-foreground mb-2">{t("vc.baseline.withExperiment")}</div>
        <ParentSize>{({ width }) => <Histogram data={histB} maxCount={maxCount} width={width} height={140} color="var(--primary)" />}</ParentSize>
      </div>
    </div>
  )
}

function Histogram({ data, maxCount, width, height, color }: { data: number[]; maxCount: number; width: number; height: number; color: string }) {
  const xScale = scaleBand<number>({ domain: data.map((_, i) => i), range: [0, width], padding: 0.1 })
  const yScale = scaleLinear<number>({ domain: [0, maxCount], range: [height, 0] })
  return (
    <svg width={width} height={height}>
      <Group>
        {data.map((count, i) => {
          const x = xScale(i) ?? 0
          const y = yScale(count)
          const w = xScale.bandwidth()
          const h = height - y
          return <rect key={i} x={x} y={y} width={w} height={h} fill={color} />
        })}
      </Group>
    </svg>
  )
}
