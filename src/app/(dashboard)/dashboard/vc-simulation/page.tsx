"use client"

import { useEffect, useState, Component, type ReactNode } from "react"
import { useSelectedGame } from "@/shared/store/selected-game"
import { PageHeader } from "@/shared/ui"
import { PageTransition, FadeInUp } from "@/shared/ui/page-transition"
import { VcInputPanel, VcResultBoard } from "@/widgets/vc-simulation"
import { CalcErrorCard } from "@/widgets/vc-simulation/ui/calc-error-card"
import { DEFAULT_OFFER, useVcSimulation, isLstmStale, type Offer } from "@/shared/api/vc-simulation"
import { useGameData } from "@/shared/api/use-game-data"
import { useLocale } from "@/shared/i18n"

class CalcBoundary extends Component<{ children: ReactNode }, { err: Error | null }> {
  state = { err: null as Error | null }
  static getDerivedStateFromError(err: Error) {
    return { err }
  }
  componentDidCatch() {
    /* swallow — fallback UI sufficient */
  }
  render() {
    return this.state.err ? <CalcErrorCard /> : this.props.children
  }
}

const FALLBACK_INITIAL_CASH = 500_000
const FALLBACK_DELTA_LTV = 0
// Reference per-user LTV used to normalize deltaLtvPerUser ($/user) into a
// fractional lift consumed by the VC simulation engine. ~$10/user is a
// reasonable mid-market baseline; tunable when LSTM-derived posterior arrives.
const REFERENCE_LTV_PER_USER = 10

export default function VcSimulationPage() {
  const { gameId } = useSelectedGame()
  const [offer, setOffer] = useState<Offer>(DEFAULT_OFFER)
  const gameData = useGameData()
  // Gate time-dependent rendering (isLstmStale uses `new Date()`) to
  // client-side only, preventing SSR/CSR hydration mismatch (and the
  // associated flicker on first paint).
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  // AppsFlyer-equivalent cash position derive (best-effort).
  // TODO: server-only readSnapshot() can't run in client components; mock
  // cumulative cash position from revenueVsInvest (cumRevenue - cumUaSpend,
  // in $K units) stands in until a /api/appsflyer/cash route exposes the
  // real snapshot to the client.
  const revenueVsInvest = gameData?.charts?.revenueVsInvest ?? []
  const lastPoint = revenueVsInvest[revenueVsInvest.length - 1]
  const initialCash = lastPoint
    ? Math.max(0, (lastPoint.cumRevenue - lastPoint.cumUaSpend) * 1000)
    : FALLBACK_INITIAL_CASH

  // Bayesian average ΔLTV from current game's experiments.
  // ExperimentForkScenario.deltaLtvPerUser is in $/user; divide by the
  // reference LTV to convert to a fractional uplift (compute.ts uses
  // `1 + deltaLtv` as a multiplicative cohort revenue lift factor).
  const experiments = gameData?.charts?.revenueForecastMeta?.experiments ?? []
  const bayesianDeltaLtv = experiments.length > 0
    ? experiments.reduce((s, e) => s + (e.deltaLtvPerUser ?? 0), 0)
        / experiments.length
        / REFERENCE_LTV_PER_USER
    : FALLBACK_DELTA_LTV

  const result = useVcSimulation({
    gameId,
    offer,
    appsflyerInitialCash: initialCash,
    bayesianDeltaLtv,
  })

  const stale = isLstmStale()

  return (
    <PageTransition>
      <div className="px-10 pt-6 pb-24">
        <FadeInUp>
          <PageHeader titleKey="vc.page.title" subtitleKey="vc.page.subtitle" />
        </FadeInUp>
        <FadeInUp>
          <div className="mt-6 grid grid-cols-[360px_1fr] gap-6">
            <VcInputPanel onChange={setOffer} />
            <div className="space-y-3">
              <DataSourceBadge badge={result.dataSourceBadge} />
              {mounted && stale && <StaleBadge />}
              <CalcBoundary>
                <VcResultBoard result={result} />
              </CalcBoundary>
            </div>
          </div>
        </FadeInUp>
      </div>
    </PageTransition>
  )
}

function StaleBadge() {
  const { t } = useLocale()
  return (
    <div className="text-xs text-[var(--signal-caution)]">
      ● {t("vc.badge.stale")}
    </div>
  )
}

function DataSourceBadge({ badge }: { badge: "real" | "benchmark" | "default" }) {
  const { t } = useLocale()
  const tone = {
    real: "text-[var(--signal-positive)]",
    benchmark: "text-[var(--signal-caution)]",
    default: "text-[var(--fg-3)]",
  }[badge]
  return (
    <div className={`text-xs ${tone}`}>
      ● {t(`vc.badge.dataSource.${badge}` as const)}
    </div>
  )
}
