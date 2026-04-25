import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  RevenueSnapshotSchema,
  loadRevenueSnapshot,
  getGameForecast,
  isRevenueSnapshotStale,
  revenueSnapshotAgeDays,
  getRevenueSnapshotMeta,
} from "../revenue-snapshot"
import rawSnapshot from "../../data/lstm/revenue-snapshot.json"

describe("RevenueSnapshotSchema", () => {
  it("accepts the bundled mock snapshot", () => {
    const result = RevenueSnapshotSchema.safeParse(rawSnapshot)
    expect(result.success).toBe(true)
  })

  it("rejects forecast points where P10 > P50", () => {
    const broken = structuredClone(rawSnapshot) as typeof rawSnapshot
    broken.forecast.poko_merge.points[0].revenueP10 = 9999
    const result = RevenueSnapshotSchema.safeParse(broken)
    expect(result.success).toBe(false)
  })

  it("rejects forecast points where P50 > P90", () => {
    const broken = structuredClone(rawSnapshot) as typeof rawSnapshot
    broken.forecast.poko_merge.points[0].revenueP90 = 1
    const result = RevenueSnapshotSchema.safeParse(broken)
    expect(result.success).toBe(false)
  })

  it("rejects when forecast game is missing arpdau entry", () => {
    const broken = structuredClone(rawSnapshot) as any
    broken.forecast["unknown_game"] = broken.forecast.poko_merge
    const result = RevenueSnapshotSchema.safeParse(broken)
    expect(result.success).toBe(false)
  })

  it("rejects unknown root keys (strict)", () => {
    const broken = { ...rawSnapshot, surprise: "field" }
    const result = RevenueSnapshotSchema.safeParse(broken)
    expect(result.success).toBe(false)
  })

  it("rejects negative revenue", () => {
    const broken = structuredClone(rawSnapshot) as typeof rawSnapshot
    broken.forecast.poko_merge.points[0].revenueP50 = -10
    broken.forecast.poko_merge.points[0].revenueP10 = -20
    const result = RevenueSnapshotSchema.safeParse(broken)
    expect(result.success).toBe(false)
  })
})

describe("loadRevenueSnapshot", () => {
  it("returns the parsed bundled snapshot with poko_merge forecast", () => {
    const snap = loadRevenueSnapshot()
    expect(snap.forecast.poko_merge.points.length).toBeGreaterThanOrEqual(11)
    expect(snap.arpdau.perGame.poko_merge).toBeGreaterThan(0)
    expect(snap.installsAssumption.perGame.poko_merge).toBeGreaterThan(0)
  })

  it("forecast points are monotonically increasing in day", () => {
    const snap = loadRevenueSnapshot()
    const days = snap.forecast.poko_merge.points.map((p) => p.day)
    const sorted = [...days].sort((a, b) => a - b)
    expect(days).toEqual(sorted)
  })
})

describe("getGameForecast", () => {
  it("returns points for a known game", () => {
    const points = getGameForecast("poko_merge")
    expect(points).not.toBeNull()
    expect(points!.length).toBeGreaterThanOrEqual(11)
  })

  it("returns null for an unknown game", () => {
    expect(getGameForecast("does_not_exist")).toBeNull()
  })
})

describe("staleness helpers", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => vi.useRealTimers())

  it("isRevenueSnapshotStale = false within 7 days of generated_at", () => {
    const meta = getRevenueSnapshotMeta()
    vi.setSystemTime(new Date(new Date(meta.generatedAt).getTime() + 6 * 24 * 60 * 60 * 1000))
    expect(isRevenueSnapshotStale()).toBe(false)
  })

  it("isRevenueSnapshotStale = true after 7 days of generated_at", () => {
    const meta = getRevenueSnapshotMeta()
    vi.setSystemTime(new Date(new Date(meta.generatedAt).getTime() + 8 * 24 * 60 * 60 * 1000))
    expect(isRevenueSnapshotStale()).toBe(true)
  })

  it("revenueSnapshotAgeDays returns floor of elapsed days", () => {
    const meta = getRevenueSnapshotMeta()
    vi.setSystemTime(new Date(new Date(meta.generatedAt).getTime() + 5 * 24 * 60 * 60 * 1000 + 1000))
    expect(revenueSnapshotAgeDays()).toBe(5)
  })
})

describe("getRevenueSnapshotMeta", () => {
  it("exposes schema version, generated_at, currency, and arpdau window", () => {
    const meta = getRevenueSnapshotMeta()
    expect(meta.schemaVersion).toBe("1.0")
    expect(meta.currency).toMatch(/^(USD|KRW)$/)
    expect(meta.arpdauWindowDays).toBeGreaterThan(0)
    expect(new Date(meta.generatedAt).getTime()).not.toBeNaN()
    expect(new Date(meta.sourceRetentionAt).getTime()).not.toBeNaN()
  })
})
