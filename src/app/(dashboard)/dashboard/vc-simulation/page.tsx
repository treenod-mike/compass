"use client"

import { useState } from "react"
import { useSelectedGame } from "@/shared/store/selected-game"
import { PageHeader } from "@/shared/ui"
import { PageTransition, FadeInUp } from "@/shared/ui/page-transition"
import { VcInputPanel, VcResultBoard } from "@/widgets/vc-simulation"
import { DEFAULT_OFFER, useVcSimulation, type Offer } from "@/shared/api/vc-simulation"

export default function VcSimulationPage() {
  const { gameId } = useSelectedGame()
  const [offer, setOffer] = useState<Offer>(DEFAULT_OFFER)
  const result = useVcSimulation({
    gameId,
    offer,
    appsflyerInitialCash: 500_000,
    bayesianDeltaLtv: 0.15,
  })

  return (
    <PageTransition>
      <div className="px-10 pt-6 pb-24">
        <FadeInUp>
          <PageHeader titleKey="vc.page.title" subtitleKey="vc.page.subtitle" />
        </FadeInUp>
        <FadeInUp>
          <div className="mt-6 grid grid-cols-[360px_1fr] gap-6">
            <VcInputPanel onChange={setOffer} />
            <VcResultBoard result={result} />
          </div>
        </FadeInUp>
      </div>
    </PageTransition>
  )
}
