import type { IconifyIcon } from '@iconify/types'
import chart2Bold from '@iconify-icons/solar/chart-2-bold'
import graphUpBold from '@iconify-icons/solar/graph-up-bold'

export type CategoryId = 'overview' | 'market'

export interface CategoryMeta {
  id: CategoryId
  label: string
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
  { id: 'overview', label: '투자 판정', position: 'primary', icon: chart2Bold },
  { id: 'market', label: '시장 포지셔닝', position: 'primary', icon: graphUpBold },
]

export const navigationItems: NavigationItem[] = [
  {
    title: '투자 판정',
    url: '/dashboard',
    icon: chart2Bold,
    category: 'overview',
  },
  {
    title: '시장 포지셔닝',
    url: '/dashboard/market-gap',
    icon: graphUpBold,
    category: 'market',
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
