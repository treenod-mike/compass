"use client"

import { useState, useMemo } from "react"
import { motion } from "framer-motion"
import { useLocale } from "@/shared/i18n"
import type { PriorPosterior } from "@/shared/api/mock-data"
import { ChartHeader } from "@/shared/ui/chart-header"
import { ExpandButton } from "@/shared/ui/expand-button"
import { useChartExpand } from "@/shared/hooks/use-chart-expand"
import { MARKET_GAP_PROOF_COLORS } from "@/shared/config/chart-colors"
import { computeMarketSignal } from "@/shared/lib"
import { MethodologyModal } from "@/shared/ui/methodology-modal"
import { CyclicUpdateTimeline } from "./cyclic-update-timeline"
import { mockCyclicUpdate_matchLeague_d7 } from "@/shared/api/mock-data"
import { getPrior } from "@/shared/api/prior-data"
import { betaBinomialModel } from "@/shared/lib/bayesian-stats/beta-binomial"
import { useLiveAfData } from "@/widgets/dashboard/lib/use-live-af-data"

// Validity thresholds per spec §6
const RETENTION_N_THRESHOLD = { d1: 25, d7: 80, d30: 200 } as const

const C = MARKET_GAP_PROOF_COLORS

type PriorPosteriorChartProps = {
  data: PriorPosterior[]
}

/** Posterior band for one metric, or null if ML3 (sample too small) */
type BayesianBand = {
  prior: { mean: number; ci_low: number; ci_high: number }
  posterior: { mean: number; ci_low: number; ci_high: number } | null
  ml3: boolean
}

/**
 * Market Gap — Layer 1 "장르 기대치 vs 우리 실적" 차트.
 *
 * L0/L1/L2 언어 레이어링 정책(docs/superpowers/specs/2026-04-15-compass-positioning-language-layering-design.md)에 따라
 * L1(operator UI)에는 Prior/Posterior/Bayesian/Alpha 용어 사용 금지. 장르 기대치 / 우리 실적 /
 * Invest·Hold·Reduce 신호 언어로 통일. 색상은 Revenue Forecast와 정합 (빨강=장르, 초록=우리, 파랑=격차 accent).
 */
