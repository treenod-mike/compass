"use client"

import { cn } from "@/shared/lib/utils"
import { useLocale } from "@/shared/i18n"
import type { MmmChannel } from "@/shared/api/mmm-data"
import { useSelectedGame } from "@/shared/store/selected-game"
import { useGameSettings } from "@/shared/store/game-settings"
import { lookupCpi } from "@/shared/api/cpi-benchmarks"

type CpiBenchmarkTableProps = {
  channels: readonly MmmChannel[]
}

const CHANNEL_LABEL_KEY = {
  "meta": "mmm.channel.meta",
  "google": "mmm.channel.google",
  "tiktok": "mmm.channel.tiktok",
  "apple-search": "mmm.channel.appleSearch",
} as const

function deviationPct(channelCpi: number, marketCpi: number): number {
  return ((channelCpi - marketCpi) / marketCpi) * 100
}

type Verdict = "expensive" | "close" | "cheap"
function verdictFor(dev: number): Verdict {
  if (dev >= 15) return "expensive"
  if (dev <= -15) return "cheap"
  return "close"
}

const VERDICT_STYLE: Record<Verdict, { dot: string; bg: string; fg: string }> = {
  expensive: { dot: "🔴", bg: "bg-[color-mix(in_srgb,#d22030_14%,transparent)]", fg: "text-[#d22030]" },
  close:     { dot: "🟡", bg: "bg-[color-mix(in_srgb,#fb8800_14%,transparent)]", fg: "text-[#fb8800]" },
  cheap:     { dot: "🟢", bg: "bg-[color-mix(in_srgb,#02a262_14%,transparent)]", fg: "text-[#02a262]" },
}

const VERDICT_LABEL_KEY: Record<Verdict, "mmm.benchmark.verdict.expensive" | "mmm.benchmark.verdict.close" | "mmm.benchmark.verdict.cheap"> = {
  expensive: "mmm.benchmark.verdict.expensive",
  close: "mmm.benchmark.verdict.close",
  cheap: "mmm.benchmark.verdict.cheap",
}

export function CpiBenchmarkTable({ channels }: CpiBenchmarkTableProps) {
  const { t } = useLocale()
  const gameId = useSelectedGame((s) => s.gameId)
  const settings = useGameSettings((s) => s.settings[gameId])

  // LevelPlay benchmark is per (game genre × country), not per channel.
  // All channels compare against the same market median for this game's market.
  // Platform fixed to "ios" for Phase 2 (channels don't carry platform info yet).
  const marketCpi = settings ? lookupCpi(settings.country, settings.genre, "ios") : null

  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--bg-1)] p-4 h-full flex flex-col">
      <div className="overflow-auto flex-1">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs font-bold text-[var(--fg-2)] border-b border-[var(--border-default)]">
              <th className="text-left px-2 py-2">{t("mmm.benchmark.table.headers.channel")}</th>
              <th className="text-right px-2 py-2">{t("mmm.benchmark.table.headers.us")}</th>
              <th className="text-right px-2 py-2">{t("mmm.benchmark.table.headers.market")}</th>
              <th className="text-right px-2 py-2">{t("mmm.benchmark.table.headers.deviation")}</th>
              <th className="text-right px-2 py-2">{t("mmm.benchmark.table.headers.verdict")}</th>
            </tr>
          </thead>
          <tbody>
            {channels.map((c) => {
              if (marketCpi == null) {
                return (
                  <tr key={c.key} className="border-b border-[var(--border-default)]/40">
                    <td className="px-2 py-2 text-[var(--fg-0)] font-medium">
                      {t(CHANNEL_LABEL_KEY[c.key])}
                    </td>
                    <td className="px-2 py-2 text-right text-[var(--fg-1)]" style={{ fontVariantNumeric: "tabular-nums" }}>
                      ${c.marginal.cpi.toFixed(2)}
                    </td>
                    <td className="px-2 py-2 text-right text-[var(--fg-3)]" colSpan={3}>
                      {t("mmm.benchmarkNoData")}
                    </td>
                  </tr>
                )
              }
              const dev = deviationPct(c.marginal.cpi, marketCpi)
              const v = verdictFor(dev)
              const style = VERDICT_STYLE[v]
              const roundedDev = Math.abs(dev) < 0.5 ? 0 : Math.round(dev)
              return (
                <tr key={c.key} className="border-b border-[var(--border-default)]/40">
                  <td className="px-2 py-2 text-[var(--fg-0)] font-medium">
                    {t(CHANNEL_LABEL_KEY[c.key])}
                  </td>
                  <td className="px-2 py-2 text-right text-[var(--fg-1)]" style={{ fontVariantNumeric: "tabular-nums" }}>
                    ${c.marginal.cpi.toFixed(2)}
                  </td>
                  <td className="px-2 py-2 text-right text-[var(--fg-2)]" style={{ fontVariantNumeric: "tabular-nums" }}>
                    ${marketCpi.toFixed(2)}
                  </td>
                  <td className="px-2 py-2 text-right" style={{ fontVariantNumeric: "tabular-nums" }}>
                    <span className={roundedDev > 0 ? "text-[#fb8800]" : roundedDev < 0 ? "text-[#02a262]" : "text-[var(--fg-2)]"}>
                      {roundedDev > 0 ? "+" : ""}{roundedDev}%
                    </span>
                  </td>
                  <td className="px-2 py-2 text-right">
                    <span className={cn("inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] font-semibold", style.bg, style.fg)}>
                      {style.dot} {t(VERDICT_LABEL_KEY[v])}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-[var(--fg-3)] mt-3 italic">
        {t("mmm.benchmark.source")}
      </p>
    </div>
  )
}
