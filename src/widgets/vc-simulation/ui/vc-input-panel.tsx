"use client"

import { useState } from "react"
import type { Offer } from "@/shared/api/vc-simulation"
import { DEFAULT_OFFER } from "@/shared/api/vc-simulation"
import { OfferFields } from "./offer-fields"
import { DerivedStats } from "./derived-stats"

type Props = { initial?: Offer; onChange: (o: Offer) => void }

export function VcInputPanel({ initial = DEFAULT_OFFER, onChange }: Props) {
  const [offer, setOffer] = useState<Offer>(initial)
  const patch = (p: Partial<Offer>) => {
    const next = { ...offer, ...p }
    setOffer(next)
    onChange(next)
  }
  return (
    <div className="sticky top-[80px] h-fit border border-[var(--bg-4)] rounded-[var(--radius-card)] p-5 bg-[var(--bg-1)]">
      <OfferFields offer={offer} onChange={patch} />
      <DerivedStats offer={offer} />
    </div>
  )
}
