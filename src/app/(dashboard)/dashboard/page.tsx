"use client"

import { PageHeader } from "@/shared/ui"
import {
  DecisionStoryCard,
  HeroVerdict,
  KPICards,
  TitleHeatmap,
  MarketContextCard,
  DataFreshnessStrip,
} from "@/widgets/dashboard"
import { RevenueVsInvest, CapitalWaterfall, RevenueForecast } from "@/widgets/charts"
import { useLocale } from "@/shared/i18n"
import {
  mockPortfolioSignal,
  mockPortfolioKPIs,
  mockTitleHealth,
  mockMarketContext,
  mockDataFreshness,
  mockMarketHero,
} from "@/shared/api"
import { useGameData } from "@/shared/api/use-game-data"
import { useSelectedGame, PORTFOLIO_ID } from "@/shared/store/selected-game"
import { PageTransition, FadeInUp } from "@/shared/ui/page-transition"
import { useGridLayout } from "@/shared/hooks"
import { motion } from "framer-motion"

const GRID_TRANSITION = { duration: 0.3, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }

const REGION_REASONS: Record<string, string> = {
  "포코머지": "ROAS 148%, 월 +6% 성장",
}

export default function ExecutiveOverviewPage() {
  const { t: _t } = useLocale()
  const gameId = useSelectedGame((s) => s.gameId)
  const gameData = useGameData()
  const heatmapGrid = useGridLayout(2)
  const waterfallGrid = useGridLayout(2)
  const forecastGrid = useGridLayout(1)

  const isPortfolioView = gameId === PORTFOLIO_ID

  return (
    <PageTransition>
      {/* 1. Decision Story Card (α+β hybrid) — 최상단 판정 덱 */}
      <FadeInUp className="mb-10">
        {isPortfolioView ? (
          <DecisionStoryCard
            status={mockPortfolioSignal.status}
            headline={mockPortfolioSignal.recommendation.ko}
            impactText={mockPortfolioSignal.impact.value.ko}
            confidence={mockPortfolioSignal.confidence}
            metrics={[
              {
                label: "광고비 회수",
                value: `${mockPortfolioKPIs.blendedRoas.value}%`,
                trend: {
                  text: `지난 달 +${mockPortfolioKPIs.blendedRoas.trend}%p`,
                  direction: "up",
                },
              },
              {
                label: "성장 속도",
                value: `+${mockPortfolioKPIs.deployPace.trend > 0 ? mockPortfolioKPIs.deployPace.trend : 6.2}%/월`,
                trend: { text: "가속 중", direction: "up" },
              },
              {
                label: "경쟁 위치",
                value: `장르 ${mockMarketHero.rank}위`,
                trend: {
                  text: `${Math.abs(mockMarketHero.rankChange)}계단 상승`,
                  direction: "up",
                },
              },
            ]}
            regions={mockTitleHealth.map((t) => ({
              label: t.label,
              status: t.signal,
              reason: REGION_REASONS[t.label] ?? `ROAS ${t.roas}%, 본전 ${t.paybackD}일`,
            }))}
            ctaLabel="재배분 플랜 보기"
          />
        ) : (
          <HeroVerdict
            status={gameData.signal.status}
            confidence={gameData.signal.confidence}
            factors={gameData.signal.factors as unknown as Parameters<typeof HeroVerdict>[0]["factors"]}
            payback={gameData.signal.payback}
            nextAction={gameData.signal.nextAction}
            reason={gameData.signal.reason}
            impact={gameData.signal.impact}
          />
        )}
      </FadeInUp>

      <FadeInUp className="mb-2">
        <PageHeader titleKey="exec.title" subtitleKey="exec.subtitle" />
      </FadeInUp>

      {/* 2. KPI Strip — Portfolio (6 blended cards) or Single-game (4 cards) */}
      <FadeInUp className="mb-8">
        {isPortfolioView ? (
          <KPICards
            items={[
              { labelKey: "kpi.blendedRoas", value: `${mockPortfolioKPIs.blendedRoas.value}%`, trend: mockPortfolioKPIs.blendedRoas.trend, trendLabel: mockPortfolioKPIs.blendedRoas.trendLabel },
              { labelKey: "kpi.deployPace", value: mockPortfolioKPIs.deployPace.value, unit: mockPortfolioKPIs.deployPace.unit, trend: mockPortfolioKPIs.deployPace.trend, trendLabel: mockPortfolioKPIs.deployPace.trendLabel },
              { labelKey: "kpi.portfolioMoic", value: mockPortfolioKPIs.portfolioMoic.value, unit: mockPortfolioKPIs.portfolioMoic.unit, trend: mockPortfolioKPIs.portfolioMoic.trend, trendLabel: mockPortfolioKPIs.portfolioMoic.trendLabel },
              { labelKey: "kpi.fundDpi", value: mockPortfolioKPIs.fundDpi.value, unit: mockPortfolioKPIs.fundDpi.unit, trend: mockPortfolioKPIs.fundDpi.trend, trendLabel: mockPortfolioKPIs.fundDpi.trendLabel },
              { labelKey: "kpi.expVelocity", value: mockPortfolioKPIs.expVelocity.value, unit: mockPortfolioKPIs.expVelocity.unit, trend: mockPortfolioKPIs.expVelocity.trend, trendLabel: mockPortfolioKPIs.expVelocity.trendLabel },
              { labelKey: "kpi.marketTiming", value: mockPortfolioKPIs.marketTiming.value, unit: mockPortfolioKPIs.marketTiming.unit, trend: mockPortfolioKPIs.marketTiming.trend, trendLabel: mockPortfolioKPIs.marketTiming.trendLabel },
            ]}
            basisKey="kpi.basisPortfolio"
          />
        ) : (
          <KPICards
            items={[
              { labelKey: "kpi.roas",    value: `${gameData.charts.kpis.roas.value}%`,   trend: gameData.charts.kpis.roas.trend,    trendLabel: gameData.charts.kpis.roas.trendLabel },
              { labelKey: "kpi.payback", value: gameData.charts.kpis.payback.value,      unit: _t("common.days"),   trend: gameData.charts.kpis.payback.trend, trendLabel: gameData.charts.kpis.payback.trendLabel },
              { labelKey: "kpi.bep",     value: `${gameData.charts.kpis.bep.value}%`,    trend: gameData.charts.kpis.bep.trend,     trendLabel: gameData.charts.kpis.bep.trendLabel },
              { labelKey: "kpi.burn",    value: gameData.charts.kpis.burn.value,         unit: _t("common.months"), trend: gameData.charts.kpis.burn.trend,    trendLabel: gameData.charts.kpis.burn.trendLabel },
            ]}
            basisKey="kpi.basis"
          />
        )}
      </FadeInUp>

      {/* 3. Title Heatmap + Market Context (3:2 split) */}
      <FadeInUp className="grid grid-cols-5 gap-6 mb-8">
        <motion.div
          layout
          className={heatmapGrid.expandedId ? "col-span-5" : "col-span-3"}
          transition={GRID_TRANSITION}
        >
          <TitleHeatmap
            titles={mockTitleHealth}
            expanded={heatmapGrid.expandedId === "chart-0"}
            onToggle={() => heatmapGrid.toggle("chart-0")}
          />
        </motion.div>
        <motion.div
          layout
          className={heatmapGrid.expandedId ? "col-span-5" : "col-span-2"}
          transition={GRID_TRANSITION}
        >
          <MarketContextCard
            data={mockMarketContext}
            expanded={heatmapGrid.expandedId === "chart-1"}
            onToggle={() => heatmapGrid.toggle("chart-1")}
          />
        </motion.div>
      </FadeInUp>

      {/* 4. Capital Waterfall + Revenue vs Investment (2-col) */}
      <FadeInUp className="grid grid-cols-2 gap-6 mb-8">
        <motion.div
          layout
          className={`${waterfallGrid.getClassName("chart-0", 0)} h-full`}
          transition={GRID_TRANSITION}
        >
          <CapitalWaterfall
            data={gameData.charts.capitalWaterfall}
            expanded={waterfallGrid.expandedId === "chart-0"}
            onToggle={() => waterfallGrid.toggle("chart-0")}
          />
        </motion.div>
        <motion.div
          layout
          className={`${waterfallGrid.getClassName("chart-1", 1)} h-full`}
          transition={GRID_TRANSITION}
        >
          <RevenueVsInvest
            data={gameData.charts.revenueVsInvest}
            expanded={waterfallGrid.expandedId === "chart-1"}
            onToggle={() => waterfallGrid.toggle("chart-1")}
          />
        </motion.div>
      </FadeInUp>

      {/* 5. Revenue Forecast + Data Freshness (3:1 split) */}
      <FadeInUp className="grid grid-cols-4 gap-6">
        <motion.div
          layout
          className={forecastGrid.expandedId === "chart-0" ? "col-span-4" : "col-span-3"}
          transition={GRID_TRANSITION}
        >
          <RevenueForecast
            data={gameData.charts.revenueForecast}
            meta={gameData.charts.revenueForecastMeta}
            expanded={forecastGrid.expandedId === "chart-0"}
            onToggle={() => forecastGrid.toggle("chart-0")}
          />
        </motion.div>
        <motion.div
          layout
          className={forecastGrid.expandedId === "chart-0" ? "col-span-4" : "col-span-1"}
          transition={GRID_TRANSITION}
        >
          <DataFreshnessStrip data={mockDataFreshness} />
        </motion.div>
      </FadeInUp>
    </PageTransition>
  )
}
