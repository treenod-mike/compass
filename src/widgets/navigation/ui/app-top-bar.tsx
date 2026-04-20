'use client'

import { navigationItems } from '@/shared/config/navigation'
import { BrandAndProduct } from './brand-and-product'
import { CategoryTabs } from './category-tabs'

interface AppTopBarProps {
  onToggleSidebar?: () => void
  isSidebarCollapsed?: boolean
}

export function AppTopBar({ onToggleSidebar, isSidebarCollapsed }: AppTopBarProps = {}) {
  return (
    <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex items-center px-4 pt-4 pb-2">
        <BrandAndProduct />
      </div>
      <CategoryTabs
        items={navigationItems}
        onToggleSidebar={onToggleSidebar}
        isSidebarCollapsed={isSidebarCollapsed}
      />
    </header>
  )
}
