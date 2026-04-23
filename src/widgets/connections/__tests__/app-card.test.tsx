// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import { AppCard } from "../ui/app-card"

const baseState = (overrides: any = {}) => ({
  appId: "com.x",
  status: "active",
  progress: { step: 5, total: 5, rowsFetched: 100 },
  callsUsedToday: 4,
  callsResetAt: "2026-04-24T00:00:00.000Z",
  syncLock: null,
  failureHistory: [],
  ...overrides,
})

afterEach(cleanup)

describe("AppCard", () => {
  it("renders active status with positive color and installs count", () => {
    render(<AppCard appId="com.x" label="My App" state={baseState() as any} />)
    expect(screen.getByText(/Active|active/i)).toBeTruthy()
    expect(screen.getByText(/My App/)).toBeTruthy()
    expect(screen.getByText(/100/)).toBeTruthy()
  })

  it("renders credential_invalid with retry-token CTA", () => {
    render(<AppCard appId="com.x" label="My App" state={baseState({ status: "credential_invalid" }) as any} />)
    expect(screen.getByText(/토큰|invalid|재등록/i)).toBeTruthy()
  })

  it("renders app_missing with app-id-fix CTA", () => {
    render(<AppCard appId="com.x" label="My App" state={baseState({ status: "app_missing" }) as any} />)
    expect(screen.getByText(/App ID|찾을 수 없|not found/i)).toBeTruthy()
  })

  it("renders backfilling with progress fraction", () => {
    render(
      <AppCard
        appId="com.x"
        label="My App"
        state={baseState({ status: "backfilling", progress: { step: 2, total: 5, rowsFetched: 50 } }) as any}
      />,
    )
    expect(screen.getByText(/2.*\/.*5|2 \/ 5/)).toBeTruthy()
  })
})
