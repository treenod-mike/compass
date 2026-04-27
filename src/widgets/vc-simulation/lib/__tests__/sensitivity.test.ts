import { describe, expect, test } from "vitest"
import { readFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import {
  buildIfThenScenarios,
  findUaShareThresholdForBep,
  tornadoSensitivity,
  type SimContext,
} from "../sensitivity"
import { DEFAULT_OFFER } from "@/shared/api/vc-simulation"
import type { LstmSnapshot } from "@/shared/api/vc-simulation"

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURE_PATH = join(
  __dirname,
  "../../../../shared/api/vc-simulation/__tests__/fixtures/lstm.valid.json",
)
const LSTM: LstmSnapshot = JSON.parse(readFileSync(FIXTURE_PATH, "utf-8"))

const ctx: SimContext = {
  gameId: "test_game",
  lstmSnapshot: LSTM,
  appsflyerInitialCash: 500_000,
  bayesianDeltaLtv: null,
}

describe("tornadoSensitivity", () => {
  test("returns one entry per known lever (5 total)", () => {
    const impacts = tornadoSensitivity(DEFAULT_OFFER, ctx)
    expect(impacts).toHaveLength(5)
    expect(impacts.map((i) => i.leverKey).sort()).toEqual(
      ["deltaLtv", "horizonMonths", "hurdleRate", "investmentUsd", "uaSharePct"].sort(),
    )
  })

  test("uaSharePct moves BEP (not invariant)", () => {
    const impacts = tornadoSensitivity(DEFAULT_OFFER, ctx)
    const ua = impacts.find((i) => i.leverKey === "uaSharePct")
    expect(ua).toBeDefined()
    expect(ua!.invariant).toBe(false)
  })

  test("investmentUsd is BEP-invariant", () => {
    const impacts = tornadoSensitivity(DEFAULT_OFFER, ctx)
    const inv = impacts.find((i) => i.leverKey === "investmentUsd")
    expect(inv).toBeDefined()
    expect(inv!.invariant).toBe(true)
  })

  test("hurdleRate is BEP-invariant", () => {
    const impacts = tornadoSensitivity(DEFAULT_OFFER, ctx)
    const inv = impacts.find((i) => i.leverKey === "hurdleRate")
    expect(inv).toBeDefined()
    expect(inv!.invariant).toBe(true)
  })
})

describe("buildIfThenScenarios", () => {
  test("returns three scenarios in fixed lever order", () => {
    const scenarios = buildIfThenScenarios(DEFAULT_OFFER, ctx)
    expect(scenarios.map((s) => s.leverKey)).toEqual([
      "uaSharePct",
      "horizonMonths",
      "deltaLtv",
    ])
  })

  test("uaSharePct +10%p scenario newValueLabel matches expected percent", () => {
    const scenarios = buildIfThenScenarios(DEFAULT_OFFER, ctx)
    expect(scenarios[0].newValueLabel).toBe(`${DEFAULT_OFFER.uaSharePct + 10}%`)
  })

  test("higher UA share shortens or matches BEP (typically)", () => {
    const scenarios = buildIfThenScenarios(DEFAULT_OFFER, ctx)
    const ua = scenarios[0]
    if (ua.delta != null) {
      expect(ua.delta).toBeLessThanOrEqual(0)
    }
  })
})

describe("findUaShareThresholdForBep", () => {
  test("returns a percentage when BEP is reachable somewhere in [10, 100]", () => {
    const threshold = findUaShareThresholdForBep(DEFAULT_OFFER, ctx)
    if (threshold !== null) {
      expect(threshold).toBeGreaterThanOrEqual(10)
      expect(threshold).toBeLessThanOrEqual(100)
      expect(threshold % 5).toBe(0)
    }
  })
})
