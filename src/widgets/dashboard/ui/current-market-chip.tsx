"use client"

/**
 * CurrentMarketChip — read-only display of the active (country, genre) market for a game,
 * with a stale-data warning badge and an Edit button that opens GameSettingsModal.
 *
 * Hydration safety: `isBenchmarkStale()` and `benchmarkAgeDays()` depend on `new Date()`,
 * which would diverge between SSR and client render. Gating those reads behind a `mounted`
 * flag (false on SSR, flips true after `useEffect`) keeps the first client paint identical
 * to the server output, then upgrades to the time-aware version on the next tick. Same
 * pattern as `mmm/page.tsx`.
 *
 * Hidden cases:
 *  - `gameId === "portfolio"` — portfolio view has no per-title market settings
 *  - `settings` undefined — Zustand persist uses `skipHydration: true`, so the per-game
 *    record may be absent until the client rehydrates
 */
import { useEffect, useState } from "react"
import { Icon as Iconify } from "@iconify/react"
import { useLocale, type TranslationKey } from "@/shared/i18n"
import { useSelectedGame } from "@/shared/store/selected-game"
import { useGameSettings } from "@/shared/store/game-settings"
import { isBenchmarkStale, benchmarkAgeDays } from "@/shared/api/cpi-benchmarks"
import { GameSettingsModal } from "@/widgets/app-shell/ui/game-settings-modal"

interface CurrentMarketChipProps {
  gameLabel: string
}

export function CurrentMarketChip({ gameLabel }: CurrentMarketChipProps) {
  const { t } = useLocale()
  const gameId = useSelectedGame((s) => s.gameId)
  const settings = useGameSettings((s) => s.settings[gameId])
  const [modalOpen, setModalOpen] = useState(false)

  // Gate time-based rendering to client to avoid hydration mismatch.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  if (gameId === "portfolio" || !settings) return null

  const countryLabel = t(`settings.country.${settings.country}` as TranslationKey)
  const genreLabel = t(`settings.genre.${settings.genre}` as TranslationKey)
  const stale = mounted && isBenchmarkStale()
  const ageDays = mounted ? benchmarkAgeDays() : 0

  return (
    <>
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-[var(--radius-inline)] bg-[var(--bg-2)] border border-[var(--border-default)] text-xs">
        <span className="text-[var(--fg-2)]">{t("mmm.currentMarket")}:</span>
        <span className="font-semibold text-[var(--fg-0)]">
          {countryLabel} × {genreLabel}
        </span>
        {stale && (
          <span
            title={t("mmm.benchmarkStale").replace("{days}", String(ageDays))}
            className="inline-flex items-center text-[var(--signal-caution)]"
          >
            <Iconify icon="solar:danger-triangle-bold" width={14} />
          </span>
        )}
        <button
          onClick={() => setModalOpen(true)}
          className="text-[var(--brand)] hover:underline text-xs"
        >
          {t("mmm.edit")}
        </button>
      </div>

      <GameSettingsModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        gameId={gameId}
        gameLabel={gameLabel}
      />
    </>
  )
}
