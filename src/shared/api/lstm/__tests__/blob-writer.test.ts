import { describe, it, expect, vi } from "vitest"

vi.mock("@vercel/blob", () => {
  const put = vi.fn(async (path: string) => ({ url: `https://blob.test/${path}` }))
  return { put }
})

import { put as mockPut } from "@vercel/blob"
import { writeLstmSnapshots } from "../blob-writer"
import type { LstmSnapshot } from "../../vc-simulation/types"
import type { RevenueSnapshot } from "../revenue-snapshot"

const validRetention: LstmSnapshot = {
  schema_version: "1.0",
  generated_at: "2026-04-27T18:30:00Z",
  model: {
    name: "retention-bayesian-shrinkage",
    version: "phase-2",
    trained_at: "2026-04-27T18:30:00Z",
    hyperparameters: {
      lookback_days: 30,
      forecast_horizon_days: 1095,
      sample_count: 1,
      confidence_interval: 0.8,
    },
  },
  predictions: {
    poko_merge: {
      game_id: "poko_merge",
      genre: "Merge",
      points: Array.from({ length: 11 }, (_, i) => ({
        day: i + 1,
        p10: 0.5 - i * 0.04,
        p50: 0.55 - i * 0.04,
        p90: 0.6 - i * 0.04,
      })),
    },
  },
}

const validRevenue: RevenueSnapshot = {
  schema_version: "1.0",
  generated_at: "2026-04-27T18:30:00Z",
  source_retention_at: "2026-04-27T18:30:00Z",
  arpdau: { perGame: { poko_merge: 0.55 }, currency: "USD", windowDays: 14 },
  installsAssumption: { perGame: { poko_merge: 800 }, method: "trailing-14d-mean" },
  forecast: {
    poko_merge: {
      points: Array.from({ length: 11 }, (_, i) => ({
        day: i + 1,
        dauP50: 800,
        revenueP10: 200,
        revenueP50: 220,
        revenueP90: 240,
      })),
    },
  },
}

describe("writeLstmSnapshots", () => {
  it("publishes both snapshots to expected paths", async () => {
    vi.mocked(mockPut).mockClear()
    const r = await writeLstmSnapshots({
      retentionSnapshot: validRetention,
      revenueSnapshot: validRevenue,
    })
    expect(r.retentionUrl).toContain("lstm/retention-snapshot.json")
    expect(r.revenueUrl).toContain("lstm/revenue-snapshot.json")
    expect(mockPut).toHaveBeenCalledTimes(2)
  })

  it("skips revenue put when revenueSnapshot is null", async () => {
    vi.mocked(mockPut).mockClear()
    const r = await writeLstmSnapshots({
      retentionSnapshot: validRetention,
      revenueSnapshot: null,
    })
    expect(r.retentionUrl).toContain("lstm/retention-snapshot.json")
    expect(r.revenueUrl).toBeNull()
    expect(mockPut).toHaveBeenCalledTimes(1)
  })

  it("throws on invalid retention snapshot", async () => {
    // Drop a required top-level field (`generated_at`) — Zod will reject.
    // Note: empty `predictions: {}` is NOT rejected because z.record accepts
    // empty maps; deviated from the plan which assumed it would throw.
    const { generated_at: _omit, ...broken } = validRetention
    await expect(
      writeLstmSnapshots({
        retentionSnapshot: broken as unknown as LstmSnapshot,
        revenueSnapshot: null,
      }),
    ).rejects.toThrow()
  })
})
