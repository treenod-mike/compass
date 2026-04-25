"use client"

import { useState } from "react"
import { useSelectedGame } from "@/shared/store/selected-game"
import { PageHeader } from "@/shared/ui"
import { PageTransition, FadeInUp } from "@/shared/ui/page-transition"
import { VcInputPanel } from "@/widgets/vc-simulation"
import { DEFAULT_OFFER, type Offer } from "@/shared/api/vc-simulation"

export default function VcSimulationPage() {
  const { gameId } = useSelectedGame()
  const [offer, setOffer] = useState<Offer>(DEFAULT_OFFER)

  return (
    <PageTransition>
      <div className="px-10 pt-6 pb-24">
        <FadeInUp>
          <PageHeader titleKey="vc.page.title" subtitleKey="vc.page.subtitle" />
        </FadeInUp>
        <FadeInUp>
          <div className="mt-6 grid grid-cols-[360px_1fr] gap-6">
            <VcInputPanel onChange={setOffer} />
            <div>
              <p className="text-sm text-[var(--fg-2)]">Result board placeholder</p>
              <p className="text-xs text-[var(--fg-3)] mt-2">
                selected: {gameId} · offer.investment: ${(offer.investmentUsd / 1e6).toFixed(1)}M
              </p>
            </div>
          </div>
        </FadeInUp>
      </div>
    </PageTransition>
  )
}
