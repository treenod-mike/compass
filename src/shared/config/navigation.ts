import type { IconifyIcon } from '@iconify/types'
import chart2Bold from '@iconify-icons/solar/chart-2-bold'
import plugCircleBold from '@iconify-icons/solar/plug-circle-bold'
import type { TranslationKey } from '@/shared/i18n/dictionary'

export type CategoryId = 'overview' | 'settings'

export interface CategoryMeta {
  id: CategoryId
  label: string
  /** i18n key rendered as the sidebar group label above items in this category */
  groupKey: TranslationKey
  position: 'primary' | 'utility'
  icon: IconifyIcon
}

export interface NavigationItem {
  title: string
  url: string
  icon: IconifyIcon
  category: CategoryId
  badge?: string
}

export const CATEGORIES: CategoryMeta[] = [
  { id: 'overview', label: '대시보드', groupKey: 'nav.group.investment', position: 'primary', icon: chart2Bold },
  { id: 'settings', label: '데이터 연결', groupKey: 'nav.group.settings', position: 'utility', icon: plugCircleBold },
]

export const navigationItems: NavigationItem[] = [
  {
    title: '대시보드',
    url: '/dashboard',
    icon: chart2Bold,
    category: 'overview',
  },
  {
    title: '데이터 연결',
    url: '/dashboard/connections',
    icon: plugCircleBold,
    category: 'settings',
  },
]

export function inferCategoryFromPath(
  pathname: string,
  items: NavigationItem[] = navigationItems,
): CategoryId | null {
  const exact = items.find((i) => pathname === i.url)
  if (exact) return exact.category
  const sorted = [...items].sort((a, b) => b.url.length - a.url.length)
  const prefix = sorted.find((i) => pathname.startsWith(`${i.url}/`))
  return prefix?.category ?? null
}

export function getItemsByCategory(
  items: NavigationItem[],
  categoryId: CategoryId,
): NavigationItem[] {
  return items.filter((i) => i.category === categoryId)
}

export function getAvailableCategories(items: NavigationItem[]): CategoryId[] {
  const set = new Set<CategoryId>(items.map((i) => i.category))
  return Array.from(set)
}
