'use client'

import Link from 'next/link'
import { Icon as Iconify } from '@iconify/react'
import compassBoldDuotone from '@iconify-icons/solar/compass-bold-duotone'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/shared/ui/tooltip'
import { GameSelector } from '@/widgets/dashboard/ui/game-selector'

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
              <span className="brand-duotone-compass inline-flex">
                <Iconify icon={compassBoldDuotone} className="w-8 h-8" />
              </span>
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
