'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '@/shared/lib/utils'
import {
  CATEGORIES,
  getAvailableCategories,
  getItemsByCategory,
  inferCategoryFromPath,
  type CategoryMeta,
  type NavigationItem,
} from '@/shared/config/navigation'
import { SidebarToggleIcon } from '@/shared/ui'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/shared/ui/tooltip'
import { CATEGORY_SIDEBAR_COLLAPSED_WIDTH } from '../model/constants'

interface CategoryTabsProps {
  items: NavigationItem[]
  onToggleSidebar?: () => void
  isSidebarCollapsed?: boolean
}

const CLOSE_DELAY_MS = 120

export function CategoryTabs({ items, onToggleSidebar, isSidebarCollapsed }: CategoryTabsProps) {
  const pathname = usePathname()
  const activeCategory = inferCategoryFromPath(pathname, items)
  const availableIds = new Set(getAvailableCategories(items))

  const [isMegaOpen, setIsMegaOpen] = React.useState(false)
  const closeTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const cancelClose = React.useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }, [])

  const openMega = React.useCallback(() => {
    cancelClose()
    setIsMegaOpen(true)
  }, [cancelClose])

  const scheduleClose = React.useCallback(() => {
    cancelClose()
    closeTimerRef.current = setTimeout(() => setIsMegaOpen(false), CLOSE_DELAY_MS)
  }, [cancelClose])

  const closeMega = React.useCallback(() => {
    cancelClose()
    setIsMegaOpen(false)
  }, [cancelClose])

  React.useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    }
  }, [])

  React.useEffect(() => {
    setIsMegaOpen(false)
  }, [pathname])

  const primaryTabs = CATEGORIES.filter(
    (c) => c.position === 'primary' && availableIds.has(c.id),
  )
  const utilityTabs = CATEGORIES.filter(
    (c) => c.position === 'utility' && availableIds.has(c.id),
  )

  return (
    <div
      className="relative"
      onMouseLeave={scheduleClose}
      onMouseEnter={cancelClose}
    >
      <div className="flex items-stretch h-12 px-2">
        {onToggleSidebar && (
          <div
            className="flex items-center justify-center -ml-2 shrink-0"
            style={{ width: CATEGORY_SIDEBAR_COLLAPSED_WIDTH }}
          >
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={onToggleSidebar}
                    className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-brand-line/10 text-primary dark:text-foreground transition-colors"
                    aria-label={isSidebarCollapsed ? '사이드바 열기' : '사이드바 접기'}
                  >
                    <SidebarToggleIcon />
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="bottom"
                  className="z-[9999] bg-primary text-primary-foreground font-bold"
                >
                  {isSidebarCollapsed ? '사이드바 열기' : '사이드바 접기'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}

        <div className="relative flex items-stretch">
          {primaryTabs.map((meta) => (
            <PrimaryTab
              key={meta.id}
              meta={meta}
              isActive={activeCategory === meta.id}
              isMenuOpen={isMegaOpen}
              onHover={openMega}
              onClick={openMega}
            />
          ))}

          <AnimatePresence>
            {isMegaOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15, ease: [0.45, 0, 0.38, 1] }}
                className="absolute left-0 top-full z-50 pt-1"
              >
                <div
                  role="menu"
                  className="rounded-md border border-border bg-popover shadow-lg py-3 flex divide-x divide-border"
                >
                  {primaryTabs.map((meta) => (
                    <MegaSection
                      key={meta.id}
                      meta={meta}
                      items={getItemsByCategory(items, meta.id)}
                      pathname={pathname}
                      onNavigate={closeMega}
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex-1" />
        <div className="flex items-stretch">
          {utilityTabs.map((meta) => (
            <UtilityTab
              key={meta.id}
              meta={meta}
              isActive={activeCategory === meta.id}
              items={items}
              onNavigate={closeMega}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

interface PrimaryTabProps {
  meta: CategoryMeta
  isActive: boolean
  isMenuOpen: boolean
  onHover: () => void
  onClick: () => void
}

function PrimaryTab({ meta, isActive, isMenuOpen, onHover, onClick }: PrimaryTabProps) {
  const Icon = meta.icon
  return (
    <button
      type="button"
      onMouseEnter={onHover}
      onClick={onClick}
      className={cn(
        'flex items-center justify-center gap-2 w-[200px] px-4 text-lg font-medium transition-colors border-b-2 -mb-px',
        isActive
          ? 'text-brand-line border-brand-line'
          : 'text-foreground/70 border-transparent hover:text-foreground hover:border-border',
      )}
      aria-haspopup="menu"
      aria-expanded={isMenuOpen}
    >
      <Icon size={20} className="text-primary dark:text-foreground" />
      <span>{meta.label}</span>
    </button>
  )
}

interface UtilityTabProps {
  meta: CategoryMeta
  isActive: boolean
  items: NavigationItem[]
  onNavigate: () => void
}

function UtilityTab({ meta, isActive, items, onNavigate }: UtilityTabProps) {
  const categoryItems = getItemsByCategory(items, meta.id)
  if (categoryItems.length === 0) return null
  const target = categoryItems[0]
  const Icon = meta.icon
  return (
    <Link
      href={target.url}
      onClick={onNavigate}
      className={cn(
        'flex items-center gap-2 px-4 text-lg font-medium transition-colors border-b-2 -mb-px',
        isActive
          ? 'text-brand-line border-brand-line'
          : 'text-foreground/70 border-transparent hover:text-foreground hover:border-border',
      )}
    >
      <Icon size={20} className="text-primary dark:text-foreground" />
      <span>{meta.label}</span>
    </Link>
  )
}

interface MegaSectionProps {
  meta: CategoryMeta
  items: NavigationItem[]
  pathname: string
  onNavigate: () => void
}

function MegaSection({ meta: _meta, items, pathname, onNavigate }: MegaSectionProps) {
  if (items.length === 0) return null
  return (
    <div className="min-w-[200px] px-2 space-y-0.5">
      {items.map((item) => {
        const ItemIcon = item.icon
        const isItemActive =
          pathname === item.url || pathname.startsWith(`${item.url}/`)
        return (
          <Link
            key={item.url}
            href={item.url}
            role="menuitem"
            onClick={onNavigate}
            className={cn(
              'flex items-center gap-3 px-2 py-2 rounded-md text-base transition-colors',
              isItemActive
                ? 'text-brand-line bg-brand-line/10 font-semibold'
                : 'text-foreground/80 hover:bg-accent hover:text-accent-foreground',
            )}
          >
            <ItemIcon size={20} className="shrink-0 text-primary dark:text-foreground" />
            <span className="break-keep">{item.title}</span>
            {item.badge && (
              <span className="ml-auto text-xs font-bold text-white px-2 py-0.5 rounded-full bg-brand-line whitespace-nowrap">
                {item.badge}
              </span>
            )}
          </Link>
        )
      })}
    </div>
  )
}
