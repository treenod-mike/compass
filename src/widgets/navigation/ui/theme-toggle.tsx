'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useTheme } from 'next-themes'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/shared/ui/tooltip'
import { cn } from '@/shared/lib/utils'

const iconHoverTransition = { type: 'spring' as const, stiffness: 400, damping: 17 }

function SunIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className={className}>
      <path fill="currentColor" d="M17 12a5 5 0 1 1-10 0a5 5 0 0 1 10 0" />
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M12 1.25a.75.75 0 0 1 .75.75v2a.75.75 0 0 1-1.5 0V2a.75.75 0 0 1 .75-.75M1.25 12a.75.75 0 0 1 .75-.75h2a.75.75 0 0 1 0 1.5H2a.75.75 0 0 1-.75-.75m18 0a.75.75 0 0 1 .75-.75h2a.75.75 0 0 1 0 1.5h-2a.75.75 0 0 1-.75-.75M12 19.25a.75.75 0 0 1 .75.75v2a.75.75 0 0 1-1.5 0v-2a.75.75 0 0 1 .75-.75"
        clipRule="evenodd"
      />
      <path
        fill="currentColor"
        d="M3.67 3.716a.75.75 0 0 1 1.059-.048L6.95 5.7a.75.75 0 0 1-1.012 1.107L3.717 4.775a.75.75 0 0 1-.048-1.06m16.663.001a.75.75 0 0 1-.047 1.06l-2.223 2.03A.75.75 0 1 1 17.05 5.7l2.222-2.032a.75.75 0 0 1 1.06.048m-3.306 13.309a.75.75 0 0 1 1.06 0l2.223 2.222a.75.75 0 1 1-1.061 1.06l-2.222-2.222a.75.75 0 0 1 0-1.06m-10.051 0a.75.75 0 0 1 0 1.06l-2.222 2.223a.75.75 0 0 1-1.06-1.06l2.222-2.223a.75.75 0 0 1 1.06 0"
        opacity="0.45"
      />
    </svg>
  )
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className={className}>
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M22 12c0 5.523-4.477 10-10 10a10 10 0 0 1-3.321-.564A9 9 0 0 1 8 18a8.97 8.97 0 0 1 2.138-5.824A6.5 6.5 0 0 0 15.5 15a6.5 6.5 0 0 0 5.567-3.143c.24-.396.933-.32.933.143"
        clipRule="evenodd"
        opacity="0.45"
      />
      <path
        fill="currentColor"
        d="M2 12c0 4.359 2.789 8.066 6.679 9.435A9 9 0 0 1 8 18c0-2.221.805-4.254 2.138-5.824A6.47 6.47 0 0 1 9 8.5a6.5 6.5 0 0 1 3.143-5.567C12.54 2.693 12.463 2 12 2C6.477 2 2 6.477 2 12"
      />
    </svg>
  )
}

interface ThemeToggleProps {
  isCollapsed?: boolean
  showExpandedContent?: boolean
}

const THEME_TOGGLE_HEIGHT = 44

export function ThemeToggle({ isCollapsed, showExpandedContent }: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const isDark = mounted && resolvedTheme === 'dark'
  const toggle = () => setTheme(isDark ? 'light' : 'dark')
  const label = isDark ? '라이트 모드로 전환' : '다크 모드로 전환'
  const Icon = isDark ? MoonIcon : SunIcon

  return (
    <div
      className={isCollapsed ? 'flex items-center justify-center' : 'flex items-center'}
      style={{ height: THEME_TOGGLE_HEIGHT }}
    >
      <TooltipProvider delayDuration={100}>
        <Tooltip open={isCollapsed ? undefined : false}>
          <TooltipTrigger asChild>
            <button
              onClick={toggle}
              aria-label={label}
              className={cn(
                'flex items-center transition-colors duration-200',
                isCollapsed
                  ? 'w-10 h-10 justify-center rounded-full hover:bg-brand-line/10'
                  : 'w-full rounded-xl px-3 gap-3 hover:bg-brand-line/10 hover:text-brand-line',
              )}
              style={{ minHeight: isCollapsed ? 40 : THEME_TOGGLE_HEIGHT }}
            >
              <motion.div
                className="flex-shrink-0"
                whileHover={{ scale: 1.15 }}
                transition={iconHoverTransition}
              >
                <Icon className="w-7 h-7 theme-btn" />
              </motion.div>
              {!isCollapsed && (
                <span
                  className="font-bold text-base"
                  style={{
                    opacity: showExpandedContent ? 1 : 0,
                    transition: 'opacity 0.16s cubic-bezier(0.45, 0, 0.38, 1)',
                    pointerEvents: showExpandedContent ? 'auto' : 'none',
                  }}
                >
                  {isDark ? '다크 모드' : '라이트 모드'}
                </span>
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent
            side="right"
            className="z-[9999] bg-primary text-primary-foreground font-bold"
          >
            {label}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  )
}
