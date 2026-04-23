import { describe, it, expect } from "vitest"
import {
  AccountSchema,
  AppSchema,
  StateSchema,
  CohortSummarySchema,
  RegisterRequestSchema,
} from "../types"

describe("AccountSchema", () => {
  it("accepts valid account", () => {
    const ok = AccountSchema.safeParse({
      id: "acc_ab12cdef",
      tokenHash: "a".repeat(64),
      encryptedToken: "iv:ct:tag",
      currency: "KRW",
      label: "Treenod 본계정",
      createdAt: "2026-04-23T00:00:00.000Z",
    })
    expect(ok.success).toBe(true)
  })

  it("rejects bad id prefix", () => {
    const bad = AccountSchema.safeParse({
      id: "wrong_ab12cdef",
      tokenHash: "a".repeat(64),
      encryptedToken: "x",
      currency: "KRW",
      label: "x",
      createdAt: "2026-04-23T00:00:00.000Z",
    })
    expect(bad.success).toBe(false)
  })
})

describe("StateSchema", () => {
  it("accepts backfilling state with null syncLock", () => {
    const ok = StateSchema.safeParse({
      appId: "com.example.app",
      status: "backfilling",
      progress: { step: 1, total: 5, rowsFetched: 135 },
      callsUsedToday: 2,
      callsResetAt: "2026-04-24T00:00:00.000Z",
      syncLock: null,
      failureHistory: [],
    })
    expect(ok.success).toBe(true)
  })

  it("rejects unknown status", () => {
    const bad = StateSchema.safeParse({
      appId: "com.example.app",
      status: "exploding",
      progress: { step: 0, total: 5, rowsFetched: 0 },
      callsUsedToday: 0,
      callsResetAt: "2026-04-24T00:00:00.000Z",
      syncLock: null,
      failureHistory: [],
    })
    expect(bad.success).toBe(false)
  })
})

describe("CohortSummarySchema", () => {
  it("accepts partial retention metrics", () => {
    const ok = CohortSummarySchema.safeParse({
      updatedAt: "2026-04-23T00:00:00.000Z",
      cohorts: {
        "2026-04-10": { n: 12, d1_retained: 5 },
      },
      revenue: {
        daily: [{ date: "2026-04-10", sumUsd: 123.45, purchasers: 3 }],
        total: { sumUsd: 123.45, purchasers: 3 },
      },
    })
    expect(ok.success).toBe(true)
  })
})

describe("RegisterRequestSchema", () => {
  it("defaults home_currency to KRW", () => {
    const parsed = RegisterRequestSchema.parse({
      dev_token: "a".repeat(32),
      app_id: "com.example.app",
      app_label: "Example",
      game_key: "match-league",
    })
    expect(parsed.home_currency).toBe("KRW")
  })
})
