'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Button } from '@/shared/ui/button'
import {
  Tooltip as InfoTooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/shared/ui/tooltip'
import { Info } from 'lucide-react'
import { ResponsiveContainer } from 'recharts'
import { CustomTabs, CustomTabsList, CustomTabsTrigger } from '@/shared/ui/custom-tabs'

import {
  renderLoadingOrEmpty, renderLineChart, renderAreaChart,
  renderBarChart, renderPieChart, renderComposedChart,
} from './chart-renderers'
import type { ChartRenderContext } from './chart-context'
import { SegmentFilter } from './segment-filter'
import { useChartState } from './use-chart-state'
import type { ToggleChartProps } from './types'
import { ChartTypeSelector } from './chart-type-selector'
import { AxisRangeDialog } from './axis-range-dialog'
import { XReferenceLineOverlay } from './x-reference-line-overlay'

// Re-exports for backward compatibility
export type { ChartDataItem } from './types'
export type { ToggleChartProps } from './types'

export function ToggleChart({
  title, tooltip, titleSuffix, titleAdornment, data, height = 300,
  dataKey = 'value', dataKey2, nameKey = 'label',
  isPuChart = false, chartType = 'line',
  selectConfig, customToggles, onToggleChange,
  isLoading = false, valueFormatter,
  isStackedBar = false, stackKeys = [] as string[],
  legendOrder, enableFullWidth = false,
  isFullWidth: initialIsFullWidth = false,
  enableDualAxis = false,
  onFullWidthChange, hideXAxis: hideXAxisProp = false, hideYAxis = false, yAxisTickFormatter,
  disableLegendInteraction: disableLegendProp = false, hideSegmentFilter = false,
  hideChartTypeSelector = false, composedConfig,
  leftMargin = 0, rightMargin = 0,
  customColorFunction, customFilter, customTooltip, customLabels,
  fixedLeftYMax, referenceLines, xReferenceLines, mini = false, barCellColors, segmentFilterLabel,
  legendLayout = 'scroll-x',
  animateLines = false,
}: ToggleChartProps) {
  const hideXAxis = mini ? true : hideXAxisProp
  const disableLegendInteraction = mini ? true : disableLegendProp
  const effectiveHeight = mini ? (height || 120) : height
  const [visibility, setVisibility] = useState<string>(
    customToggles ? customToggles[0].value : 'PU'
  )
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)

  const [isFullWidth, setIsFullWidth] = useState(initialIsFullWidth)
  const [hoveredSegment, setHoveredSegment] = useState<{ dataKey: string; index: number } | null>(null)
  const [pinnedSegment, setPinnedSegment] = useState<{ dataKey: string; index: number } | null>(null)
  const [isAxisDialogOpen, setIsAxisDialogOpen] = useState(false)
  const [editingAxis, setEditingAxis] = useState<'left' | 'right'>('left')
  const [userChartType, setUserChartType] = useState<'line' | 'bar' | null>(null)
  const activeChartType = userChartType !== null ? userChartType : chartType

  const chartAreaRef = useRef<HTMLDivElement>(null)
  const [chartWidth, setChartWidth] = useState(0)
  useEffect(() => {
    const el = chartAreaRef.current
    if (!el) return
    const obs = new ResizeObserver(([entry]) => setChartWidth(entry.contentRect.width))
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    if (isPuChart && (activeChartType === 'bar' || activeChartType === 'line') && visibility === 'All') {
      setVisibility('PU')
    }
  }, [activeChartType, isPuChart])

  const {
    selectedOptions, setSelectedOptions,
    leftYMin, setLeftYMin, leftYMax, setLeftYMax,
    rightYMin, setRightYMin, rightYMax, setRightYMax,
    filteredData, activeKeys, sortedActiveKeys,
    shouldUseDualAxis, rightAxisKey,
    leftDomain, rightDomain, leftTicks, rightTicks,
    dynamicYAxisWidth, dynamicRightYAxisWidth, dynamicLeftMargin, dynamicRightMargin,
  } = useChartState({
    data, nameKey, dataKey, dataKey2, stackKeys, selectConfig,
    isStackedBar, hideSegmentFilter, enableDualAxis, composedConfig,
    activeChartType, title, isPuChart, leftMargin, rightMargin,
    selectedVisibility: visibility, fixedLeftYMax,
  })

  const handleYAxisClick = (isRightAxis: boolean) => {
    setEditingAxis(isRightAxis ? 'right' : 'left')
    const fmt = (v: number | 'auto') => (typeof v === 'number' ? v.toLocaleString() : '0')
    if (isRightAxis) {
      if (rightYMin === '') setRightYMin(fmt(rightDomain[0]))
      if (rightYMax === '') setRightYMax(fmt(rightDomain[1]))
    } else {
      if (leftYMin === '') setLeftYMin(fmt(leftDomain[0]))
      if (leftYMax === '') setLeftYMax(fmt(leftDomain[1]))
    }
    setIsAxisDialogOpen(true)
  }

  // key1/key2 visibility
  let key1Visible = visibility === 'All' || visibility === 'PU' || visibility === 'Acquisition'
  let key2Visible = visibility === 'All' || visibility === 'Non PU' || visibility === 'Consumption'
  if (customToggles) {
    const normalize = (v: any) => (v ? String(v).toLowerCase() : '')
    const vk = normalize(visibility)
    const synonymsForKey1 = new Set(['acquisition', 'count', 'total', normalize(dataKey)])
    const synonymsForKey2 = new Set(['consumption', 'rate', 'average', normalize(dataKey2)])
    key1Visible = visibility === 'All' || synonymsForKey1.has(vk)
    key2Visible = dataKey2 ? visibility === 'All' || synonymsForKey2.has(vk) : false
  }

  const handleCheckboxChange = (option: string, checked: boolean) => {
    let newSelected: string[]
    if (option === '전체') {
      newSelected = checked ? ['전체'] : (selectedOptions.filter(i => i !== option).length === 0 ? ['전체'] : selectedOptions.filter(i => i !== option))
    } else {
      newSelected = checked
        ? [...selectedOptions.filter(i => i !== '전체'), option]
        : selectedOptions.filter(i => i !== option)
      if (newSelected.length === 0) newSelected = ['전체']
    }
    setSelectedOptions(newSelected)
    selectConfig?.onMultiSelect?.(newSelected)
  }

  const handleCategoryChange = (category: string, checked: boolean) => {
    let newSelected = checked
      ? [...selectedOptions.filter(i => i !== '전체'), category]
      : selectedOptions.filter(i => i !== category)
    if (newSelected.length === 0) newSelected = ['전체']
    setSelectedOptions(newSelected)
    selectConfig?.onMultiSelect?.(newSelected)
  }

  const ctx: ChartRenderContext = {
    filteredData, nameKey, dataKey, dataKey2, isLoading, height: effectiveHeight,
    title,
    activeChartType, isStackedBar, stackKeys, activeKeys, sortedActiveKeys,
    shouldUseDualAxis, rightAxisKey, leftDomain, rightDomain, leftTicks, rightTicks,
    dynamicYAxisWidth, dynamicRightYAxisWidth, dynamicLeftMargin, dynamicRightMargin,
    hoveredSegment, setHoveredSegment, pinnedSegment, setPinnedSegment, visibility, isPuChart,
    key1Visible, key2Visible, legendOrder, customLabels, customColorFunction,
    customTooltip, valueFormatter, disableLegendInteraction, hideXAxis, hideYAxis,
    composedConfig, handleYAxisClick, referenceLines, xReferenceLines, barCellColors, yAxisTickFormatter,
    legendLayout,
    animateLines,
  }

  const renderChart = () => {
    if (isLoading || !filteredData || filteredData.length === 0) return renderLoadingOrEmpty(ctx)
    if (activeChartType === 'line') return renderLineChart(ctx)
    if (activeChartType === 'area') return renderAreaChart(ctx)
    if (activeChartType === 'bar') return renderBarChart(ctx)
    if (activeChartType === 'pie') return renderPieChart(ctx)
    if (activeChartType === 'composed') return renderComposedChart(ctx)
    return null
  }

  // mini 모드: Card/Header 없이 차트만 렌더링
  if (mini) {
    return (
      <div className="w-full h-full">
        {isLoading || !filteredData || filteredData.length === 0 ? (
          <div style={{ width: '100%', height: effectiveHeight }}>{renderChart()}</div>
        ) : (
          <ResponsiveContainer width="100%" height={effectiveHeight}>
            {renderChart()}
          </ResponsiveContainer>
        )}
      </div>
    )
  }

  return (
    <Card className="rounded-2xl hover:border-primary transition-colors h-full">
      <CardHeader className="pb-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <CardTitle className="text-xl font-semibold text-foreground">{title}</CardTitle>
            {titleAdornment && titleAdornment}
            {tooltip && (
              <TooltipProvider delayDuration={100}>
                <InfoTooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{tooltip}</p>
                  </TooltipContent>
                </InfoTooltip>
              </TooltipProvider>
            )}
          </div>
          <div className="flex gap-4 items-center flex-nowrap">
            {titleSuffix && titleSuffix}
            {!hideChartTypeSelector && chartType !== 'pie' && chartType !== 'composed' && (
              <ChartTypeSelector
                activeChartType={activeChartType as 'line' | 'bar'}
                isStackedBar={isStackedBar}
                stackKeys={stackKeys}
                onChartTypeChange={(v) => setUserChartType(v)}
              />
            )}

            {customToggles ? (
              <CustomTabs
                value={visibility}
                onValueChange={(value) => { setVisibility(value); onToggleChange?.(value) }}
                className="w-auto"
              >
                <CustomTabsList>
                  {customToggles.map((toggle) => (
                    <CustomTabsTrigger key={toggle.value} value={toggle.value}>
                      {toggle.label}
                    </CustomTabsTrigger>
                  ))}
                </CustomTabsList>
              </CustomTabs>
            ) : isPuChart ? (
              <>
                {(activeChartType === 'line' || activeChartType === 'bar') && (
                  <CustomTabs value={visibility} onValueChange={(value) => setVisibility(value)} className="w-auto">
                    <CustomTabsList>
                      <CustomTabsTrigger value="PU">PU</CustomTabsTrigger>
                      <CustomTabsTrigger value="Non PU">NewPU</CustomTabsTrigger>
                    </CustomTabsList>
                  </CustomTabs>
                )}
                {chartType === 'pie' && (
                  <CustomTabs value={visibility} onValueChange={(value) => setVisibility(value)} className="w-auto">
                    <CustomTabsList>
                      <CustomTabsTrigger value="PU">비율</CustomTabsTrigger>
                      <CustomTabsTrigger value="Non PU">판매수</CustomTabsTrigger>
                    </CustomTabsList>
                  </CustomTabs>
                )}
              </>
            ) : null}

            {!hideSegmentFilter && (selectConfig || (stackKeys && stackKeys.length > 0) || !!segmentFilterLabel) && (
              <SegmentFilter
                isDropdownOpen={isDropdownOpen}
                setIsDropdownOpen={setIsDropdownOpen}
                selectedOptions={selectedOptions}
                stackKeys={stackKeys}
                selectConfig={selectConfig}
                onCheckboxChange={handleCheckboxChange}
                onCategoryChange={handleCategoryChange}
                segmentFilterLabel={segmentFilterLabel}
                customLabels={customLabels}
              />
            )}

            {customFilter && customFilter}

            {enableFullWidth && (
              <CustomTabs
                value={isFullWidth ? 'full' : 'half'}
                onValueChange={(v) => { const next = v === 'full'; setIsFullWidth(next); onFullWidthChange?.(next) }}
                className="w-auto ml-auto"
              >
                <CustomTabsList>
                  <CustomTabsTrigger value="half">1/2</CustomTabsTrigger>
                  <CustomTabsTrigger value="full">확장</CustomTabsTrigger>
                </CustomTabsList>
              </CustomTabs>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex items-center relative [&_svg]:overflow-visible" style={{ minHeight: `${effectiveHeight}px` }} role="region" aria-label={`${title} 차트`}>
        <div ref={chartAreaRef} style={{ width: '100%', position: 'relative' }}>
          {isLoading || !filteredData || filteredData.length === 0 ? (
            <div style={{ width: '100%', height: effectiveHeight }}>{renderChart()}</div>
          ) : (
            <ResponsiveContainer width="100%" height={effectiveHeight}>
              {renderChart()}
            </ResponsiveContainer>
          )}
          {xReferenceLines && (
            <XReferenceLineOverlay
              xReferenceLines={xReferenceLines}
              chartWidth={chartWidth}
              filteredData={filteredData}
              nameKey={nameKey}
              dynamicLeftMargin={dynamicLeftMargin}
              dynamicYAxisWidth={dynamicYAxisWidth}
              dynamicRightMargin={dynamicRightMargin}
              shouldUseDualAxis={shouldUseDualAxis}
              dynamicRightYAxisWidth={dynamicRightYAxisWidth}
              effectiveHeight={effectiveHeight}
              stackKeys={stackKeys}
              legendLayout={legendLayout}
            />
          )}
        </div>
      </CardContent>

      <AxisRangeDialog
        open={isAxisDialogOpen}
        onOpenChange={setIsAxisDialogOpen}
        editingAxis={editingAxis}
        leftYMin={leftYMin}
        setLeftYMin={setLeftYMin}
        leftYMax={leftYMax}
        setLeftYMax={setLeftYMax}
        rightYMin={rightYMin}
        setRightYMin={setRightYMin}
        rightYMax={rightYMax}
        setRightYMax={setRightYMax}
      />
    </Card>
  )
}
