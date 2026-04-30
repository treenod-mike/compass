"use client"

import { PageHeader } from "@/shared/ui"
import { PageTransition, FadeInUp } from "@/shared/ui/page-transition"
import { useLocale } from "@/shared/i18n"
import { mockTitleHealth, mockPortfolioKPIs } from "@/shared/api/mock-data"
import { PortfolioGameCard } from "@/widgets/portfolio"

export default function PortfolioPage() {
  const { t } = useLocale()

  return (
    <PageTransition>
      <div className="px-10 pt-6 pb-24">
        <FadeInUp>
          <PageHeader
            titleKey="portfolio.page.title"
            subtitleKey="portfolio.page.subtitle"
          />
        </FadeInUp>

        {/* Aggregate KPIs */}
        <FadeInUp className="mt-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <AggregateKpi
              label={t("portfolio.kpi.blendedRoas")}
              value={`${mockPortfolioKPIs.blendedRoas.value}%`}
            />
            <AggregateKpi
              label={t("portfolio.kpi.deployPace")}
              value={`$${mockPortfolioKPIs.deployPace.value}K/mo`}
            />
            <AggregateKpi
              label={t("portfolio.kpi.portfolioMoic")}
              value={`${mockPortfolioKPIs.portfolioMoic.value}x`}
            />
            <AggregateKpi
              label={t("portfolio.kpi.fundDpi")}
              value={`${mockPortfolioKPIs.fundDpi.value}x`}
            />
            <AggregateKpi
              label={t("portfolio.kpi.expVelocity")}
              value={`${mockPortfolioKPIs.expVelocity.value}/mo`}
            />
            <AggregateKpi
              label={t("portfolio.kpi.marketTiming")}
              value={`${mockPortfolioKPIs.marketTiming.value}pts`}
            />
          </div>
        </FadeInUp>

        {/* Per-game grid */}
        <FadeInUp className="mt-8">
          <h2 className="text-sm font-semibold text-foreground mb-4">
            {t("portfolio.gamesHeading")}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {mockTitleHealth.map((row) => (
              <PortfolioGameCard key={row.gameId} row={row} />
            ))}
          </div>
        </FadeInUp>
      </div>
    </PageTransition>
  )
}

function AggregateKpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-border bg-card p-4">
      <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 text-xl font-semibold tabular-nums text-foreground">{value}</div>
    </div>
  )
}
