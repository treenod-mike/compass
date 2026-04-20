'use client'

import { Icon as Iconify } from '@iconify/react'
import compassBoldIcon from '@iconify-icons/solar/compass-bold'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/shared/ui/tooltip'
import { cn } from '@/shared/lib/utils'

interface SidebarFooterProps {
  isFullyCollapsed: boolean
  showExpandedContent: boolean
}

/**
 * SidebarFooter — 사이드바 하단 브랜드 배지.
 *
 * gameboard의 ThemeToggle + UserProfile 슬롯을 "COMPASS 브랜드 배지"로
 * 대체. 포트폴리오 데모에서 테마/인증은 불필요하지만, 빈 공간은
 * gameboard의 footer 리듬과 맞지 않으므로 간결한 브랜드 마크로 채움.
 *
 * - 접힘: 컴퍼스 아이콘 한 개 (Tooltip으로 "COMPASS v0.1.0")
 * - 펼침: 컴퍼스 아이콘 + 워드마크 + 버전/캡션
 */
export function SidebarFooter({ isFullyCollapsed, showExpandedContent }: SidebarFooterProps) {
  return (
    <div className="pb-4 px-3 pt-3 border-t border-border/60">
      <TooltipProvider delayDuration={100}>
        <Tooltip open={isFullyCollapsed ? undefined : false}>
          <TooltipTrigger asChild>
            <div
              className={cn(
                'flex items-center gap-2.5 rounded-xl transition-colors',
                isFullyCollapsed
                  ? 'w-10 h-10 justify-center mx-auto hover:bg-brand-line/10'
                  : 'px-2 py-2',
              )}
            >
              <Iconify
                icon={compassBoldIcon}
                className="w-7 h-7 text-primary flex-shrink-0"
              />
              {!isFullyCollapsed && (
                <div
                  className="flex flex-col min-w-0"
                  style={{
                    opacity: showExpandedContent ? 1 : 0,
                    transition: 'opacity 0.16s cubic-bezier(0.45, 0, 0.38, 1)',
                    pointerEvents: showExpandedContent ? 'auto' : 'none',
                  }}
                >
                  <span
                    className="text-base font-bold tracking-wide text-primary leading-none"
                    style={{ fontFamily: "'Rocko Ultra', 'Pretendard Variable', sans-serif" }}
                  >
                    COMPASS
                  </span>
                  <span className="text-[11px] font-medium text-muted-foreground mt-0.5 break-keep">
                    v0.1.0 · 실험→투자 OS
                  </span>
                </div>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent
            side="right"
            className="z-[9999] bg-primary text-primary-foreground font-bold"
          >
            COMPASS v0.1.0
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  )
}
