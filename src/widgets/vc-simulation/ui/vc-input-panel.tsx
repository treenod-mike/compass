"use client"

import { useState } from "react"
import type { Offer } from "@/shared/api/vc-simulation"
import { DEFAULT_OFFER, PRESETS } from "@/shared/api/vc-simulation"
import { PresetTabs } from "./preset-tabs"
import { OfferFields } from "./offer-fields"
import { FundAllocationSlider } from "./fund-allocation-slider"
import { HorizonSlider } from "./horizon-slider"
import { DerivedStats } from "./derived-stats"

type Props = { initial?: Offer; onChange: (o: Offer) => void }

export function VcInputPanel({ initial = DEFAULT_OFFER, onChange }: Props) {
  const [offer, setOffer] = useState<Offer>(initial)
  const [activePreset, setActivePreset] = useState<keyof typeof PRESETS>("standard")

  const patch = (p: Partial<Offer>) => {
    const next = { ...offer, ...p }
    setOffer(next)
    onChange(next)
  }

  const applyPreset = (preset: Offer, key: keyof typeof PRESETS) => {
    setOffer(preset)
    setActivePreset(key)
    onChange(preset)
  }

  return (
    <div className="sticky top-[80px] h-fit rounded-2xl border border-border bg-card p-5">
      <PresetTabs
        active={activePreset}
        onSelect={(preset) => {
          const entry = Object.entries(PRESETS).find(([, p]) => p === preset)
          if (entry) applyPreset(preset, entry[0] as keyof typeof PRESETS)
        }}
      />
      <OfferFields offer={offer} onChange={patch} />
      <div className="mt-4 space-y-4">
        <FundAllocationSlider uaSharePct={offer.uaSharePct} onChange={(v) => patch({ uaSharePct: v })} />
        <HorizonSlider months={offer.horizonMonths} onChange={(v) => patch({ horizonMonths: v })} />
      </div>
      <DerivedStats offer={offer} />
    </div>
  )
}
