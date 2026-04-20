'use client'

import React, { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import {
  FILTER_TRIGGER_HEIGHT,
  FILTER_TRIGGER_RADIUS,
  FILTER_TRIGGER_BORDER,
  FILTER_TRIGGER_BG,
  FILTER_TRIGGER_HOVER,
  FILTER_TRIGGER_SHADOW,
  FILTER_ITEM_RADIUS,
} from '@/shared/constants/ui-sizes'
import { Button } from '@/shared/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu'
import type { SelectConfig } from './types'

interface SegmentFilterProps {
  isDropdownOpen: boolean
  setIsDropdownOpen: (open: boolean) => void
  selectedOptions: string[]
  stackKeys: string[]
  selectConfig?: SelectConfig
  onCheckboxChange: (option: string, checked: boolean) => void
  onCategoryChange: (category: string, checked: boolean) => void
  segmentFilterLabel?: string
  customLabels?: Record<string, string>
}

export function SegmentFilter({
  isDropdownOpen,
  setIsDropdownOpen,
  selectedOptions,
  stackKeys,
  selectConfig,
  onCheckboxChange,
  onCategoryChange,
  segmentFilterLabel,
  customLabels,
}: SegmentFilterProps) {
  const isMultiSelect = selectConfig?.isMultiSelect || (stackKeys && stackKeys.length > 0)

  // 단일 선택 모드 — DropdownMenu RadioGroup 사용
  if (!isMultiSelect) {
    if (!selectConfig) return (
      <button type="button"
        disabled
        className={cn(FILTER_TRIGGER_HEIGHT, FILTER_TRIGGER_RADIUS, FILTER_TRIGGER_BORDER, FILTER_TRIGGER_BG, FILTER_TRIGGER_SHADOW, "inline-flex items-center px-4 text-sm justify-between gap-2 font-medium min-w-[140px] opacity-50 cursor-not-allowed")}
      >
        <span className="truncate">{segmentFilterLabel || '세그먼트'}</span>
        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
      </button>
    )
    return (
      <SingleSelectDropdown
        selectConfig={selectConfig}
        open={isDropdownOpen}
        onOpenChange={setIsDropdownOpen}
      />
    )
  }

  // 다중 선택 모드
  const options = selectConfig?.options || stackKeys
  const hasCategories = options.some(opt => opt.startsWith('[') && opt.endsWith(']'))

  const triggerLabel = (() => {
    if (selectedOptions.length === 0 || selectedOptions.includes('전체')) {
      return selectConfig?.label || segmentFilterLabel || '세그먼트'
    }
    if (selectedOptions.length === 1) {
      const val = selectedOptions[0]
      return val.startsWith('[') && val.endsWith(']') ? val.slice(1, -1) : val
    }
    return `${selectedOptions.length}개 선택`
  })()

  return (
    <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
      <DropdownMenuTrigger asChild>
        <button type="button"
          className={cn(FILTER_TRIGGER_HEIGHT, FILTER_TRIGGER_RADIUS, FILTER_TRIGGER_BORDER, FILTER_TRIGGER_BG, FILTER_TRIGGER_SHADOW, FILTER_TRIGGER_HOVER, "inline-flex items-center px-4 text-sm justify-between gap-2 font-medium min-w-[140px]")}
        >
          <span className="truncate">{triggerLabel}</span>
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-[180px]" align="start" sideOffset={8}>
        {!hasCategories && (
          <>
            <DropdownMenuLabel
              className="px-3 py-1.5 text-xs font-semibold text-muted-foreground cursor-pointer hover:bg-muted rounded-xl mx-1 mt-1"
              onClick={(e) => {
                e.preventDefault()
                const allSelected = options.every(o => selectedOptions.includes(o)) || selectedOptions.includes('전체')
                onCheckboxChange('전체', !allSelected)
              }}
            >
              {(options.every(o => selectedOptions.includes(o)) || selectedOptions.includes('전체')) ? '전체 해제' : '전체 선택'}
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="mx-2" />
          </>
        )}
        <div className="max-h-[260px] overflow-y-auto p-1">
          {hasCategories
            ? (
              <CategoryItems
                options={options}
                selectedOptions={selectedOptions}
                onCheckboxChange={onCheckboxChange}
                onCategoryChange={onCategoryChange}
                customLabels={customLabels}
              />
            )
            : (
              <FlatItems
                options={options}
                selectedOptions={selectedOptions}
                onCheckboxChange={onCheckboxChange}
                customLabels={customLabels}
              />
            )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SingleSelectDropdown — 단일 선택 DropdownMenu RadioGroup
// ─────────────────────────────────────────────────────────────────────────────

function SingleSelectDropdown({
  selectConfig,
  open,
  onOpenChange,
}: {
  selectConfig: SelectConfig
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [value, setValue] = useState(selectConfig.defaultValue || selectConfig.options[0] || '')

  const handleChange = (newValue: string) => {
    setValue(newValue)
    selectConfig.onSelect?.(newValue)
  }

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <button type="button"
          className={cn(FILTER_TRIGGER_HEIGHT, FILTER_TRIGGER_RADIUS, FILTER_TRIGGER_BORDER, FILTER_TRIGGER_BG, FILTER_TRIGGER_SHADOW, FILTER_TRIGGER_HOVER, "inline-flex items-center px-4 text-sm justify-between gap-2 font-medium")}
        >
          <span>{value}</span>
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-[120px]" align="start" sideOffset={8}>
        <div className="max-h-[260px] overflow-y-auto p-1">
          <DropdownMenuRadioGroup value={value} onValueChange={handleChange}>
            {selectConfig.options.map((option) => (
              <DropdownMenuRadioItem key={option} value={option} className="rounded-xl cursor-pointer font-medium">
                {option}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// FlatItems — 계층 없는 옵션 목록
// ─────────────────────────────────────────────────────────────────────────────

function FlatItems({
  options,
  selectedOptions,
  onCheckboxChange,
  customLabels,
}: {
  options: string[]
  selectedOptions: string[]
  onCheckboxChange: (opt: string, checked: boolean) => void
  customLabels?: Record<string, string>
}) {
  return (
    <>
      {options.map((option) => (
        <DropdownMenuCheckboxItem
          key={option}
          checked={selectedOptions.includes('전체') || selectedOptions.includes(option)}
          onCheckedChange={(checked) => onCheckboxChange(option, !!checked)}
          onSelect={(e) => e.preventDefault()}
          className={cn('rounded-xl cursor-pointer', option === '전체' ? 'font-semibold' : 'font-medium')}
        >
          {customLabels?.[option] ?? option}
        </DropdownMenuCheckboxItem>
      ))}
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// CategoryItems — [bracket] 마커로 구분된 계층형 목록
// ─────────────────────────────────────────────────────────────────────────────

function CategoryItems({
  options,
  selectedOptions,
  onCheckboxChange,
  onCategoryChange,
  customLabels,
}: {
  options: string[]
  selectedOptions: string[]
  onCheckboxChange: (opt: string, checked: boolean) => void
  onCategoryChange: (cat: string, checked: boolean) => void
  customLabels?: Record<string, string>
}) {
  const groups: Array<{ category: string | null; items: string[] }> = []
  let currentCategory: string | null = null
  let currentItems: string[] = []

  for (const option of options) {
    if (option.startsWith('[') && option.endsWith(']')) {
      if (currentCategory !== null || currentItems.length > 0) {
        groups.push({ category: currentCategory, items: currentItems })
      }
      currentCategory = option
      currentItems = []
    } else {
      currentItems.push(option)
    }
  }
  if (currentCategory !== null || currentItems.length > 0) {
    groups.push({ category: currentCategory, items: currentItems })
  }

  return (
    <>
      {groups.map((group, groupIndex) => {
        // 카테고리 없는 flat 항목
        if (!group.category) {
          return group.items.map((option) => (
            <DropdownMenuCheckboxItem
              key={option}
              checked={selectedOptions.includes(option)}
              onCheckedChange={(checked) => onCheckboxChange(option, !!checked)}
              onSelect={(e) => e.preventDefault()}
              className={cn('rounded-xl cursor-pointer', option === '전체' ? 'font-semibold' : 'font-medium')}
            >
              {customLabels?.[option] ?? option}
            </DropdownMenuCheckboxItem>
          ))
        }

        const categoryName = group.category.slice(1, -1)
        const displayCategoryName = customLabels?.[categoryName] ?? categoryName
        const isChecked = selectedOptions.includes(group.category)
        const someChildrenChecked = group.items.some(item => selectedOptions.includes(item))

        // 자식 없는 카테고리 — 단독 체크 항목
        if (group.items.length === 0) {
          return (
            <DropdownMenuCheckboxItem
              key={`group-${groupIndex}`}
              checked={isChecked}
              onCheckedChange={(checked) => onCategoryChange(group.category!, !!checked)}
              onSelect={(e) => e.preventDefault()}
              className="rounded-xl cursor-pointer font-semibold text-muted-foreground"
            >
              {displayCategoryName}
            </DropdownMenuCheckboxItem>
          )
        }

        // 자식 있는 카테고리 — Sub 메뉴
        const allChildrenChecked = group.items.every(item => selectedOptions.includes(item))

        return (
          <DropdownMenuSub key={`group-${groupIndex}`}>
            <DropdownMenuSubTrigger className="rounded-xl cursor-pointer font-semibold">
              <div className="flex items-center gap-2 flex-1">
                <span className="flex-1 truncate text-muted-foreground">{displayCategoryName}</span>
                {someChildrenChecked && !allChildrenChecked && (
                  <span className="text-xs text-muted-foreground font-normal shrink-0">
                    {group.items.filter(i => selectedOptions.includes(i)).length}/{group.items.length}
                  </span>
                )}
                {allChildrenChecked && (
                  <span className="text-xs text-primary font-semibold shrink-0">전체</span>
                )}
              </div>
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent className="shadow-none rounded-xl p-1 min-w-[160px] bg-popover" sideOffset={4}>
                <DropdownMenuLabel
                  className="px-3 py-1 text-xs font-semibold text-muted-foreground cursor-pointer hover:bg-muted rounded-xl"
                  onClick={(e) => {
                    e.preventDefault()
                    onCategoryChange(group.category!, !allChildrenChecked)
                  }}
                >
                  {allChildrenChecked ? '전체 해제' : '전체 선택'}
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="mx-2" />
                {group.items.map((option) => (
                  <DropdownMenuCheckboxItem
                    key={option}
                    checked={selectedOptions.includes(option)}
                    onCheckedChange={(checked) => onCheckboxChange(option, !!checked)}
                    onSelect={(e) => e.preventDefault()}
                    className="rounded-xl cursor-pointer font-medium"
                  >
                    {customLabels?.[option] ?? option}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>
        )
      })}
    </>
  )
}
