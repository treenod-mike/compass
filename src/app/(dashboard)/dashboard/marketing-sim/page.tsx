"use client"

import { PageHeader } from "@/shared/ui"
import { PageTransition, FadeInUp } from "@/shared/ui/page-transition"
import {
  MarketingSimControls,
  MarketingSimKpiTiles,
  MarketingSimRoasChart,
  MarketingSimRevenueCompare,
  useMarketingSim,
} from "@/widgets/marketing-sim"
import { useLocale } from "@/shared/i18n"

export default function MarketingSimPage() {
  const { state, setState, derived, HORIZON_DAYS, OBSERVED_ARPDAU } = useMarketingSim()
  const { t } = useLocale()

  const heroLine = buildHeroLine({
    country: state.country,
    genre: state.genre,
    budgetUsdPerDay: state.uaBudgetUsdPerDay,
    paybackDayP50: derived.result?.paybackDayP50 ?? null,
    horizonDays: HORIZON_DAYS,
    hasResult: derived.result !== null,
    t,
  })

  return (
    <PageTransition>
      <div className="px-10 pt-6 pb-6 flex flex-col h-full min-h-0">
        <FadeInUp>
          <PageHeader titleKey="marketingSim.page.title" subtitleKey="marketingSim.page.subtitle" />
        </FadeInUp>

        <FadeInUp className="mt-6">
          <div className="rounded-[var(--radius-card)] border border-[var(--bg-3)] bg-[var(--bg-1)] px-5 py-4 font-serif text-[var(--fg-0)] text-lg">
            {heroLine}
          </div>
        </FadeInUp>

        <FadeInUp className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4">
            <section
              aria-label={t("marketingSim.section.inputs")}
              className="rounded-[var(--radius-card)] border border-[var(--bg-3)] bg-[var(--bg-1)] p-4"
            >
              <MarketingSimControls
                state={state}
                onChange={setState}
                cpiUsd={derived.cpiUsd}
                cpiUsedFallback={derived.cpiUsedFallback}
              />
              {derived.cpiUsedFallback && (
                <div className="mt-3 text-xs text-[var(--signal-caution)]">
                  ⚠ {t("marketingSim.badge.cpiFallback")}
                </div>
              )}
            </section>
            <section
              aria-label={t("marketingSim.section.kpis")}
              className="rounded-[var(--radius-card)] border border-[var(--bg-3)] bg-[var(--bg-1)] p-4"
            >
              <MarketingSimKpiTiles result={derived.result} horizonDays={HORIZON_DAYS} />
            </section>
          </div>
        </FadeInUp>

        <FadeInUp className="mt-4">
          <section
            aria-label={t("marketingSim.section.roas")}
            className="rounded-[var(--radius-card)] border border-[var(--bg-3)] bg-[var(--bg-1)] p-4"
          >
            <MarketingSimRoasChart result={derived.result} />
          </section>
        </FadeInUp>

        <FadeInUp className="mt-4">
          <section
            aria-label={t("marketingSim.section.revenue")}
            className="rounded-[var(--radius-card)] border border-[var(--bg-3)] bg-[var(--bg-1)] p-4"
          >
            <MarketingSimRevenueCompare
              targetResult={derived.result}
              observedResult={derived.observedRevenueResult}
              targetArpdauUsd={state.targetArpdauUsd}
              observedArpdauUsd={OBSERVED_ARPDAU}
            />
          </section>
        </FadeInUp>
      </div>
    </PageTransition>
  )
}

function buildHeroLine({
  country,
  genre,
  budgetUsdPerDay,
  paybackDayP50,
  horizonDays,
  hasResult,
  t,
}: {
  country: string
  genre: string
  budgetUsdPerDay: number
  paybackDayP50: number | null
  horizonDays: number
  hasResult: boolean
  t: (key: import("@/shared/i18n/dictionary").TranslationKey) => string
}): string {
  if (!hasResult) return t("marketingSim.hero.noResult")
  const budget = formatBudget(budgetUsdPerDay)
  const fill = (template: string) =>
    template
      .replace("{country}", country)
      .replace("{genre}", genre)
      .replace("{budget}", budget)
  if (paybackDayP50 === null || paybackDayP50 > horizonDays) {
    return fill(t("marketingSim.hero.noPayback"))
  }
  return fill(t("marketingSim.hero.payback")).replace("{day}", String(paybackDayP50))
}

function formatBudget(usdPerDay: number): string {
  if (usdPerDay >= 1000) return `$${(usdPerDay / 1000).toFixed(usdPerDay >= 10000 ? 0 : 1)}k`
  return `$${Math.round(usdPerDay)}`
}
