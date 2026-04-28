"use client"

import { useLocale, type TranslationKey, translate } from "@/shared/i18n"
import { cn } from "@/shared/lib"
import { Icon as Iconify } from "@iconify/react"
import graphUpBold from "@iconify-icons/solar/graph-up-bold"
import graphDownBold from "@iconify-icons/solar/graph-down-bold"
import minusBold from "@iconify-icons/solar/minus-circle-bold"
import { AnimatedNumber } from "@/shared/ui/animated-number"
import { InfoHint } from "@/shared/ui/info-hint"
import { useLiveAfData } from "../lib/use-live-af-data"
import { useRealKpi } from "../lib/use-real-kpi"
import type { RealKpiInput } from "@/shared/api/composite/types"

export type KPIItem = {
  labelKey: TranslationKey
  value: string | number
  unit?: string
  trend: number
  trendLabel: string
  infoKey?: TranslationKey
}

type KPICardsProps = {
  items: KPIItem[]
  basisKey?: TranslationKey
  gameId: string
  realKpiFallback: RealKpiInput["mockFallback"]
}

function resolveInfoKey(
  labelKey: TranslationKey,
  override?: TranslationKey,
): TranslationKey | undefined {
  if (override) return override
  const candidate = `info.${labelKey}` as TranslationKey
  try {
    const probe = translate(candidate, "ko")
    return typeof probe === "string" && probe.length > 0 ? candidate : undefined
  } catch {
    return undefined
  }
}

/**
 * KPICards — gameboard metric-card 스타일 KPI 그리드.
 *
 * 계층:
 *   label      10px uppercase tracking muted   ← 작게
 *   value      32~36px extrabold foreground    ← 매우 크게 (3.6x 차이)
 *   unit       14px semibold muted             ← value 옆 보조
 *   trend      11px semibold signal-color      ← 아래 subtle
 */
export function KPICards({ items, basisKey, gameId, realKpiFallback }: KPICardsProps) {
  const { t } = useLocale()
  const { state, summary, badge } = useLiveAfData()
  const real = useRealKpi(gameId, realKpiFallback)

  // Merge live AF data into items: replace installs + revenue values when active
  const liveInstalls =
    summary?.cohorts.reduce((s, c) => s + c.installs, 0) ?? null
  const liveRevenue = summary?.revenue.total.sumUsd ?? null
  const isActive = state?.status === "active"

  const mergedItems: KPIItem[] = items.map((item) => {
    const key = item.labelKey as string
    if (isActive && key === "kpi.installs" && liveInstalls !== null)
      return { ...item, value: liveInstalls }
    if (isActive && (key === "kpi.revenue" || key === "kpi.totalRevenue") && liveRevenue !== null)
      return { ...item, value: Math.round(liveRevenue) }
    if (key === "kpi.roas")
      return { ...item, value: `${Math.round(real.roas.p50)}%` }
    if (key === "kpi.payback")
      return { ...item, value: real.payback.p50 }
    return item
  })

  // Composite freshness takes precedence over the generic AppsFlyer badge
  // because it carries KPI-specific semantics (ML1=Forecast Mock, ML2=Stale).
  const effectiveBadgeText: string | null =
    real.freshness === "ML1"
      ? "Forecast Mock"
      : real.freshness === "ML2"
      ? "Stale"
      : badge === "ML1"
      ? "Live data unavailable"
      : badge === "ML2"
      ? `Data from ${state?.lastSyncAt?.slice(0, 10) ?? "—"}`
      : null

  const n = mergedItems.length
  const gridClass =
    n <= 2 ? "grid-cols-2" :
    n === 3 ? "grid-cols-2 md:grid-cols-3" :
    n === 4 ? "grid-cols-2 md:grid-cols-4" :
    n === 5 ? "grid-cols-2 md:grid-cols-3 xl:grid-cols-5" :
              "grid-cols-2 md:grid-cols-3 xl:grid-cols-6"

  return (
    <div className="relative">
      {effectiveBadgeText && (
        <span className="absolute right-2 top-2 z-10 rounded-[var(--radius-inline)] bg-[var(--bg-3)] px-2 py-0.5 text-xs text-[var(--fg-2)]">
          {effectiveBadgeText}
        </span>
      )}
      <div className={cn("grid gap-4", gridClass)}>
        {mergedItems.map((item) => {
          const infoKey = resolveInfoKey(item.labelKey, item.infoKey)
          const isPositiveTrend = item.trend > 0
          const isNegativeTrend = item.trend < 0
          const TrendIconData = isPositiveTrend
            ? graphUpBold
            : isNegativeTrend
            ? graphDownBold
            : minusBold
          const trendColorClass = isPositiveTrend
            ? "text-success"
            : isNegativeTrend
            ? "text-destructive"
            : "text-muted-foreground"

          return (
            <div
              key={item.labelKey}
              className={cn(
                "rounded-2xl border border-border bg-card p-5",
                "transition-colors hover:border-primary",
              )}
            >
              {/* Label — 작고 tracking-wide */}
              <div className="flex items-center gap-1.5">
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground break-keep">
                  {t(item.labelKey)}
                </p>
                {infoKey && <InfoHint content={t(infoKey)} size={12} />}
              </div>

              {/* Value — 거대하게 */}
              <div className="flex items-baseline gap-1.5 mt-2.5">
                <span
                  className="text-[32px] md:text-[36px] font-extrabold text-foreground leading-none"
                  style={{
                    fontVariantNumeric: "tabular-nums",
                    letterSpacing: "-0.02em",
                  }}
                >
                  {typeof item.value === "number" ? (
                    <AnimatedNumber value={item.value} />
                  ) : (
                    item.value
                  )}
                </span>
                {item.unit && (
                  <span className="text-sm font-semibold text-muted-foreground">
                    {item.unit}
                  </span>
                )}
              </div>

              {/* Trend — 작고 섬세 */}
              <div className="flex items-center gap-1.5 mt-3">
                <Iconify
                  icon={TrendIconData}
                  width={14}
                  height={14}
                  className={trendColorClass}
                />
                <span
                  className={cn("text-xs font-bold", trendColorClass)}
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {Math.abs(item.trend)}
                  {item.unit === "%" ? "pp" : ""}
                </span>
                <span className="text-xs text-muted-foreground font-normal break-keep">
                  {item.trendLabel}
                </span>
              </div>
            </div>
          )
        })}
      </div>
      {basisKey && (
        <p className="mt-3 text-[11px] text-muted-foreground text-right">
          {t(basisKey)}
        </p>
      )}
    </div>
  )
}
