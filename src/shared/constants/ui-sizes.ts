/**
 * UI 컴포넌트 표준 크기 상수
 * Select, Input, Button 등 공통 컴포넌트의 폭 표준화
 */

export const SELECT_WIDTHS = {
  /** 소형 필터 드롭다운 (w-36 = 144px) */
  SM: 'w-36',
  /** 중형 필터 드롭다운 (w-44 = 176px) */
  MD: 'w-44',
  /** 대형 필터 드롭다운 (w-48 = 192px) */
  LG: 'w-48',
  /** 특대형 필터 드롭다운 (w-64 = 256px) */
  XL: 'w-64',
} as const

export type SelectWidth = typeof SELECT_WIDTHS[keyof typeof SELECT_WIDTHS]

export const FILTER_TRIGGER_HEIGHT = 'h-10' as const

export const FILTER_HEIGHTS = {
  DEFAULT: 'h-10',
} as const

// === Filter trigger pill (SelectTrigger, FilterBar, DatePicker, MonthPicker, MultiSelect, chart filters) ===
export const FILTER_TRIGGER_RADIUS = 'rounded-[1.25rem]' as const
export const FILTER_TRIGGER_BORDER = 'border border-input dark:border-primary/40' as const
export const FILTER_TRIGGER_BG = 'bg-background dark:bg-muted' as const
export const FILTER_TRIGGER_SHADOW = 'shadow-none' as const
export const FILTER_TRIGGER_HOVER = 'hover:border-primary hover:bg-background dark:hover:border-primary dark:hover:bg-muted transition-colors' as const
export const FILTER_TRIGGER_TEXT = 'text-sm font-medium' as const

/** Composite class for raw <button> filter pills (non-primitive usage) */
export const FILTER_TRIGGER_CLS = 'inline-flex items-center h-10 px-4 text-sm border border-input dark:border-primary/40 bg-background dark:bg-muted rounded-[1.25rem] shadow-none justify-between gap-2 font-medium hover:bg-background hover:border-primary dark:hover:border-primary dark:hover:bg-muted transition-colors' as const

// === Dropdown popover container (SelectContent, PopoverContent, DropdownMenuContent) ===
export const FILTER_POPOVER_RADIUS = 'rounded-[1.25rem]' as const
export const FILTER_POPOVER_BG = 'bg-popover' as const
export const FILTER_POPOVER_BORDER = 'border border-border' as const
export const FILTER_POPOVER_SHADOW = 'shadow-lg' as const

// === Dropdown item (SelectItem, DropdownMenuItem) ===
export const FILTER_ITEM_RADIUS = 'rounded-xl' as const
export const FILTER_ITEM_HOVER = 'hover:bg-muted/50 focus:bg-muted/50' as const
