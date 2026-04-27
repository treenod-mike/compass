import { describe, it, expect } from "vitest"
import {
  buildRevenueForecastVm,
  STALE_THRESHOLD_DAYS,
} from "../revenue-forecast-vm"
import type { RevenueSnapshot } from "../revenue-snapshot"
import type { RevenueForecastPoint as ChartPoint } from "../../mock-data"

const MOCK_POINTS: ChartPoint[] = [
  { month: "May", p10: 50, p50: 100, p90: 150, priorP10: 40, priorP50: 90, priorP90: 140 },
  { month: "Jun", p10: 60, p50: 110, p90: 160, priorP10: 45, priorP50: 95, priorP90: 145 },
  { month: "Jul", p10: 70, p50: 120, p90: 170, priorP10: 50, priorP50: 100, priorP90: 150 },
]

const FRESH_GENERATED_AT = "2026-04-26T00:00:00Z"
const NOW_FRESH = new Date("2026-04-27T12:00:00Z") // ~1.5 days old
const NOW_STALE = new Date("2026-05-05T00:00:00Z") // ~9 days old

function makeSnapshot(args: {
  generatedAt?: string
  gameId?: string
  // sparse anchor points (day, revenueP50). P10/P90 derived as ±20%.
  anchors?: Array<{ day: number; rev: number }>
}): RevenueSnapshot {
  const generatedAt = args.generatedAt ?? FRESH_GENERATED_AT
  const gameId = args.gameId ?? "poko_merge"
  const anchors = args.anchors ?? [
    { day: 1, rev: 100 },
    { day: 30, rev: 100 },
    { day: 60, rev: 100 },
    { day: 90, rev: 100 },
  ]
  const points = anchors.map((a) => ({
    day: a.day,
    dauP50: 1000,
    revenueP10: a.rev * 0.8,
    revenueP50: a.rev,
    revenueP90: a.rev * 1.2,
  }))
  return {
    schema_version: "1.0",
    generated_at: generatedAt,
    source_retention_at: generatedAt,
    arpdau: { perGame: { [gameId]: 0.5 }, currency: "USD", windowDays: 14 },
    installsAssumption: { perGame: { [gameId]: 1000 }, method: "trailing-14d-mean" },
    forecast: { [gameId]: { points } },
  } as RevenueSnapshot
}

