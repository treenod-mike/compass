import type { Offer, LstmSnapshot } from "@/shared/api/vc-simulation"
import { computeVcSimulation } from "@/shared/api/vc-simulation"

/**
 * Lever sweep helpers for the VC insights panel.
 *
 * All functions call the pure computeVcSimulation directly (no React hooks),
 * so they can be invoked many times inside a single useMemo. Each simulation
 * runs ~2000 Monte Carlo samples × 2 baselines × 12 months — ~50ms each on
 * current laptops. The panel does ≤8 sweeps per memo, well within the 500ms
 * budget specified in the design doc.
 */

export type SimContext = {
  gameId: string
  lstmSnapshot: LstmSnapshot
  appsflyerInitialCash: number
  bayesianDeltaLtv: number | null
}

function runSim(offer: Offer, ctx: SimContext) {
  return computeVcSimulation(offer, {
    gameId: ctx.gameId,
    lstmSnapshot: ctx.lstmSnapshot,
    bayesianPosterior:
      ctx.bayesianDeltaLtv != null ? { deltaLtv: ctx.bayesianDeltaLtv } : null,
    appsflyerInitialCash: ctx.appsflyerInitialCash,
  })
}

export type LeverKey =
  | "uaSharePct"
  | "horizonMonths"
  | "deltaLtv"
  | "investmentUsd"
  | "hurdleRate"

export type LeverImpact = {
  leverKey: LeverKey
  baseBep: number | null
  /** ΔBEP when the lever is swung up. null if the perturbed sim misses BEP. */
  bepDeltaUp: number | null
  bepDeltaDown: number | null
  /** True when both deltas are 0 — lever provably does not move BEP. */
  invariant: boolean
}

/**
 * Tornado: every lever swung ±swing once and the resulting BEP delta.
 * BEP-invariant levers are explicitly returned (not filtered) so the UI
 * can show "no impact" callouts.
 */
export function tornadoSensitivity(baseOffer: Offer, ctx: SimContext): LeverImpact[] {
  const baseBep = runSim(baseOffer, ctx).baselineB.paybackMonths

  const offerSweeps: { key: LeverKey; up: Offer; down: Offer }[] = [
    {
      key: "uaSharePct",
      up: { ...baseOffer, uaSharePct: Math.min(100, baseOffer.uaSharePct + 20) },
      down: { ...baseOffer, uaSharePct: Math.max(0, baseOffer.uaSharePct - 20) },
    },
    {
      key: "horizonMonths",
      up: { ...baseOffer, horizonMonths: Math.min(60, baseOffer.horizonMonths + 6) },
      down: { ...baseOffer, horizonMonths: Math.max(12, baseOffer.horizonMonths - 6) },
    },
    {
      key: "investmentUsd",
      up: { ...baseOffer, investmentUsd: baseOffer.investmentUsd * 1.2 },
      down: { ...baseOffer, investmentUsd: baseOffer.investmentUsd * 0.8 },
    },
    {
      key: "hurdleRate",
      up: { ...baseOffer, hurdleRate: Math.min(2, baseOffer.hurdleRate + 0.05) },
      down: { ...baseOffer, hurdleRate: Math.max(0, baseOffer.hurdleRate - 0.05) },
    },
  ]

  const impacts: LeverImpact[] = offerSweeps.map(({ key, up, down }) => {
    const upBep = runSim(up, ctx).baselineB.paybackMonths
    const downBep = runSim(down, ctx).baselineB.paybackMonths
    const bepDeltaUp = upBep != null && baseBep != null ? upBep - baseBep : null
    const bepDeltaDown = downBep != null && baseBep != null ? downBep - baseBep : null
    const invariant = bepDeltaUp === 0 && bepDeltaDown === 0
    return { leverKey: key, baseBep, bepDeltaUp, bepDeltaDown, invariant }
  })

  // deltaLtv (실험) — context-level lever
  const baseLtv = ctx.bayesianDeltaLtv ?? 0
  const upLtv = Math.min(1, baseLtv + 0.2)
  const downLtv = Math.max(0, baseLtv - 0.2)
  const upLtvBep = runSim(baseOffer, { ...ctx, bayesianDeltaLtv: upLtv }).baselineB.paybackMonths
  const downLtvBep =
    runSim(baseOffer, { ...ctx, bayesianDeltaLtv: downLtv }).baselineB.paybackMonths
  const ltvDeltaUp = upLtvBep != null && baseBep != null ? upLtvBep - baseBep : null
  const ltvDeltaDown = downLtvBep != null && baseBep != null ? downLtvBep - baseBep : null
  impacts.push({
    leverKey: "deltaLtv",
    baseBep,
    bepDeltaUp: ltvDeltaUp,
    bepDeltaDown: ltvDeltaDown,
    invariant: ltvDeltaUp === 0 && ltvDeltaDown === 0,
  })

  return impacts
}

export type IfThenScenario = {
  leverKey: LeverKey
  newValueLabel: string
  newBep: number | null
  /** Months delta vs. base BEP. negative = shorter (good), positive = longer. */
  delta: number | null
}

/**
 * Top-3 If/Then scenarios: each lever moved by a deterministic step and the
 * resulting BEP. The lever choices are fixed (not data-driven) — the panel
 * shows the same three lever scenarios every render, varying only in their
 * computed outcomes.
 */
export function buildIfThenScenarios(baseOffer: Offer, ctx: SimContext): IfThenScenario[] {
  const baseBep = runSim(baseOffer, ctx).baselineB.paybackMonths

  const ua = { ...baseOffer, uaSharePct: Math.min(100, baseOffer.uaSharePct + 10) }
  const uaBep = runSim(ua, ctx).baselineB.paybackMonths

  const hz = { ...baseOffer, horizonMonths: 18 }
  const hzBep = runSim(hz, ctx).baselineB.paybackMonths

  const ltvBep = runSim(baseOffer, { ...ctx, bayesianDeltaLtv: 0.3 }).baselineB.paybackMonths

  const delta = (newBep: number | null) =>
    newBep != null && baseBep != null ? newBep - baseBep : null

  return [
    { leverKey: "uaSharePct", newValueLabel: `${ua.uaSharePct}%`, newBep: uaBep, delta: delta(uaBep) },
    { leverKey: "horizonMonths", newValueLabel: "18mo", newBep: hzBep, delta: delta(hzBep) },
    { leverKey: "deltaLtv", newValueLabel: "+30%", newBep: ltvBep, delta: delta(ltvBep) },
  ]
}

/**
 * Smallest uaSharePct (5% step) at which BEP arrives within horizon.
 * Returns null if no value in [10, 100] satisfies it.
 */
export function findUaShareThresholdForBep(
  baseOffer: Offer,
  ctx: SimContext,
): number | null {
  for (let pct = 10; pct <= 100; pct += 5) {
    const r = runSim({ ...baseOffer, uaSharePct: pct }, ctx)
    if (r.baselineB.paybackMonths != null) return pct
  }
  return null
}
