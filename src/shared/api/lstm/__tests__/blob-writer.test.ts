import { describe, it, expect, vi, beforeEach } from "vitest"

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
  beforeEach(() => {
    vi.mocked(mockPut).mockReset()
    // Default behavior: succeed with the standard URL shape.
    vi.mocked(mockPut).mockImplementation(
      async (path: string) => ({ url: `https://blob.test/${path}` }) as never,
    )
  })

  it("publishes both snapshots to expected paths", async () => {
    const r = await writeLstmSnapshots({
      retentionSnapshot: validRetention,
      revenueSnapshot: validRevenue,
    })
    expect(r.retentionUrl).toContain("lstm/retention-snapshot.json")
    expect(r.revenueUrl).toContain("lstm/revenue-snapshot.json")
    expect(mockPut).toHaveBeenCalledTimes(2)
  })

  it("skips revenue put when revenueSnapshot is null", async () => {
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

  it("retries on transient failure and eventually succeeds", async () => {
    // Two rejections, then a success — total 3 calls (1 initial + 2 retries).
    vi.mocked(mockPut)
      .mockRejectedValueOnce(new Error("transient 1"))
      .mockRejectedValueOnce(new Error("transient 2"))
      .mockResolvedValueOnce({
        url: "https://blob.test/lstm/retention-snapshot.json",
      } as never)

    vi.useFakeTimers()
    const promise = writeLstmSnapshots({
      retentionSnapshot: validRetention,
      revenueSnapshot: null,
    })
    // Drain backoff timers (500ms, 1000ms) so the retry loop progresses.
    await vi.runAllTimersAsync()
    const r = await promise
    vi.useRealTimers()

    expect(r.retentionUrl).toContain("lstm/retention-snapshot.json")
    expect(r.revenueUrl).toBeNull()
    expect(mockPut).toHaveBeenCalledTimes(3)
  })

  it("throws after exhausting all retries", async () => {
    // Every attempt fails — guards against off-by-one in the retry loop
    // (RETRY_BACKOFFS.length = 3 → 1 initial + 3 retries = 4 total calls).
    vi.mocked(mockPut).mockRejectedValue(new Error("permanent failure"))

    vi.useFakeTimers()
    const promise = writeLstmSnapshots({
      retentionSnapshot: validRetention,
      revenueSnapshot: null,
    })
    // Attach catch synchronously so unhandled rejection doesn't fire while
    // we drain timers.
    const assertion = expect(promise).rejects.toThrow("permanent failure")
    await vi.runAllTimersAsync()
    await assertion
    vi.useRealTimers()

    expect(mockPut).toHaveBeenCalledTimes(4)
  })
})
