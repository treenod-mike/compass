import { test } from "node:test"
import assert from "node:assert/strict"
import { prefillOffer } from "../prefill"

test("prefillOffer returns standard default when no sources", () => {
  const o = prefillOffer({ gameId: "test_game", appsflyerSnapshot: null })
  assert.equal(o.uaSharePct, 60)
  assert.equal(o.investmentUsd, 3_000_000)
})

test("prefillOffer derives uaSharePct from AppsFlyer cost ratio", () => {
  const mockAf = {
    totalCostUsd: 100_000,
    uaCostUsd: 75_000,
  }
  const o = prefillOffer({ gameId: "test_game", appsflyerSnapshot: mockAf as any })
  assert.equal(Math.round(o.uaSharePct), 75)
})

test("prefillOffer clamps uaSharePct to [0, 100]", () => {
  const mockAf = {
    totalCostUsd: 100,
    uaCostUsd: 150,
  }
  const o = prefillOffer({ gameId: "test_game", appsflyerSnapshot: mockAf as any })
  assert.ok(o.uaSharePct <= 100)
  assert.ok(o.uaSharePct >= 0)
})
