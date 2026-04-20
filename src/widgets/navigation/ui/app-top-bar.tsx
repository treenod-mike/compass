'use client'

import { navigationItems } from '@/shared/config/navigation'
import { DateRangePicker } from '@/widgets/dashboard/ui/date-range-picker'
import { BrandAndProduct } from './brand-and-product'
import { CategoryTabs } from './category-tabs'
import { isPriorStale, priorAgeDays } from '@/shared/api/prior-data'

interface AppTopBarProps {
  onToggleSidebar?: () => void
  isSidebarCollapsed?: boolean
}

/**
 * AppTopBar — 2행 레이아웃:
 *   Row 1: [BrandAndProduct (로고 + Game selector)] ← 좌 | 우 → [DateRangePicker]
 *   Row 2: [CategoryTabs (투자 판정 / 시장 포지셔닝)]
 */
export function AppTopBar({ onToggleSidebar, isSidebarCollapsed }: AppTopBarProps = {}) {
  return (
    <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex items-center justify-between gap-4 px-4 pt-4 pb-2">
        <BrandAndProduct />
        <div className="flex items-center gap-3 shrink-0 pr-2">
          {isPriorStale() && (
            <div className="bg-signal-caution/10 text-signal-caution rounded-inline px-2 py-1 text-xs">
              Prior 데이터 {priorAgeDays()}일 경과 — npm run crawl:st 권장
            </div>
          )}
          <DateRangePicker />
        </div>
      </div>
      <CategoryTabs
        items={navigationItems}
        onToggleSidebar={onToggleSidebar}
        isSidebarCollapsed={isSidebarCollapsed}
      />
    </header>
  )
}
