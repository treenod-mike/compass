import type { IconifyIcon } from '@iconify/types'
import calculatorBold from '@iconify-icons/solar/calculator-bold'
import chart2Bold from '@iconify-icons/solar/chart-2-bold'
import graphUpBold from '@iconify-icons/solar/graph-up-bold'
import plugCircleBold from '@iconify-icons/solar/plug-circle-bold'
import widget5Bold from '@iconify-icons/solar/widget-5-bold'
import type { TranslationKey } from '@/shared/i18n/dictionary'
import { flaskBold } from './custom-icons'

export type CategoryId = 'overview' | 'market' | 'channel' | 'experiments' | 'settings'

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
  { id: 'overview', label: '투자 판정', groupKey: 'nav.group.investment', position: 'primary', icon: chart2Bold },
  { id: 'market', label: '시장 포지셔닝', groupKey: 'nav.group.market', position: 'primary', icon: graphUpBold },
  { id: 'channel', label: '채널 포화도', groupKey: 'nav.group.channel', position: 'primary', icon: widget5Bold },
  { id: 'experiments', label: '실험 영향 (PRISM)', groupKey: 'nav.group.experiments', position: 'primary', icon: flaskBold },
  { id: 'settings', label: '데이터 연결', groupKey: 'nav.group.settings', position: 'utility', icon: plugCircleBold },
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
  {
    title: '투자 시뮬레이션',
    url: '/dashboard/vc-simulation',
    icon: calculatorBold,
    category: 'overview',
  },
  {
    title: '채널 포화도',
    url: '/dashboard/mmm',
    icon: widget5Bold,
    category: 'channel',
  },
  {
    title: 'PRISM 연동',
    url: '/dashboard/prism',
    icon: flaskBold,
    category: 'experiments',
    badge: '개발 예정',
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
