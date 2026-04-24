"use client"

import { useGridLayout } from "@/shared/hooks"
import type { MmmChannel } from "@/shared/api/mmm-data"
import { ResponseCurveCard } from "./response-curve-card"

type ResponseCurveGridProps = {
  channels: readonly MmmChannel[]
}

/**
 * 2×2 grid of MMM Response Curves.
 * - Default: all 4 channels visible in compact view.
 * - Expand one: that card spans both columns; remaining 3 re-flow so the
 *   last one becomes an orphan row (also col-span-2) for a clean rhythm.
 * - Re-uses `useGridLayout` so the interaction model matches Market Gap.
 */
export function ResponseCurveGrid({ channels }: ResponseCurveGridProps) {
  const grid = useGridLayout(channels.length)

  return (
    <div className="grid grid-cols-2 gap-4">
      {channels.map((channel, index) => {
        const id = `mmm-${channel.key}`
        const expanded = grid.expandedId === id
        return (
          <ResponseCurveCard
            key={id}
            channel={channel}
            expanded={expanded}
            onToggle={() => grid.toggle(id)}
            gridClassName={grid.getClassName(id, index)}
          />
        )
      })}
    </div>
  )
}
