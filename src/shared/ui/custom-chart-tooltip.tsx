"use client"

/**
 * Gameboard-style Recharts tooltip variants.
 * Ported verbatim from `@/src/shared/ui/custom-chart-tooltip` (gameboard).
 * Use these when a widget wants the TDS-native rounded-[1.25rem] + shadow-md
 * look without building its own render fn.
 */

export interface CustomChartTooltipProps {
  active?: boolean
  payload?: readonly { value: number }[]
  label?: string | number
  chartLabel: string
  unit?: string
  decimals?: number
}

export interface SimpleChartTooltipProps {
  active?: boolean
  payload?: readonly { value: number; name?: string }[]
  label?: string | number
  valueFormatter?: (value: number) => string
  seriesName?: string
  hideName?: boolean
  [key: string]: unknown
}

export interface MultiSeriesChartTooltipProps {
  active?: boolean
  payload?: any[]
  label?: string | number
  hoveredDataKey?: string
  valueFormatter?: (value: number) => string
  valueFormatters?: Record<string, (value: number) => string>
  customLabels?: Record<string, string>
  showTotal?: boolean
}

export function MultiSeriesChartTooltip({
  active,
  payload,
  label,
  hoveredDataKey,
  valueFormatter,
  valueFormatters,
  customLabels,
  showTotal,
}: MultiSeriesChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null

  const hoveredItem = hoveredDataKey
    ? payload.find((entry) => entry.dataKey === hoveredDataKey)
    : null

  const total = payload.reduce(
    (sum, entry) => sum + (Number(entry.value) || 0),
    0,
  )

  return (
    <div
      className="bg-background p-3 border border-input rounded-[1.25rem] shadow-md"
      style={{ maxWidth: "350px" }}
    >
      <p className="text-sm font-medium text-foreground mb-2">{label}</p>

      {hoveredItem && (
        <div className="mb-2 p-2 bg-primary/10 border-2 border-primary rounded-[1.25rem]">
          <div className="flex items-center gap-2">
            <div
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: hoveredItem.color ?? hoveredItem.fill }}
            />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-foreground truncate">
                {customLabels?.[hoveredItem.name] ?? hoveredItem.name}
              </div>
              <div
                className="text-sm font-bold"
                style={{
                  color:
                    hoveredItem.value == null
                      ? undefined
                      : hoveredItem.color ?? hoveredItem.fill,
                }}
              >
                {hoveredItem.value == null ? (
                  <span className="text-muted-foreground font-normal">집계 중</span>
                ) : (valueFormatters?.[hoveredItem.dataKey] ?? valueFormatter) ? (
                  (valueFormatters?.[hoveredItem.dataKey] ?? valueFormatter)!(
                    Number(hoveredItem.value) || 0,
                  )
                ) : (
                  (Number(hoveredItem.value) || 0).toLocaleString()
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {payload.map((entry, index) => {
        const isNull = entry.value == null
        const val = Number(entry.value) || 0
        const displayName = customLabels?.[entry.name] ?? entry.name
        const isHovered = hoveredDataKey ? entry.dataKey === hoveredDataKey : true
        const color = entry.color ?? entry.fill ?? "currentColor"
        return (
          <p
            key={index}
            className={`text-sm font-semibold transition-opacity ${isHovered ? "" : "opacity-40"}`}
            style={{ color: isNull ? undefined : color }}
          >
            {displayName}:{" "}
            {isNull ? (
              <span className="text-muted-foreground font-normal">집계 중</span>
            ) : (valueFormatters?.[entry.dataKey] ?? valueFormatter) ? (
              (valueFormatters?.[entry.dataKey] ?? valueFormatter)!(val)
            ) : (
              val.toLocaleString()
            )}
          </p>
        )
      })}

      {showTotal && payload.length > 1 && (
        <div className="mt-2 pt-2 border-t border-border">
          <p className="text-sm font-semibold text-foreground">
            합계: {valueFormatter ? valueFormatter(total) : total.toLocaleString()}
          </p>
        </div>
      )}
    </div>
  )
}

export function SimpleChartTooltip({
  active,
  payload,
  label,
  valueFormatter,
  seriesName,
  hideName,
}: SimpleChartTooltipProps) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-background border border-input rounded-[1.25rem] shadow-md p-3">
        <p className="text-sm font-semibold text-foreground mb-1">{label}</p>
        {payload.map((entry, i) => (
          <p key={i} className="text-sm text-muted-foreground">
            {!hideName && (
              <span className="font-medium">{seriesName || entry.name}: </span>
            )}
            {valueFormatter
              ? valueFormatter(entry.value)
              : entry.value?.toLocaleString?.() ?? entry.value}
          </p>
        ))}
      </div>
    )
  }
  return null
}

export function CustomChartTooltip({
  active,
  payload,
  label,
  chartLabel,
  unit = "",
  decimals,
}: CustomChartTooltipProps) {
  if (active && payload && payload.length) {
    const value = payload[0].value
    let formattedValue: string

    if (decimals !== undefined) {
      formattedValue =
        typeof value === "number"
          ? value.toFixed(decimals)
          : Number(value).toFixed(decimals)
    } else {
      formattedValue =
        typeof value === "number"
          ? value.toLocaleString()
          : Number(value).toLocaleString()
    }

    return (
      <div className="bg-background border border-input rounded-[1.25rem] shadow-md p-3">
        <p className="text-sm font-medium text-foreground mb-1">{label}</p>
        <p className="text-sm text-muted-foreground">
          <span className="font-medium">{chartLabel}:</span> {formattedValue}
          {unit}
        </p>
      </div>
    )
  }
  return null
}
