import type { Offer } from "./types"

export const PRESETS: Record<"conservative" | "standard" | "aggressive", Offer> = {
  conservative: {
    investmentUsd: 2_000_000,
    postMoneyUsd: 10_000_000,
    exitMultiple: 2,
    hurdleRate: 0.25,
    uaSharePct: 60,
    horizonMonths: 36,
  },
  standard: {
    investmentUsd: 3_000_000,
    postMoneyUsd: 15_000_000,
    exitMultiple: 3,
    hurdleRate: 0.2,
    uaSharePct: 60,
    horizonMonths: 36,
  },
  aggressive: {
    investmentUsd: 5_000_000,
    postMoneyUsd: 25_000_000,
    exitMultiple: 5,
    hurdleRate: 0.15,
    uaSharePct: 70,
    horizonMonths: 36,
  },
}

export const DEFAULT_OFFER: Offer = PRESETS.standard

export const MONTE_CARLO_SAMPLES = 2_000
export const IRR_MAX_ITER = 50
export const IRR_TOL = 1e-6
export const LSTM_STALE_DAYS = 30
