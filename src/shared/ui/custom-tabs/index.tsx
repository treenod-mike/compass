'use client'

import * as React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/shared/lib/utils'

// ─── Context ─────────────────────────────────────────────────────────────────

interface CustomTabsContextValue {
  value: string
  onValueChange: (value: string) => void
  layoutId: string
}

const CustomTabsContext = React.createContext<CustomTabsContextValue | null>(null)

function useCustomTabs() {
  const ctx = React.useContext(CustomTabsContext)
  if (!ctx) throw new Error('CustomTabs 컴포넌트 안에서 사용해야 합니다')
  return ctx
}

// ─── Components ──────────────────────────────────────────────────────────────

interface CustomTabsProps {
  value: string
  onValueChange: (value: string) => void
  children: React.ReactNode
  className?: string
}

export function CustomTabs({ value, onValueChange, children, className }: CustomTabsProps) {
  const layoutId = React.useId()
  return (
    <CustomTabsContext.Provider value={{ value, onValueChange, layoutId }}>
      <div className={cn('w-full', className)}>{children}</div>
    </CustomTabsContext.Provider>
  )
}

interface CustomTabsListProps {
  children: React.ReactNode
  className?: string
}

export function CustomTabsList({ children, className }: CustomTabsListProps) {
  return (
    <div
      role="tablist"
      className={cn(
        'inline-flex items-center rounded-2xl bg-muted p-1 gap-1',
        className
      )}
    >
      {children}
    </div>
  )
}

interface CustomTabsTriggerProps {
  value: string
  children: React.ReactNode
  className?: string
  disabled?: boolean
  /** 활성 탭의 배경 motion.span에 추가할 클래스 (기본: bg-background shadow-sm) */
  activeClassName?: string
}

export function CustomTabsTrigger({ value, children, className, disabled, activeClassName }: CustomTabsTriggerProps) {
  const { value: activeValue, onValueChange, layoutId } = useCustomTabs()
  const isActive = activeValue === value

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      disabled={disabled}
      onClick={() => !disabled && onValueChange(value)}
      className={cn(
        'relative inline-flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-xl transition-colors cursor-pointer',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        isActive
          ? (activeClassName ? 'text-primary-foreground' : 'text-foreground dark:text-primary-foreground')
          : 'text-muted-foreground hover:text-foreground',
        className
      )}
    >
      {isActive && (
        <span
          className={cn('absolute inset-0 rounded-xl', activeClassName ?? 'bg-background shadow-sm dark:bg-primary')}
          style={{ zIndex: 0 }}
        />
      )}
      <span className="relative z-[1] flex items-center gap-2">{children}</span>
    </button>
  )
}

interface CustomTabsContentProps {
  value: string
  children: React.ReactNode
  className?: string
}

export function CustomTabsContent({ value, children, className }: CustomTabsContentProps) {
  const { value: activeValue } = useCustomTabs()
  if (activeValue !== value) return null
  return (
    <div role="tabpanel" className={cn('mt-4', className)}>
      <AnimatePresence mode="wait">
        <motion.div
          key={value}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.15 }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
