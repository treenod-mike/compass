'use client'

import React from 'react'
import {
  BarChart, Bar, AreaChart, Area, Legend, Cell,
} from 'recharts'
import { COLORS, LEGEND_CONFIG } from './constants'
import { CustomLegend } from './chart-utils'
import { buildCommonElements, buildChartMargin, type ChartRenderContext } from './chart-context'

export type { ChartRenderContext } from './chart-context'
export { renderLoadingOrEmpty } from './chart-context'
export { renderPieChart, renderComposedChart } from './chart-renderers-pie-composed'
export { renderLineChart } from './chart-renderer-line'

// ========================================
// 에어리어 차트 렌더러
// ========================================

export function renderAreaChart(ctx: ChartRenderContext): React.ReactNode {
  const { filteredData, dataKey, dataKey2, stackKeys, activeKeys, shouldUseDualAxis, rightAxisKey,
    dynamicRightMargin, dynamicLeftMargin, key1Visible, key2Visible, isPuChart, disableLegendInteraction, title, legendLayout } = ctx
  const { commonElements } = buildCommonElements(ctx)

  if (stackKeys.length > 0) {
    return (
      <AreaChart data={filteredData}
        margin={buildChartMargin(true, ctx)}
      >
        {commonElements}
        <Legend content={<CustomLegend chartType="line" legendLayout={legendLayout} />} verticalAlign="bottom"
          height={legendLayout === 'scroll-x' ? 44 : LEGEND_CONFIG.HEIGHT}
          wrapperStyle={{ paddingTop: `${LEGEND_CONFIG.PADDING_TOP_NORMAL}px`, marginTop: `${LEGEND_CONFIG.MARGIN_TOP}px`, width: '100%' }}
          style={{ cursor: disableLegendInteraction ? 'default' : 'pointer' }}
        />
        {activeKeys.map((key, index) => (
          <Area key={key} type="monotone" dataKey={key}
            yAxisId={shouldUseDualAxis && key === rightAxisKey ? 'right' : 'left'}
            stroke={COLORS[index % COLORS.length]} fill={COLORS[index % COLORS.length]}
            fillOpacity={0.6} strokeWidth={2} name={key}
          />
        ))}
      </AreaChart>
    )
  }

  return (
    <AreaChart data={filteredData}
      margin={buildChartMargin(false, ctx)}
    >
      {commonElements}
      {key1Visible && (
        <Area type="monotone" dataKey={dataKey} yAxisId="left" stroke={COLORS[0]} fill={COLORS[0]}
          fillOpacity={0.6} strokeWidth={2} name={isPuChart ? 'PU' : (title || dataKey)} />
      )}
      {dataKey2 && key2Visible && (
        <Area type="monotone" dataKey={dataKey2} yAxisId={shouldUseDualAxis ? 'right' : 'left'}
          stroke={COLORS[1]} fill={COLORS[1]} fillOpacity={0.6} strokeWidth={2} name={isPuChart ? 'NewPU' : dataKey2} />
      )}
    </AreaChart>
  )
}

// ========================================
// 바 차트 렌더러
// ========================================

