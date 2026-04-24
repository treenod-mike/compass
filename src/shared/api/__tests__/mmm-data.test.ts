import { test } from "node:test"
import assert from "node:assert/strict"
import {
  SnapshotSchema,
  mmmChannels,
  mmmVerdict,
  mmmMetadata,
  mmmPortfolio,
  mmmContribution,
  mmmReallocation,
  mmmAgeDays,
  isMmmStale,
  getMmmChannel,
} from "../mmm-data"

test("mmm-data: parses mock snapshot without errors", () => {
  // Module load already runs SnapshotSchema.parse(); if import succeeded, schema passed.
  assert.equal(mmmChannels.length, 4)
  assert.ok(mmmMetadata.generatedAt)
  assert.equal(mmmMetadata.source, "mock-v1")
})

test("mmm-data: all 4 channel keys present", () => {
  const keys = mmmChannels.map((c) => c.key).sort()
  assert.deepEqual(keys, ["apple-search", "google", "meta", "tiktok"])
})

test("mmm-data: response curve arrays have equal length per channel", () => {
  for (const c of mmmChannels) {
    const len = c.responseCurve.spendGrid.length
    assert.equal(c.responseCurve.p10.length, len, `${c.key}: p10 length`)
    assert.equal(c.responseCurve.p50.length, len, `${c.key}: p50 length`)
    assert.equal(c.responseCurve.p90.length, len, `${c.key}: p90 length`)
  }
})

test("mmm-data: p10 <= p50 <= p90 at every grid point", () => {
  for (const c of mmmChannels) {
    const { p10, p50, p90 } = c.responseCurve
    for (let i = 0; i < p50.length; i++) {
      assert.ok(p10[i] <= p50[i], `${c.key}[${i}]: p10 > p50`)
      assert.ok(p50[i] <= p90[i], `${c.key}[${i}]: p50 > p90`)
    }
  }
})

test("mmm-data: verdict shape valid", () => {
  assert.ok(["invest", "hold", "reduce"].includes(mmmVerdict.status))
  assert.ok(mmmVerdict.confidence >= 0 && mmmVerdict.confidence <= 1)
  assert.ok(mmmVerdict.headline.ko.length > 0)
  assert.ok(mmmVerdict.headline.en.length > 0)
  assert.ok(mmmVerdict.metrics.length >= 3 && mmmVerdict.metrics.length <= 5)
})

test("mmm-data: getMmmChannel returns correct channel", () => {
  const google = getMmmChannel("google")
  assert.equal(google.key, "google")
  assert.equal(google.label, "Google Ads")
})

test("mmm-data: isMmmStale returns false when generatedAt is recent", () => {
  const recent = new Date(new Date(mmmMetadata.generatedAt).getTime() + 10 * 86_400_000)
  assert.equal(isMmmStale(recent), false)
})

test("mmm-data: isMmmStale returns true at 90-day boundary", () => {
  const stale = new Date(new Date(mmmMetadata.generatedAt).getTime() + 91 * 86_400_000)
  assert.equal(isMmmStale(stale), true)
})

test("mmm-data: mmmAgeDays computes correctly", () => {
  const future = new Date(new Date(mmmMetadata.generatedAt).getTime() + 45 * 86_400_000)
  assert.equal(mmmAgeDays(future), 45)
})

test("mmm-data: SnapshotSchema rejects wrong array lengths", () => {
  const invalid = {
    $schemaVersion: 2,
    metadata: mmmMetadata,
    verdict: mmmVerdict,
    portfolio: mmmPortfolio,
    contribution: mmmContribution,
    channels: [
      {
        ...mmmChannels[0],
        responseCurve: {
          spendGrid: [0, 1000, 2000],
          p10: [0, 100],
          p50: [0, 200],
          p90: [0, 300],
        },
      },
      ...mmmChannels.slice(1),
    ],
    reallocation: mmmReallocation,
  }
  assert.throws(() => SnapshotSchema.parse(invalid))
})

test("mmm-data: SnapshotSchema rejects non-4-channel arrays", () => {
  const invalid = {
    $schemaVersion: 2,
    metadata: mmmMetadata,
    verdict: mmmVerdict,
    portfolio: mmmPortfolio,
    contribution: mmmContribution,
    channels: mmmChannels.slice(0, 3),
    reallocation: mmmReallocation,
  }
  assert.throws(() => SnapshotSchema.parse(invalid))
})

/* ─────────── v2 invariants ─────────── */

test("mmm-data: portfolio.saturationWeighted is in [0, 1]", () => {
  assert.ok(mmmPortfolio.saturationWeighted >= 0 && mmmPortfolio.saturationWeighted <= 1)
  assert.ok(mmmPortfolio.saturationInterpretation.ko.length > 0)
})

test("mmm-data: contribution totals add up (organic + paid sum = total)", () => {
  const paidSum = Object.values(mmmContribution.paid).reduce((a, b) => a + b, 0)
  assert.equal(mmmContribution.organic + paidSum, mmmContribution.totalInstalls)
})

test("mmm-data: reallocation moves all source ≠ target", () => {
  for (const m of mmmReallocation.moves) {
    assert.notEqual(m.from, m.to, `move ${m.from}→${m.to}: same channel`)
    assert.ok(m.amount > 0)
  }
})

test("mmm-data: reallocation totalMoved matches sum of moves", () => {
  const sum = mmmReallocation.moves.reduce((acc, m) => acc + m.amount, 0)
  assert.equal(sum, mmmReallocation.totalMoved)
})

test("mmm-data: each channel has recommendation + mmpComparison", () => {
  for (const c of mmmChannels) {
    assert.ok(["increase", "decrease", "hold"].includes(c.recommendation.action))
    assert.equal(typeof c.mmpComparison.mmpInstalls, "number")
    assert.equal(typeof c.mmpComparison.mmmInstalls, "number")
  }
})