export function PriorPosteriorChart({ data }: PriorPosteriorChartProps) {
  const { t } = useLocale()
  const [methodologyOpen, setMethodologyOpen] = useState(false)
  const { expanded, toggle, gridClassName } = useChartExpand()

  const { summary } = useLiveAfData()

  // Compute Bayesian posterior for each retention day from live AF cohorts
  const bayesianBands = useMemo((): Record<string, BayesianBand> => {
    const prior = getPrior({ genre: "Merge", region: "JP" })
    if (!prior) return {}

    const cohorts = summary?.cohorts ?? []

    function bandForDay(
      dayKey: "d1" | "d7" | "d30",
      priorDist: { p10: number; p50: number; p90: number },
      threshold: number,
    ): BayesianBand {
      const priorParams = betaBinomialModel.priorFromEmpirical(priorDist, prior!.effectiveN)
      const priorInterval = betaBinomialModel.priorAsInterval(priorParams)
      // Convert 0–1 fractions to percentages for display consistency
      const priorBand = {
        mean: priorInterval.mean * 100,
        ci_low: priorInterval.ci_low * 100,
        ci_high: priorInterval.ci_high * 100,
      }

      const measurable = cohorts.filter((c) => c.retainedByDay[dayKey] !== null)
      const trials = measurable.reduce((s, c) => s + c.installs, 0)
      const successes = measurable.reduce((s, c) => s + (c.retainedByDay[dayKey] ?? 0), 0)
      const ml3 = trials < threshold

      let posteriorBand: BayesianBand["posterior"] = null
      if (!ml3 && trials > 0) {
        try {
          const interval = betaBinomialModel.posterior(priorParams, { n: trials, k: successes })
          posteriorBand = {
            mean: interval.mean * 100,
            ci_low: interval.ci_low * 100,
            ci_high: interval.ci_high * 100,
          }
        } catch {
          posteriorBand = null
        }
      }

      return { prior: priorBand, posterior: posteriorBand, ml3 }
    }

    return {
      "D1 Retention": bandForDay("d1", prior.retention.d1, RETENTION_N_THRESHOLD.d1),
      "D7 Retention": bandForDay("d7", prior.retention.d7, RETENTION_N_THRESHOLD.d7),
      "D30 Retention": bandForDay("d30", prior.retention.d30, RETENTION_N_THRESHOLD.d30),
    }
  }, [summary])

  return (
    <motion.div
      layout
      className={`rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--bg-1)] p-6 ${gridClassName}`}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
    >
      <ChartHeader
        title={t("market.proof.title")}
        subtitle={t("market.proof.subtitle")}
        info={t("market.proof.info")}
        actions={<ExpandButton expanded={expanded} onToggle={toggle} />}
      />

      <div className="space-y-6">
        {data.map((item) => {
          // Use Bayesian prior band when available; fall back to mock prior
          const band = bayesianBands[item.metric]
          const resolvedPrior = band?.prior ?? item.prior
          // Use Bayesian posterior when available; fall back to mock posterior
          const resolvedPosterior = band?.posterior ?? item.posterior
          const { signal, deltaPct, direction } = computeMarketSignal(resolvedPrior.mean, resolvedPosterior.mean)
          const signalColor =
            signal === "invest" ? C.signalInvest : signal === "reduce" ? C.signalReduce : C.signalHold
          const signalLabel = t(
            signal === "invest" ? "market.signal.invest" : signal === "reduce" ? "market.signal.reduce" : "market.signal.hold",
          )
          const gapLabel = t(direction === "above" ? "market.proof.gapAbove" : "market.proof.gapBelow")
          const deltaDisplay = `${deltaPct > 0 ? "+" : ""}${deltaPct.toFixed(1)}%`

          const allValues = [resolvedPrior.ci_low, resolvedPrior.ci_high, resolvedPosterior.ci_low, resolvedPosterior.ci_high]
          const min = Math.min(...allValues) * 0.8
          const max = Math.max(...allValues) * 1.2
          const range = max - min

          const genreLeft = ((resolvedPrior.ci_low - min) / range) * 100
          const genreWidth = ((resolvedPrior.ci_high - resolvedPrior.ci_low) / range) * 100
          const genreMean = ((resolvedPrior.mean - min) / range) * 100

          const ourLeft = ((resolvedPosterior.ci_low - min) / range) * 100
          const ourWidth = ((resolvedPosterior.ci_high - resolvedPosterior.ci_low) / range) * 100
          const ourMean = ((resolvedPosterior.mean - min) / range) * 100

          return (
            <div key={item.metric}>
              <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
                <span className="text-sm font-bold text-[var(--fg-0)]">{item.metric}</span>
                <div className="flex items-center gap-3 text-xs font-mono-num">
                  <span className="text-[var(--fg-2)]">
                    {t("market.proof.genreLabel")}: {resolvedPrior.mean.toFixed(2)}
                  </span>
                  <span className="text-[var(--fg-3)]">→</span>
                  <span className="font-bold" style={{ color: C.our }}>
                    {t("market.proof.ourLabel")}: {resolvedPosterior.mean.toFixed(2)}
                  </span>
                  <span className="font-bold" style={{ color: C.gapAccent }}>
                    {gapLabel} {deltaDisplay}
                  </span>
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide"
                    style={{ background: `${signalColor}15`, color: signalColor }}
                  >
                    {signalLabel}
                  </span>
                  {band?.ml3 && (
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide bg-[var(--bg-3)] text-[var(--fg-3)]">
                      ML3 · Sample too small
                    </span>
                  )}
                </div>
              </div>

              <div className="relative h-12">
                <div
                  className="absolute top-1 h-4 rounded-full"
                  style={{
                    left: `${genreLeft}%`,
                    width: `${genreWidth}%`,
                    background: C.genreFill,
                    border: `1px dashed ${C.genreLine}`,
                  }}
                />
                <div
                  className="absolute top-0 w-0.5 h-6"
                  style={{ left: `${genreMean}%`, background: C.genre }}
                />
                <span
                  className="absolute top-7 text-[10px] text-[var(--fg-2)] font-mono-num"
                  style={{ left: `${genreMean}%`, transform: "translateX(-50%)" }}
                >
                  {t("market.proof.genreLabel")}
                </span>

                <div
                  className="absolute top-1 h-4 rounded-full"
                  style={{
                    left: `${ourLeft}%`,
                    width: `${ourWidth}%`,
                    background: C.ourFill,
                    border: `1px solid ${C.our}`,
                  }}
                />
                <div
                  className="absolute top-0 w-0.5 h-6"
                  style={{ left: `${ourMean}%`, background: C.our }}
                />
              </div>

              <div className="flex justify-between text-[10px] text-[var(--fg-2)] font-mono-num mt-1">
                <span>{min.toFixed(1)}</span>
                <span>{max.toFixed(1)}</span>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-4 pt-4 border-t border-[var(--border-default)] flex items-center gap-4 text-xs">
        <div className="flex items-center gap-2">
          <div
            className="w-4 h-2 rounded"
            style={{ background: C.genreFill, border: `1px dashed ${C.genre}` }}
          />
          <span className="text-[var(--fg-2)]">{t("market.proof.genreLabel")}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-2 rounded" style={{ background: C.ourFill, border: `1px solid ${C.our}` }} />
          <span className="text-[var(--fg-2)]">{t("market.proof.ourLabel")}</span>
        </div>
      </div>

      {/* L2 Methodology CTA */}
      <div className="mt-3 text-center">
        <button
          type="button"
          onClick={() => setMethodologyOpen(true)}
          className="text-caption text-[var(--fg-3)] hover:text-[var(--fg-1)] transition-colors"
        >
          📊 {t("methodology.ctaLabel")}
        </button>
      </div>

      {/* L2 Methodology Modal */}
      <MethodologyModal
        open={methodologyOpen}
        onOpenChange={setMethodologyOpen}
        title={t("methodology.title").replace("{metric}", data[0]?.metric ?? "D7 Retention")}
        subtitle={t("methodology.subtitle")}
        footer={
          <div className="text-caption text-[var(--fg-2)] leading-relaxed">
            <p>{t("methodology.footer")}</p>
            <p className="mt-1 italic text-[var(--fg-3)]">{t("methodology.footerL2")}</p>
          </div>
        }
      >
        <CyclicUpdateTimeline data={mockCyclicUpdate_matchLeague_d7} />
      </MethodologyModal>
    </motion.div>
  )
}
