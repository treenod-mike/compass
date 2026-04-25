import type { Offer } from "./types"
import { DEFAULT_OFFER } from "./defaults"

type PrefillInput = {
  gameId: string
  appsflyerSnapshot: { totalCostUsd: number; uaCostUsd: number } | null
}

export function prefillOffer(input: PrefillInput): Offer {
  const base = { ...DEFAULT_OFFER }

  if (input.appsflyerSnapshot && input.appsflyerSnapshot.totalCostUsd > 0) {
    const raw = (input.appsflyerSnapshot.uaCostUsd / input.appsflyerSnapshot.totalCostUsd) * 100
    base.uaSharePct = Math.max(0, Math.min(100, raw))
  }

  return base
}
