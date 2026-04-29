"use client"

import { useState, useId } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronDown } from "lucide-react"
import { useLocale } from "@/shared/i18n"
import { useGameData } from "@/shared/api/use-game-data"
import { useRevenueForecast } from "@/shared/api/lstm/use-revenue-forecast"
import { useSelectedGame } from "@/shared/store/selected-game"
import { RevenueForecast } from "@/widgets/charts/ui/revenue-forecast"

/**
 * 시뮬 베이스라인의 출처를 보여주는 좌측 컬럼 디스클로저.
 * 3개 미니 카드 (RevenueForecast / D1/D7/D30 retention strip / KPI baseline) 를 stack.
 * 모든 데이터는 *읽기 전용* — 사용자가 조작할 수 없다.
 */

/** Per-game D1/D7/D30 retention baseline (mirrors mockCompetitors rank-3 entry + portfolio blend). */
const RETENTION_BASELINE: Record<string, { d1: number; d7: number; d30: number }> = {
  poco:      { d1: 42.3, d7: 18.7, d30: 8.5 },
  portfolio: { d1: 41.2, d7: 17.8, d30: 8.0 },
}

export function AssumptionSourcePanel() {
  const { t } = useLocale()
  const [expanded, setExpanded] = useState(false)
  const regionId = useId()
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
        aria-expanded={expanded}
        aria-controls={regionId}
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
            id={regionId}
            role="region"
            aria-label={t("vc.assumption.title")}
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
                <div className="min-h-40">
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

              {/* Mini card 2 — D1/D7/D30 retention baseline (per-game) */}
              <div className="rounded-md border border-border bg-card p-3">
                <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground mb-2">
                  {t("vc.assumption.cohort")}
                </div>
                <RetentionStrip gameId={gameId} />
              </div>

              {/* Mini card 3 — KPI baseline (read-only) */}
              <div className="rounded-md border border-border bg-card p-3">
                <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground mb-2">
                  {t("vc.assumption.kpi")}
                </div>
                <KpiBaselineGrid kpis={gameData?.charts?.kpis} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function RetentionStrip({ gameId }: { gameId: string }) {
  const ret = RETENTION_BASELINE[gameId] ?? RETENTION_BASELINE["poco"]
  const cols: Array<{ label: string; value: number | undefined }> = [
    { label: "D1",  value: ret?.d1  },
    { label: "D7",  value: ret?.d7  },
    { label: "D30", value: ret?.d30 },
  ]
  return (
    <div className="grid grid-cols-3 gap-2 text-xs">
      {cols.map((c) => (
        <div key={c.label} className="flex flex-col">
          <span className="text-muted-foreground text-[10px] uppercase tracking-wider">
            {c.label}
          </span>
          <span className="font-mono tabular-nums text-foreground font-semibold">
            {c.value != null ? `${c.value}%` : "—"}
          </span>
        </div>
      ))}
    </div>
  )
}

type KpiItem = NonNullable<NonNullable<ReturnType<typeof useGameData>>["charts"]>["kpis"]

function KpiBaselineGrid({ kpis }: { kpis?: KpiItem }) {
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
