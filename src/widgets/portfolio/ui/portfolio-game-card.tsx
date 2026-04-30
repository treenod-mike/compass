"use client"

import { useRouter } from "next/navigation"
import { ArrowRight } from "lucide-react"
import { useLocale } from "@/shared/i18n"
import { useSelectedGame } from "@/shared/store/selected-game"
import type { TitleHealthRow } from "@/shared/api/mock-data"
import { clsx } from "clsx"

type Props = {
  row: TitleHealthRow
}

export function PortfolioGameCard({ row }: Props) {
  const { t } = useLocale()
  const router = useRouter()
  const { setGameId } = useSelectedGame()

  const handleOpen = () => {
    setGameId(row.gameId)
    router.push("/dashboard")
  }

  const signalTone =
    row.signal === "invest"
      ? "text-[var(--signal-positive)] bg-[var(--signal-positive)]/10"
      : row.signal === "hold"
        ? "text-[var(--signal-caution)] bg-[var(--signal-caution)]/10"
        : row.signal === "reduce"
          ? "text-[var(--signal-risk)] bg-[var(--signal-risk)]/10"
          : "text-muted-foreground bg-muted"

  return (
    <div className="rounded-[var(--radius-card)] border border-border bg-card p-5 flex flex-col gap-4 hover:border-primary transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-foreground">{row.label}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{row.genre}</p>
        </div>
        <span
          className={clsx(
            "text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-[var(--radius-inline)]",
            signalTone,
          )}
        >
          {t(`portfolio.signal.${row.signal}` as Parameters<typeof t>[0])}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3 text-xs">
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-[10px] uppercase tracking-wider">ROAS</span>
          <span className="font-mono tabular-nums text-foreground font-semibold">{row.roas}%</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-[10px] uppercase tracking-wider">
            {t("portfolio.kpi.payback")}
          </span>
          <span className="font-mono tabular-nums text-foreground font-semibold">{row.paybackD}d</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-[10px] uppercase tracking-wider">
            {t("portfolio.kpi.confidence")}
          </span>
          <span className="font-mono tabular-nums text-foreground font-semibold">{row.confidence}%</span>
        </div>
      </div>

      <button
        type="button"
        onClick={handleOpen}
        className="mt-2 w-full inline-flex items-center justify-between rounded-[var(--radius-card)] border border-border bg-[var(--bg-2)] px-4 py-2.5 text-sm font-semibold text-foreground hover:border-primary hover:bg-[var(--bg-3)] transition-colors"
      >
        <span>{t("portfolio.openInSimulator")}</span>
        <ArrowRight className="size-4 text-muted-foreground" />
      </button>
    </div>
  )
}
