"use client"

import { useSelectedGame } from "@/shared/store/selected-game"
import { PageHeader } from "@/shared/ui"
import { PageTransition, FadeInUp } from "@/shared/ui/page-transition"

export default function VcSimulationPage() {
  const { gameId } = useSelectedGame()

  return (
    <PageTransition>
      <div className="px-10 pt-6 pb-24">
        <FadeInUp>
          <PageHeader titleKey="vc.page.title" subtitleKey="vc.page.subtitle" />
        </FadeInUp>
        <FadeInUp>
          <div className="mt-6 grid grid-cols-[360px_1fr] gap-6">
            <div className="sticky top-[80px] h-fit border border-[var(--bg-4)] rounded-[var(--radius-card)] p-5">
              <p className="text-sm text-[var(--fg-2)]">Input panel placeholder</p>
              <p className="text-xs text-[var(--fg-3)] mt-2">selected: {gameId}</p>
            </div>
            <div>
              <p className="text-sm text-[var(--fg-2)]">Result board placeholder</p>
            </div>
          </div>
        </FadeInUp>
      </div>
    </PageTransition>
  )
}
