"use client"

import type { ReactNode } from "react"

export type TooltipPayloadItem = {
  name?: string
  value?: string | number
  color?: string
  dataKey?: string
  payload?: Record<string, unknown>
}

export type ChartTooltipProps = {
  active?: boolean
  payload?: TooltipPayloadItem[]
  label?: string | number
  render?: (props: {
    active: boolean
    payload: TooltipPayloadItem[]
    label?: string | number
  }) => ReactNode
  className?: string
}

export function TooltipDot({ color }: { color: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: 8,
        height: 8,
        borderRadius: "50%",
        backgroundColor: color,
        marginRight: 6,
        flexShrink: 0,
      }}
    />
  )
}

/**
 * ChartTooltip — visual shell for all Recharts tooltips.
 * Matches gameboard TDS style: rounded-[1.25rem] + shadow-md + bg-background / border-input.
 */
export function ChartTooltip({
  active,
  payload,
  label,
  render,
  className = "",
}: ChartTooltipProps) {
  if (!active || !payload?.length) return null

  if (render) {
    return (
      <div
        className={`compass-tooltip bg-background border border-input rounded-[1.25rem] shadow-md p-3 ${className}`}
        style={BASE_STYLE}
      >
        {render({ active: !!active, payload, label })}
      </div>
    )
  }

  return (
    <div
      className={`compass-tooltip bg-background border border-input rounded-[1.25rem] shadow-md p-3 ${className}`}
      style={BASE_STYLE}
    >
      {label != null && (
        <div className="text-sm font-semibold text-foreground mb-1">{label}</div>
      )}
      {payload.map((item, i) => (
        <div
          key={i}
          className="flex items-center text-sm text-muted-foreground"
          style={{ lineHeight: 1.6 }}
        >
          {item.color && <TooltipDot color={item.color} />}
          <span>{item.name}</span>
          <span
            className="text-foreground font-medium"
            style={{
              marginLeft: "auto",
              paddingLeft: 12,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {item.value}
          </span>
        </div>
      ))}
    </div>
  )
}

const BASE_STYLE: React.CSSProperties = {
  fontFamily: "inherit",
  minWidth: 120,
  maxWidth: 350,
}
