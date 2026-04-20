'use client'

import React from 'react'
import { CHART_MARGINS, XAXIS_CONFIG, LEGEND_CONFIG } from './constants'
import type { ChartDataItem } from './types'

interface XReferenceLineOverlayProps {
  xReferenceLines: Array<{ value: string | number; label?: string; color?: string }>
  chartWidth: number
  filteredData: ChartDataItem[]
  nameKey: string
  dynamicLeftMargin: number
  dynamicYAxisWidth: number
  dynamicRightMargin: number
  shouldUseDualAxis: boolean
  dynamicRightYAxisWidth: number
  effectiveHeight: number
  stackKeys: string[]
  legendLayout: 'wrap' | 'scroll-x'
}

export function XReferenceLineOverlay({
  xReferenceLines, chartWidth, filteredData, nameKey,
  dynamicLeftMargin, dynamicYAxisWidth, dynamicRightMargin,
  shouldUseDualAxis, dynamicRightYAxisWidth, effectiveHeight,
  stackKeys, legendLayout,
}: XReferenceLineOverlayProps) {
  if (!xReferenceLines.length || chartWidth <= 0 || !filteredData.length) return null

  return (
    <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: effectiveHeight, pointerEvents: 'none', overflow: 'visible' }}>
      {xReferenceLines.map((rl, i) => {
        const idx = filteredData.findIndex((d) => String(d[nameKey]) === String(rl.value))
        if (idx < 0) return null
        const plotLeft = dynamicLeftMargin + dynamicYAxisWidth
        const plotRight = chartWidth - dynamicRightMargin - (shouldUseDualAxis ? dynamicRightYAxisWidth : 0)
        const plotWidth = plotRight - plotLeft
        const N = filteredData.length
        const x = plotLeft + (N <= 1 ? plotWidth / 2 : (idx / (N - 1)) * plotWidth)
        const legendH = legendLayout === 'scroll-x'
          ? 44
          : LEGEND_CONFIG.HEIGHT + LEGEND_CONFIG.PADDING_TOP_NORMAL + LEGEND_CONFIG.MARGIN_TOP
        const hasLegend = stackKeys.length > 0
        const y1 = CHART_MARGINS.TOP
        const y2 = effectiveHeight - CHART_MARGINS.BOTTOM_WITH_LEGEND - XAXIS_CONFIG.HEIGHT - (hasLegend ? legendH : 0)
        return (
          <g key={i}>
            <line
              x1={x} y1={y1} x2={x} y2={y2}
              stroke={rl.color ?? '#f97316'}
              strokeDasharray="6 3"
              strokeWidth={1.5}
            />
            {rl.label && (
              <text x={x + 4} y={y1 + 16} fill={rl.color ?? '#f97316'} fontSize={12} fontWeight={500}>
                {rl.label}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}
