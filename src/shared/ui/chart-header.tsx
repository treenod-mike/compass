"use client"

import type { ReactNode } from "react"
import { InfoHint } from "./info-hint"

export type ChartHeaderProps = {
  title: string
  subtitle?: string
  context?: string
  insight?: string
  info?: string
  actions?: ReactNode
}

/**
 * ChartHeader — title/description block for all chart cards.
 * Matches gameboard TDS style (text-lg foreground title, muted subtitle).
 */
export function ChartHeader({ title, subtitle, context, insight, info, actions }: ChartHeaderProps) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <h3 className="text-lg font-semibold text-foreground leading-snug">{title}</h3>
          {info && <InfoHint content={info} />}
        </div>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed break-keep">
            {subtitle}
          </p>
        )}
        {context && (
          <p className="text-xs text-muted-foreground mt-0.5 italic leading-relaxed break-keep">
            {context}
          </p>
        )}
        {insight && (
          <p className="text-[11px] text-muted-foreground mt-1 font-medium break-keep">
            {insight}
          </p>
        )}
      </div>
      {actions && <div className="flex-shrink-0">{actions}</div>}
    </div>
  )
}
