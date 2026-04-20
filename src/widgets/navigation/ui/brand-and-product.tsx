'use client'

import Link from 'next/link'
import { Icon as Iconify } from '@iconify/react'
import compassBigBoldDuotone from '@iconify-icons/solar/compass-big-bold-duotone'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/shared/ui/tooltip'

/**
 * BrandAndProduct — 로고(아이콘 + 워드마크) + 제품 태그라인.
 *
 * 아이콘: solar compass-big-bold-duotone (둥글둥글 2톤)
 *         currentColor → text-primary 상속
 * 워드마크: Rocko Ultra + 30px + weight 900 + 미세 textShadow
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
              <Iconify icon={compassBigBoldDuotone} className="w-8 h-8" />
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

      <div className="text-sm font-semibold text-foreground/70 shrink-0 break-keep">
        실험→투자 의사결정 OS
      </div>
    </div>
  )
}
