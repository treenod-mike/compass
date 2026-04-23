// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { useAfState } from "../use-af-state"

describe("useAfState", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    global.fetch = vi.fn()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it("polls every 2s while status != active and stops on active", async () => {
    let call = 0
    ;(global.fetch as any).mockImplementation(async () => ({
      ok: true,
      json: async () => ({
        appId: "com.x",
        status: ++call < 3 ? "backfilling" : "active",
        progress: { step: call, total: 5, rowsFetched: 100 * call },
        callsUsedToday: 0,
        callsResetAt: "2026-04-24T00:00:00Z",
        syncLock: null,
        failureHistory: [],
      }),
    }))
    const { result } = renderHook(() => useAfState("com.x"))
    await vi.waitFor(() => expect(result.current.state?.status).toBe("backfilling"))
    await vi.advanceTimersByTimeAsync(2000)
    await vi.advanceTimersByTimeAsync(2000)
    await vi.waitFor(() => expect(result.current.state?.status).toBe("active"))
    // After active: no more calls
    const callCountAfterActive = (global.fetch as any).mock.calls.length
    await vi.advanceTimersByTimeAsync(10_000)
    expect((global.fetch as any).mock.calls.length).toBe(callCountAfterActive)
  })

  it("returns error state on 404", async () => {
    ;(global.fetch as any).mockResolvedValue({ ok: false, status: 404 })
    const { result } = renderHook(() => useAfState("ghost"))
    await vi.waitFor(() => expect(result.current.error).toBeTruthy())
  })

  it("returns null state when appId is null (no fetch)", async () => {
    const { result } = renderHook(() => useAfState(null))
    expect(result.current.state).toBeNull()
    expect((global.fetch as any).mock?.calls?.length ?? 0).toBe(0)
  })
})
