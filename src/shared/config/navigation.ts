import { BarChart3, TrendingUp, type LucideIcon } from 'lucide-react'

export type CategoryId = 'overview' | 'market'

export interface CategoryMeta {
  id: CategoryId
  label: string
  position: 'primary' | 'utility'
  icon: LucideIcon
}

export interface NavigationItem {
  title: string
  url: string
  icon: LucideIcon
  category: CategoryId
  badge?: string
}

export const CATEGORIES: CategoryMeta[] = [
  { id: 'overview', label: '투자 판정', position: 'primary', icon: BarChart3 },
  { id: 'market', label: '시장 포지셔닝', position: 'primary', icon: TrendingUp },
]

export const navigationItems: NavigationItem[] = [
  {
    title: '투자 판정',
    url: '/dashboard',
    icon: BarChart3,
    category: 'overview',
  },
  {
    title: '시장 포지셔닝',
    url: '/dashboard/market-gap',
    icon: TrendingUp,
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
