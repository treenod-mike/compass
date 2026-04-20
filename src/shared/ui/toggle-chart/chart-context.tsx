'use client'

import React from 'react'
import { XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { Info } from 'lucide-react'
import { Skeleton } from '@/shared/ui/skeleton'
import { COLORS as _COLORS, CHART_MARGINS as _CM, LEGEND_CONFIG as _LC, XAXIS_CONFIG, YAXIS_CONFIG } from './constants'
import type { ChartDataItem } from './types'

// ========================================
// 공유 렌더 컨텍스트 타입
// ========================================

export interface ChartRenderContext {
  filteredData: ChartDataItem[]
  nameKey: string
  dataKey: string
  dataKey2?: string
  isLoading: boolean
  height: number
  activeChartType: string
  isStackedBar: boolean
  stackKeys: string[]
  activeKeys: string[]
  sortedActiveKeys: string[]
  shouldUseDualAxis: boolean
  rightAxisKey: string | null
  leftDomain: [number | 'auto', number | 'auto']
  rightDomain: [number | 'auto', number | 'auto']
  leftTicks: number[] | undefined
  rightTicks: number[] | undefined
  dynamicYAxisWidth: number
  dynamicRightYAxisWidth: number
  dynamicLeftMargin: number
  dynamicRightMargin: number
  hoveredSegment: { dataKey: string; index: number } | null
  setHoveredSegment: (val: { dataKey: string; index: number } | null) => void
  pinnedSegment: { dataKey: string; index: number } | null
  setPinnedSegment: (val: { dataKey: string; index: number } | null) => void
  visibility: string
  isPuChart: boolean
  key1Visible: boolean
  key2Visible: boolean
  legendOrder?: string[]
  customLabels?: Record<string, string>
  customColorFunction?: (key: string, index: number, totalKeys: number) => string
  customTooltip?: (props: { active?: boolean; payload?: any[]; label?: string | number; hoveredDataKey?: string }) => React.ReactNode
  valueFormatter?: (value: string | number) => string
  title?: string
  disableLegendInteraction: boolean
  hideXAxis: boolean
  hideYAxis: boolean
  composedConfig?: {
    bars?: Array<{ dataKey: string; name: string; fill?: string; yAxisId?: 'left' | 'right' }>
    lines?: Array<{ dataKey: string; name: string; stroke?: string; yAxisId?: 'left' | 'right' }>
  }
  handleYAxisClick: (isRightAxis: boolean) => void
  yAxisTickFormatter?: (value: number) => string
  referenceLines?: Array<{ value: number; label?: string; color?: string }>
  xReferenceLines?: Array<{ value: string | number; label?: string; color?: string }>
  barCellColors?: string[]
  legendLayout?: 'wrap' | 'scroll-x'
  animateLines?: boolean
}

// ========================================
// 공통 차트 요소 빌더
// ========================================

export function buildChartMargin(hasLegend: boolean, ctx: Pick<ChartRenderContext, 'dynamicRightMargin' | 'dynamicLeftMargin'>) {
  return {
    top: _CM.TOP,
    right: ctx.dynamicRightMargin,
    left: ctx.dynamicLeftMargin,
    bottom: hasLegend ? _CM.BOTTOM_WITH_LEGEND : _CM.BOTTOM_WITHOUT_LEGEND,
  }
}

export function buildCommonElements(ctx: ChartRenderContext) {
  const {
    nameKey, filteredData, hideXAxis, hideYAxis, leftDomain, leftTicks, dynamicYAxisWidth, dynamicRightYAxisWidth,
    shouldUseDualAxis, rightDomain, rightTicks, activeChartType, hoveredSegment, pinnedSegment,
    customTooltip, customLabels, valueFormatter, handleYAxisClick, yAxisTickFormatter,
  } = ctx

  const activeSegment = pinnedSegment ?? hoveredSegment

  const formatNumber = (value: string | number | undefined) => {
    if (value === undefined || value === null) return ''
    if (valueFormatter) return valueFormatter(value)
    if (typeof value === 'number') return value.toLocaleString()
    return String(value)
  }

  const CustomYAxisTick = (props: { x: number | string; y: number | string; payload: { value: number }; orientation?: string }) => {
    const { x, y, payload } = props
    const isRightAxis = props.orientation === 'right'
    return (
      <g transform={`translate(${x},${y})`} style={{ cursor: 'pointer' }}>
        <title>클릭하여 축 범위 변경하기</title>
        <text x={0} y={0} dy={4} textAnchor={isRightAxis ? 'start' : 'end'} fill="var(--muted-foreground)" fontSize={YAXIS_CONFIG.FONT_SIZE}>
          {typeof payload.value === 'number'
            ? (yAxisTickFormatter ? yAxisTickFormatter(payload.value) : payload.value.toLocaleString())
            : payload.value}
        </text>
      </g>
    )
  }
  CustomYAxisTick.displayName = 'CustomYAxisTick'

  const commonElements = [
    <CartesianGrid key="grid" strokeDasharray="3 3" vertical={false} yAxisId="left" stroke="var(--border)" />,
    ...(hideXAxis ? [] : [
      <XAxis key="xaxis" dataKey={nameKey} type="category" tick={{ fontSize: XAXIS_CONFIG.FONT_SIZE, fill: 'var(--muted-foreground)' }}
        angle={0} textAnchor="middle" height={XAXIS_CONFIG.HEIGHT}
        interval="preserveStartEnd"
      />,
    ]),
    ...(hideYAxis ? [] : [
      <YAxis key="yaxis" yAxisId="left" tick={CustomYAxisTick} domain={leftDomain} tickCount={6}
        width={dynamicYAxisWidth} allowDataOverflow={false} allowDecimals={true}
        onClick={() => handleYAxisClick(false)} style={{ cursor: 'pointer' }}
      />,
    ]),
    ...(shouldUseDualAxis ? [
      <YAxis key="yaxis-right" yAxisId="right" orientation="right"
        tick={(props: any) => <CustomYAxisTick {...props} orientation="right" />}
        domain={rightDomain} tickCount={6} width={dynamicRightYAxisWidth}
        allowDataOverflow={false} allowDecimals={true}
        onClick={() => handleYAxisClick(true)} style={{ cursor: 'pointer' }}
      />,
    ] : []),
    <Tooltip key="tooltip" formatter={formatNumber as any} wrapperStyle={{ outline: 'none', zIndex: 9999, backgroundColor: 'var(--card)' }}
      content={customTooltip
        ? (({ active, payload, label }: any) => {
            if (activeChartType === 'bar' && !activeSegment) return null
            return customTooltip({ active, payload, label, hoveredDataKey: activeSegment?.dataKey })
          })
        : (({ active, payload, label }: any) => {
            if (activeChartType === 'bar' && !activeSegment) return null
            if ((active || pinnedSegment) && payload && payload.length) {
              const hKey = activeSegment?.dataKey
              const allEntries: any[] = [...payload]
              const hoveredItem = hKey ? allEntries.find((e: any) => e.dataKey === hKey) : null
              const total = allEntries.reduce((sum: number, e: any) => sum + (Number(e.value) || 0), 0)
              const isSingleSeries = allEntries.length === 1
              return (
                <div className="p-3 border border-input rounded-[1.25rem] shadow-md" style={{ maxWidth: '350px', backgroundColor: 'var(--card)' }}>
                  <p className="text-sm font-medium text-foreground mb-2">{label}</p>
                  {!isSingleSeries && hoveredItem && (
                    <div className="mb-2 p-2 bg-primary/10 border-2 border-primary rounded-[1.25rem]">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: hoveredItem.color ?? hoveredItem.fill }} />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-bold text-foreground truncate">
                            {(customLabels && hoveredItem.name) ? (customLabels[hoveredItem.name] || hoveredItem.name) : hoveredItem.name}
                          </div>
                          <div className="text-sm font-bold" style={{ color: hoveredItem.color ?? hoveredItem.fill }}>
                            {formatNumber(hoveredItem.value)}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  {allEntries.map((entry: any, i: number) => {
                    const displayName = (customLabels && entry.name) ? (customLabels[entry.name] || entry.name) : entry.name
                    const isHovered = hKey ? entry.dataKey === hKey : true
                    const color = entry.color ?? entry.fill ?? 'currentColor'
                    if (isSingleSeries) {
                      return (
                        <p key={i} className="text-sm text-muted-foreground">
                          {formatNumber(entry.value)}
                        </p>
                      )
                    }
                    return (
                      <p key={i} className={`text-sm font-semibold transition-opacity ${isHovered ? '' : 'opacity-40'}`} style={{ color }}>
                        {displayName}: {formatNumber(entry.value)}
                      </p>
                    )
                  })}
                  {!isSingleSeries && allEntries.length > 1 && (
                    <div className="mt-2 pt-2 border-t border-border">
                      <p className="text-sm font-semibold text-foreground">합계: {formatNumber(total)}</p>
                    </div>
                  )}
                </div>
              )
            }
            return null
          })
      }
      cursor={false}
    />,
  ]

  return { formatNumber, CustomYAxisTick, commonElements }
}

// ========================================
// 로딩 / 빈 데이터 상태
// ========================================

export function renderLoadingOrEmpty(ctx: ChartRenderContext): React.ReactNode {
  if (ctx.isLoading) {
    return (
      <div className="flex items-end gap-2 px-2" style={{ height: `${ctx.height}px` }}>
        {[65, 80, 50, 90, 60, 75, 55, 85, 70, 45].map((h, i) => (
          <Skeleton key={i} className="flex-1" style={{ height: `${h}%` }} />
        ))}
      </div>
    )
  }
  return (
    <div className="flex items-center justify-center h-full w-full text-muted-foreground">
      <div className="flex items-center gap-2">
        <Info className="w-5 h-5 flex-shrink-0" />
        <div>표시할 데이터가 없습니다.</div>
      </div>
    </div>
  )
}
