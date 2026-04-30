"use client"

import { useState } from "react"
import { clsx } from "clsx"
import type { VcSimResult } from "@/shared/api/vc-simulation"
import { useLocale, type TranslationKey } from "@/shared/i18n"
import { VcInsightsPanel } from "./vc-insights-panel"
import { DualBaselineRunwayChart } from "./dual-baseline-runway-chart"

type TabKey = "insights" | "runway"

type Props = {
  result: VcSimResult
  gameId: string
  appsflyerInitialCash: number
  bayesianDeltaLtv: number | null
}

/**
 * Secondary information container that sits below the Decision sentence and
 * Cumulative ROAS chart. Compresses KPI / insights / cash-flow widgets into a
 * single tab strip so the result panel doesn't overload the decision-maker
 * with everything at once.
 */
export function VcResultTabs({
  result,
  gameId,
  appsflyerInitialCash,
  bayesianDeltaLtv,
}: Props) {
  const { t } = useLocale()
  const [tab, setTab] = useState<TabKey>("insights")

  const tabs: { key: TabKey; labelKey: TranslationKey }[] = [
    { key: "insights", labelKey: "vc.tabs.insights" },
    { key: "runway", labelKey: "vc.tabs.runway" },
  ]

  return (
    <div>
      <div role="tablist" className="flex items-center gap-1 border-b border-border">
        {tabs.map((it) => (
          <button
            key={it.key}
            role="tab"
            aria-selected={tab === it.key}
            onClick={() => setTab(it.key)}
            className={clsx(
              "px-4 py-2.5 text-sm font-semibold transition-colors -mb-px border-b-2 break-keep",
              tab === it.key
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t(it.labelKey)}
          </button>
        ))}
      </div>
      <div className="mt-4">
        {tab === "insights" && (
          <VcInsightsPanel
            result={result}
            gameId={gameId}
            appsflyerInitialCash={appsflyerInitialCash}
            bayesianDeltaLtv={bayesianDeltaLtv}
          />
        )}
        {tab === "runway" && (
          <DualBaselineRunwayChart
            result={result}
            hurdleLine={(result.offer.hurdleRate * result.offer.investmentUsd) / 1000}
          />
        )}
      </div>
    </div>
  )
}
