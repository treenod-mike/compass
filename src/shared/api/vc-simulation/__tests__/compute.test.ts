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
