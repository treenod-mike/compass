'use client'

import Link from 'next/link'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/shared/ui/tooltip'

/**
 * BrandAndProduct — 상단 좌측 로고 + 제품 설명.
 *
 * "COMPASS" 워드마크는 Rocko Ultra 폰트로 brand 컬러(purple)에서 렌더.
 * gameboard의 로고 자리(이미지)와 동일한 높이/위치를 맞춤.
 */
export function BrandAndProduct() {
  return (
    <div className="flex items-center gap-3 min-w-0 ml-2">
      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              href="/dashboard"
              className="flex items-center shrink-0"
              aria-label="대시보드로 돌아가기"
            >
              <span
                className="text-[26px] font-normal leading-none tracking-[0.02em] text-primary"
                style={{ fontFamily: "'Rocko Ultra', 'Pretendard Variable', sans-serif" }}
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
