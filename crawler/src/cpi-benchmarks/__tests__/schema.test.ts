import { describe, it, expect } from "vitest"
import {
  CountryCodeSchema,
  GenreSchema,
  PlatformSchema,
  MetricsSchema,
  SnapshotSchema,
} from "../schema.js"

describe("CountryCodeSchema", () => {
  it("accepts ISO alpha-2 codes", () => {
    expect(() => CountryCodeSchema.parse("JP")).not.toThrow()
    expect(() => CountryCodeSchema.parse("US")).not.toThrow()
  })
  it("rejects unknown country", () => {
    expect(() => CountryCodeSchema.parse("ZZ")).toThrow()
  })
})

describe("GenreSchema", () => {
  it("accepts merge and puzzle", () => {
    expect(() => GenreSchema.parse("merge")).not.toThrow()
    expect(() => GenreSchema.parse("puzzle")).not.toThrow()
  })
  it("rejects unknown genre", () => {
    expect(() => GenreSchema.parse("battle-royale")).toThrow()
  })
})

describe("MetricsSchema", () => {
  it("accepts positive cpi", () => {
    expect(() => MetricsSchema.parse({ cpi: 3.2 })).not.toThrow()
  })
  it("rejects negative cpi", () => {
    expect(() => MetricsSchema.parse({ cpi: -1 })).toThrow()
  })
  it("rejects cpi > 100", () => {
    expect(() => MetricsSchema.parse({ cpi: 150 })).toThrow()
  })
})

describe("SnapshotSchema", () => {
  const valid = {
    version: 1,
    source: "unity-levelplay-cpi-index",
    generatedAt: "2026-04-24T00:00:00.000Z",
    sourceRange: { start: "2026-03-24", end: "2026-04-23" },
    platforms: {
      ios: {
        JP: { merge: { cpi: 3.8 } },
      },
    },
  }
  it("accepts valid snapshot", () => {
    expect(() => SnapshotSchema.parse(valid)).not.toThrow()
  })
  it("rejects wrong version", () => {
    expect(() => SnapshotSchema.parse({ ...valid, version: 2 })).toThrow()
  })
  it("allows partial country coverage", () => {
    const partial = { ...valid, platforms: { ios: {} } }
    expect(() => SnapshotSchema.parse(partial)).not.toThrow()
  })
})
