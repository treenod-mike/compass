'use client'

import { navigationItems } from '@/shared/config/navigation'
import { DateRangePicker } from '@/widgets/dashboard/ui/date-range-picker'
import { CategoryTabs } from './category-tabs'
import { isPriorStale, priorAgeDays } from '@/shared/api/prior-data'

interface AppTopBarProps {
  onToggleSidebar?: () => void
  isSidebarCollapsed?: boolean
}

/**
 * AppTopBar — 1행 레이아웃 (gameboard 와 동일 구조):
 *   [≡ 사이드바 토글 | CategoryTabs (primary/utility) | rightSlot (StaleChip + DateRangePicker)]
 *
 * 브랜드(CompassMark + COMPASS 워드마크) 와 GameSelector 는 사이드바 상단으로 이동됨.
 */
export function AppTopBar({ onToggleSidebar, isSidebarCollapsed }: AppTopBarProps = {}) {
  return (
    <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <CategoryTabs
        items={navigationItems}
        onToggleSidebar={onToggleSidebar}
        isSidebarCollapsed={isSidebarCollapsed}
        rightSlot={
          <>
            {isPriorStale() && (
              <div className="bg-signal-caution/10 text-signal-caution rounded-inline px-2 py-1 text-xs">
                Prior 데이터 {priorAgeDays()}일 경과 — npm run crawl:st 권장
              </div>
            )}
            <DateRangePicker />
          </>
        }
      />
    </header>
  )
}
