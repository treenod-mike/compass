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

/**
 * BrandAndProduct — 로고(아이콘 + 워드마크) + 제품 태그라인.
 *
 * 아이콘: solar compass-bold-duotone (2 path — 외곽 링 + 내부 바늘)
 *   → CSS로 path별 색 재정의 (brand-duotone-compass class)
 *       · 외곽 링  = primary purple (full opacity)
 *       · 내부 바늘 = warning amber (클래식 gold 나침반 바늘 톤)
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

      <div className="text-sm font-semibold text-foreground/70 shrink-0 break-keep">
        실험→투자 의사결정 OS
      </div>
    </div>
  )
}
