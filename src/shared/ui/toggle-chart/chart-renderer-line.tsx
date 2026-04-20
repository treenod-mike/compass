'use client'

import React from 'react'
import { LineChart, Line, Legend, ReferenceLine } from 'recharts'
import { COLORS, LEGEND_CONFIG } from './constants'
import { CustomLegend } from './chart-utils'
import { buildCommonElements, buildChartMargin, type ChartRenderContext } from './chart-context'

export function renderLineChart(ctx: ChartRenderContext): React.ReactNode {
  const { filteredData, dataKey, dataKey2, stackKeys, sortedActiveKeys, shouldUseDualAxis, rightAxisKey,
    dynamicRightMargin, dynamicLeftMargin, key1Visible, key2Visible, hoveredSegment, setHoveredSegment,
    pinnedSegment, setPinnedSegment,
    legendOrder, customLabels, customColorFunction, disableLegendInteraction, isPuChart, title,
    referenceLines, xReferenceLines, legendLayout, animateLines } = ctx

  const handleDotClick = (dk: string, dotIndex: number) => {
    if (pinnedSegment?.dataKey === dk && pinnedSegment?.index === dotIndex) {
      setPinnedSegment(null)
    } else {
      setPinnedSegment({ dataKey: dk, index: dotIndex })
    }
  }
  const { commonElements } = buildCommonElements(ctx)

  if (stackKeys.length > 0) {
    const hasPrecomputedTotal = stackKeys.includes('전체') &&
      filteredData.length > 0 && Object.prototype.hasOwnProperty.call(filteredData[0], '전체')
    const showOnlyTotalLine = hasPrecomputedTotal && sortedActiveKeys.length === stackKeys.length
    const lineKeysToRender = showOnlyTotalLine ? ['전체'] : sortedActiveKeys

    return (
      <LineChart data={filteredData}
        margin={buildChartMargin(true, ctx)}
        onMouseLeave={() => setHoveredSegment(null)}
      >
        {commonElements}
        <Legend
          content={(props) => (
            <CustomLegend {...props} chartType="line" legendOrder={legendOrder} customLabels={customLabels}
              legendLayout={legendLayout}
              onHover={(dk, idx) => setHoveredSegment(dk ? { dataKey: dk, index: idx } : null)}
            />
          )}
          verticalAlign="bottom" height={legendLayout === 'scroll-x' ? 44 : LEGEND_CONFIG.HEIGHT}
          wrapperStyle={{ paddingTop: `${LEGEND_CONFIG.PADDING_TOP_NORMAL}px`, marginTop: `${LEGEND_CONFIG.MARGIN_TOP}px`, width: '100%' }}
          style={{ cursor: disableLegendInteraction ? 'default' : 'pointer' }}
        />
        {lineKeysToRender.map((key, index) => {
          const strokeColor = customColorFunction
            ? customColorFunction(key, index, sortedActiveKeys.length)
            : COLORS[index % COLORS.length]
          const isHovered = hoveredSegment?.dataKey === key
          const isDimmed = !!hoveredSegment?.dataKey && !isHovered
          return (
            <Line key={key} type="monotone" dataKey={key}
              yAxisId={shouldUseDualAxis && key === rightAxisKey ? 'right' : 'left'}
              stroke={strokeColor} strokeWidth={isDimmed ? 1 : 2} strokeOpacity={isDimmed ? 0.25 : 1}
              isAnimationActive={!!animateLines}
              animationDuration={animateLines ? 800 : 0}
              animationEasing="ease-out"
              dot={{ r: 3, fill: strokeColor, stroke: strokeColor, strokeWidth: 1, fillOpacity: isDimmed ? 0.25 : 1 }}
              activeDot={(props: any) => {
                const { cx, cy, index: dotIndex } = props
                const isTarget = !hoveredSegment || isHovered
                const isPinned = pinnedSegment?.dataKey === key && pinnedSegment?.index === dotIndex
                return (
                  <circle cx={cx} cy={cy} r={isPinned ? 8 : isTarget ? 6 : 3}
                    fill={strokeColor}
                    stroke={strokeColor}
                    strokeWidth={isPinned ? 3 : isTarget ? 2 : 1} style={{ cursor: 'pointer' }}
                    onMouseOver={() => { if (hoveredSegment?.dataKey !== key) setHoveredSegment({ dataKey: key, index: dotIndex }) }}
                    onClick={() => handleDotClick(key, dotIndex)}
                  />
                )
              }}
              connectNulls={false} name={key}
            />
          )
        })}
      </LineChart>
    )
  }

  const color1 = customColorFunction ? customColorFunction(dataKey, 0, dataKey2 ? 2 : 1) : COLORS[0]
  const color2 = dataKey2 ? (customColorFunction ? customColorFunction(dataKey2, 1, 2) : COLORS[1]) : null

  return (
    <LineChart data={filteredData}
      margin={buildChartMargin(false, ctx)}
      onMouseLeave={() => setHoveredSegment(null)}
    >
      {commonElements}
      {key1Visible && (
        <Line type="monotone" dataKey={dataKey} yAxisId="left"
          stroke={color1} strokeWidth={2}
          isAnimationActive={!!animateLines}
          animationDuration={animateLines ? 800 : 0}
          animationEasing="ease-out"
          dot={{ r: 3, fill: color1, stroke: color1, strokeWidth: 1 }}
          activeDot={(props: any) => {
            const { cx, cy, index: dotIndex } = props
            const isPinned = pinnedSegment?.dataKey === dataKey && pinnedSegment?.index === dotIndex
            return (
              <circle cx={cx} cy={cy} r={isPinned ? 8 : 6}
                fill={color1} stroke={color1} strokeWidth={2} style={{ cursor: 'pointer' }}
                onClick={() => handleDotClick(dataKey, dotIndex)}
              />
            )
          }}
          connectNulls={false}
          name={isPuChart ? 'PU' : (title || dataKey)}
        />
      )}
      {dataKey2 && key2Visible && color2 && (
        <Line type="monotone" dataKey={dataKey2} yAxisId={shouldUseDualAxis ? 'right' : 'left'}
          stroke={color2} strokeWidth={2}
          isAnimationActive={!!animateLines}
          animationDuration={animateLines ? 800 : 0}
          animationEasing="ease-out"
          dot={{ r: 3, fill: color2, stroke: color2, strokeWidth: 1 }}
          activeDot={(props: any) => {
            const { cx, cy, index: dotIndex } = props
            const isPinned = pinnedSegment?.dataKey === dataKey2 && pinnedSegment?.index === dotIndex
            return (
              <circle cx={cx} cy={cy} r={isPinned ? 8 : 6}
                fill={color2} stroke={color2} strokeWidth={2} style={{ cursor: 'pointer' }}
                onClick={() => handleDotClick(dataKey2, dotIndex)}
              />
            )
          }}
          connectNulls={false}
          name={isPuChart ? 'NewPU' : dataKey2}
        />
      )}
      {referenceLines?.map((rl, i) => (
        <ReferenceLine
          key={i}
          y={rl.value}
          yAxisId="left"
          stroke={rl.color ?? 'var(--destructive)'}
          strokeDasharray="5 3"
          strokeWidth={1.5}
          label={rl.label ? { value: rl.label, position: 'insideTopRight', fontSize: 11, fill: rl.color ?? 'var(--destructive)' } : undefined}
        />
      ))}
    </LineChart>
  )
}
