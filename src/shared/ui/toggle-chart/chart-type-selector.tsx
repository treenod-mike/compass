'use client'

import React from 'react'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import {
  FILTER_TRIGGER_HEIGHT,
  FILTER_TRIGGER_RADIUS,
  FILTER_TRIGGER_BORDER,
  FILTER_TRIGGER_BG,
  FILTER_TRIGGER_HOVER,
  FILTER_TRIGGER_SHADOW,
} from '@/shared/constants/ui-sizes'
import { cn } from '@/shared/lib/utils'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuTrigger,
  DropdownMenuRadioGroup, DropdownMenuRadioItem,
} from '@/shared/ui/dropdown-menu'
import { BarChartIcon, LineChartIcon } from './chart-icons'

interface ChartTypeSelectorProps {
  activeChartType: 'line' | 'bar'
  isStackedBar: boolean
  stackKeys: string[]
  onChartTypeChange: (type: 'line' | 'bar') => void
}

export function ChartTypeSelector({
  activeChartType,
  isStackedBar,
  stackKeys,
  onChartTypeChange,
}: ChartTypeSelectorProps) {
  const stackedLabel = isStackedBar && stackKeys.length > 0 ? '누적 막대 차트' : '막대 차트'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button"
          className={cn(FILTER_TRIGGER_HEIGHT, FILTER_TRIGGER_RADIUS, FILTER_TRIGGER_BORDER, FILTER_TRIGGER_BG, FILTER_TRIGGER_SHADOW, FILTER_TRIGGER_HOVER, "inline-flex items-center w-auto px-3 gap-2 justify-between font-medium text-sm")}
        >
          <span className="flex items-center gap-1.5 truncate">
            {activeChartType === 'line' ? <LineChartIcon /> : <BarChartIcon />}
            {activeChartType === 'line' ? '라인 차트' : stackedLabel}
          </span>
          <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-auto min-w-[var(--radix-dropdown-menu-trigger-width)]">
        <DropdownMenuRadioGroup
          value={activeChartType}
          onValueChange={(v) => onChartTypeChange(v as 'line' | 'bar')}
        >
          <DropdownMenuRadioItem value="line">
            <span className="flex items-center gap-1.5">
              <LineChartIcon />
              라인 차트
            </span>
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="bar">
            <span className="flex items-center gap-1.5">
              <BarChartIcon />
              {stackedLabel}
            </span>
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
