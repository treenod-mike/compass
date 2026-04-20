"use client"

import { Icon as Iconify } from "@iconify/react"
import gamepadBold from "@iconify-icons/solar/gamepad-bold"
import altArrowDownBold from "@iconify-icons/solar/alt-arrow-down-bold"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select"
import { useSelectedGame, PORTFOLIO_ID } from "@/shared/store/selected-game"

const GAMES: { id: string; label: string }[] = [
  { id: PORTFOLIO_ID, label: "전체 포트폴리오" },
  { id: "poco", label: "포코머지" },
  { id: "game1", label: "게임 1" },
  { id: "game2", label: "게임 2" },
]

export function GameSelector() {
  const gameId = useSelectedGame((s) => s.gameId)
  const setGameId = useSelectedGame((s) => s.setGameId)

  return (
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
      <SelectContent>
        {GAMES.map((g) => (
          <SelectItem key={g.id} value={g.id}>
            {g.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