export function renderBarChart(ctx: ChartRenderContext): React.ReactNode {
  const { filteredData, dataKey, dataKey2, stackKeys, activeKeys, sortedActiveKeys, isStackedBar,
    shouldUseDualAxis, dynamicRightMargin, dynamicLeftMargin, key1Visible, key2Visible, nameKey,
    legendOrder, customLabels, customColorFunction, disableLegendInteraction, isPuChart, hoveredSegment, setHoveredSegment, title, legendLayout } = ctx
  const { commonElements } = buildCommonElements(ctx)

  const legendContent = (props: any) => (
    <CustomLegend {...props} chartType="bar" legendOrder={legendOrder} customLabels={customLabels}
      legendLayout={legendLayout}
      onHover={(dk, idx) => setHoveredSegment(dk ? { dataKey: dk, index: idx } : null)}
    />
  )
  const scrollLegendHeight = 44
  const legendProps = {
    content: legendContent, verticalAlign: 'bottom' as const,
    height: legendLayout === 'scroll-x' ? scrollLegendHeight : LEGEND_CONFIG.HEIGHT,
    wrapperStyle: { paddingTop: `${LEGEND_CONFIG.PADDING_TOP_NORMAL}px`, marginTop: `${LEGEND_CONFIG.MARGIN_TOP}px`, zIndex: 1, width: '100%' },
  }

  const handleBarMouseMove = (e: any) => {
    if (e?.activeTooltipIndex !== undefined) {
      setHoveredSegment({ dataKey: '', index: e.activeTooltipIndex })
    }
  }
  const handleBarMouseLeave = () => setHoveredSegment(null)

  if (isStackedBar && stackKeys.length > 0) {
    const componentKeys = sortedActiveKeys.filter(key => key !== '전체')

    const stackedData = filteredData.map(item => {
      const filtered: Record<string, unknown> = { ...item }
      stackKeys.forEach(key => {
        if (key === '전체') return
        if (!componentKeys.includes(key)) delete filtered[key]
      })
      return filtered
    })

    return (
      <BarChart data={stackedData}
        margin={buildChartMargin(true, ctx)}
        barCategoryGap="5%" barGap={0}
        onMouseLeave={handleBarMouseLeave}
      >
        {commonElements}
        <Legend {...legendProps} />
        {componentKeys.map((key, idx) => {
          const originalIndex = stackKeys.indexOf(key)
          const fillColor = customColorFunction
            ? customColorFunction(key, originalIndex, stackKeys.length)
            : COLORS[originalIndex % COLORS.length]
          const isSeriesDimmed = !!hoveredSegment?.dataKey && hoveredSegment.dataKey !== key
          const isTopBar = idx === componentKeys.length - 1
          return <Bar key={key} dataKey={key} yAxisId="left" stackId="stack" fill={fillColor} name={key} maxBarSize={100} fillOpacity={isSeriesDimmed ? 0.25 : 1}
            radius={isTopBar ? [4, 4, 0, 0] : [0, 0, 0, 0]}
            onMouseEnter={() => setHoveredSegment({ dataKey: key, index: 0 })}
          />
        })}
      </BarChart>
    )
  }

  if (!isStackedBar && stackKeys.length > 0) {
    return (
      <BarChart data={filteredData}
        margin={buildChartMargin(true, ctx)}
        barCategoryGap="10%" barGap={4}
        onMouseMove={handleBarMouseMove}
        onMouseLeave={handleBarMouseLeave}
      >
        {commonElements}
        <Legend {...legendProps} style={{ cursor: disableLegendInteraction ? 'default' : 'pointer' }} />
        {activeKeys.map((key, index) => {
          const fillColor = customColorFunction
            ? customColorFunction(key, index, activeKeys.length)
            : COLORS[index % COLORS.length]
          const isSeriesDimmed = !!hoveredSegment?.dataKey && hoveredSegment.dataKey !== key
          return <Bar key={key} dataKey={key} yAxisId="left" fill={fillColor} name={key} maxBarSize={56} fillOpacity={isSeriesDimmed ? 0.25 : 1} radius={[4, 4, 0, 0]} />
        })}
      </BarChart>
    )
  }

  return (
    <BarChart data={filteredData}
      margin={buildChartMargin(false, ctx)}
      barCategoryGap="5%" barGap={0}
      onMouseMove={handleBarMouseMove}
      onMouseLeave={handleBarMouseLeave}
    >
      {commonElements}
      {key1Visible && (
        <Bar dataKey={dataKey} yAxisId="left" fill={COLORS[0]} name={isPuChart ? 'PU' : (title || dataKey)} maxBarSize={100} radius={[4, 4, 0, 0]}>
          {ctx.barCellColors && filteredData.map((_, index) => (
            <Cell key={index} fill={ctx.barCellColors![index] ?? COLORS[0]} />
          ))}
        </Bar>
      )}
      {dataKey2 && key2Visible && (
        <Bar dataKey={dataKey2} yAxisId={shouldUseDualAxis ? 'right' : 'left'}
          fill={COLORS[1]} name={isPuChart ? 'NewPU' : dataKey2} maxBarSize={100} radius={[4, 4, 0, 0]} />
      )}
    </BarChart>
  )
}

