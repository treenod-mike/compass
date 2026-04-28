'use client'

import Link from 'next/link'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/shared/ui/tooltip'
import { GameSelector } from '@/widgets/dashboard/ui/game-selector'
import { cn } from '@/shared/lib/utils'

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

interface BrandAndProductProps {
  /** 사이드바 collapsed 상태 */
  isCollapsed?: boolean
  /** width 애니메이션 완료 후 텍스트/세컨더리 콘텐츠 fade-in 트리거 */
  showExpandedContent?: boolean
}

/**
 * BrandAndProduct — CategorySidebar 상단 영역.
 *   로고 + COMPASS 워드마크 + 포트폴리오/게임 선택 드롭다운
 *
 * collapsed 모드(76px): 아이콘만 표시
 * expanded 모드(220px): 아이콘 + COMPASS 워드마크 + GameSelector
 */
export function BrandAndProduct({
  isCollapsed = false,
  showExpandedContent = true,
}: BrandAndProductProps = {}) {
  return (
    <div
      className={cn(
        'flex flex-col items-stretch min-w-0 transition-[padding] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]',
        isCollapsed ? 'items-center px-2 pt-3 pb-2' : 'px-4 pt-3 pb-3 gap-3',
      )}
    >
      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              href="/dashboard"
              className={cn(
                'flex items-center shrink-0 text-primary',
                isCollapsed ? 'justify-center' : 'gap-2.5',
              )}
              aria-label="대시보드로 돌아가기"
            >
              <CompassMark />
              <span
                className="leading-none whitespace-nowrap overflow-hidden inline-block"
                style={{
                  fontFamily: "'Rocko Ultra', 'Pretendard Variable', sans-serif",
                  fontSize: "30px",
                  fontWeight: 900,
                  letterSpacing: "-0.015em",
                  textShadow: "0 1px 0 rgba(145,40,180,0.15)",
                  maxWidth: showExpandedContent ? '200px' : '0px',
                  opacity: showExpandedContent ? 1 : 0,
                  transition: 'max-width 0.3s cubic-bezier(0.4,0,0.2,1), opacity 0.3s cubic-bezier(0.4,0,0.2,1)',
                  pointerEvents: showExpandedContent ? 'auto' : 'none',
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

      {!isCollapsed && (
        <div
          className="overflow-hidden"
          style={{
            maxHeight: showExpandedContent ? '60px' : '0px',
            opacity: showExpandedContent ? 1 : 0,
            transition: 'max-height 0.3s cubic-bezier(0.4,0,0.2,1), opacity 0.3s cubic-bezier(0.4,0,0.2,1)',
            pointerEvents: showExpandedContent ? 'auto' : 'none',
          }}
        >
          <GameSelector />
        </div>
      )}
    </div>
  )
}
