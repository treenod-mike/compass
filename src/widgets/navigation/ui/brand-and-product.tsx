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
 * 나침반 아이콘: 전통 compass 컨벤션 반영
 *   - 북침: 브랜드 primary (purple) 솔리드
 *   - 남침: 밝은 fill + primary stroke (contrast)
 *   - 외곽 링 + 중심 피벗
 *   - 카디널 마크 (N/E/S/W) 미세 틱
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
      <circle
        cx="20"
        cy="20"
        r="17.5"
        stroke="var(--primary)"
        strokeWidth={2.5}
      />

      {/* 카디널 틱 (N/E/S/W) */}
      <g stroke="var(--primary)" strokeWidth={1.5} strokeLinecap="round">
        <line x1="20" y1="2" x2="20" y2="5" />
        <line x1="20" y1="35" x2="20" y2="38" />
        <line x1="2" y1="20" x2="5" y2="20" />
        <line x1="35" y1="20" x2="38" y2="20" />
      </g>

      {/* 남침 (흰색 fill + primary stroke — 대비 half) */}
      <path
        d="M20 34 L14 20 L20 21.5 L26 20 Z"
        fill="var(--background)"
        stroke="var(--primary)"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />

      {/* 북침 (primary solid — 주인공 half) */}
      <path
        d="M20 6 L26 20 L20 18.5 L14 20 Z"
        fill="var(--primary)"
        stroke="var(--primary)"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />

      {/* 중심 피벗 */}
      <circle cx="20" cy="20" r={2.2} fill="var(--primary)" />
      <circle cx="20" cy="20" r={0.9} fill="var(--background)" />
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
              <CompassMark className="w-8 h-8" />
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
