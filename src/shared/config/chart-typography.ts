/**
 * Chart Typography — Pretendard Variable (matches TDS / gameboard).
 *
 * Recharts SVG <text> elements inherit font-family via tick/label props,
 * so the CSS @font-face in globals.css is sufficient — hex values below
 * define sizes/weights/variants only.
 */

export const CHART_FONT = {
  sans: "'Pretendard Variable', Pretendard, system-ui, -apple-system, sans-serif",
  mono: "'Pretendard Variable', Pretendard, ui-monospace, monospace",
} as const

export const CHART_TYPO = {
  /** XAxis / YAxis tick labels */
  axisTick: {
    fontSize: 11,
    fontFamily: CHART_FONT.sans,
    fontVariantNumeric: "tabular-nums" as const,
  },

  /** Axis unit labels ($K, %, etc.) */
  axisLabel: {
    fontSize: 10,
    fontFamily: CHART_FONT.sans,
    fontVariantNumeric: "tabular-nums" as const,
  },

  /** Tooltip title (date, category) */
  tooltipTitle: { fontSize: 11, fontWeight: 600, fontFamily: CHART_FONT.sans },

  /** Tooltip numeric values — tabular nums for alignment */
  tooltipValue: {
    fontSize: 12,
    fontWeight: 500,
    fontFamily: CHART_FONT.sans,
    fontVariantNumeric: "tabular-nums" as const,
  },

  /** Tooltip descriptive labels */
  tooltipLabel: { fontSize: 12, fontFamily: CHART_FONT.sans },

  /** Legend text */
  legend: { fontSize: 11, fontFamily: CHART_FONT.sans },

  /** In-chart annotations — numbers & abbreviations */
  annotation: {
    fontSize: 11,
    fontWeight: 700,
    fontFamily: CHART_FONT.sans,
    fontVariantNumeric: "tabular-nums" as const,
  },

  /** In-chart annotations — descriptive text labels */
  annotationText: { fontSize: 11, fontWeight: 600, fontFamily: CHART_FONT.sans },
} as const
