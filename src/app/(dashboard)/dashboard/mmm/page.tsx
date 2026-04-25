"use client"

import { useEffect, useState } from "react"
import { PageHeader } from "@/shared/ui"
import { PageTransition, FadeInUp } from "@/shared/ui/page-transition"
import { DecisionStoryCard } from "@/widgets/dashboard"
import { CurrentMarketChip } from "@/widgets/dashboard/ui/current-market-chip"
import { SaturationMeter } from "@/widgets/charts/ui/saturation-meter"
import { ContributionDonut } from "@/widgets/charts/ui/contribution-donut"
import { ChannelStatusCard } from "@/widgets/charts/ui/channel-status-card"
import { ChannelDetailModal } from "@/widgets/charts/ui/channel-detail-modal"
import { CpiQuadrant } from "@/widgets/charts/ui/cpi-quadrant"
import { CpiBenchmarkTable } from "@/widgets/charts/ui/cpi-benchmark-table"
import { ReallocationSummary } from "@/widgets/charts/ui/reallocation-summary"
import { useLocale } from "@/shared/i18n"
import type { SignalStatus } from "@/shared/api/mock-data"
import {
  mmmChannels,
  mmmVerdict,
  mmmPortfolio,
  mmmContribution,
  mmmReallocation,
  isMmmStale,
  mmmAgeDays,
  type MmmChannel,
} from "@/shared/api/mmm-data"

function deriveChannelStatus(mROAS: number): SignalStatus {
  if (mROAS >= 1.4) return "invest"
  if (mROAS >= 1.0) return "hold"
  return "reduce"
}

function fmtK(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `$${Math.round(v / 1_000)}K`
  return `$${v.toFixed(0)}`
}

export default function MmmPage() {
  const { locale, t } = useLocale()
  const [detailChannel, setDetailChannel] = useState<MmmChannel | null>(null)
  // Gate time-dependent rendering (isMmmStale / mmmAgeDays use `new Date()`)
  // to client-side only, preventing SSR/CSR hydration mismatch.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const totalSpend = mmmChannels.reduce((s, c) => s + c.currentSpend, 0)
  const weightedMROAS =
    mmmChannels.reduce((s, c) => s + c.marginal.roas * c.currentSpend, 0) / Math.max(1, totalSpend)
  const saturatedCount = mmmChannels.filter((c) => c.marginal.roas < 1).length

  const impactText =
    locale === "ko"
      ? `총 spend ${fmtK(totalSpend)} · 가중 mROAS ${weightedMROAS.toFixed(2)}× · 포화 ${saturatedCount}/${mmmChannels.length}채널`
      : `Total spend ${fmtK(totalSpend)} · Weighted mROAS ${weightedMROAS.toFixed(2)}× · ${saturatedCount}/${mmmChannels.length} saturated`

  const regions = mmmChannels.map((c) => ({
    label: c.label,
    status: deriveChannelStatus(c.marginal.roas),
    reason: `mROAS ${c.marginal.roas.toFixed(2)}× · mCPI $${c.marginal.cpi.toFixed(2)}`,
  }))

  return (
    <PageTransition>
      <FadeInUp className="mb-4">
        <CurrentMarketChip gameLabel="포코머지" />
      </FadeInUp>

      {/* ① Hero Verdict */}
      <FadeInUp className="mb-8">
        <DecisionStoryCard
          status={mmmVerdict.status}
          headline={mmmVerdict.headline[locale]}
          impactText={impactText}
          confidence={Math.round(mmmVerdict.confidence * 100)}
          metrics={mmmVerdict.metrics.map((m) => ({ label: m.label[locale], value: m.value }))}
          regions={regions}
          regionsLabel={locale === "ko" ? "채널별 상태" : "Per-channel status"}
          ctaLabel={locale === "ko" ? "방법론 보기" : "View methodology"}
        />
      </FadeInUp>

      <FadeInUp className="mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <PageHeader titleKey="mmm.title" subtitleKey="mmm.subtitle" />
          {mounted ? (
            isMmmStale() ? (
              <span className="inline-flex items-center gap-1 rounded-sm border border-[var(--signal-caution)]/40 bg-[var(--signal-caution)]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[var(--signal-caution)]">
                {t("mmm.badge.stale").replace("{{days}}", String(mmmAgeDays()))}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-sm border border-border bg-[var(--bg-2)] px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                {t("mmm.badge.mock")}
              </span>
            )
          ) : null}
        </div>
      </FadeInUp>

      {/* ② Saturation Meter */}
      <FadeInUp className="mb-6">
        <SaturationMeter portfolio={mmmPortfolio} />
      </FadeInUp>

      {/* ③ Base vs Incremental Donut */}
      <FadeInUp className="mb-8">
        <ContributionDonut contribution={mmmContribution} />
      </FadeInUp>

      {/* ④ Channel Status Cards (2×2) */}
      <FadeInUp className="mb-10">
        <div className="grid grid-cols-2 gap-4">
          {mmmChannels.map((c) => (
            <ChannelStatusCard
              key={c.key}
              channel={c}
              onClick={() => setDetailChannel(c)}
            />
          ))}
        </div>
      </FadeInUp>

      {/* ⑤ CPI Benchmark Analysis — Quadrant + Table */}
      <FadeInUp className="mb-8">
        <div className="grid grid-cols-[1fr_1fr] gap-4">
          <CpiQuadrant channels={mmmChannels} />
          <CpiBenchmarkTable channels={mmmChannels} />
        </div>
      </FadeInUp>

      {/* ⑥ Reallocation Summary */}
      <FadeInUp>
        <ReallocationSummary channels={mmmChannels} reallocation={mmmReallocation} />
      </FadeInUp>

      <ChannelDetailModal channel={detailChannel} onClose={() => setDetailChannel(null)} />
    </PageTransition>
  )
}
