'use client'

import React, { useState } from 'react'
import {
  PieChart, Pie, Cell, Legend, Tooltip, Sector,
  ComposedChart, Bar, Line,
} from 'recharts'
import { COLORS, LEGEND_CONFIG } from './constants'
import { CustomLegend } from './chart-utils'
import { buildCommonElements, buildChartMargin, type ChartRenderContext } from './chart-context'

// ========================================
// 파이 차트 렌더러
// ========================================

function PieChartRenderer({ ctx }: { ctx: ChartRenderContext }) {
  const { filteredData, dataKey, dataKey2, visibility, customColorFunction, valueFormatter,
    customTooltip, disableLegendInteraction } = ctx
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined)

  const pieData = filteredData.map((entry) => ({
    name: entry.label,
    value: visibility === 'Non PU' ? entry[dataKey2 || 'value'] : entry[dataKey],
  }))

  const renderActiveShape = (props: any) => {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props
    return (
      <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + 6}
        startAngle={startAngle} endAngle={endAngle} fill={fill} />
    )
  }

  const PieTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null
    const data = payload[0]
    const percent = data.percent || 0
    return (
      <div className="bg-popover border border-border rounded-lg shadow-lg p-3">
        <p className="font-semibold text-sm text-foreground mb-1">{data.name}</p>
        <p className="text-sm text-muted-foreground">
          <span className="font-medium">비율:</span> {(percent * 100).toFixed(2)}%
        </p>
        <p className="text-sm text-muted-foreground">
          {valueFormatter ? valueFormatter(data.value) : data.value?.toLocaleString()}
        </p>
      </div>
    )
  }

  return (
    <PieChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <Pie {...({
        data: pieData, cx: '50%', cy: '50%', labelLine: false,
        label: ({ name, percent }: any) => percent * 100 >= 5 ? `${name} ${(percent * 100).toFixed(0)}%` : '',
        outerRadius: 110, innerRadius: 55, fill: COLORS[0], dataKey: 'value', nameKey: 'name',
        activeIndex,
        activeShape: renderActiveShape,
        onMouseEnter: (_: any, index: number) => setActiveIndex(index),
        onMouseLeave: () => setActiveIndex(undefined),
      } as any)}>
        {pieData.map((entry, index) => {
          const entryName = String(entry.name ?? index)
          const fillColor = customColorFunction
            ? customColorFunction(entryName, index, pieData.length)
            : COLORS[index % COLORS.length]
          return <Cell key={`cell-${index}`} fill={fillColor} />
        })}
      </Pie>
      <Tooltip content={(customTooltip ?? PieTooltip) as any} />
    </PieChart>
  )
}

export function renderPieChart(ctx: ChartRenderContext): React.ReactNode {
  return <PieChartRenderer ctx={ctx} />
}

// ========================================
// 혼합(Composed) 차트 렌더러
// ========================================

export function renderComposedChart(ctx: ChartRenderContext): React.ReactNode {
  const { filteredData, composedConfig, dynamicRightMargin, dynamicLeftMargin, disableLegendInteraction, legendLayout, legendOrder } = ctx
  if (!composedConfig) return null
  const { commonElements } = buildCommonElements(ctx)

  return (
    <ComposedChart
      data={filteredData}
      margin={buildChartMargin(true, ctx)}
      barCategoryGap="5%" barGap={0}
    >
      {commonElements}
      <Legend
        content={<CustomLegend chartType="bar" legendLayout={legendLayout} legendOrder={legendOrder} />}
        verticalAlign="bottom" height={legendLayout === 'scroll-x' ? 44 : LEGEND_CONFIG.HEIGHT}
        wrapperStyle={{ paddingTop: `${LEGEND_CONFIG.PADDING_TOP_NORMAL}px`, marginTop: `${LEGEND_CONFIG.MARGIN_TOP}px`, width: '100%' }}
        style={{ cursor: disableLegendInteraction ? 'default' : 'pointer' }}
      />
      {composedConfig.bars?.map((bar, index) => (
        <Bar key={bar.dataKey} dataKey={bar.dataKey}
          fill={bar.fill || COLORS[index % COLORS.length]}
          name={bar.name} maxBarSize={100} yAxisId={bar.yAxisId || 'left'}
          radius={[4, 4, 0, 0]}
        />
      ))}
      {composedConfig.lines?.map((line, index) => (
        <Line key={line.dataKey} type="monotone" dataKey={line.dataKey}
          stroke={line.stroke || COLORS[(composedConfig.bars?.length || 0) + index % COLORS.length]}
          strokeWidth={2} name={line.name} dot={{ r: 3 }} activeDot={{ r: 5 }}
          yAxisId={line.yAxisId || 'right'}
        />
      ))}
    </ComposedChart>
  )
}
