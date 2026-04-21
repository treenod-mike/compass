import { test } from "node:test"
import assert from "node:assert/strict"
import { parseCsv } from "../fetcher"
import { toCompactInstall } from "../types"

const csvSample = [
  "\uFEFFInstall Time,Partner,Media Source,Cost Value,Event Revenue USD,Country Code,Platform,Event Name",
  "2026-02-14 13:53:39,Facebook Ads,Facebook Ads,1.25,0,KR,android,install",
  `2026-02-13 15:24:07,"google",google,0.90,,US,android,install`,
  "2026-02-12 08:00:00,,organic,,5.00,JP,ios,af_purchase",
].join("\n")

test("parseCsv: parses rows with BOM + quoted fields", () => {
  const rows = parseCsv(csvSample)
  assert.equal(rows.length, 3)
  assert.equal(rows[0]!["Install Time"], "2026-02-14 13:53:39")
  assert.equal(rows[0]!["Cost Value"], 1.25)
  assert.equal(rows[1]!["Partner"], "google")
  assert.equal(rows[2]!["Partner"], null)
})

test("parseCsv: empty input returns empty array", () => {
  assert.deepEqual(parseCsv(""), [])
  assert.deepEqual(parseCsv("\uFEFF"), [])
})

test("toCompactInstall: projects raw row to compact shape", () => {
  const rows = parseCsv(csvSample)
  const c = toCompactInstall(rows[0]!)
  assert.equal(c.installTime, "2026-02-14 13:53:39")
  assert.equal(c.partner, "Facebook Ads")
  assert.equal(c.costValue, 1.25)
  assert.equal(c.countryCode, "KR")
})

test("toCompactInstall: handles empty / missing columns", () => {
  const rows = parseCsv(csvSample)
  const c = toCompactInstall(rows[2]!)
  assert.equal(c.partner, null)
  assert.equal(c.costValue, null)
  assert.equal(c.eventRevenueUsd, 5)
  assert.equal(c.eventName, "af_purchase")
})
