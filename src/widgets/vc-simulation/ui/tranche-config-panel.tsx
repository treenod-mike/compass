"use client"

import { useLocale } from "@/shared/i18n"
import { clsx } from "clsx"

export type TrancheConfig = {
  enabled: boolean
  tranche2Pct: number  // 0..1, fraction of total investmentUsd allocated to tranche 2
  tranche2AtMonth: number
}

export const DEFAULT_TRANCHE_CONFIG: TrancheConfig = {
  enabled: false,
  tranche2Pct: 0.4,  // default split: 60/40
  tranche2AtMonth: 6,
}

type Props = {
  config: TrancheConfig
  onChange: (config: TrancheConfig) => void
}

/**
 * V1: Visualization-only tranche split. Captures user intent for phased
 * investment but does NOT yet modify the compute engine.
 * V2 backlog: thread `config` into computeVcSimulation as cash inflow schedule.
 */
export function TrancheConfigPanel({ config, onChange }: Props) {
  const { t } = useLocale()

  const setField = <K extends keyof TrancheConfig>(key: K, value: TrancheConfig[K]) => {
    onChange({ ...config, [key]: value })
  }

  return (
    <div className="rounded-md border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-[0.08em] text-foreground">
            {t("vc.tranches.title")}
          </h4>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {t("vc.tranches.subtitle")}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={config.enabled}
          onClick={() => setField("enabled", !config.enabled)}
          className={clsx(
            "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
            config.enabled ? "bg-primary" : "bg-muted"
          )}
        >
          <span
            className={clsx(
              "inline-block size-3.5 rounded-full bg-card transition-transform",
              config.enabled ? "translate-x-5" : "translate-x-1"
            )}
          />
        </button>
      </div>

      {config.enabled && (
        <div className="mt-3 space-y-3">
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
              {t("vc.tranches.tranche2Pct")}
            </label>
            <input
              type="range"
              min="0.1"
              max="0.7"
              step="0.05"
              value={config.tranche2Pct}
              onChange={(e) => setField("tranche2Pct", Number(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-[10px] tabular-nums text-foreground mt-1">
              <span>{t("vc.tranches.tranche1")}: {((1 - config.tranche2Pct) * 100).toFixed(0)}%</span>
              <span>{t("vc.tranches.tranche2")}: {(config.tranche2Pct * 100).toFixed(0)}%</span>
            </div>
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
              {t("vc.tranches.triggerMonth")}
            </label>
            <input
              type="number"
              min="1"
              max="24"
              value={config.tranche2AtMonth}
              onChange={(e) => setField("tranche2AtMonth", Math.max(1, Math.min(24, Number(e.target.value))))}
              className="w-full rounded-md border border-border bg-[var(--bg-2)] px-3 py-1.5 text-xs font-mono tabular-nums text-foreground focus:border-primary focus:outline-none"
            />
          </div>

          <p className="text-[10px] text-muted-foreground italic leading-relaxed">
            {t("vc.tranches.v2Note")}
          </p>
        </div>
      )}
    </div>
  )
}
