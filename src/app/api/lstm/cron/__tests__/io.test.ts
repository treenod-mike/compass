import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@vercel/blob", () => ({
  get: vi.fn(),
  list: vi.fn(),
}))

import { get } from "@vercel/blob"
import { readCohortSummary } from "../io"

const validCohort = {
  updatedAt: "2026-04-27T00:00:00.000Z",
  cohorts: [],
  revenue: { daily: [], total: { sumUsd: 0, purchasers: 0 } },
}

function blob(payload: unknown, statusCode = 200) {
  return {
    statusCode,
    stream: new Blob([JSON.stringify(payload)]).stream(),
  } as unknown as Awaited<ReturnType<typeof get>>
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, "warn").mockImplementation(() => {})
  vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("readCohortSummary", () => {
  it("returns null when blob is absent (404)", async () => {
    vi.mocked(get).mockResolvedValueOnce(blob(null, 404))
    const r = await readCohortSummary("game1")
    expect(r).toBeNull()
  })

  it("throws when blob fetch fails (5xx)", async () => {
    vi.mocked(get).mockResolvedValueOnce(blob(null, 503))
    await expect(readCohortSummary("game1")).rejects.toThrow(/blob_fetch_failed/)
  })

  it("throws when blob get itself rejects (network)", async () => {
    vi.mocked(get).mockRejectedValueOnce(new Error("network down"))
    await expect(readCohortSummary("game1")).rejects.toThrow(/blob_fetch_failed/)
  })

  it("throws when JSON is malformed", async () => {
    vi.mocked(get).mockResolvedValueOnce({
      statusCode: 200,
      stream: new Blob(["not-json{{"]).stream(),
    } as unknown as Awaited<ReturnType<typeof get>>)
    await expect(readCohortSummary("game1")).rejects.toThrow(/blob_parse_failed/)
  })

  it("throws when schema validation fails", async () => {
    vi.mocked(get).mockResolvedValueOnce(blob({ wrong: "shape" }))
    await expect(readCohortSummary("game1")).rejects.toThrow(/schema_invalid/)
  })

  it("returns parsed CohortSummary on success", async () => {
    vi.mocked(get).mockResolvedValueOnce(blob(validCohort))
    const r = await readCohortSummary("game1")
    expect(r).not.toBeNull()
    expect(r?.updatedAt).toBe("2026-04-27T00:00:00.000Z")
  })
})
