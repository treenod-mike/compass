"use client"

import {
  mockCashRunway,
  mockCapitalWaterfall,
  mockBudgetAllocation,
  mockRevenueVsInvest,
} from "@/shared/api/mock-data"
import { PageHeader } from "@/shared/ui"
import { PageTransition, FadeInUp } from "@/shared/ui/page-transition"
import { useLocale } from "@/shared/i18n"
import {
  RunwayFanChart,
  CapitalWaterfall,
  BudgetDonut,
  RevenueVsInvest,
  ScenarioSimulator,
} from "@/widgets/charts"

export default function CapitalPage() {
  const { t, locale } = useLocale()
  const heroLine = buildHeroLine(t)

  return (
    <PageTransition>
      <div className="px-10 pt-6 pb-6 flex flex-col h-full min-h-0">
        <FadeInUp>
          <PageHeader titleKey="capital.page.title" subtitleKey="capital.page.subtitle" />
        </FadeInUp>

        <FadeInUp className="mt-6">
          <div className="rounded-[var(--radius-card)] border border-[var(--bg-3)] bg-[var(--bg-1)] px-5 py-4 font-serif text-[var(--fg-0)] text-lg">
            {heroLine}
          </div>
        </FadeInUp>

        <FadeInUp className="mt-4">
          <section
            aria-label={t("capital.section.runway")}
            className="rounded-[var(--radius-card)] border border-[var(--bg-3)] bg-[var(--bg-1)] p-4"
          >
            <RunwayFanChart data={mockCashRunway} locale={locale} height={320} />
          </section>
        </FadeInUp>

        <FadeInUp className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <section
              aria-label={t("capital.section.waterfall")}
              className="rounded-[var(--radius-card)] border border-[var(--bg-3)] bg-[var(--bg-1)] p-4"
            >
              <CapitalWaterfall data={mockCapitalWaterfall} />
            </section>
            <section
              aria-label={t("capital.section.revenue")}
              className="rounded-[var(--radius-card)] border border-[var(--bg-3)] bg-[var(--bg-1)] p-4"
            >
              <RevenueVsInvest data={mockRevenueVsInvest} />
            </section>
          </div>
        </FadeInUp>

        <FadeInUp className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <section
              aria-label={t("capital.section.budget")}
              className="rounded-[var(--radius-card)] border border-[var(--bg-3)] bg-[var(--bg-1)] p-4"
            >
              <BudgetDonut data={mockBudgetAllocation} />
            </section>
            <section
              aria-label={t("capital.section.scenario")}
              className="rounded-[var(--radius-card)] border border-[var(--bg-3)] bg-[var(--bg-1)] p-4"
            >
              <ScenarioSimulator />
            </section>
          </div>
        </FadeInUp>
      </div>
    </PageTransition>
  )
}

function buildHeroLine(
  t: (key: import("@/shared/i18n/dictionary").TranslationKey) => string,
): string {
  const cashM = (mockCashRunway.initialCash / 1000).toFixed(1)
  const months = mockCashRunway.p50CashOutMonth
  const probPct = Math.round(mockCashRunway.probCashOut * 100)
  if (months < 0) {
    return t("capital.hero.noCashOut").replace("{cash}", cashM)
  }
  return t("capital.hero.template")
    .replace("{cash}", cashM)
    .replace("{months}", months.toFixed(1))
    .replace("{prob}", String(probPct))
}
