/**
 * Per-chart color config — TDS palette (purple primary).
 *
 * WHY hex not CSS var(): Recharts SVG attributes don't resolve
 * CSS custom properties at runtime. Hex values here mirror the
 * TDS tokens defined in globals.css.
 */

/** Shared palette — mirrors TDS tokens in globals.css */
export const PALETTE = {
  // Brand primary (purple)
  p50:           "#9128b4",  // --purple-600 / --primary
  bandInner:     "rgba(145, 40, 180, 0.18)",
  bandOuter:     "rgba(145, 40, 180, 0.10)",
  benchmark:     "#8b95a1",  // --grey-500
  observed:      "#191f28",  // --grey-900

  // Signal / status colors (TDS green/orange/red)
  positive:      "#02a262",  // --green-600 → success / invest / ship
  caution:       "#fb8800",  // --orange-600 → hold / watch
  risk:          "#d22030",  // --red-700 → reduce / pull back

  // Cohort categorical — mirrors --chart-1 .. --chart-6 tokens
  cohort1:       "#02a262",  // --chart-1 green
  cohort2:       "#2272eb",  // --chart-2 blue
  cohort3:       "#109595",  // --chart-3 teal
  cohort4:       "#fb8800",  // --chart-4 orange
  cohort5:       "#9128b4",  // --chart-5 purple (brand)
  cohort6:       "#e42939",  // --chart-6 red

  // Neutral
  axis:          "#6b7684",  // --grey-600
  grid:          "#e5e8eb",  // --grey-200
  border:        "#e5e8eb",  // --grey-200
  bg:            "#ffffff",
  fg0:           "#191f28",  // --grey-900
  fg2:           "#6b7684",  // --grey-600

  // Semantic aliases used across widgets
  revenue:       "#9128b4",  // brand purple
  uaSpend:       "#fb8800",  // orange
  roas:          "#02a262",  // green
  breakeven:     "#d22030",  // red
  genreAvgGray:  "#d1d6db",  // --grey-300
  legendGray:    "#6b7684",  // --grey-600
} as const

// ─── Per-chart configs ───

export const RETENTION_CURVE_COLORS = {
  p50:        PALETTE.p50,
  bandOuter:  PALETTE.bandOuter,
  bandInner:  PALETTE.bandInner,
  benchmark:  PALETTE.benchmark,
  asymptotic: PALETTE.positive,
  grid:       PALETTE.grid,
  axis:       PALETTE.axis,
  border:     PALETTE.border,
  bg:         PALETTE.bg,
} as const

export const REVENUE_VS_INVEST_COLORS = {
  revenue:    PALETTE.revenue,
  uaSpend:    PALETTE.uaSpend,
  roas:       PALETTE.roas,
  breakeven:  PALETTE.breakeven,
  profit:     PALETTE.positive,
  loss:       PALETTE.risk,
  cumLine:    PALETTE.p50,
  grid:       PALETTE.grid,
  axis:       PALETTE.axis,
  border:     PALETTE.border,
  legend:     PALETTE.legendGray,
} as const

export const REVENUE_DECOMP_COLORS = {
  organic:    PALETTE.benchmark,
  experiment: PALETTE.p50,
  deploy:     PALETTE.positive,
  grid:       PALETTE.grid,
  axis:       PALETTE.axis,
  border:     PALETTE.border,
  legend:     PALETTE.legendGray,
  fg0:        PALETTE.fg0,
  fg2:        PALETTE.fg2,
} as const

export const REVENUE_FORECAST_COLORS = {
  line:       PALETTE.positive,
  postFill:   "rgba(2, 162, 98, 0.14)",
  postLine:   PALETTE.positive,
  prior:      PALETTE.risk,
  priorFill:  "rgba(210, 32, 48, 0.08)",
  priorLine:  "rgba(210, 32, 48, 0.55)",
  experiment: PALETTE.revenue,
  forkMark:   PALETTE.legendGray,
  grid:       PALETTE.grid,
  axis:       PALETTE.axis,
  border:     PALETTE.border,
} as const

export const MARKET_BENCHMARK_COLORS = {
  p50:        PALETTE.revenue,
  genre:      PALETTE.benchmark,
  bandFill:   "rgba(139, 149, 161, 0.12)",
  grid:       PALETTE.grid,
  axis:       PALETTE.axis,
  border:     PALETTE.border,
} as const

export const RANKING_TREND_COLORS = {
  line:       PALETTE.revenue,
  top5:       PALETTE.uaSpend,
  grid:       PALETTE.grid,
  axis:       PALETTE.axis,
  border:     PALETTE.border,
} as const

export const SATURATION_TREND_COLORS = {
  threshold:  PALETTE.uaSpend,
  myRevenue:  PALETTE.revenue,
  grid:       PALETTE.grid,
  axis:       PALETTE.axis,
  border:     PALETTE.border,
} as const

export const SATURATION_BAR_COLORS = {
  myGame:     PALETTE.revenue,
  genreAvg:   PALETTE.genreAvgGray,
  grid:       PALETTE.grid,
  axis:       PALETTE.axis,
  border:     PALETTE.border,
} as const

