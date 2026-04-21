'use client'

import Link from 'next/link'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/shared/ui/tooltip'
import { GameSelector } from '@/widgets/dashboard/ui/game-selector'

function CompassMark() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      className="w-[30px] h-[30px] shrink-0"
      fill="none"
      aria-hidden
      style={{
        filter:
          'drop-shadow(0 0 0.4px currentColor) drop-shadow(0 0 0.4px currentColor)',
      }}
    >
      <path
        fill="currentColor"
        d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0M1.5 8a6.5 6.5 0 0 1 10.93-4.756L6 6l-2.756 6.43A6.48 6.48 0 0 1 1.5 8m7.643 1.143l-4.001 1.715l1.715-4.001zM8 14.5a6.48 6.48 0 0 1-4.43-1.744L10 10l2.756-6.43A6.5 6.5 0 0 1 8 14.5"
      />
    </svg>
  )
}

/**
 * BrandAndProduct — AppTopBar 좌측 영역.
 *   로고 | divider | 포트폴리오/게임 선택 드롭다운
 *
 * gameboard의 BrandAndProduct 레이아웃 구조 동일 (ProductSelector 자리에
 * Compass의 GameSelector를 배치).
 */
export function BrandAndProduct() {
  return (
    <div className="flex items-center gap-3 min-w-0 ml-2">
      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              href="/dashboard"
              className="flex items-center gap-2.5 shrink-0 text-primary"
              aria-label="대시보드로 돌아가기"
            >
              <CompassMark />
              <span
                className="leading-none"
                style={{
                  fontFamily: "'Rocko Ultra', 'Pretendard Variable', sans-serif",
                  fontSize: "30px",
                  fontWeight: 900,
                  letterSpacing: "-0.015em",
                  textShadow: "0 1px 0 rgba(145,40,180,0.15)",
                }}
              >
                COMPASS
              </span>
            </Link>
          </TooltipTrigger>
          <TooltipContent
            side="bottom"
            className="z-[9999] bg-primary text-primary-foreground font-bold"
          >
            대시보드로 돌아가기
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <div className="h-6 w-px bg-border shrink-0" aria-hidden />

      <div className="w-[200px] shrink-0">
        <GameSelector />
      </div>
    </div>
  )
}
