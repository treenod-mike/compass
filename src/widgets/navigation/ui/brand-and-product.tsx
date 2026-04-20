'use client'

import Link from 'next/link'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/shared/ui/tooltip'

/**
 * BrandAndProduct — 로고(아이콘 + 워드마크) + 제품 태그라인.
 *
 * 아이콘: inline SVG로 렌더해 currentColor → text-primary 상속
 * 워드마크: Rocko Ultra + 30px + tracking-tight 으로
 *           게임보드 PNG 로고 수준의 두께감 확보
 */
function CompassMark({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 40 40"
      fill="none"
      className={className}
      aria-hidden
    >
      {/* 외곽 링 */}
      <circle cx="20" cy="20" r="17.5" stroke="currentColor" strokeWidth={2.8} />
      {/* 북침 (진함) */}
      <path d="M20 5.5 L27 22 L20 18.5 L13 22 Z" fill="currentColor" />
      {/* 남침 (흐림) */}
      <path d="M20 34.5 L13 18 L20 21.5 L27 18 Z" fill="currentColor" fillOpacity={0.35} />
      {/* 중심 점 */}
      <circle cx="20" cy="20" r={2} fill="currentColor" />
    </svg>
  )
}

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
              <CompassMark className="w-7 h-7" />
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
