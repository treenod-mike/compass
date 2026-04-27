'use client'

import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { Menu } from 'lucide-react'
import { AppTopBar } from './app-top-bar'
import { CategorySidebar } from './category-sidebar'
import {
  CATEGORY_SIDEBAR_COLLAPSED_WIDTH,
  CATEGORY_SIDEBAR_EXPANDED_WIDTH,
} from '../model/constants'

interface LayoutWrapperProps {
  children: React.ReactNode
}

export function LayoutWrapper({ children }: LayoutWrapperProps) {
  const pathname = usePathname()

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true)
  const [isDesktop, setIsDesktop] = useState(true)
  const [hasLoadedState, setHasLoadedState] = useState(false)
  const [canAnimate, setCanAnimate] = useState(false)
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)

  useLayoutEffect(() => {
    try {
      const stored = localStorage.getItem('sidebar-state')
      if (stored) {
        const state = JSON.parse(stored)
        const collapsed = state?.state?.collapsed ?? true
        setIsSidebarCollapsed(collapsed)
      }
    } catch {
      // ignore
    }
    setHasLoadedState(true)
  }, [])

  useEffect(() => {
    if (!hasLoadedState) return
    const newState = { state: { collapsed: isSidebarCollapsed }, version: 0 }
    localStorage.setItem('sidebar-state', JSON.stringify(newState))
  }, [isSidebarCollapsed, hasLoadedState])

  useLayoutEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 768px)')
    const handleChange = () => setIsDesktop(mediaQuery.matches)
    handleChange()
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  useEffect(() => {
    if (hasLoadedState) setCanAnimate(true)
  }, [hasLoadedState])

  useEffect(() => {
    const el = document.querySelector('[data-new-nav-top-bar]')
    if (!el) return
    const update = () => {
      document.documentElement.style.setProperty(
        '--app-top-bar-height',
        `${(el as HTMLElement).offsetHeight}px`,
      )
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (isDesktop) setIsMobileSidebarOpen(false)
  }, [isDesktop])

  useEffect(() => {
    setIsMobileSidebarOpen(false)
  }, [pathname])

  const handleSidebarCollapsedChange = useCallback(
    (next: boolean) => {
      if (isDesktop) {
        setIsSidebarCollapsed(next)
      } else {
        setIsMobileSidebarOpen(false)
      }
    },
    [isDesktop],
  )

  const effectiveCollapsed = isDesktop ? isSidebarCollapsed : false

  const mainMarginLeft =
    isDesktop
      ? isSidebarCollapsed
        ? CATEGORY_SIDEBAR_COLLAPSED_WIDTH
        : CATEGORY_SIDEBAR_EXPANDED_WIDTH
      : 0

  return (
    <div className="relative min-h-screen bg-page-background">
      <div data-new-nav-top-bar className="sticky top-0 z-app-top-bar">
        <AppTopBar
          onToggleSidebar={
            isDesktop ? () => setIsSidebarCollapsed((prev) => !prev) : undefined
          }
          isSidebarCollapsed={effectiveCollapsed}
        />
      </div>

      {!isDesktop && !isMobileSidebarOpen && (
        <button
          onClick={() => setIsMobileSidebarOpen(true)}
          className="fixed top-3 left-3 z-app-top-bar flex items-center justify-center w-10 h-10 rounded-xl bg-brand-line text-white shadow-md opacity-40 hover:opacity-100 active:scale-95 transition-all duration-200"
          aria-label="메뉴 열기"
        >
          <Menu className="h-5 w-5" />
        </button>
      )}

      {!isDesktop && isMobileSidebarOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[65] bg-black/40 backdrop-blur-sm"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      <CategorySidebar
        isCollapsed={effectiveCollapsed}
        onCollapsedChange={handleSidebarCollapsedChange}
        isMobileOpen={!isDesktop && isMobileSidebarOpen}
        isDesktop={isDesktop}
        isInitialized={canAnimate}
      />

      <motion.main
        className="min-h-screen"
        style={{ willChange: 'margin-left' }}
        initial={false}
        animate={{ marginLeft: mainMarginLeft }}
        transition={
          canAnimate ? { type: 'spring', stiffness: 220, damping: 32 } : { duration: 0 }
        }
      >
        <div className="max-w-[1800px] mx-auto pb-4 pt-8 px-6">{children}</div>
      </motion.main>
    </div>
  )
}
