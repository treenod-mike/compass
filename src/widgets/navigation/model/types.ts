export interface AppSidebarProps {
  isCollapsed: boolean
  onCollapsedChange: (next: boolean) => void
  isMobileOpen?: boolean
  isDesktop?: boolean
  isInitialized?: boolean
}
