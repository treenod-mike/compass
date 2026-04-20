'use client'

import * as React from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { Icon as Iconify } from '@iconify/react'
import { cn } from '@/shared/lib/utils'
import {
  getItemsByCategory,
  inferCategoryFromPath,
  navigationItems,
  type NavigationItem,
} from '@/shared/config/navigation'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/shared/ui/tooltip'
import type { AppSidebarProps } from '../model/types'
import {
  CATEGORY_SIDEBAR_COLLAPSED_WIDTH,
  CATEGORY_SIDEBAR_EXPANDED_WIDTH,
  ITEM_SPACING,
  MENU_ITEM_HEIGHT,
  PADDING_COLLAPSED,
  PADDING_EXPANDED,
  SECTION_SPACING,
} from '../model/constants'
import { SidebarFooter } from './sidebar-footer'

const iconHoverTransition = { type: 'spring' as const, stiffness: 400, damping: 17 }

export function CategorySidebar({
  isCollapsed,
  onCollapsedChange,
  isMobileOpen = false,
  isDesktop = true,
  isInitialized = true,
}: AppSidebarProps) {
  const pathname = usePathname()

  const [isFullyCollapsed, setIsFullyCollapsed] = React.useState(isCollapsed)
  const showExpandedContent = !isCollapsed && !isFullyCollapsed

  const handleSidebarAnimationComplete = React.useCallback(() => {
    setIsFullyCollapsed(isCollapsed)
  }, [isCollapsed])

  const loadingToastId = React.useRef<string | number | null>(null)
  const previousPathname = React.useRef<string>(pathname)

  React.useEffect(() => {
    if (pathname !== previousPathname.current && loadingToastId.current) {
      toast.dismiss(loadingToastId.current)
      loadingToastId.current = null
    }
    previousPathname.current = pathname
  }, [pathname])

  React.useEffect(() => {
    return () => {
      if (loadingToastId.current) {
        toast.dismiss(loadingToastId.current)
        loadingToastId.current = null
      }
    }
  }, [])

  const handleNavClick = React.useCallback(() => {
    if (loadingToastId.current) return
    loadingToastId.current = toast.loading('페이지 이동 중...', {
      duration: 10000,
      dismissible: true,
    })
  }, [])

  const activeCategory = inferCategoryFromPath(pathname, navigationItems)
  const items = activeCategory
    ? getItemsByCategory(navigationItems, activeCategory)
    : []

  return (
    <motion.aside
      initial={false}
      animate={{
        width: isCollapsed ? CATEGORY_SIDEBAR_COLLAPSED_WIDTH : CATEGORY_SIDEBAR_EXPANDED_WIDTH,
        x: isDesktop ? 0 : isMobileOpen ? 0 : -CATEGORY_SIDEBAR_EXPANDED_WIDTH,
      }}
      transition={
        isInitialized
          ? {
              width: { duration: 0.28, ease: [0.4, 0, 0.2, 1] },
              x: { type: 'spring', stiffness: 300, damping: 30 },
            }
          : { duration: 0 }
      }
      onAnimationComplete={handleSidebarAnimationComplete}
      className={cn(
        'flex fixed left-0 border-r border-border bg-background flex-col',
        isMobileOpen ? 'z-[70] top-0 h-screen' : 'z-20',
      )}
      style={{
        overflow: 'hidden',
        willChange: 'transform, width',
        ...(isMobileOpen
          ? {}
          : {
              top: 'var(--app-top-bar-height, 113px)',
              height: 'calc(100vh - var(--app-top-bar-height, 113px))',
            }),
      }}
      data-new-nav-sidebar
    >
      <nav
        className="flex-1 pt-4 pb-4 overflow-y-auto overflow-x-hidden"
        style={{
          paddingLeft: isCollapsed ? PADDING_COLLAPSED : PADDING_EXPANDED,
          paddingRight: isCollapsed ? PADDING_COLLAPSED : PADDING_EXPANDED,
        }}
      >
        <ul className={ITEM_SPACING}>
          {items.map((item, index) => {
            const isLastItem = index === items.length - 1
            return (
              <li key={item.url}>
                <CategoryMenuItem
                  item={item}
                  pathname={pathname}
                  isCollapsed={isCollapsed}
                  showExpandedContent={showExpandedContent}
                  onNavClick={handleNavClick}
                />
                {!isLastItem && <div className={SECTION_SPACING} />}
              </li>
            )
          })}
        </ul>
      </nav>

      <SidebarFooter
        isFullyCollapsed={isFullyCollapsed}
        showExpandedContent={showExpandedContent}
      />
    </motion.aside>
  )
}

interface CategoryMenuItemProps {
  item: NavigationItem
  pathname: string
  isCollapsed: boolean
  showExpandedContent: boolean
  onNavClick: () => void
}

function CategoryMenuItem({
  item,
  pathname,
  isCollapsed,
  showExpandedContent,
  onNavClick,
}: CategoryMenuItemProps) {
  const isActive = pathname === item.url || pathname.startsWith(`${item.url}/`)

  return (
    <Link
      href={item.url}
      onClick={onNavClick}
      className={cn(
        'text-base transition-colors duration-200 flex items-center',
        isCollapsed
          ? 'rounded-full justify-center'
          : 'rounded-xl w-full justify-start px-3 gap-3',
        !isCollapsed && !isActive && 'hover:bg-brand-line/10 dark:hover:bg-primary/15',
        !isCollapsed && isActive && 'bg-brand-line/10 dark:bg-primary/15',
      )}
      style={{ minHeight: MENU_ITEM_HEIGHT }}
      aria-current={isActive ? 'page' : undefined}
    >
      {isCollapsed ? (
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  'flex items-center justify-center w-10 h-10 rounded-full transition-colors hover:bg-brand-line/10',
                  isActive && 'bg-brand-line/10 dark:bg-primary/15',
                )}
              >
                <motion.div whileHover={{ scale: 1.15 }} transition={iconHoverTransition}>
                  <Iconify icon={item.icon} className="w-7 h-7 text-primary dark:text-foreground" />
                </motion.div>
              </div>
            </TooltipTrigger>
            <TooltipContent
              side="right"
              className="z-[9999] bg-primary text-primary-foreground font-bold"
            >
              {item.title}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        <>
          <motion.div
            className="flex-shrink-0"
            whileHover={{ scale: 1.15 }}
            transition={iconHoverTransition}
          >
            <Iconify icon={item.icon} className="w-7 h-7 text-primary dark:text-foreground" />
          </motion.div>
          <span
            className="font-bold break-keep"
            style={{
              opacity: showExpandedContent ? 1 : 0,
              transition: 'opacity 0.16s cubic-bezier(0.45, 0, 0.38, 1)',
              pointerEvents: showExpandedContent ? 'auto' : 'none',
            }}
          >
            {item.title}
          </span>
          {item.badge && (
            <span
              className="ml-auto text-xs font-bold text-white px-2 py-0.5 rounded-full bg-brand-line whitespace-nowrap"
              style={{
                opacity: showExpandedContent ? 1 : 0,
                transition: 'opacity 0.16s cubic-bezier(0.45, 0, 0.38, 1)',
                pointerEvents: showExpandedContent ? 'auto' : 'none',
              }}
            >
              {item.badge}
            </span>
          )}
        </>
      )}
    </Link>
  )
}
