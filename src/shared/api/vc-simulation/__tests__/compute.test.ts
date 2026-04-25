import { test } from "node:test"
import assert from "node:assert/strict"
import { computeVcSimulation, makeSeededRng } from "../compute"
import { DEFAULT_OFFER } from "../defaults"
import type { LstmSnapshot } from "../types"
import { readFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))

const LSTM_VALID: LstmSnapshot = JSON.parse(
  readFileSync(join(__dirname, "fixtures/lstm.valid.json"), "utf-8")
)

const SOURCES = {
  gameId: "test_game",
  lstmSnapshot: LSTM_VALID,
  bayesianPosterior: null,
  appsflyerInitialCash: 500_000,
}

test("seeded RNG is deterministic", () => {
  const a = makeSeededRng("abc")
  const b = makeSeededRng("abc")
  assert.equal(a(), b())
  assert.equal(a(), b())
})

test("compute returns same P50 IRR for same offer + sources", () => {
  const r1 = computeVcSimulation(DEFAULT_OFFER, SOURCES)
  const r2 = computeVcSimulation(DEFAULT_OFFER, SOURCES)
  assert.equal(r1.baselineA.p50Irr, r2.baselineA.p50Irr)
})

test("runway has horizon+1 months (month 0..horizon)", () => {
  const r = computeVcSimulation(DEFAULT_OFFER, SOURCES)
  assert.equal(r.baselineA.runway.length, DEFAULT_OFFER.horizonMonths + 1)
})

test("runway P10 <= P50 <= P90 at each month", () => {
  const r = computeVcSimulation(DEFAULT_OFFER, SOURCES)
  for (const pt of r.baselineA.runway) {
    assert.ok(pt.p10 <= pt.p50, `month ${pt.month}: p10 ${pt.p10} > p50 ${pt.p50}`)
    assert.ok(pt.p50 <= pt.p90, `month ${pt.month}: p50 ${pt.p50} > p90 ${pt.p90}`)
  }
})

test("higher UA share → shorter payback (typically)", () => {
  const low = computeVcSimulation({ ...DEFAULT_OFFER, uaSharePct: 40 }, SOURCES)
  const high = computeVcSimulation({ ...DEFAULT_OFFER, uaSharePct: 80 }, SOURCES)
  if (low.baselineA.paybackMonths != null && high.baselineA.paybackMonths != null) {
    assert.ok(
      high.baselineA.paybackMonths <= low.baselineA.paybackMonths,
      `high UA payback ${high.baselineA.paybackMonths} should be ≤ low UA ${low.baselineA.paybackMonths}`
    )
  }
})

test("positive experiment delta → baselineB p50 IRR >= baselineA (장기)", () => {
  const withExp = {
    ...SOURCES,
    bayesianPosterior: { deltaLtv: 0.2 },
  }
  const r = computeVcSimulation(DEFAULT_OFFER, withExp)
  if (Number.isFinite(r.baselineA.p50Irr) && Number.isFinite(r.baselineB.p50Irr)) {
    assert.ok(r.baselineB.p50Irr >= r.baselineA.p50Irr, "experiment uplift should increase long-term IRR")
  }
})

test("J-curve: experiment cost creates initial drag, break-even contract honored", () => {
  const withExp = {
    ...SOURCES,
    bayesianPosterior: { deltaLtv: 0.2 },
  }
  const r = computeVcSimulation(DEFAULT_OFFER, withExp)
  // 실험 비용은 즉시 발생 → 초기 gap 음수
  assert.ok(r.gap[1] < 0 || r.gap[3] < 0, "early months should show experiment cost drag")
  // 회복 없음 ↔ break-even null. 회복 있음 ↔ break-even 양수 정수
  if (r.jCurveBreakEvenMonth === null) {
    assert.ok(r.gap[r.gap.length - 1] <= 0, "no break-even must imply final gap non-positive")
  } else {
    assert.ok(r.jCurveBreakEvenMonth >= 0, "break-even month must be non-negative")
    assert.ok(r.gap[r.jCurveBreakEvenMonth] >= 0, "gap at break-even month must be non-negative")
  }
})

test("jCurveBreakEvenMonth is in [0, horizon] or null", () => {
  const r = computeVcSimulation(DEFAULT_OFFER, { ...SOURCES, bayesianPosterior: { deltaLtv: 0.2 } })
  if (r.jCurveBreakEvenMonth !== null) {
    assert.ok(r.jCurveBreakEvenMonth >= 0)
    assert.ok(r.jCurveBreakEvenMonth <= DEFAULT_OFFER.horizonMonths)
  }
})
