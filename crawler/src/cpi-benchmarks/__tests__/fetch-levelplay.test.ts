import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { fetchLevelPlayCpi } from "../fetch-levelplay.js"

describe("fetchLevelPlayCpi", () => {
  const originalFetch = globalThis.fetch
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
    globalThis.fetch = originalFetch
  })

  it("returns rows on 200 response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ rows: [{ platform: "iOS", country: "Japan", genre: "Casual", cpi: 3.8 }] }),
    } as Response) as typeof fetch

    const rows = await fetchLevelPlayCpi("https://levelplay.example/api")
    expect(rows).toEqual([{ platform: "iOS", country: "Japan", genre: "Casual", cpi: 3.8 }])
  })

  it("retries 3 times on 5xx then throws", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 503 } as Response)
    globalThis.fetch = fetchMock as typeof fetch

    const promise = fetchLevelPlayCpi("https://levelplay.example/api")
    const assertion = expect(promise).rejects.toThrow(/fail after 3 attempts/i)
    await vi.runAllTimersAsync()
    await assertion
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it("throws on unexpected JSON shape", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ unexpected: true }),
    } as Response) as typeof fetch

    const promise = fetchLevelPlayCpi("https://levelplay.example/api")
    const assertion = expect(promise).rejects.toThrow(/unexpected/i)
    await vi.runAllTimersAsync()
    await assertion
  })
})
