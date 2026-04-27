import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@vercel/blob", () => ({
  list: vi.fn(),
  head: vi.fn(),
  put: vi.fn(async (path: string) => ({ url: `https://blob.test/${path}` })),
}))

vi.mock("../../../../../shared/api/lstm/blob-writer", () => ({
  writeLstmSnapshots: vi.fn(async () => ({
    retentionUrl: "https://blob.test/lstm/retention-snapshot.json",
    revenueUrl: "https://blob.test/lstm/revenue-snapshot.json",
  })),
}))

const mockReadAllApps = vi.fn()
const mockReadCohortSummary = vi.fn()

vi.mock("../io", () => ({
  readAllApps: () => mockReadAllApps(),
  readCohortSummary: (id: string) => mockReadCohortSummary(id),
}))

import { GET } from "../route"
import { writeLstmSnapshots } from "../../../../../shared/api/lstm/blob-writer"

const SECRET = "test-secret"
beforeEach(() => {
  vi.clearAllMocks()
  process.env.CRON_SECRET = SECRET
})

const cohortSummary = (cohortDays: number, revenueDays: number) => ({
  updatedAt: "2026-04-27T00:00:00Z",
  cohorts: Array.from({ length: cohortDays }, (_, i) => ({
    cohortDate: `2026-03-${String((i % 30) + 1).padStart(2, "0")}`,
    installs: 800,
    retainedByDay: { d1: 480, d7: 240, d30: 96 },
  })),
  revenue: {
    daily: Array.from({ length: revenueDays }, (_, i) => ({
      date: `2026-04-${String(i + 1).padStart(2, "0")}`,
      sumUsd: 4500,
      purchasers: 120,
    })),
    total: { sumUsd: revenueDays * 4500, purchasers: revenueDays * 120 },
  },
})

const buildRequest = (token: string | null) =>
  new Request("https://example.com/api/lstm/cron", {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  })

describe("GET /api/lstm/cron", () => {
  it("returns 401 when CRON_SECRET missing or wrong", async () => {
    const res = await GET(buildRequest("wrong"))
    expect(res.status).toBe(401)
  })

  it("returns 200 with empty publish when no apps registered", async () => {
    mockReadAllApps.mockResolvedValueOnce([])
    const res = await GET(buildRequest(SECRET))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.processed).toEqual([])
    expect(body.snapshots).toBeNull()
    expect(writeLstmSnapshots).not.toHaveBeenCalled()
  })

  it("processes a single sufficient app and publishes both snapshots", async () => {
    mockReadAllApps.mockResolvedValueOnce([
      { appId: "poko_merge", gameKey: "portfolio", label: "P", genre: "Merge", region: "JP" },
    ])
    mockReadCohortSummary.mockResolvedValueOnce(cohortSummary(32, 14))
    const res = await GET(buildRequest(SECRET))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.processed).toEqual(["poko_merge"])
    expect(body.skipped).toEqual([])
    expect(writeLstmSnapshots).toHaveBeenCalledTimes(1)
  })

  it("skips a game missing genre/region meta (skipped[] reason populated)", async () => {
    mockReadAllApps.mockResolvedValueOnce([
      { appId: "x", gameKey: "portfolio", label: "P" },
    ])
    mockReadCohortSummary.mockResolvedValueOnce(cohortSummary(32, 14))
    const res = await GET(buildRequest(SECRET))
    const body = await res.json()
    expect(body.processed).toEqual([])
    expect(body.skipped).toEqual([{ gameId: "x", reason: "missing_genre_meta" }])
    expect(writeLstmSnapshots).not.toHaveBeenCalled()
  })
})
