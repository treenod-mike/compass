"use client"

import { PageHeader } from "@/shared/ui"
import { DecisionStoryCard } from "@/widgets/dashboard"
import { MarketBenchmark, PriorPosteriorChart, RankingTrend, SaturationTrendChart } from "@/widgets/charts"
import { useLocale } from "@/shared/i18n"
import {
  mockRetention,
  mockCompetitors,
  mockMarketHero,
  mockPriorPosterior,
  mockRankingHistory,
  mockSaturationTrend,
} from "@/shared/api"
import type { SignalStatus } from "@/shared/api/mock-data"
import { PageTransition, FadeInUp } from "@/shared/ui/page-transition"
import { useGridLayout } from "@/shared/hooks"
import { motion } from "framer-motion"

const GRID_TRANSITION = { duration: 0.3, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }

function deriveMarketStatus(rankChange: number): SignalStatus {
  if (rankChange > 0) return "invest"
  if (rankChange < 0) return "reduce"
  return "hold"
}

const FACTOR_TO_STATUS: Record<"ok" | "warn" | "fail", SignalStatus> = {
  ok: "invest",
  warn: "hold",
  fail: "reduce",
}

export default function MarketGapPage() {
  const { t } = useLocale()
  const benchGrid = useGridLayout(2)
  const satGrid = useGridLayout(2)

  const status = deriveMarketStatus(mockMarketHero.rankChange)
  const headline =
    status === "invest"
      ? "지금 카테고리 리드를 굳히세요"
      : status === "reduce"
      ? "카테고리 모멘텀이 식고 있어요"
      : "포지션을 유지하며 돌파 신호를 기다리세요"

  const impactText =
    mockMarketHero.rankChange > 0
      ? `장르 ${mockMarketHero.rank}위 · 6개월간 ${mockMarketHero.rankChange}계단 상승`
      : mockMarketHero.rankChange < 0
      ? `장르 ${mockMarketHero.rank}위 · 6개월간 ${Math.abs(mockMarketHero.rankChange)}계단 하락`
      : `장르 ${mockMarketHero.rank}위 유지`

  const competitorsTopDelta = Math.abs(
    (mockCompetitors.find((c) => c.rank === 1)?.d7 ?? 0) -
      (mockCompetitors.find((c) => c.name === "포코머지")?.d7 ?? 0),
  )

  return (
    <PageTransition>
      {/* 1. Decision Story Card (market variant) */}
      <FadeInUp className="mb-10">
        <DecisionStoryCard
          status={status}
          headline={headline}
          impactText={impactText}
          confidence={mockMarketHero.confidence}
          metrics={[
            {
              label: "장르 순위",
              value: `${mockMarketHero.rank}위`,
              trend: {
                text:
                  mockMarketHero.rankChange > 0
                    ? `↗ ${mockMarketHero.rankChange}계단 상승`
                    : mockMarketHero.rankChange < 0
                    ? `↘ ${Math.abs(mockMarketHero.rankChange)}계단 하락`
                    : "변동 없음",
                direction: mockMarketHero.rankChange >= 0 ? "up" : "down",
              },
            },
            {
              label: "D7 리텐션",
              value: `${mockRetention.data[6]?.p50 ?? 18}%`,
              trend: { text: "장르 P75 이상", direction: "up" },
            },
            {
              label: "Top 1 대비",
              value: `-${competitorsTopDelta.toFixed(1)}%p`,
              trend: { text: "좁혀지는 중", direction: "up" },
            },
          ]}
          regions={mockMarketHero.factors.map((f) => ({
            label: f.text.ko,
            status: FACTOR_TO_STATUS[f.status],
            reason: "",
          }))}
          regionsLabel="카테고리 신호"
          ctaLabel="경쟁 분석 보기"
        />
      </FadeInUp>

      <FadeInUp className="mb-2">
        <PageHeader titleKey="market.title" subtitleKey="market.subtitle" />
      </FadeInUp>

      {/* 2. Prior vs Posterior — Bayesian differentiator */}
      <FadeInUp className="mb-8">
        <PriorPosteriorChart data={mockPriorPosterior} />
      </FadeInUp>

      {/* 3. Retention benchmark + Ranking trend */}
      <FadeInUp className="grid grid-cols-2 gap-6 mb-8">
        <motion.div layout className={`${benchGrid.getClassName("chart-0", 0)} h-full`} transition={GRID_TRANSITION}>
          <MarketBenchmark data={mockRetention.data} expanded={benchGrid.expandedId === "chart-0"} onToggle={() => benchGrid.toggle("chart-0")} />
        </motion.div>
        <motion.div layout className={`${benchGrid.getClassName("chart-1", 1)} h-full`} transition={GRID_TRANSITION}>
          <RankingTrend data={mockRankingHistory} expanded={benchGrid.expandedId === "chart-1"} onToggle={() => benchGrid.toggle("chart-1")} />
        </motion.div>
      </FadeInUp>

      {/* 4. Saturation trend + Competitor table */}
      <FadeInUp className="grid grid-cols-2 gap-6">
        <motion.div layout className={`${satGrid.getClassName("chart-0", 0)} h-full`} transition={GRID_TRANSITION}>
          <SaturationTrendChart data={mockSaturationTrend} expanded={satGrid.expandedId === "chart-0"} onToggle={() => satGrid.toggle("chart-0")} />
        </motion.div>
        <motion.div layout className={`${satGrid.getClassName("chart-1", 1)} h-full`} transition={GRID_TRANSITION}>
        <div className="rounded-2xl border border-border bg-card p-6 h-full transition-colors hover:border-primary">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-foreground">상위 10개 경쟁작</h3>
            <p className="text-xs text-muted-foreground mt-0.5">머지 장르 · 매출 순위</p>
            <p className="text-xs text-muted-foreground mt-0.5 italic">포코머지 행은 보라색으로 강조됩니다</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-3 py-2 text-left text-xs font-bold text-muted-foreground">{t("table.rank")}</th>
                  <th className="px-3 py-2 text-left text-xs font-bold text-muted-foreground">{t("table.name")}</th>
                  <th className="px-3 py-2 text-right text-xs font-bold text-muted-foreground">{t("table.d7")}</th>
                  <th className="px-3 py-2 text-right text-xs font-bold text-muted-foreground">{t("table.d30")}</th>
                  <th className="px-3 py-2 text-right text-xs font-bold text-muted-foreground">{t("table.revenue")}</th>
                </tr>
              </thead>
              <tbody>
                {mockCompetitors.map((c) => {
                  const isOurs = c.name === "포코머지"
                  return (
                    <tr
                      key={c.rank}
                      className={
                        "border-b border-border/40 " +
                        (isOurs ? "bg-primary/10" : "")
                      }
                    >
                      <td className="px-3 py-2.5 text-xs text-foreground/70" style={{ fontVariantNumeric: "tabular-nums" }}>
                        #{c.rank}
                      </td>
                      <td className={"px-3 py-2.5 text-xs " + (isOurs ? "font-bold text-primary" : "font-medium text-foreground")}>
                        {c.name}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-right text-foreground/70" style={{ fontVariantNumeric: "tabular-nums" }}>
                        {c.d7}%
                      </td>
                      <td className="px-3 py-2.5 text-xs text-right text-foreground/70" style={{ fontVariantNumeric: "tabular-nums" }}>
                        {c.d30}%
                      </td>
                      <td className="px-3 py-2.5 text-xs text-right font-bold text-foreground" style={{ fontVariantNumeric: "tabular-nums" }}>
                        {c.revenue}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
        </motion.div>
      </FadeInUp>
    </PageTransition>
  )
}
