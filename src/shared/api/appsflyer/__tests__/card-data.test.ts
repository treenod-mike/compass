import { test } from "node:test"
import assert from "node:assert/strict"
import { deriveCardFromSnapshot } from "../snapshot-derive"
import type { AppsFlyerSnapshot, CompactInstall } from "../types"

const base: AppsFlyerSnapshot = {
  version: 2,
  fetchedAt: new Date().toISOString(),
  request: null,
  installs: null,
  meta: { warnings: [], source: "pull-api-v5" },
}

function makeInstall(overrides: Partial<CompactInstall> = {}): CompactInstall {
  return {
    installTime: "2026-02-14 13:53:39",
    partner: "Facebook Ads",
    mediaSource: "Facebook Ads",
    costValue: null,
    eventRevenueUsd: null,
    eventName: "install",
    countryCode: "KR",
    platform: "android",
    ...overrides,
  }
}

test("deriveCardFromSnapshot: empty → only lastSync, no metrics", () => {
  const card = deriveCardFromSnapshot(base)
  assert.equal(card.status, "connected")
  assert.equal(card.metrics.length, 0)
  assert.equal(card.retentionDepth, null)
})

test("deriveCardFromSnapshot: counts total installs (non-organic + organic)", () => {
  const snap: AppsFlyerSnapshot = {
    ...base,
    installs: {
      nonOrganic: [makeInstall(), makeInstall()],
      organic: [makeInstall({ partner: null, mediaSource: "organic" })],
    },
  }
  const card = deriveCardFromSnapshot(snap)
  const installs = card.metrics.find((m) => m.label === "설치")
  assert.equal(installs?.value, "3")
})

test("deriveCardFromSnapshot: CPI computed from non-organic cost only", () => {
  const snap: AppsFlyerSnapshot = {
    ...base,
    installs: {
      nonOrganic: [
        makeInstall({ costValue: 1.25 }),
        makeInstall({ costValue: 0.75 }),
      ],
      organic: [makeInstall({ costValue: null })],
    },
  }
  const card = deriveCardFromSnapshot(snap)
  const cpi = card.metrics.find((m) => m.label === "CPI")
  // (1.25 + 0.75) / 2 = 1 → ₩1
  assert.equal(cpi?.value, "₩1")
})

test("deriveCardFromSnapshot: cost=0 → CPI metric excluded", () => {
  const snap: AppsFlyerSnapshot = {
    ...base,
    installs: {
      nonOrganic: [makeInstall({ costValue: 0 })],
      organic: [],
    },
  }
  const card = deriveCardFromSnapshot(snap)
  const cpi = card.metrics.find((m) => m.label === "CPI")
  assert.equal(cpi, undefined)
})

test("deriveCardFromSnapshot: revenue aggregated across both streams", () => {
  const snap: AppsFlyerSnapshot = {
    ...base,
    installs: {
      nonOrganic: [makeInstall({ eventRevenueUsd: 2.5 })],
      organic: [makeInstall({ eventRevenueUsd: 7.5 })],
    },
  }
  const card = deriveCardFromSnapshot(snap)
  const revenue = card.metrics.find((m) => m.label === "매출")
  assert.equal(revenue?.value, "$10.00")
})

test("deriveCardFromSnapshot: retentionDepth is null (plan does not include retention_report)", () => {
  const snap: AppsFlyerSnapshot = {
    ...base,
    installs: { nonOrganic: [makeInstall()], organic: [] },
  }
  const card = deriveCardFromSnapshot(snap)
  assert.equal(card.retentionDepth, null)
})