export const ACTION_TIMELINE_COLORS = {
  retention:  PALETTE.revenue,
  ua:         PALETTE.revenue,
  liveops:    "#c770e4",  // --purple-300
  release:    PALETTE.uaSpend,
  grid:       PALETTE.grid,
  axis:       PALETTE.axis,
  border:     PALETTE.border,
} as const

export const EXPERIMENT_BAR_COLORS = {
  positive:   PALETTE.roas,
  negative:   PALETTE.breakeven,
  grid:       PALETTE.grid,
  axis:       PALETTE.axis,
  border:     PALETTE.border,
  label:      PALETTE.legendGray,
} as const

export const VARIANT_IMPACT_COLORS = {
  shipped:    PALETTE.roas,
  reverted:   PALETTE.breakeven,
  control:    PALETTE.benchmark,
  running:    PALETTE.revenue,
  errorBar:   PALETTE.fg0,
  grid:       PALETTE.grid,
  axis:       PALETTE.axis,
  border:     PALETTE.border,
  label:      PALETTE.legendGray,
} as const

export const ROLLOUT_HISTORY_COLORS = {
  bar:        PALETTE.revenue,
  line:       PALETTE.roas,
  grid:       PALETTE.grid,
  axis:       PALETTE.axis,
  border:     PALETTE.border,
} as const

export const RIPPLE_FORECAST_COLORS = {
  line:       PALETTE.revenue,
  bandFill:   "rgba(145, 40, 180, 0.18)",
  bandFillEnd:"rgba(145, 40, 180, 0.04)",
  grid:       PALETTE.grid,
  axis:       PALETTE.axis,
  border:     PALETTE.border,
} as const

export const PRIOR_POSTERIOR_COLORS = {
  prior:      PALETTE.benchmark,
  priorFill:  "rgba(139, 149, 161, 0.3)",
  priorBorder:"rgba(139, 149, 161, 0.4)",
  posterior:  PALETTE.revenue,
  postFill:   "rgba(145, 40, 180, 0.6)",
  postBorder: PALETTE.revenue,
} as const

export const MARKET_GAP_PROOF_COLORS = {
  genre:           PALETTE.risk,
  genreFill:       "rgba(210, 32, 48, 0.08)",
  genreLine:       "rgba(210, 32, 48, 0.55)",

  our:             PALETTE.positive,
  ourFill:         "rgba(2, 162, 98, 0.14)",

  gapAccent:       PALETTE.revenue,

  signalInvest:    PALETTE.positive,
  signalHold:      PALETTE.legendGray,
  signalReduce:    PALETTE.risk,

  axis:            PALETTE.axis,
  grid:            PALETTE.grid,
  border:          PALETTE.border,
} as const

export const RUNWAY_FAN_COLORS = {
  p50:        PALETTE.p50,
  bandOuter:  PALETTE.bandOuter,
  bandInner:  PALETTE.bandInner,
  cashOut:    "rgba(210, 32, 48, 0.08)",
  cashOutBorder: PALETTE.risk,
  axis:       PALETTE.axis,
  grid:       PALETTE.grid,
  border:     PALETTE.border,
  fg0:        PALETTE.fg0,
  fg2:        PALETTE.fg2,
} as const

export const SCENARIO_SIMULATOR_COLORS = {
  payback:    PALETTE.p50,
  bep:        PALETTE.positive,
} as const

export const BUDGET_DONUT_COLORS = {
  legend:     PALETTE.legendGray,
} as const

export const COHORT_HEATMAP_COLORS = {
  level5:     "#9128b4",  // --purple-600
  level4:     "#b44bd7",  // --purple-400
  level3:     "#da9bef",  // --purple-200
  level2:     "#edccf8",  // --purple-100
  level1:     "#f9f0fc",  // --purple-50
} as const

/**
 * MMM Response Curve — 4 channels as colorblind-safe categorical.
 * Reference lines use semantic tokens so viewers pre-read them:
 *  - saturationPoint = caution  → "여기서부터 체감 감소"
 *  - marketMedian    = benchmark → 중립 참고선
 *  - currentPosition = brand     → 지금 우리의 위치
 */
export const MMM_COLORS = {
  channels: {
    meta:           { line: PALETTE.cohort2, band: "rgba(34, 114, 235, 0.18)" },
    google:         { line: PALETTE.cohort1, band: "rgba(2, 162, 98, 0.18)" },
    tiktok:         { line: PALETTE.cohort4, band: "rgba(251, 136, 0, 0.18)" },
    "apple-search": { line: PALETTE.cohort3, band: "rgba(16, 149, 149, 0.18)" },
  },
  saturationPoint: PALETTE.caution,
  marketMedian:    PALETTE.benchmark,
  currentPosition: PALETTE.p50,
  axis:            PALETTE.axis,
  grid:            PALETTE.grid,
  border:          PALETTE.border,
  fg0:             PALETTE.fg0,
  fg2:             PALETTE.fg2,
} as const
