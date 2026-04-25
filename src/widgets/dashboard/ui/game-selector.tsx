"use client"

import { useState } from "react"
import { Icon as Iconify } from "@iconify/react"
import gamepadBold from "@iconify-icons/solar/gamepad-bold"
import altArrowDownBold from "@iconify-icons/solar/alt-arrow-down-bold"
import settingsBold from "@iconify-icons/solar/settings-bold"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select"
import { useSelectedGame, PORTFOLIO_ID } from "@/shared/store/selected-game"
import { useLocale } from "@/shared/i18n"
import { GameSettingsModal } from "@/widgets/app-shell/ui/game-settings-modal"

const GAMES: { id: string; label: string }[] = [
  { id: PORTFOLIO_ID, label: "전체 포트폴리오" },
  { id: "poco", label: "포코머지" },
]

export function GameSelector() {
  const { t } = useLocale()
  const gameId = useSelectedGame((s) => s.gameId)
  const setGameId = useSelectedGame((s) => s.setGameId)
  const [modalOpen, setModalOpen] = useState(false)
  const current = GAMES.find((g) => g.id === gameId) ?? GAMES[0]

  return (
    <div className="flex items-center gap-1.5">
      <Select
        value={gameId}
        onValueChange={(value) => {
          if (value != null) setGameId(value)
        }}
      >
        <SelectTrigger className="h-10 rounded-full border border-border bg-card hover:border-primary transition-colors pl-3 pr-3 gap-2 w-[200px] text-sm font-semibold">
          <Iconify icon={gamepadBold} width={16} height={16} className="text-primary" />
          <SelectValue />
          <Iconify icon={altArrowDownBold} width={14} height={14} className="text-muted-foreground ml-auto" />
        </SelectTrigger>
        <SelectContent
          alignItemWithTrigger={false}
          side="bottom"
          sideOffset={6}
          align="start"
        >
          {GAMES.map((g) => (
            <SelectItem key={g.id} value={g.id}>
              {g.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {gameId !== PORTFOLIO_ID && (
        <>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            title={t("settings.modalTitle")}
            aria-label={t("settings.modalTitle")}
            className="p-1 rounded-[var(--radius-inline)] text-[var(--fg-2)] hover:bg-[var(--bg-3)] hover:text-[var(--fg-0)] transition-colors"
          >
            <Iconify icon={settingsBold} width={16} height={16} />
          </button>
          <GameSettingsModal
            open={modalOpen}
            onOpenChange={setModalOpen}
            gameId={gameId}
            gameLabel={current.label}
          />
        </>
      )}
    </div>
  )
}
