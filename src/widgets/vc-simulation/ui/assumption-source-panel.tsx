"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronDown } from "lucide-react"
import { useLocale } from "@/shared/i18n"
import { useGameData } from "@/shared/api/use-game-data"
import { useRevenueForecast } from "@/shared/api/lstm/use-revenue-forecast"
import { useSelectedGame } from "@/shared/store/selected-game"
import { RevenueForecast } from "@/widgets/charts/ui/revenue-forecast"
import { CohortHeatmap } from "@/widgets/charts/ui/cohort-heatmap"

/**
 * 시뮬 베이스라인의 출처를 보여주는 좌측 컬럼 디스클로저.
 * 3개 미니 카드 (RevenueForecast / CohortHeatmap / KPI baseline) 를 stack.
 * 모든 데이터는 *읽기 전용* — 사용자가 조작할 수 없다.
 */
export function AssumptionSourcePanel() {
  const { t } = useLocale()
  const [expanded, setExpanded] = useState(false)
  const { gameId } = useSelectedGame()
  const gameData = useGameData()

  // RevenueForecastVm returns { points, source, ageDays, isStale }
  // RevenueForecast component expects { data: RevenueForecastPoint[], meta: RevenueForecastMeta }
  const mockPoints = gameData?.charts?.revenueForecast ?? []
  const meta = gameData?.charts?.revenueForecastMeta
  const vm = useRevenueForecast(gameId, mockPoints)

  return (
    <div className="border-t border-border pt-4 mt-4">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center justify-between w-full text-left text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground hover:text-foreground transition-colors"
      >
        <span>{t("vc.assumption.title")}</span>
        <motion.span
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="inline-flex"
        >
          <ChevronDown className="size-4" />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="space-y-3 pt-3">
              {/* Mini card 1 — Revenue forecast baseline */}
              <div className="rounded-md border border-border bg-card p-3">
                <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground mb-2">
                  {t("vc.assumption.revenue")}
                </div>
                <div className="h-40">
                  {meta ? (
                    <RevenueForecast
                      data={vm.points}
                      meta={meta}
                    />
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                      —
                    </div>
                  )}
                </div>
              </div>

              {/* Mini card 2 — Cohort retention baseline */}
              {/* CohortHeatmap takes zero props — uses hardcoded internal data */}
              <div className="rounded-md border border-border bg-card p-3">
                <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground mb-2">
                  {t("vc.assumption.cohort")}
                </div>
                <div className="h-40">
                  <CohortHeatmap />
                </div>
              </div>

              {/* Mini card 3 — KPI baseline (read-only) */}
              <div className="rounded-md border border-border bg-card p-3">
                <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground mb-2">
                  {t("vc.assumption.kpi")}
                </div>
                <KpiBaselineGrid />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function KpiBaselineGrid() {
  const gameData = useGameData()
  // charts.kpis is a named object: { roas, payback, bep, burn }
  // each entry: { value: number; trend: number; trendLabel: string }
  const kpis = gameData?.charts?.kpis
  if (!kpis) {
    return <div className="text-xs text-muted-foreground">—</div>
  }

  const entries: Array<{ label: string; value: number; unit: string }> = [
    { label: "ROAS",    value: kpis.roas.value,    unit: "%" },
    { label: "Payback", value: kpis.payback.value,  unit: "d" },
    { label: "BEP",     value: kpis.bep.value,      unit: "d" },
    { label: "Burn",    value: kpis.burn.value,      unit: "K" },
  ]

  return (
    <div className="grid grid-cols-2 gap-2 text-xs">
      {entries.map((k) => (
        <div key={k.label} className="flex flex-col">
          <span className="text-muted-foreground text-[10px] uppercase tracking-wider">
            {k.label}
          </span>
          <span className="font-mono tabular-nums text-foreground font-semibold">
            {k.value}{k.unit}
          </span>
        </div>
      ))}
    </div>
  )
}
