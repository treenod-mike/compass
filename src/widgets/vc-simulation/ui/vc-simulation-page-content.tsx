"use client"

import { useEffect, useState, Component, type ReactNode } from "react"
import { useSelectedGame } from "@/shared/store/selected-game"
import { PageHeader } from "@/shared/ui"
import { PageTransition, FadeInUp } from "@/shared/ui/page-transition"
import { VcInputPanel, VcResultBoard } from "@/widgets/vc-simulation"
import { AssumptionSourcePanel } from "./assumption-source-panel"
import { DecisionSentence } from "./decision-sentence"
import { VcKpiStrip } from "./vc-kpi-strip"
import { CalcErrorCard } from "@/widgets/vc-simulation/ui/calc-error-card"
import { DEFAULT_OFFER, useVcSimulation, isLstmStale, type Offer } from "@/shared/api/vc-simulation"
import { useGameData } from "@/shared/api/use-game-data"
import { useLocale } from "@/shared/i18n"
import { ArrowRight } from "lucide-react"
import { ChannelDrawer } from "./channel-drawer"

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

export function VcSimulationPageContent() {
  const { gameId } = useSelectedGame()
  const { t } = useLocale()
  const [offer, setOffer] = useState<Offer>(DEFAULT_OFFER)
  const [compareMarket, setCompareMarket] = useState(false)
  const [channelOpen, setChannelOpen] = useState(false)
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
      <div className="px-10 pt-6 pb-6 flex flex-col h-full min-h-0">
        <FadeInUp>
          <PageHeader titleKey="vc.page.title" subtitleKey="vc.page.subtitle" />
        </FadeInUp>

        <FadeInUp className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={() => setCompareMarket((v) => !v)}
            aria-pressed={compareMarket}
            className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:border-primary hover:text-foreground transition-colors"
          >
            <span
              className={`size-2 rounded-full transition-colors ${
                compareMarket ? "bg-primary" : "bg-muted-foreground/40"
              }`}
              aria-hidden="true"
            />
            {t("vc.compare.title")}
          </button>
        </FadeInUp>

        {/* Hero — 항상 보이는 결정 sentence (full-width). */}
        <FadeInUp className="mt-4">
          <DecisionSentence result={result} />
        </FadeInUp>

        <FadeInUp className="flex-1 min-h-0 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-[2fr_3fr] gap-6 h-full min-h-0">
            {/* Left column — input panel scrolls independently. */}
            <div className="overflow-y-auto pr-2 -mr-2 min-h-0">
              <VcInputPanel onChange={setOffer} />
              <button
                type="button"
                onClick={() => setChannelOpen(true)}
                className="mt-4 w-full inline-flex items-center justify-between rounded-md border border-border bg-card px-4 py-3 text-sm font-semibold text-foreground hover:border-primary transition-colors"
              >
                <span>{t("vc.channel.trigger")}</span>
                <ArrowRight className="size-4 text-muted-foreground" />
              </button>
              <AssumptionSourcePanel compareMarket={compareMarket} />
            </div>
            {/* Right column — results scroll independently so input stays in
                view as the user explores the insights / charts below. */}
            <div className="overflow-y-auto pr-2 -mr-2 space-y-3 min-h-0">
              {/* Both badges depend on isLstmStale() / new Date() — gate behind
                  `mounted` to keep SSR-rendered HTML identical to first client render.
                  Until mount, show a deterministic "real" placeholder. */}
              <DataSourceBadge badge={mounted ? result.dataSourceBadge : "real"} />
              {mounted && stale && <StaleBadge />}
              {/* KPI 상시 노출 (Phase 2: 결과 탭에서 hoist). */}
              <VcKpiStrip result={result} />
              <CalcBoundary>
                <VcResultBoard
                  result={result}
                  gameId={gameId}
                  appsflyerInitialCash={initialCash}
                  bayesianDeltaLtv={bayesianDeltaLtv}
                />
              </CalcBoundary>
            </div>
          </div>
        </FadeInUp>
      </div>
      <ChannelDrawer open={channelOpen} onClose={() => setChannelOpen(false)} />
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
