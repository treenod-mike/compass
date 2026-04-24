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
  it("rejects cpi === 0 (positive is exclusive)", () => {
    expect(() => MetricsSchema.parse({ cpi: 0 })).toThrow()
  })
  it("accepts cpi === 100 (max is inclusive)", () => {
    expect(() => MetricsSchema.parse({ cpi: 100 })).not.toThrow()
  })
  it("rejects cpi just over 100", () => {
    expect(() => MetricsSchema.parse({ cpi: 100.01 })).toThrow()
  })
  it("accepts metrics with cpi and cpm", () => {
    expect(() => MetricsSchema.parse({ cpi: 3.2, cpm: 18.5 })).not.toThrow()
  })
  it("accepts cpm === 200 (max is inclusive)", () => {
    expect(() => MetricsSchema.parse({ cpi: 3.2, cpm: 200 })).not.toThrow()
  })
  it("rejects cpm just over 200", () => {
    expect(() => MetricsSchema.parse({ cpi: 3.2, cpm: 200.01 })).toThrow()
  })
  it("rejects negative cpm", () => {
    expect(() => MetricsSchema.parse({ cpi: 3.2, cpm: -1 })).toThrow()
  })
  it("rejects metrics with unknown keys (.strict)", () => {
    expect(() => MetricsSchema.parse({ cpi: 3.2, roas: 1.5 })).toThrow()
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
  it("allows partial platform coverage (only ios, no android)", () => {
    const partial = {
      ...valid,
      platforms: {
        ios: { JP: { merge: { cpi: 3.8 } } },
      },
    }
    expect(() => SnapshotSchema.parse(partial)).not.toThrow()
  })
  it("allows mixed partial coverage (country with genres, country without)", () => {
    const partial = {
      ...valid,
      platforms: {
        ios: {
          JP: { merge: { cpi: 3.8 } },
          US: {},
        },
      },
    }
    expect(() => SnapshotSchema.parse(partial)).not.toThrow()
  })
  it("rejects snapshot with unknown top-level keys (.strict)", () => {
    expect(() => SnapshotSchema.parse({ ...valid, extra: "field" })).toThrow()
  })
})
