// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react"
import { RegisterModal } from "../ui/register-modal"

describe("RegisterModal", () => {
  beforeEach(() => {
    global.fetch = vi.fn()
  })

  afterEach(() => {
    cleanup()
  })

  it("renders 5 form fields when open", () => {
    render(<RegisterModal open onClose={() => {}} onSuccess={() => {}} />)
    expect(screen.getByLabelText(/dev.?token/i)).toBeTruthy()
    expect(screen.getByLabelText(/app.?id/i)).toBeTruthy()
    expect(screen.getByLabelText(/label|레이블/i)).toBeTruthy()
    expect(screen.getByLabelText(/game|게임/i)).toBeTruthy()
    expect(screen.getByLabelText(/currency|통화/i)).toBeTruthy()
  })

  it("shows inline validation error when dev_token too short", async () => {
    render(<RegisterModal open onClose={() => {}} onSuccess={() => {}} />)
    fireEvent.change(screen.getByLabelText(/dev.?token/i), { target: { value: "short" } })
    fireEvent.change(screen.getByLabelText(/app.?id/i), { target: { value: "com.x" } })
    fireEvent.change(screen.getByLabelText(/label|레이블/i), { target: { value: "Test" } })
    fireEvent.click(screen.getByRole("button", { name: /저장|register|submit/i }))
    await waitFor(() => {
      expect(screen.getByText(/20|짧|min/i)).toBeTruthy()
    })
  })

  it("calls onSuccess with appId when 202 returned", async () => {
    ;(global.fetch as any).mockResolvedValue({
      ok: true, status: 202,
      json: async () => ({ appId: "com.x", status: "backfilling", accountId: "acc_a1b2c3d4" }),
    })
    const onSuccess = vi.fn()
    render(<RegisterModal open onClose={() => {}} onSuccess={onSuccess} />)
    fireEvent.change(screen.getByLabelText(/dev.?token/i), { target: { value: "x".repeat(25) } })
    fireEvent.change(screen.getByLabelText(/app.?id/i), { target: { value: "com.x" } })
    fireEvent.change(screen.getByLabelText(/label|레이블/i), { target: { value: "Test" } })
    fireEvent.click(screen.getByRole("button", { name: /저장|register|submit/i }))
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith("com.x"))
  })

  it("shows error when register returns 401", async () => {
    ;(global.fetch as any).mockResolvedValue({
      ok: false, status: 401,
      json: async () => ({ error: "credential_invalid" }),
    })
    render(<RegisterModal open onClose={() => {}} onSuccess={() => {}} />)
    fireEvent.change(screen.getByLabelText(/dev.?token/i), { target: { value: "x".repeat(25) } })
    fireEvent.change(screen.getByLabelText(/app.?id/i), { target: { value: "com.x" } })
    fireEvent.change(screen.getByLabelText(/label|레이블/i), { target: { value: "Test" } })
    fireEvent.click(screen.getByRole("button", { name: /저장|register|submit/i }))
    await waitFor(() => {
      expect(screen.getByText(/토큰|invalid|401|유효/i)).toBeTruthy()
    })
  })
})
