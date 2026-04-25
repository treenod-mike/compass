"use client"

import { useState, useEffect } from "react"
import * as Dialog from "@radix-ui/react-dialog"
import { useLocale } from "@/shared/i18n"
import type { TranslationKey } from "@/shared/i18n"
import { useGameSettings, type GameSettings } from "@/shared/store/game-settings"
import type { CountryCode, Genre } from "@/shared/api/cpi-benchmarks"

const COUNTRIES = ["JP", "US", "KR", "DE", "GB"] as const satisfies readonly CountryCode[]
const GENRES = ["merge", "puzzle", "rpg", "casual", "strategy", "idle"] as const satisfies readonly Genre[]

interface GameSettingsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  gameId: string
  gameLabel: string
}

export function GameSettingsModal({ open, onOpenChange, gameId, gameLabel }: GameSettingsModalProps) {
  const { t } = useLocale()
  const current = useGameSettings((s) => s.settings[gameId])
  const updateSettings = useGameSettings((s) => s.updateSettings)

  const [draft, setDraft] = useState<GameSettings>(
    current ?? { country: "JP", genre: "merge" },
  )

  useEffect(() => {
    if (open && current) setDraft(current)
  }, [open, current])

  const onSave = () => {
    updateSettings(gameId, draft)
    onOpenChange(false)
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[420px] rounded-[var(--radius-modal)] bg-[var(--bg-1)] border border-[var(--border-default)] p-6 shadow-xl">
          <Dialog.Title className="text-sm font-bold text-[var(--fg-0)] mb-4">
            {t("settings.modalTitle")} — {gameLabel}
          </Dialog.Title>

          <div className="space-y-4">
            <div>
              <label className="block text-xs text-[var(--fg-2)] mb-1">{t("settings.country")}</label>
              <select
                value={draft.country}
                onChange={(e) => setDraft({ ...draft, country: e.target.value as CountryCode })}
                className="w-full px-3 py-2 rounded-[var(--radius-inline)] bg-[var(--bg-2)] border border-[var(--border-default)] text-sm"
              >
                {COUNTRIES.map((c) => (
                  <option key={c} value={c}>{t(`settings.country.${c}` as TranslationKey)}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-[var(--fg-2)] mb-1">{t("settings.genre")}</label>
              <select
                value={draft.genre}
                onChange={(e) => setDraft({ ...draft, genre: e.target.value as Genre })}
                className="w-full px-3 py-2 rounded-[var(--radius-inline)] bg-[var(--bg-2)] border border-[var(--border-default)] text-sm"
              >
                {GENRES.map((g) => (
                  <option key={g} value={g}>{t(`settings.genre.${g}` as TranslationKey)}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <Dialog.Close asChild>
              <button className="px-3 py-1.5 text-sm text-[var(--fg-1)] rounded-[var(--radius-inline)] hover:bg-[var(--bg-3)]">
                {t("settings.cancel")}
              </button>
            </Dialog.Close>
            <button
              onClick={onSave}
              className="px-3 py-1.5 text-sm bg-[var(--brand)] text-white rounded-[var(--radius-inline)] hover:opacity-90"
            >
              {t("settings.save")}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
