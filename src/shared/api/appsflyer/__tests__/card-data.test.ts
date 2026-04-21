import { test } from "node:test"
import assert from "node:assert/strict"
import { deriveCardFromSnapshot } from "../snapshot-derive"
import type { AppsFlyerSnapshot } from "../types"

const base: AppsFlyerSnapshot = {
  version: 1,
  fetchedAt: new Date().toISOString(),
  request: { master: null, cohort: null },
  master: null,
  cohort: null,
  meta: { warnings: [] },
}

test("deriveCardFromSnapshot: empty → only lastSync, no metrics", () => {
  const card = deriveCardFromSnapshot(base)
  assert.equal(card.status, "connected")
  assert.equal(card.metrics.length, 0)
  assert.equal(card.retentionDepth, null)
})

test("deriveCardFromSnapshot: master rows → installs metric", () => {
  const snap: AppsFlyerSnapshot = {
    ...base,
    master: {
      rows: [
        { date: "2026-04-18", installs: 42, non_organic_installs: 38, cost: 0 },
        { date: "2026-04-19", installs: 15, non_organic_installs: 12, cost: 0 },
      ],
    },
  }
  const card = deriveCardFromSnapshot(snap)
  const installs = card.metrics.find((m) => m.label === "설치")
  assert.equal(installs?.value, "57")
  const cpi = card.metrics.find((m) => m.label === "CPI")
  assert.equal(cpi, undefined, "cost=0 → CPI excluded")
})

test("deriveCardFromSnapshot: cohort rows → retentionDepth", () => {
  const snap: AppsFlyerSnapshot = {
    ...base,
    cohort: {
      rows: [
        {
          cohort_date: "2026-04-18",
          size: 38,
          retention_day_0: 1,
          retention_day_1: 0.42,
          retention_day_3: 0.18,
        },
      ],
    },
  }
  const card = deriveCardFromSnapshot(snap)
  assert.equal(card.retentionDepth, "D3")
})
