// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import { FailureHistoryTab } from "../ui/failure-history-tab"

afterEach(cleanup)

const entry = (i: number, t: string) => ({
  at: `2026-04-${String(i).padStart(2, "0")}T00:00:00.000Z`,
  type: t,
  message: `error ${i}`,
  report: "installs_report",
})

describe("FailureHistoryTab", () => {
  it("renders entries reverse-chronological (most recent first)", () => {
    const items = [entry(1, "auth_invalid"), entry(2, "throttled"), entry(3, "partial")]
    render(<FailureHistoryTab appId="com.x" failureHistory={items as any} onRetry={() => {}} />)
    const messages = screen.getAllByText(/^error \d+$/)
    expect(messages[0].textContent).toContain("error 3")
    expect(messages[2].textContent).toContain("error 1")
  })

  it("limits display to 10 entries (already capped upstream but defensive)", () => {
    const items = Array.from({ length: 15 }, (_, i) => entry(i + 1, "partial"))
    render(<FailureHistoryTab appId="com.x" failureHistory={items as any} onRetry={() => {}} />)
    const messages = screen.getAllByText(/^error \d+$/)
    expect(messages.length).toBeLessThanOrEqual(10)
  })

  it("retry button calls onRetry with appId", () => {
    const onRetry = vi.fn()
    render(<FailureHistoryTab appId="com.x" failureHistory={[entry(1, "partial")] as any} onRetry={onRetry} />)
    fireEvent.click(screen.getByRole("button", { name: /재시도|retry/i }))
    expect(onRetry).toHaveBeenCalledWith("com.x")
  })
})
