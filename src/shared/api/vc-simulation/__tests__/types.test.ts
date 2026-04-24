import { test } from "node:test"
import assert from "node:assert/strict"
import {
  OfferSchema,
  LstmSnapshotSchema,
  VcSimResultSchema,
} from "../types"

test("OfferSchema rejects negative investment", () => {
  const r = OfferSchema.safeParse({
    investmentUsd: -1000,
    postMoneyUsd: 15_000_000,
    exitMultiple: 3,
    hurdleRate: 0.2,
    uaSharePct: 60,
    horizonMonths: 36,
  })
  assert.equal(r.success, false)
})

test("OfferSchema accepts valid standard offer", () => {
  const r = OfferSchema.safeParse({
    investmentUsd: 3_000_000,
    postMoneyUsd: 15_000_000,
    exitMultiple: 3,
    hurdleRate: 0.2,
    uaSharePct: 60,
    horizonMonths: 36,
  })
  assert.equal(r.success, true)
})

test("LstmSnapshotSchema requires >= 11 points", () => {
  const r = LstmSnapshotSchema.safeParse({
    schema_version: "1.0",
    generated_at: new Date().toISOString(),
    model: {
      name: "retention-lstm",
      version: "v1",
      trained_at: new Date().toISOString(),
      hyperparameters: {
        lookback_days: 90,
        forecast_horizon_days: 1095,
        sample_count: 10000,
        confidence_interval: 0.8,
      },
    },
    predictions: {
      poko_merge: {
        game_id: "poko_merge",
        genre: "puzzle_match3",
        points: Array.from({ length: 10 }, (_, i) => ({
          day: i + 1,
          p10: 0.1,
          p50: 0.2,
          p90: 0.3,
        })),
      },
    },
  })
  assert.equal(r.success, false)
})

// Sanity check that VcSimResultSchema is at least importable and parses a minimal valid shape.
test("VcSimResultSchema imported and parses minimal valid shape", () => {
  const r = VcSimResultSchema.safeParse({
    offer: {
      investmentUsd: 3_000_000,
      postMoneyUsd: 15_000_000,
      exitMultiple: 3,
      hurdleRate: 0.2,
      uaSharePct: 60,
      horizonMonths: 36,
    },
    baselineA: {},
    baselineB: {},
    gap: [0, 0, 0],
    jCurveBreakEvenMonth: null,
    dataSourceBadge: "real",
  })
  assert.equal(r.success, true)
})
