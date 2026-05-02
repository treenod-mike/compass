"use client"

import { useMemo } from "react"
import { mockRetention } from "@/shared/api/mock-data"
import type { RetentionDataPoint } from "@/shared/api/mock-data"
import { PageHeader } from "@/shared/ui"
import { PageTransition, FadeInUp } from "@/shared/ui/page-transition"
import { useLocale } from "@/shared/i18n"
import { RetentionCurve, CohortHeatmap } from "@/widgets/charts"

type RetentionStat = {
  d1: number | null
  d7: number | null
  d30: number | null
  gap1: number | null
  gap7: number | null
  gap30: number | null
}

export default function CohortPage() {
  const { t } = useLocale()
  const stat = useMemo<RetentionStat>(
    () => deriveRetentionStat(mockRetention.data),
    [],
  )
  const heroLine = buildHeroLine(stat, t)

  return (
    <PageTransition>
      <div className="px-10 pt-6 pb-6 flex flex-col h-full min-h-0">
        <FadeInUp>
          <PageHeader titleKey="cohort.page.title" subtitleKey="cohort.page.subtitle" />
        </FadeInUp>

        <FadeInUp className="mt-6">
          <div className="rounded-[var(--radius-card)] border border-[var(--bg-3)] bg-[var(--bg-1)] px-5 py-4 font-serif text-[var(--fg-0)] text-lg">
            {heroLine}
          </div>
        </FadeInUp>

        <FadeInUp className="mt-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiTile labelKey="cohort.kpi.d1" valuePct={stat.d1} gapPp={stat.gap1} />
            <KpiTile labelKey="cohort.kpi.d7" valuePct={stat.d7} gapPp={stat.gap7} />
            <KpiTile labelKey="cohort.kpi.d30" valuePct={stat.d30} gapPp={stat.gap30} />
            <KpiTile labelKey="cohort.kpi.gap" valuePp={stat.gap7} />
          </div>
        </FadeInUp>

        <FadeInUp className="mt-4">
          <section
            aria-label={t("cohort.section.curve")}
            className="rounded-[var(--radius-card)] border border-[var(--bg-3)] bg-[var(--bg-1)] p-4"
          >
            <RetentionCurve
              data={mockRetention.data}
              asymptoticDay={mockRetention.asymptoticDay}
            />
          </section>
        </FadeInUp>

        <FadeInUp className="mt-4">
          <section
            aria-label={t("cohort.section.heatmap")}
            className="rounded-[var(--radius-card)] border border-[var(--bg-3)] bg-[var(--bg-1)] p-4"
          >
            <CohortHeatmap />
          </section>
        </FadeInUp>
      </div>
    </PageTransition>
  )
}

function KpiTile({
  labelKey,
  valuePct,
  valuePp,
  gapPp,
}: {
  labelKey: import("@/shared/i18n/dictionary").TranslationKey
  valuePct?: number | null
  valuePp?: number | null
  gapPp?: number | null
}) {
  const { t } = useLocale()
  const display =
    valuePct !== undefined && valuePct !== null
      ? `${valuePct.toFixed(1)}%`
      : valuePp !== undefined && valuePp !== null
        ? `${valuePp >= 0 ? "+" : ""}${valuePp.toFixed(1)} pp`
        : "—"
  const tone =
    gapPp === undefined || gapPp === null
      ? "text-[var(--fg-2)]"
      : gapPp >= 0
        ? "text-[var(--signal-positive)]"
        : "text-[var(--signal-risk)]"
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--bg-3)] bg-[var(--bg-1)] p-4">
      <div className="text-xs text-[var(--fg-2)]">{t(labelKey)}</div>
      <div className="mt-2 font-mono tabular-nums text-2xl text-[var(--fg-0)]">{display}</div>
      {gapPp !== undefined && gapPp !== null && valuePp === undefined && (
        <div className={`mt-1 text-xs ${tone}`}>
          {gapPp >= 0 ? "+" : ""}
          {gapPp.toFixed(1)} pp
        </div>
      )}
    </div>
  )
}

function deriveRetentionStat(data: RetentionDataPoint[]): RetentionStat {
  const pick = (day: number) => data.find((p) => p.day === day) ?? null
  const d1Pt = pick(1)
  const d7Pt = pick(7)
  const d30Pt = pick(30)
  const safeGap = (own: number | undefined, genre: number | undefined) =>
    own !== undefined && genre !== undefined ? own - genre : null
  return {
    d1: d1Pt?.p50 ?? null,
    d7: d7Pt?.p50 ?? null,
    d30: d30Pt?.p50 ?? null,
    gap1: safeGap(d1Pt?.p50, d1Pt?.genre),
    gap7: safeGap(d7Pt?.p50, d7Pt?.genre),
    gap30: safeGap(d30Pt?.p50, d30Pt?.genre),
  }
}

function buildHeroLine(
  stat: RetentionStat,
  t: (key: import("@/shared/i18n/dictionary").TranslationKey) => string,
): string {
  if (stat.d1 === null || stat.d7 === null || stat.d30 === null) {
    return t("cohort.hero.noData")
  }
  const fmtGap = (v: number | null) =>
    v === null ? "?" : `${v >= 0 ? "+" : ""}${v.toFixed(1)}`
  return t("cohort.hero.template")
    .replace("{d1}", stat.d1.toFixed(1))
    .replace("{d7}", stat.d7.toFixed(1))
    .replace("{d30}", stat.d30.toFixed(1))
    .replace("{gap1}", fmtGap(stat.gap1))
    .replace("{gap7}", fmtGap(stat.gap7))
    .replace("{gap30}", fmtGap(stat.gap30))
}
