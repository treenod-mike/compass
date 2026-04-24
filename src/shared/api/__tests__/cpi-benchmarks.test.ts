import { describe, it } from "node:test"
import { strict as assert } from "node:assert"
import {
  lookupCpi,
  lookupCpiDetailed,
  isBenchmarkStale,
  benchmarkAgeDays,
  getSourceMeta,
} from "../cpi-benchmarks"

describe("lookupCpi", () => {
  it("returns value for valid combo (JP × merge × ios)", () => {
    const v = lookupCpi("JP", "merge", "ios")
    assert.equal(typeof v, "number")
    assert.ok(v !== null && v > 0)
  })
  it("returns null for unknown country", () => {
    assert.equal(lookupCpi("ZZ" as never, "merge", "ios"), null)
  })
  it("returns null when genre missing and no fallback", () => {
    // simulation is not in JP snapshot, and has no fallback configured
    assert.equal(lookupCpi("JP", "simulation", "ios"), null)
  })
})

describe("lookupCpiDetailed", () => {
  it("returns cpi + fallback flag for direct hit", () => {
    const r = lookupCpiDetailed("JP", "merge", "ios")
    assert.ok(r)
    assert.equal(r.usedFallbackGenre, false)
    assert.ok(r.cpi > 0)
  })
})

describe("isBenchmarkStale", () => {
  it("returns false when snapshot is recent", () => {
    // snapshot generatedAt = 2026-04-24; tests run close to that
    // Use a reference date 1 day after snapshot
    const ref = new Date("2026-04-25T00:00:00Z")
    assert.equal(isBenchmarkStale(ref), false)
  })
  it("returns true when snapshot is >35 days old", () => {
    const ref = new Date("2026-06-01T00:00:00Z") // 38 days after 2026-04-24
    assert.equal(isBenchmarkStale(ref), true)
  })
})

describe("benchmarkAgeDays", () => {
  it("computes age in whole days", () => {
    const ref = new Date("2026-04-27T00:00:00Z") // 3 days after 2026-04-24
    assert.equal(benchmarkAgeDays(ref), 3)
  })
})

describe("getSourceMeta", () => {
  it("returns source and generatedAt", () => {
    const meta = getSourceMeta()
    assert.equal(meta.source, "unity-levelplay-cpi-index")
    assert.match(meta.generatedAt, /^\d{4}-\d{2}-\d{2}T/)
    assert.equal(meta.version, 1)
  })
})
