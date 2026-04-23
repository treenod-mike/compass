// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import { SyncProgressCard } from "../ui/sync-progress-card"

afterEach(cleanup)

describe("SyncProgressCard", () => {
  it("renders progress fraction step/total + currentReport", () => {
    render(
      <SyncProgressCard
        progress={{ step: 3, total: 5, currentReport: "in_app_events_report", rowsFetched: 200 }}
      />,
    )
    expect(screen.getByText(/3.*\/.*5/)).toBeTruthy()
    expect(screen.getByText(/in_app_events_report/)).toBeTruthy()
    expect(screen.getByText(/200/)).toBeTruthy()
  })

  it("renders progress bar width proportional to step/total (60% for 3/5)", () => {
    const { container } = render(
      <SyncProgressCard progress={{ step: 3, total: 5, rowsFetched: 0 }} />,
    )
    const bar = container.querySelector("[role=\"progressbar\"]") as HTMLElement | null
    expect(bar).toBeTruthy()
    expect(bar?.style.width).toMatch(/60%/)
  })
})
