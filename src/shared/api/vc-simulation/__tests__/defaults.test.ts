import { test } from "node:test"
import assert from "node:assert/strict"
import { PRESETS, DEFAULT_OFFER } from "../defaults"
import { OfferSchema } from "../types"

test("all presets are valid offers", () => {
  for (const [name, offer] of Object.entries(PRESETS)) {
    const r = OfferSchema.safeParse(offer)
    assert.equal(r.success, true, `${name} invalid`)
  }
})

test("standard preset is the DEFAULT_OFFER", () => {
  assert.deepEqual(DEFAULT_OFFER, PRESETS.standard)
})

test("conservative has lower investment than aggressive", () => {
  assert.ok(PRESETS.conservative.investmentUsd < PRESETS.aggressive.investmentUsd)
})

test("conservative has higher hurdle than aggressive", () => {
  assert.ok(PRESETS.conservative.hurdleRate > PRESETS.aggressive.hurdleRate)
})