describe("buildRevenueForecastVm", () => {
  it("returns mock + source='mock' + isStale=true when snapshot is older than 7 days", () => {
    const snap = makeSnapshot({})
    const result = buildRevenueForecastVm({
      gameId: "poko_merge",
      snapshot: snap,
      mockPoints: MOCK_POINTS,
      now: NOW_STALE,
    })
    expect(result.source).toBe("mock")
    expect(result.isStale).toBe(true)
    expect(result.ageDays).toBeGreaterThan(STALE_THRESHOLD_DAYS)
    expect(result.points).toEqual(MOCK_POINTS)
  })

  it("returns mock + source='mock' when game id is missing in snapshot", () => {
    const snap = makeSnapshot({ gameId: "another_game" })
    const result = buildRevenueForecastVm({
      gameId: "poko_merge",
      snapshot: snap,
      mockPoints: MOCK_POINTS,
      now: NOW_FRESH,
    })
    expect(result.source).toBe("mock")
    expect(result.isStale).toBe(false)
    expect(result.points).toEqual(MOCK_POINTS)
  })

  it("returns lstm source when fresh and game present", () => {
    const snap = makeSnapshot({})
    const result = buildRevenueForecastVm({
      gameId: "poko_merge",
      snapshot: snap,
      mockPoints: MOCK_POINTS,
      now: NOW_FRESH,
    })
    expect(result.source).toBe("lstm")
    expect(result.isStale).toBe(false)
    expect(result.ageDays).toBeLessThanOrEqual(STALE_THRESHOLD_DAYS)
  })

  it("preserves mock month labels and prior bands when using LSTM", () => {
    const snap = makeSnapshot({})
    const result = buildRevenueForecastVm({
      gameId: "poko_merge",
      snapshot: snap,
      mockPoints: MOCK_POINTS,
      now: NOW_FRESH,
    })
    expect(result.points).toHaveLength(MOCK_POINTS.length)
    result.points.forEach((p, i) => {
      expect(p.month).toBe(MOCK_POINTS[i].month)
      expect(p.priorP10).toBe(MOCK_POINTS[i].priorP10)
      expect(p.priorP50).toBe(MOCK_POINTS[i].priorP50)
      expect(p.priorP90).toBe(MOCK_POINTS[i].priorP90)
    })
  })

  it("integrates daily revenue into 30-day monthly buckets when using LSTM", () => {
    // Constant 100 USD/day over the entire horizon → each 30-day bucket sums to 3000 USD
    const snap = makeSnapshot({})
    const result = buildRevenueForecastVm({
      gameId: "poko_merge",
      snapshot: snap,
      mockPoints: MOCK_POINTS,
      now: NOW_FRESH,
    })
    expect(result.points[0].p50).toBe(3000)
    expect(result.points[1].p50).toBe(3000)
    expect(result.points[2].p50).toBe(3000)
  })

  it("preserves P10 ≤ P50 ≤ P90 invariant", () => {
    const snap = makeSnapshot({})
    const result = buildRevenueForecastVm({
      gameId: "poko_merge",
      snapshot: snap,
      mockPoints: MOCK_POINTS,
      now: NOW_FRESH,
    })
    result.points.forEach((p) => {
      expect(p.p10).toBeLessThanOrEqual(p.p50)
      expect(p.p50).toBeLessThanOrEqual(p.p90)
    })
  })

  it("interpolates revenue linearly between sparse anchors", () => {
    // Anchors: day 1 → 0, day 31 → 60. Linear interp gives day d → (d-1)*2.
    // Bucket [day 1..30] sum = (0+2+4+...+58) = 870. Bucket [day 31..60] = sum from day 31..60 with anchors at day 31 (60) and beyond...
    // We test only the first bucket where math is clean.
    const snap = makeSnapshot({
      anchors: [
        { day: 1, rev: 0 },
        { day: 31, rev: 60 },
      ],
    })
    const result = buildRevenueForecastVm({
      gameId: "poko_merge",
      snapshot: snap,
      mockPoints: [MOCK_POINTS[0]],
      now: NOW_FRESH,
    })
    // Sum of d=1..30 of revenue (interp): 0, 2, 4, ..., 58 = 30 terms, arithmetic sum = (0+58)*30/2 = 870
    expect(result.points[0].p50).toBe(870)
  })

  it("clamps days beyond the last anchor to the last anchor's value", () => {
    // Anchors only at day 1..30. Bucket day 31..60 should clamp to value at day 30.
    const snap = makeSnapshot({
      anchors: [
        { day: 1, rev: 100 },
        { day: 30, rev: 100 },
      ],
    })
    const result = buildRevenueForecastVm({
      gameId: "poko_merge",
      snapshot: snap,
      mockPoints: MOCK_POINTS, // 3 months
      now: NOW_FRESH,
    })
    // Each month bucket should sum to 30 days × 100 = 3000 (clamped).
    expect(result.points[0].p50).toBe(3000)
    expect(result.points[1].p50).toBe(3000)
    expect(result.points[2].p50).toBe(3000)
  })

  it("computes ageDays correctly for fresh snapshot", () => {
    const snap = makeSnapshot({ generatedAt: "2026-04-25T00:00:00Z" })
    const now = new Date("2026-04-27T00:00:00Z")
    const result = buildRevenueForecastVm({
      gameId: "poko_merge",
      snapshot: snap,
      mockPoints: MOCK_POINTS,
      now,
    })
    expect(result.ageDays).toBe(2)
  })
})
