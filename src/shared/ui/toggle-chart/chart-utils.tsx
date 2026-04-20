'use client'

import React from 'react'
import {
  Tooltip as InfoTooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/shared/ui/tooltip'
import { YAXIS_CONFIG } from './constants'
import { LegendPayloadItem, CustomLegendPropsExtended } from './types'

// ========================================
// Y축 유틸리티 함수
// ========================================

/**
 * Y축 값의 최대 자릿수 계산 (실제 숫자 자리수, 쉼표 제외)
 */
export const getMaxDigits = (ticks: number[] | undefined): number => {
  if (!ticks || ticks.length === 0) return 1
  const maxValue = Math.max(...ticks.map(Math.abs))

  // 정수 부분의 자릿수만 계산 (소수점 무시)
  const integerPart = Math.floor(maxValue)
  if (integerPart === 0) return 1

  // 실제 숫자 자릿수 계산 (예: 1000 → 4, 100 → 3, 10 → 2)
  return Math.floor(Math.log10(integerPart)) + 1
}

/**
 * 로케일 포맷 시 쉼표 개수를 포함한 실제 렌더링 문자 수 계산
 */
export const getFormattedCharCount = (ticks: number[] | undefined): number => {
  if (!ticks || ticks.length === 0) return 1
  const maxValue = Math.max(...ticks.map(Math.abs))
  const formatted = maxValue.toLocaleString()
  return formatted.length
}

/**
 * Y축 너비를 실제 렌더링 문자 수에 따라 동적으로 계산 (쉼표 포함)
 */
export const calcDynamicYAxisWidth = (ticks: number[] | undefined): number => {
  const charCount = getFormattedCharCount(ticks)
  return YAXIS_CONFIG.WIDTH_BASE + charCount * YAXIS_CONFIG.WIDTH_PER_DIGIT
}

// ========================================
// CustomLegend 서브컴포넌트
// ========================================

export const CustomLegend = React.memo(
  ({
    payload,
    chartType: _chartType = 'line',
    legendOrder,
    customLabels,
    onHover,
    legendLayout = 'scroll-x',
  }: CustomLegendPropsExtended) => {
    if (!payload || payload.length === 0) return null
    const isScrollX = legendLayout === 'scroll-x'

    // legendOrder가 제공되면 해당 순서대로 payload 정렬
    let sortedPayload = payload
    if (legendOrder && legendOrder.length > 0) {
      sortedPayload = [...payload].sort((a, b) => {
        const aValue = a.value || ''
        const bValue = b.value || ''
        const aIndex = legendOrder.indexOf(aValue)
        const bIndex = legendOrder.indexOf(bValue)
        // legendOrder에 없는 항목은 뒤로
        if (aIndex === -1) return 1
        if (bIndex === -1) return -1
        return aIndex - bIndex
      })
    }

    return (
      <div
        className={`w-full mt-2 ${isScrollX ? 'legend-scroll-x overflow-y-hidden text-center' : 'overflow-y-auto'}`}
        style={{
          maxHeight: isScrollX ? undefined : '120px',
          paddingBottom: '0px',
        }}
        onMouseLeave={() => onHover?.(null, -1)}
      >
        <div className={`${isScrollX ? 'inline-flex flex-nowrap w-max' : 'flex flex-wrap justify-center'} gap-x-4 gap-y-1`}>
          {sortedPayload.map((entry: LegendPayloadItem, index: number) => {
            // customLabels가 있으면 레이블 변환, 없으면 원본 값 사용
            const displayLabel =
              customLabels && entry.value
                ? customLabels[entry.value] || entry.value
                : entry.value
            const dataKey = entry.dataKey || entry.value || ''

            return (
              <TooltipProvider key={`legend-${index}`} delayDuration={100}>
                <InfoTooltip>
                  <TooltipTrigger asChild>
                    <div
                      className="flex items-center gap-2 cursor-help px-2 py-1 rounded hover:bg-muted/50 transition-colors flex-shrink-0"
                      onMouseEnter={() => onHover?.(dataKey, index)}
                    >
                      {/* Circle indicator for all chart types */}
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: entry.color }}
                      />
                      <span
                        className="text-sm text-foreground whitespace-nowrap"
                        style={{ wordBreak: 'keep-all' }}
                      >
                        {displayLabel}
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    className="bg-popover text-foreground border border-border px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: entry.color }}
                      />
                      <span
                        className="text-sm font-medium text-foreground"
                        style={{ wordBreak: 'keep-all' }}
                      >
                        {displayLabel}
                      </span>
                    </div>
                  </TooltipContent>
                </InfoTooltip>
              </TooltipProvider>
            )
          })}
        </div>
      </div>
    )
  }
)

CustomLegend.displayName = 'CustomLegend'
