"use client"

import { PageHeader } from "@/shared/ui"
import { PageTransition, FadeInUp } from "@/shared/ui/page-transition"
import { DecisionStoryCard } from "@/widgets/dashboard"
import { ResponseCurveGrid } from "@/widgets/charts/ui/response-curve-grid"
import { useLocale } from "@/shared/i18n"
import type { SignalStatus } from "@/shared/api/mock-data"
import {
  mmmChannels,
  mmmVerdict,
  isMmmStale,
  mmmAgeDays,
} from "@/shared/api/mmm-data"

/** Channel-level verdict from its marginal ROAS — drives the DecisionStoryCard "regions" row. */
function deriveChannelStatus(mROAS: number): SignalStatus {
  if (mROAS >= 1.4) return "invest"
  if (mROAS >= 1.0) return "hold"
  return "reduce"
}

function fmtMoney(usd: number): string {
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(1)}M`
  if (usd >= 1_000) return `$${(usd / 1_000).toFixed(0)}K`
  return `$${usd.toFixed(0)}`
}

export default function MmmPage() {
  const { locale } = useLocale()

  const totalSpend = mmmChannels.reduce((sum, c) => sum + c.currentSpend, 0)
  const weightedMROAS =
    mmmChannels.reduce((sum, c) => sum + c.marginal.roas * c.currentSpend, 0) /
    Math.max(1, totalSpend)
  const saturatedCount = mmmChannels.filter((c) => c.marginal.roas < 1.0).length

  const impactText =
    locale === "ko"
      ? `총 spend ${fmtMoney(totalSpend)} · 가중 mROAS ${weightedMROAS.toFixed(2)}× · 포화 ${saturatedCount}/${mmmChannels.length}채널`
      : `Total spend ${fmtMoney(totalSpend)} · Weighted mROAS ${weightedMROAS.toFixed(2)}× · ${saturatedCount}/${mmmChannels.length} saturated`

  const regions = mmmChannels.map((c) => ({
    label: c.label,
    status: deriveChannelStatus(c.marginal.roas),
    reason: `mROAS ${c.marginal.roas.toFixed(2)}× · mCPI $${c.marginal.cpi.toFixed(2)}`,
  }))

  return (
    <PageTransition>
      <FadeInUp className="mb-10">
        <DecisionStoryCard
          status={mmmVerdict.status}
          headline={mmmVerdict.headline[locale]}
          impactText={impactText}
          confidence={Math.round(mmmVerdict.confidence * 100)}
          metrics={mmmVerdict.metrics.map((m) => ({
            label: m.label[locale],
            value: m.value,
          }))}
          regions={regions}
          regionsLabel={locale === "ko" ? "채널별 상태" : "Per-channel status"}
          ctaLabel={locale === "ko" ? "방법론 보기" : "View methodology"}
        />
      </FadeInUp>

      <FadeInUp className="mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <PageHeader titleKey="mmm.title" subtitleKey="mmm.subtitle" />
          {isMmmStale() ? (
            <span className="inline-flex items-center gap-1 rounded-sm border border-[var(--signal-caution)]/40 bg-[var(--signal-caution)]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[var(--signal-caution)]">
              STALE · {mmmAgeDays()}일 경과
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-sm border border-border bg-[var(--bg-2)] px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
              Mock (Phase 1)
            </span>
          )}
        </div>
      </FadeInUp>

      <FadeInUp>
        <ResponseCurveGrid channels={mmmChannels} />
      </FadeInUp>
    </PageTransition>
  )
}
