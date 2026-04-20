'use client'

import Link from 'next/link'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/shared/ui/tooltip'

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
              <span className="text-xl font-bold tracking-tight text-primary dark:text-foreground">
                Compass
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
        Experiment-to-Investment Decision OS
      </div>
    </div>
  )
}
