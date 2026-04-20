"use client"

import { GameSelector } from "./game-selector"
import { DateRangePicker } from "./date-range-picker"

/**
 * DashboardToolbar — 대시보드 상단 제어줄.
 *  · 좌: 게임 선택 (전체 / 포코머지 / 게임 1 / 게임 2)
 *  · 우: 기간 선택 (프리셋 4종 모달)
 */
export function DashboardToolbar() {
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap mb-6">
      <GameSelector />
      <DateRangePicker />
    </div>
  )
}
