"use client"

import { useMemo, useState } from "react"
import { useLocale } from "@/shared/i18n"
import { computeVcSimulation, LSTM_SNAPSHOT } from "@/shared/api/vc-simulation"
import type { VcSimResult } from "@/shared/api/vc-simulation"

type Props = {
  result: VcSimResult
  gameId: string
  appsflyerInitialCash: number
  bayesianDeltaLtv: number | null
}

// X axis: UA share % (30%–80%, 5% steps = 11 values)
const UA_SHARES = [0.30, 0.35, 0.40, 0.45, 0.50, 0.55, 0.60, 0.65, 0.70, 0.75, 0.80]
// Y axis: horizon months (6–36, 3 mo steps = 11 values)
const HORIZONS = [6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36]

type Cell = { ua: number; horizon: number; payback: number | null }

function colorFor(payback: number | null): string {
  if (payback == null) return "var(--signal-risk)"
  if (payback <= 6)  return "var(--signal-positive)"
  if (payback <= 12) return "color-mix(in oklch, var(--signal-positive) 60%, var(--signal-caution) 40%)"
  if (payback <= 18) return "var(--signal-caution)"
  if (payback <= 24) return "color-mix(in oklch, var(--signal-caution) 50%, var(--signal-risk) 50%)"
  return "var(--signal-risk)"
}

export function SensitivityHeatmap({ result, gameId, appsflyerInitialCash, bayesianDeltaLtv }: Props) {
  const { t } = useLocale()
  const [hovered, setHovered] = useState<Cell | null>(null)

  const { offer } = result

  // 121 synchronous sims. Depends only on the "fixed" offer fields (not the
  // levers we sweep), so the grid re-computes only when the user changes
  // investmentUsd / hurdleRate / deltaLtv.
  const grid: Cell[][] = useMemo(() => {
    return HORIZONS.map((horizon) =>
      UA_SHARES.map((ua): Cell => {
        const sim = computeVcSimulation(
          {
            ...offer,
            uaSharePct: ua * 100, // Offer.uaSharePct is 0-100 scale
            horizonMonths: horizon,
          },
          {
            gameId,
            lstmSnapshot: LSTM_SNAPSHOT,
            bayesianPosterior: bayesianDeltaLtv != null ? { deltaLtv: bayesianDeltaLtv } : null,
            appsflyerInitialCash,
          },
        )
        return { ua, horizon, payback: sim.baselineB.paybackMonths }
      })
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offer.investmentUsd, offer.hurdleRate, gameId, appsflyerInitialCash, bayesianDeltaLtv])

  // Grid is rendered bottom-up (largest horizon at top) to match chart convention
  const reversedGrid = grid.slice().reverse()
  const reversedHorizons = HORIZONS.slice().reverse()

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">{t("vc.sensitivity.title")}</h3>
        <p className="text-xs text-muted-foreground mt-1">{t("vc.sensitivity.subtitle")}</p>
      </div>

      <div className="flex gap-3">
        {/* Y axis labels */}
        <div
          className="flex flex-col justify-between text-[10px] text-muted-foreground tabular-nums pr-1"
          style={{ paddingTop: "2px", paddingBottom: "2px" }}
        >
          {reversedHorizons.map((h) => (
            <span key={h} className="leading-none">{h}mo</span>
          ))}
        </div>

        {/* Grid + X labels */}
        <div className="flex-1 min-w-0">
          <div
            className="grid gap-px rounded overflow-hidden"
            style={{
              gridTemplateColumns: `repeat(${UA_SHARES.length}, minmax(0, 1fr))`,
              backgroundColor: "var(--border)",
            }}
          >
            {reversedGrid.flatMap((row, ri) =>
              row.map((cell, ci) => (
                <button
                  key={`${ri}-${ci}`}
                  type="button"
                  onMouseEnter={() => setHovered(cell)}
                  onMouseLeave={() => setHovered(null)}
                  className="aspect-square min-w-0 transition-opacity hover:opacity-75 focus:outline-none"
                  style={{ backgroundColor: colorFor(cell.payback) }}
                  aria-label={`UA ${(cell.ua * 100).toFixed(0)}%, Horizon ${cell.horizon}mo`}
                />
              ))
            )}
          </div>

          {/* X axis labels */}
          <div
            className="grid mt-1.5 text-[10px] text-muted-foreground tabular-nums"
            style={{ gridTemplateColumns: `repeat(${UA_SHARES.length}, minmax(0, 1fr))` }}
          >
            {UA_SHARES.map((ua) => (
              <span key={ua} className="text-center leading-none">
                {(ua * 100).toFixed(0)}%
              </span>
            ))}
          </div>
          <div className="text-center text-[10px] text-muted-foreground mt-1">
            {t("vc.sensitivity.xLabel")}
          </div>
        </div>
      </div>

      {/* Hover readout */}
      <div className="rounded border border-border bg-card p-3 min-h-[60px] flex items-center">
        {hovered ? (
          <div className="flex items-center gap-6 text-xs w-full">
            <div className="flex flex-col gap-0.5">
              <span className="text-muted-foreground">{t("vc.sensitivity.tooltip.ua")}</span>
              <span className="font-mono tabular-nums font-semibold">
                {(hovered.ua * 100).toFixed(0)}%
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-muted-foreground">{t("vc.sensitivity.tooltip.horizon")}</span>
              <span className="font-mono tabular-nums font-semibold">{hovered.horizon}mo</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-muted-foreground">{t("vc.sensitivity.tooltip.bep")}</span>
              <span className="font-mono tabular-nums font-semibold">
                {hovered.payback != null
                  ? `${hovered.payback}mo`
                  : t("vc.sensitivity.tooltip.noBep")}
              </span>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">{t("vc.sensitivity.hint")}</p>
        )}
      </div>

      {/* Color legend */}
      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
        <span className="shrink-0">{t("vc.sensitivity.legend.fast")}</span>
        <div
          className="flex-1 h-2 rounded"
          style={{
            background:
              "linear-gradient(to right, var(--signal-positive), var(--signal-caution), var(--signal-risk))",
          }}
        />
        <span className="shrink-0">{t("vc.sensitivity.legend.slow")}</span>
      </div>
    </div>
  )
}
