'use client'

import { ThemeToggle } from './theme-toggle'

interface SidebarFooterProps {
  isFullyCollapsed: boolean
  showExpandedContent: boolean
}

export function SidebarFooter({ isFullyCollapsed, showExpandedContent }: SidebarFooterProps) {
  return (
    <div className="pb-4 px-4 pt-3 flex flex-col gap-3">
      <ThemeToggle isCollapsed={isFullyCollapsed} showExpandedContent={showExpandedContent} />
    </div>
  )
}
