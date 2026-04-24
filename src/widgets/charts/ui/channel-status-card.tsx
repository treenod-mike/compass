"use client"

import { motion } from "framer-motion"
import { MMM_COLORS, PALETTE } from "@/shared/config/chart-colors"
import { useLocale } from "@/shared/i18n"
import { cn } from "@/shared/lib/utils"
import type { MmmChannel } from "@/shared/api/mmm-data"

type ChannelStatusCardProps = {
  channel: MmmChannel
  onClick: () => void
}

const CHANNEL_LABEL_KEY = {
  "meta": "mmm.channel.meta",
  "google": "mmm.channel.google",
  "tiktok": "mmm.channel.tiktok",
  "apple-search": "mmm.channel.appleSearch",
} as const

type Tier = "low" | "medium" | "high"
function saturationTier(pct: number): Tier {
  if (pct < 33) return "low"
  if (pct < 66) return "medium"
  return "high"
}

const TIER_BADGE: Record<Tier, { dot: string; bg: string; fg: string }> = {
  low:    { dot: "🟢", bg: "bg-[color-mix(in_srgb,#02a262_14%,transparent)]", fg: "text-[#02a262]" },
  medium: { dot: "🟡", bg: "bg-[color-mix(in_srgb,#fb8800_14%,transparent)]", fg: "text-[#fb8800]" },
  high:   { dot: "🔴", bg: "bg-[color-mix(in_srgb,#d22030_14%,transparent)]", fg: "text-[#d22030]" },
}

const BADGE_LABEL_KEY: Record<Tier, "mmm.channel.badge.low" | "mmm.channel.badge.medium" | "mmm.channel.badge.high"> = {
  low: "mmm.channel.badge.low",
  medium: "mmm.channel.badge.medium",
  high: "mmm.channel.badge.high",
}

function fmtSignedMoney(usd: number, locale: "ko" | "en"): string {
  if (usd === 0) return locale === "ko" ? "유지" : "Hold"
  const abs = Math.abs(usd)
  const k = abs >= 1000 ? `${Math.round(abs / 1000)}K` : String(abs)
  const sign = usd > 0 ? "+" : "-"
  const verb = locale === "ko" ? (usd > 0 ? "증액" : "축소") : (usd > 0 ? "Increase" : "Decrease")
  return `${sign}$${k} ${verb}`
}

export function ChannelStatusCard({ channel, onClick }: ChannelStatusCardProps) {
  const { t, locale } = useLocale()
  const saturationPct = Math.min(
    100,
    Math.round((channel.currentSpend / (channel.saturation.halfSaturation * 2)) * 100),
  )
  const tier = saturationTier(saturationPct)
  const badge = TIER_BADGE[tier]
  const channelColor = MMM_COLORS.channels[channel.key].line

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      className="text-left rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--bg-1)] p-4 h-full flex flex-col gap-3 transition-colors hover:border-[var(--brand)]"
    >
      {/* Header — channel label + tier badge */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-[var(--fg-0)]">
          {t(CHANNEL_LABEL_KEY[channel.key])}
        </h4>
        <span className={cn("inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] font-semibold", badge.bg, badge.fg)}>
          {badge.dot} {t(BADGE_LABEL_KEY[tier])}
        </span>
      </div>

      {/* mCPI — large */}
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--fg-2)]">
          {t("mmm.metric.mCPI")}
        </div>
        <div
          className="text-2xl font-extrabold text-[var(--fg-0)]"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          ${channel.marginal.cpi.toFixed(2)}
        </div>
      </div>

      {/* Saturation mini bar */}
      <div>
        <div className="flex justify-between items-center text-[10px] text-[var(--fg-2)] mb-1">
          <span>{t("mmm.metric.saturation")}</span>
          <span style={{ fontVariantNumeric: "tabular-nums" }}>{saturationPct}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-[var(--bg-2)] overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{ width: `${saturationPct}%`, backgroundColor: channelColor }}
          />
        </div>
      </div>

      {/* MMP vs MMM bias label */}
      <div className="text-[10px] text-[var(--fg-2)] leading-relaxed">
        <div className="flex justify-between">
          <span>{t("mmm.channel.mmp.label")}</span>
          <span style={{ fontVariantNumeric: "tabular-nums" }}>
            {channel.mmpComparison.mmpInstalls.toLocaleString()}
          </span>
        </div>
        <div className="flex justify-between">
          <span>{t("mmm.channel.mmm.label")}</span>
          <span style={{ fontVariantNumeric: "tabular-nums" }}>
            {channel.mmpComparison.mmmInstalls.toLocaleString()}{" "}
            <span className={Math.abs(channel.mmpComparison.biasDeltaPct) > 15 ? "text-[var(--signal-caution)]" : ""}>
              ({channel.mmpComparison.biasDeltaPct > 0 ? "+" : ""}
              {channel.mmpComparison.biasDeltaPct.toFixed(0)}%)
            </span>
          </span>
        </div>
      </div>

      {/* Recommendation action */}
      <div
        className="mt-auto pt-2 border-t border-[var(--border-default)] text-sm font-bold"
        style={{
          color:
            channel.recommendation.action === "increase"
              ? PALETTE.positive
              : channel.recommendation.action === "decrease"
              ? PALETTE.risk
              : PALETTE.fg2,
        }}
      >
        {fmtSignedMoney(channel.recommendation.deltaSpend, locale)}
      </div>
    </motion.button>
  )
}
