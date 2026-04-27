# UA-spend × LSTM-revenue Composite Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace mock ROAS / payback values on the Executive Overview dashboard (KPI cards + HeroVerdict / PortfolioVerdict band) with real numbers computed from cohort UA spend (AppsFlyer) spliced into LSTM revenue forecast.

**Architecture:** Pure compute function (`computeRealKpi`) in a new `src/shared/api/composite/` domain folder + thin React hook in `src/widgets/dashboard/lib/use-real-kpi.ts`. The hook composes `useLiveAfData()` + `loadRevenueSnapshot()` and feeds the result to KPICards, HeroVerdict, and PortfolioVerdict from a single source of truth. Status machine has 4 states (`real` / `insufficient` / `fxUnsupported` / `mock`) with precedence-ordered gating; mock fallback values are passed through verbatim when not `real`.

**Tech Stack:** TypeScript, Vitest, React 19 + Next.js 15, FSD 2.1 layering. No new runtime dependencies.

**선행 문서:** [UA-spend × LSTM-revenue Composite Layer 설계](../specs/2026-04-27-ua-revenue-composite-layer-design.md)

---

## File Structure

### New files (🆕 4)

```
src/shared/api/composite/
├── types.ts                               # RealKpiInput / RealKpiResult / RealKpiStatus / RealKpiFreshness
├── roas-payback.ts                        # computeRealKpi pure function
└── __tests__/
    └── roas-payback.test.ts               # ~19 vitest cases

src/widgets/dashboard/lib/
└── use-real-kpi.ts                        # thin React hook (useLiveAfData + snapshot + computeRealKpi)
```

### Modified files (✏️ 4)

```
src/widgets/dashboard/ui/kpi-cards.tsx         # add useRealKpi merge for kpi.roas / kpi.payback + freshness badge
src/app/(dashboard)/dashboard/page.tsx         # call useRealKpi, thread payback band to HeroVerdict + PortfolioVerdict
src/shared/i18n/dictionary.ts                  # 6 new keys × ko/en
```

(`hero-verdict.tsx` / `portfolio-verdict.tsx` already accept the `payback{p10,p50,p90}` prop shape — no internal changes needed.)

---

## Task 1: Create types.ts

**Files:**
- Create: `src/shared/api/composite/types.ts`

- [ ] **Step 1: Create the file with input/output types**

```ts
// src/shared/api/composite/types.ts
import type { CohortSummary } from "../appsflyer"
import type { RevenueSnapshot } from "../lstm/revenue-snapshot"

export type RealKpiStatus =
  | "real"
  | "insufficient"
  | "fxUnsupported"
  | "mock"

export type RealKpiFreshness = "ML1" | "ML2" | null

export type RealKpiBand = {
  p10: number
  p50: number
  p90: number
}

export type RealKpiInput = {
  gameId: string
  cohortSummary: CohortSummary | null
  revenueSnapshot: RevenueSnapshot
  mockFallback: {
    roas: RealKpiBand    // %
    payback: RealKpiBand // days
  }
  now?: Date
}

export type RealKpiResult = {
  roas: RealKpiBand            // %
  payback: RealKpiBand          // days (≤ horizon, capped)
  status: RealKpiStatus
  basisDays: number
  observedRevenueUsd: number
  forecastRevenueUsd: number
  spendUsd: number | null
  freshness: RealKpiFreshness
}
```

- [ ] **Step 2: Verify tsc passes**

Run: `npx tsc --noEmit`
Expected: clean exit (no errors). The `CohortSummary` and `RevenueSnapshot` imports must resolve — both already exist on main.

- [ ] **Step 3: Commit**

```bash
git add src/shared/api/composite/types.ts
git commit -m "feat(composite): add RealKpi input/output types"
```

---

## Task 2: Stub computeRealKpi

**Files:**
- Create: `src/shared/api/composite/roas-payback.ts`

- [ ] **Step 1: Create stub that always returns mockFallback**

```ts
// src/shared/api/composite/roas-payback.ts
import type { RealKpiInput, RealKpiResult } from "./types"

export function computeRealKpi(input: RealKpiInput): RealKpiResult {
  return {
    roas: input.mockFallback.roas,
    payback: input.mockFallback.payback,
    status: "mock",
    basisDays: 0,
    observedRevenueUsd: 0,
    forecastRevenueUsd: 0,
    spendUsd: null,
    freshness: "ML1",
  }
}
```

- [ ] **Step 2: Verify tsc passes**

Run: `npx tsc --noEmit`
Expected: clean exit.

- [ ] **Step 3: Commit**

```bash
git add src/shared/api/composite/roas-payback.ts
git commit -m "feat(composite): stub computeRealKpi returning mockFallback"
```

---

## Task 3: Write unit tests (RED)

**Files:**
- Create: `src/shared/api/composite/__tests__/roas-payback.test.ts`

- [ ] **Step 1: Build a fixture helper at the top of the test file**

```ts
// src/shared/api/composite/__tests__/roas-payback.test.ts
import { describe, expect, it } from "vitest"
import type { CohortSummary } from "../../appsflyer"
import type { RevenueSnapshot } from "../../lstm/revenue-snapshot"
import { computeRealKpi } from "../roas-payback"
import type { RealKpiInput } from "../types"

const MOCK_FALLBACK: RealKpiInput["mockFallback"] = {
  roas: { p10: 100, p50: 142, p90: 180 },
  payback: { p10: 35, p50: 47, p90: 62 },
}

const NOW = new Date("2026-04-27T00:00:00Z")

function makeSnapshot(opts: {
  generatedDaysAgo?: number
  gameId?: string
  installsAssumption?: number
  // generator returning revenueP10/50/90 for day d (1-indexed)
  curve?: (d: number) => { p10: number; p50: number; p90: number }
  horizon?: number
} = {}): RevenueSnapshot {
  const generatedAt = new Date(NOW.getTime() - (opts.generatedDaysAgo ?? 1) * 86_400_000).toISOString()
  const gameId = opts.gameId ?? "poco"
  const installsAssumption = opts.installsAssumption ?? 1000
  const horizon = opts.horizon ?? 365
  const curve = opts.curve ?? ((d: number) => ({
    p10: 8 * d * 0.8,
    p50: 8 * d,
    p90: 8 * d * 1.2,
  }))
  const points = Array.from({ length: horizon }, (_, i) => {
    const d = i + 1
    const c = curve(d)
    return {
      day: d,
      dauP50: 100,
      revenueP10: c.p10,
      revenueP50: c.p50,
      revenueP90: c.p90,
    }
  })
  return {
    schema_version: "1.0",
    generated_at: generatedAt,
    source_retention_at: generatedAt,
    arpdau: { perGame: { [gameId]: 0.4 }, currency: "USD", windowDays: 14 },
    installsAssumption: { perGame: { [gameId]: installsAssumption }, method: "trailing-14d-mean" },
    forecast: { [gameId]: { points } },
  }
}

function makeCohortSummary(opts: {
  installs?: number
  spendUsd?: number | null
  observedRevenueUsd?: number
  basisDays?: number
} = {}): CohortSummary {
  const installs = opts.installs ?? 1000
  const spendUsd = opts.spendUsd ?? 2500
  const observedRevenueUsd = opts.observedRevenueUsd ?? 200
  const basisDays = opts.basisDays ?? 14
  // Build cohorts so weighted-mean age == basisDays:
  // single cohort with installs at NOW − basisDays
  const cohortDate = new Date(NOW.getTime() - basisDays * 86_400_000).toISOString().slice(0, 10)
  return {
    updatedAt: NOW.toISOString(),
    cohorts: [
      {
        cohortDate,
        installs,
        retainedByDay: { d1: null, d7: null, d30: null },
        uaSpendUsd: spendUsd,
      },
    ],
    revenue: {
      daily: [],
      total: { sumUsd: observedRevenueUsd, purchasers: Math.floor(installs * 0.05) },
    },
    spend: {
      totalUsd: spendUsd,
      homeCurrency: spendUsd === null ? "JPY" : "USD",
    },
  }
}
```

- [ ] **Step 2: Add status-gating tests (Group 1, 7 cases)**

```ts
describe("computeRealKpi — status gating", () => {
  it("returns mock + ML1 when cohortSummary is null", () => {
    const r = computeRealKpi({
      gameId: "poco",
      cohortSummary: null,
      revenueSnapshot: makeSnapshot(),
      mockFallback: MOCK_FALLBACK,
      now: NOW,
    })
    expect(r.status).toBe("mock")
    expect(r.freshness).toBe("ML1")
    expect(r.roas).toEqual(MOCK_FALLBACK.roas)
    expect(r.payback).toEqual(MOCK_FALLBACK.payback)
  })

  it("returns fxUnsupported + ML2 when spend.totalUsd is null", () => {
    const r = computeRealKpi({
      gameId: "poco",
      cohortSummary: makeCohortSummary({ spendUsd: null }),
      revenueSnapshot: makeSnapshot(),
      mockFallback: MOCK_FALLBACK,
      now: NOW,
    })
    expect(r.status).toBe("fxUnsupported")
    expect(r.freshness).toBe("ML2")
    expect(r.spendUsd).toBeNull()
  })

  it("returns insufficient + ML1 when basisDays < 14", () => {
    const r = computeRealKpi({
      gameId: "poco",
      cohortSummary: makeCohortSummary({ basisDays: 7 }),
      revenueSnapshot: makeSnapshot(),
      mockFallback: MOCK_FALLBACK,
      now: NOW,
    })
    expect(r.status).toBe("insufficient")
    expect(r.freshness).toBe("ML1")
    expect(r.basisDays).toBe(7)
  })

  it("returns mock + ML2 when snapshot is stale (>7d)", () => {
    const r = computeRealKpi({
      gameId: "poco",
      cohortSummary: makeCohortSummary(),
      revenueSnapshot: makeSnapshot({ generatedDaysAgo: 8 }),
      mockFallback: MOCK_FALLBACK,
      now: NOW,
    })
    expect(r.status).toBe("mock")
    expect(r.freshness).toBe("ML2")
  })

  it("returns mock + ML2 when forecast for gameId is missing", () => {
    const r = computeRealKpi({
      gameId: "missing-game",
      cohortSummary: makeCohortSummary(),
      revenueSnapshot: makeSnapshot({ gameId: "poco" }),
      mockFallback: MOCK_FALLBACK,
      now: NOW,
    })
    expect(r.status).toBe("mock")
    expect(r.freshness).toBe("ML2")
  })

  it("returns insufficient + ML1 when installs is 0", () => {
    const r = computeRealKpi({
      gameId: "poco",
      cohortSummary: makeCohortSummary({ installs: 0, spendUsd: 0 }),
      revenueSnapshot: makeSnapshot(),
      mockFallback: MOCK_FALLBACK,
      now: NOW,
    })
    expect(r.status).toBe("insufficient")
    expect(r.freshness).toBe("ML1")
  })

  it("returns real + null badge when all gates pass", () => {
    const r = computeRealKpi({
      gameId: "poco",
      cohortSummary: makeCohortSummary({ installs: 1000, spendUsd: 2500, observedRevenueUsd: 200, basisDays: 14 }),
      revenueSnapshot: makeSnapshot({ installsAssumption: 1000 }),
      mockFallback: MOCK_FALLBACK,
      now: NOW,
    })
    expect(r.status).toBe("real")
    expect(r.freshness).toBeNull()
  })
})
```

- [ ] **Step 3: Add splice-continuity tests (Group 2, 4 cases)**

```ts
describe("computeRealKpi — splice continuity", () => {
  // Curve giving a clean linear daily revenueP50 = $1 per install per day at N=1000
  // → forecastRevenueUsd at horizon = horizon × 1000 / 1000 = horizon (per install)
  const flatCurve = () => ({ p10: 0.8, p50: 1.0, p90: 1.2 })

  it("observedRevenueUsd is preserved verbatim from cohortSummary", () => {
    const r = computeRealKpi({
      gameId: "poco",
      cohortSummary: makeCohortSummary({ installs: 1000, observedRevenueUsd: 200, basisDays: 14 }),
      revenueSnapshot: makeSnapshot({ installsAssumption: 1000, curve: flatCurve }),
      mockFallback: MOCK_FALLBACK,
      now: NOW,
    })
    expect(r.observedRevenueUsd).toBe(200)
  })

  it("forecastRevenueUsd equals (cumPerInstall(horizon, P50) − observedPerInstall) × installs", () => {
    // observedPerInstall = 200 / 1000 = 0.2
    // cumPerInstall(365, P50) = 0.2 + Σ_{k=15..365} 1.0 × (1/1000) = 0.2 + 351×0.001 = 0.551
    // forecastRevenueUsd = (0.551 − 0.2) × 1000 = 351
    const r = computeRealKpi({
      gameId: "poco",
      cohortSummary: makeCohortSummary({ installs: 1000, observedRevenueUsd: 200, basisDays: 14 }),
      revenueSnapshot: makeSnapshot({ installsAssumption: 1000, curve: flatCurve, horizon: 365 }),
      mockFallback: MOCK_FALLBACK,
      now: NOW,
    })
    expect(r.forecastRevenueUsd).toBeCloseTo(351, 1)
  })

  it("when basisDays === horizon, no forecast tail is added (forecastRevenueUsd ≈ 0)", () => {
    const r = computeRealKpi({
      gameId: "poco",
      cohortSummary: makeCohortSummary({ installs: 1000, observedRevenueUsd: 500, basisDays: 365 }),
      revenueSnapshot: makeSnapshot({ installsAssumption: 1000, curve: flatCurve, horizon: 365 }),
      mockFallback: MOCK_FALLBACK,
      now: NOW,
    })
    expect(r.forecastRevenueUsd).toBeCloseTo(0, 1)
  })

  it("ROAS scales linearly with cumulative-revenue / spend", () => {
    // observedRevenueUsd = 600, spend = 600 → at d=14 ROAS exactly 100% if curve adds 0 forecast.
    // cum_per_install(365, P50) = 0.6 + (365−14) × 0.001 = 0.951
    // ROAS_p50 = 0.951 / (600/1000) × 100 = 158.5%
    const r = computeRealKpi({
      gameId: "poco",
      cohortSummary: makeCohortSummary({ installs: 1000, spendUsd: 600, observedRevenueUsd: 600, basisDays: 14 }),
      revenueSnapshot: makeSnapshot({ installsAssumption: 1000, curve: flatCurve }),
      mockFallback: MOCK_FALLBACK,
      now: NOW,
    })
    expect(r.roas.p50).toBeCloseTo(158.5, 1)
  })
})
```

- [ ] **Step 4: Add inverted-mapping tests (Group 3, 3 cases)**

```ts
describe("computeRealKpi — inverted band mapping", () => {
  // Build a curve where P10/P50/P90 differ enough for payback to land on different days.
  // Curve constants: revenueP10 = 0.5, P50 = 1.0, P90 = 2.0 per cohort of N=1000 → 0.0005/0.001/0.002 per install per day.
  const split = (d: number) => ({ p10: 0.5, p50: 1.0, p90: 2.0 })

  it("observed revenue > 0 yields shorter payback than the zero-observed equivalent (splice baseline)", () => {
    const withObserved = computeRealKpi({
      gameId: "poco",
      cohortSummary: makeCohortSummary({ installs: 1000, spendUsd: 100, observedRevenueUsd: 50, basisDays: 14 }),
      revenueSnapshot: makeSnapshot({ installsAssumption: 1000, curve: split }),
      mockFallback: MOCK_FALLBACK,
      now: NOW,
    })
    const zeroObserved = computeRealKpi({
      gameId: "poco",
      cohortSummary: makeCohortSummary({ installs: 1000, spendUsd: 100, observedRevenueUsd: 0, basisDays: 14 }),
      revenueSnapshot: makeSnapshot({ installsAssumption: 1000, curve: split }),
      mockFallback: MOCK_FALLBACK,
      now: NOW,
    })
    expect(withObserved.status).toBe("real")
    expect(zeroObserved.status).toBe("real")
    expect(withObserved.payback.p50).toBeLessThan(zeroObserved.payback.p50)
  })

  it("payback.p50 with mid curve sits between p10 and p90", () => {
    // Use a curve that makes payback feasible within 365d.
    // observed=0, spend=100, installs=1000 → CPI=0.1. 0 + (d−14)×0.001 (P50) ≥ 0.1 → d=114
    const r = computeRealKpi({
      gameId: "poco",
      cohortSummary: makeCohortSummary({ installs: 1000, spendUsd: 100, observedRevenueUsd: 0, basisDays: 14 }),
      revenueSnapshot: makeSnapshot({ installsAssumption: 1000, curve: split }),
      mockFallback: MOCK_FALLBACK,
      now: NOW,
    })
    // P90 (2.0) → first hit at d−14 ≥ 50 → d=64 → payback.p10 = 64
    // P50 (1.0) → first hit at d=114 → payback.p50 = 114
    // P10 (0.5) → first hit at d−14 ≥ 200 → d=214 → payback.p90 = 214
    expect(r.payback.p10).toBe(64)
    expect(r.payback.p50).toBe(114)
    expect(r.payback.p90).toBe(214)
  })

  it("revenue.P10 always maps to payback.p90 (slowest)", () => {
    const r = computeRealKpi({
      gameId: "poco",
      cohortSummary: makeCohortSummary({ installs: 1000, spendUsd: 100, observedRevenueUsd: 0, basisDays: 14 }),
      revenueSnapshot: makeSnapshot({ installsAssumption: 1000, curve: split }),
      mockFallback: MOCK_FALLBACK,
      now: NOW,
    })
    expect(r.payback.p90).toBeGreaterThan(r.payback.p50)
    expect(r.payback.p50).toBeGreaterThan(r.payback.p10)
  })
})
```

- [ ] **Step 5: Add 365d-miss tests (Group 4, 2 cases)**

```ts
describe("computeRealKpi — payback misses horizon", () => {
  // Curve with P50 too slow to recover within horizon
  const tooSlow = () => ({ p10: 0.0001, p50: 0.0002, p90: 0.001 })

  it("demotes to insufficient when P50 misses horizon", () => {
    const r = computeRealKpi({
      gameId: "poco",
      cohortSummary: makeCohortSummary({ installs: 1000, spendUsd: 10_000, observedRevenueUsd: 0, basisDays: 14 }),
      revenueSnapshot: makeSnapshot({ installsAssumption: 1000, curve: tooSlow }),
      mockFallback: MOCK_FALLBACK,
      now: NOW,
    })
    expect(r.status).toBe("insufficient")
    expect(r.payback).toEqual(MOCK_FALLBACK.payback)
  })

  it("caps payback.p90 at horizon when only P10 misses", () => {
    // Curve where P10 misses but P50/P90 hit within horizon
    const onlyP10Slow = () => ({ p10: 0.0001, p50: 1.0, p90: 2.0 })
    const r = computeRealKpi({
      gameId: "poco",
      cohortSummary: makeCohortSummary({ installs: 1000, spendUsd: 100, observedRevenueUsd: 0, basisDays: 14 }),
      revenueSnapshot: makeSnapshot({ installsAssumption: 1000, curve: onlyP10Slow }),
      mockFallback: MOCK_FALLBACK,
      now: NOW,
    })
    expect(r.status).toBe("real")
    expect(r.payback.p90).toBe(365)
  })
})
```

- [ ] **Step 6: Add zero-spend / zero-installs tests (Group 5, 2 cases) + mockFallback pass-through (Group 6, 1 case)**

```ts
describe("computeRealKpi — zero edge cases", () => {
  it("returns insufficient when spend === 0", () => {
    const r = computeRealKpi({
      gameId: "poco",
      cohortSummary: makeCohortSummary({ installs: 1000, spendUsd: 0 }),
      revenueSnapshot: makeSnapshot(),
      mockFallback: MOCK_FALLBACK,
      now: NOW,
    })
    expect(r.status).toBe("insufficient")
  })

  it("returns insufficient when installs === 0 (avoids divide-by-zero)", () => {
    const r = computeRealKpi({
      gameId: "poco",
      cohortSummary: makeCohortSummary({ installs: 0, spendUsd: 100 }),
      revenueSnapshot: makeSnapshot(),
      mockFallback: MOCK_FALLBACK,
      now: NOW,
    })
    expect(r.status).toBe("insufficient")
    expect(r.roas).toEqual(MOCK_FALLBACK.roas)
  })
})

describe("computeRealKpi — mockFallback pass-through", () => {
  it("returns mockFallback values verbatim for every non-real status", () => {
    const customFallback: RealKpiInput["mockFallback"] = {
      roas: { p10: 11, p50: 22, p90: 33 },
      payback: { p10: 44, p50: 55, p90: 66 },
    }
    const r = computeRealKpi({
      gameId: "poco",
      cohortSummary: null,
      revenueSnapshot: makeSnapshot(),
      mockFallback: customFallback,
      now: NOW,
    })
    expect(r.roas).toEqual(customFallback.roas)
    expect(r.payback).toEqual(customFallback.payback)
  })
})
```

- [ ] **Step 7: Run vitest to confirm all RED**

Run: `npx vitest run src/shared/api/composite/__tests__/roas-payback.test.ts`
Expected: 19 tests fail (stub returns mockFallback always — most assertions on `status: 'real'`, `roas.p50`, `payback.p10` etc. will mismatch).

- [ ] **Step 8: Commit**

```bash
git add src/shared/api/composite/__tests__/roas-payback.test.ts
git commit -m "test(composite): RED — 19 cases for computeRealKpi"
```

---

## Task 4: Implement computeRealKpi (GREEN)

**Files:**
- Modify: `src/shared/api/composite/roas-payback.ts`

- [ ] **Step 1: Replace the stub with the full implementation**

```ts
// src/shared/api/composite/roas-payback.ts
import type { CohortSummary } from "../appsflyer"
import type { RevenueSnapshot } from "../lstm/revenue-snapshot"
import type {
  RealKpiBand,
  RealKpiFreshness,
  RealKpiInput,
  RealKpiResult,
  RealKpiStatus,
} from "./types"

const MIN_BASIS_DAYS = 14
const SNAPSHOT_STALE_MS = 7 * 24 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

export function computeRealKpi(input: RealKpiInput): RealKpiResult {
  const { gameId, cohortSummary, revenueSnapshot, mockFallback } = input
  const now = input.now ?? new Date()

  if (cohortSummary === null) {
    return packMock("mock", "ML1", { basisDays: 0, spendUsd: null }, mockFallback)
  }

  const spend = cohortSummary.spend.totalUsd
  if (spend === null) {
    return packMock("fxUnsupported", "ML2", { basisDays: 0, spendUsd: null }, mockFallback)
  }

  const installs = cohortSummary.cohorts.reduce((s, c) => s + c.installs, 0)
  if (installs === 0 || spend <= 0) {
    return packMock("insufficient", "ML1", { basisDays: 0, spendUsd: spend }, mockFallback)
  }

  const basisDays = computeBasisDays(cohortSummary, now)
  if (basisDays < MIN_BASIS_DAYS) {
    return packMock("insufficient", "ML1", { basisDays, spendUsd: spend }, mockFallback)
  }

  const snapshotAge = now.getTime() - new Date(revenueSnapshot.generated_at).getTime()
  if (snapshotAge > SNAPSHOT_STALE_MS) {
    return packMock("mock", "ML2", { basisDays, spendUsd: spend }, mockFallback)
  }

  const game = revenueSnapshot.forecast[gameId]
  if (!game) {
    return packMock("mock", "ML2", { basisDays, spendUsd: spend }, mockFallback)
  }

  const N = revenueSnapshot.installsAssumption.perGame[gameId] ?? 1
  const horizon = game.points.length
  const observedRev = cohortSummary.revenue.total.sumUsd
  const cpi = spend / installs

  const cumP10 = (d: number) => cumPerInstall(d, "p10", basisDays, horizon, observedRev, installs, game.points, N)
  const cumP50 = (d: number) => cumPerInstall(d, "p50", basisDays, horizon, observedRev, installs, game.points, N)
  const cumP90 = (d: number) => cumPerInstall(d, "p90", basisDays, horizon, observedRev, installs, game.points, N)

  const roas: RealKpiBand = {
    p10: (cumP10(horizon) / cpi) * 100,
    p50: (cumP50(horizon) / cpi) * 100,
    p90: (cumP90(horizon) / cpi) * 100,
  }

  const hitP10 = firstHit(cumP10, cpi, horizon)
  const hitP50 = firstHit(cumP50, cpi, horizon)
  const hitP90 = firstHit(cumP90, cpi, horizon)

  if (hitP50 === null) {
    return packMock("insufficient", "ML1", { basisDays, spendUsd: spend }, mockFallback)
  }

  const payback: RealKpiBand = {
    p10: hitP90 ?? horizon,    // fast revenue → quick payback (P90 → p10)
    p50: hitP50,
    p90: hitP10 ?? horizon,    // slow revenue → late payback (P10 → p90)
  }

  const forecastRevenueUsd = cumP50(horizon) * installs - observedRev

  return {
    roas,
    payback,
    status: "real",
    basisDays,
    observedRevenueUsd: observedRev,
    forecastRevenueUsd,
    spendUsd: spend,
    freshness: null,
  }
}

function packMock(
  status: RealKpiStatus,
  freshness: RealKpiFreshness,
  meta: { basisDays: number; spendUsd: number | null },
  fallback: RealKpiInput["mockFallback"],
): RealKpiResult {
  return {
    roas: fallback.roas,
    payback: fallback.payback,
    status,
    basisDays: meta.basisDays,
    observedRevenueUsd: 0,
    forecastRevenueUsd: 0,
    spendUsd: meta.spendUsd,
    freshness,
  }
}

function computeBasisDays(cohortSummary: CohortSummary, now: Date): number {
  let weightedAgeDays = 0
  let totalInstalls = 0
  for (const c of cohortSummary.cohorts) {
    const cohortMs = new Date(`${c.cohortDate}T00:00:00Z`).getTime()
    const ageDays = (now.getTime() - cohortMs) / DAY_MS
    weightedAgeDays += ageDays * c.installs
    totalInstalls += c.installs
  }
  if (totalInstalls === 0) return 0
  return Math.floor(weightedAgeDays / totalInstalls)
}

function cumPerInstall(
  d: number,
  band: "p10" | "p50" | "p90",
  basisDays: number,
  horizon: number,
  observedRev: number,
  installs: number,
  points: RevenueSnapshot["forecast"][string]["points"],
  N: number,
): number {
  const observedPerInstall = observedRev / installs
  if (d <= basisDays) {
    return observedPerInstall * (d / basisDays)
  }
  let tail = 0
  const upTo = Math.min(d, horizon)
  for (let k = basisDays + 1; k <= upTo; k++) {
    const p = points[k - 1]
    const dailyPerInstall =
      band === "p10" ? p.revenueP10 / N
      : band === "p50" ? p.revenueP50 / N
      : p.revenueP90 / N
    tail += dailyPerInstall
  }
  return observedPerInstall + tail
}

function firstHit(
  cum: (d: number) => number,
  cpi: number,
  horizon: number,
): number | null {
  for (let d = 1; d <= horizon; d++) {
    if (cum(d) >= cpi) return d
  }
  return null
}
```

- [ ] **Step 2: Run vitest to verify all 19 tests pass**

Run: `npx vitest run src/shared/api/composite/__tests__/roas-payback.test.ts`
Expected: 19 passed. If any fail, debug the algorithm — common pitfalls:
- `basisDays` floor vs round (test fixtures use exact integer ages so floor works)
- Inverted mapping (`payback.p10` must come from `hitP90`)
- horizon vs `points.length` mismatch

- [ ] **Step 3: Run tsc**

Run: `npx tsc --noEmit`
Expected: clean exit.

- [ ] **Step 4: Commit**

```bash
git add src/shared/api/composite/roas-payback.ts
git commit -m "feat(composite): implement computeRealKpi — splice + inverted payback mapping"
```

---

## Task 5: Create useRealKpi hook

**Files:**
- Create: `src/widgets/dashboard/lib/use-real-kpi.ts`

- [ ] **Step 1: Create the hook**

```ts
// src/widgets/dashboard/lib/use-real-kpi.ts
"use client"
import { useMemo } from "react"
import { useLiveAfData } from "./use-live-af-data"
import { loadRevenueSnapshot } from "@/shared/api/lstm/revenue-snapshot"
import { computeRealKpi } from "@/shared/api/composite/roas-payback"
import type {
  RealKpiInput,
  RealKpiResult,
} from "@/shared/api/composite/types"

export function useRealKpi(
  gameId: string,
  mockFallback: RealKpiInput["mockFallback"],
): RealKpiResult {
  const { summary, state } = useLiveAfData()
  // Treat 'backfilling' as if cohort isn't ready yet — keeps computeRealKpi pure.
  const cohortSummary = state?.status === "backfilling" ? null : summary
  return useMemo(
    () =>
      computeRealKpi({
        gameId,
        cohortSummary,
        revenueSnapshot: loadRevenueSnapshot(),
        mockFallback,
      }),
    [gameId, cohortSummary, mockFallback],
  )
}
```

- [ ] **Step 2: Verify tsc**

Run: `npx tsc --noEmit`
Expected: clean exit.

- [ ] **Step 3: Commit**

```bash
git add src/widgets/dashboard/lib/use-real-kpi.ts
git commit -m "feat(composite): add useRealKpi hook"
```

---

## Task 6: Wire useRealKpi into KPICards

**Files:**
- Modify: `src/widgets/dashboard/ui/kpi-cards.tsx`

- [ ] **Step 1: Read the current file to identify the merge block**

Run: `cat src/widgets/dashboard/ui/kpi-cards.tsx`

The file currently has `useLiveAfData()` returning `{ state, summary, badge }` and a `mergedItems` map that overrides `kpi.installs` and `kpi.revenue` when `state.status === 'active'`. We will:
1. Add a `gameId` prop to `KPICardsProps`
2. Add a `mockFallback` prop (the same shape `useRealKpi` consumes)
3. Call `useRealKpi(gameId, mockFallback)` and merge ROAS/payback values into the same `mergedItems` map
4. OR-merge the freshness badge with the existing `badge` from `useLiveAfData`

- [ ] **Step 2: Update KPICardsProps and add useRealKpi merge**

Modify the component as follows. Find the `KPICardsProps` type and the `mergedItems` map. The full component after change:

```tsx
"use client"

import { useLocale, type TranslationKey, translate } from "@/shared/i18n"
import { cn } from "@/shared/lib"
import { Icon as Iconify } from "@iconify/react"
import graphUpBold from "@iconify-icons/solar/graph-up-bold"
import graphDownBold from "@iconify-icons/solar/graph-down-bold"
import minusBold from "@iconify-icons/solar/minus-circle-bold"
import { AnimatedNumber } from "@/shared/ui/animated-number"
import { InfoHint } from "@/shared/ui/info-hint"
import { useLiveAfData } from "../lib/use-live-af-data"
import { useRealKpi } from "../lib/use-real-kpi"
import type { RealKpiInput } from "@/shared/api/composite/types"

export type KPIItem = {
  labelKey: TranslationKey
  value: string | number
  unit?: string
  trend: number
  trendLabel: string
  infoKey?: TranslationKey
}

type KPICardsProps = {
  items: KPIItem[]
  basisKey?: TranslationKey
  gameId: string
  realKpiFallback: RealKpiInput["mockFallback"]
}

// ...resolveInfoKey unchanged...

export function KPICards({ items, basisKey, gameId, realKpiFallback }: KPICardsProps) {
  const { t } = useLocale()
  const { state, summary, badge } = useLiveAfData()
  const real = useRealKpi(gameId, realKpiFallback)

  const liveInstalls =
    summary?.cohorts.reduce((s, c) => s + c.installs, 0) ?? null
  const liveRevenue = summary?.revenue.total.sumUsd ?? null
  const isActive = state?.status === "active"

  const mergedItems: KPIItem[] = items.map((item) => {
    const key = item.labelKey as string
    if (isActive && key === "kpi.installs" && liveInstalls !== null)
      return { ...item, value: liveInstalls }
    if (isActive && (key === "kpi.revenue" || key === "kpi.totalRevenue") && liveRevenue !== null)
      return { ...item, value: Math.round(liveRevenue) }
    if (key === "kpi.roas")
      return { ...item, value: `${Math.round(real.roas.p50)}%` }
    if (key === "kpi.payback")
      return { ...item, value: real.payback.p50 }
    return item
  })

  // Prefer composite freshness over live-AF badge when both are set
  const effectiveBadge = real.freshness ?? badge

  // ...rest of component, replacing usages of `badge` with `effectiveBadge`...
}
```

Apply this change with Edit. Be careful: the existing component has more JSX further down — leave the rendering body intact except for `badge` → `effectiveBadge` usage. Verify with `grep -n "badge" src/widgets/dashboard/ui/kpi-cards.tsx` after editing.

- [ ] **Step 3: Verify tsc**

Run: `npx tsc --noEmit`
Expected: clean exit. If errors: most likely `gameId` / `realKpiFallback` not yet supplied at call site (next task).

- [ ] **Step 4: Commit**

```bash
git add src/widgets/dashboard/ui/kpi-cards.tsx
git commit -m "feat(composite): KPICards consumes useRealKpi for ROAS/payback + freshness"
```

(The tsc may not be fully clean until Task 7 supplies the new props at the call site. If only the call-site error remains, proceed to Task 7 and commit at end of Task 7 as one logical chunk.)

---

## Task 7: Wire useRealKpi into dashboard/page.tsx + verdict widgets

**Files:**
- Modify: `src/app/(dashboard)/dashboard/page.tsx`

- [ ] **Step 1: Inspect current call sites**

Run: `grep -n "KPICards\|HeroVerdict\|PortfolioVerdict\|payback" "src/app/(dashboard)/dashboard/page.tsx"`

We need to:
1. Call `useRealKpi(gameId, mockFallback)` once at the top of the component
2. Pass `gameId` and `realKpiFallback` to `<KPICards>`
3. Replace the `payback={...}` prop on `<HeroVerdict>` and `<PortfolioVerdict>` with `real.payback`

- [ ] **Step 2: Apply the edits**

Add the hook import and call. Approximate diff (apply with Edit; exact line numbers depend on current file):

```tsx
// imports
import { useRealKpi } from "@/widgets/dashboard/lib/use-real-kpi"

// inside the component, after `const gameData = useGameData(gameId)` and similar derived state:
const realKpiFallback = useMemo(() => ({
  roas: {
    p10: gameData.charts.kpis.roas.value * 0.7,   // mock band ±30% (mockFallback only used when status !== 'real')
    p50: gameData.charts.kpis.roas.value,
    p90: gameData.charts.kpis.roas.value * 1.3,
  },
  payback: gameData.signal.payback,
}), [gameData])

const real = useRealKpi(gameId, realKpiFallback)

// where <KPICards> is rendered:
<KPICards
  items={[ /* existing items unchanged */ ]}
  gameId={gameId}
  realKpiFallback={realKpiFallback}
/>

// where <HeroVerdict> is rendered (single-game view):
<HeroVerdict
  // ...other props unchanged...
  payback={real.payback}
/>

// where <PortfolioVerdict> is rendered (portfolio view):
<PortfolioVerdict
  // ...other props unchanged...
  payback={real.payback}
/>
```

The `useMemo` is required because `mockFallback` is in `useRealKpi`'s dep array — recomputing it inline every render would invalidate the memo. `useMemo` import added if not already imported.

- [ ] **Step 3: Verify tsc**

Run: `npx tsc --noEmit`
Expected: clean exit. If `gameData.charts.kpis.roas.value` is a string like `"142%"` rather than a number, parse it: `Number(String(gameData.charts.kpis.roas.value).replace(/%$/, ""))`. Confirm by reading the current `mock-data.ts` `kpis.roas` shape.

- [ ] **Step 4: Run full vitest suite**

Run: `npx vitest run`
Expected: all tests pass (existing 233 + new 19 = 252).

- [ ] **Step 5: Commit**

```bash
git add "src/app/(dashboard)/dashboard/page.tsx" src/widgets/dashboard/ui/kpi-cards.tsx
git commit -m "feat(composite): thread useRealKpi result into KPICards + verdict widgets"
```

---

## Task 8: Add i18n keys

**Files:**
- Modify: `src/shared/i18n/dictionary.ts`

- [ ] **Step 1: Locate the dictionary structure**

Run: `grep -n "kpi.realKpi\|kpi.roas\|kpi.payback" src/shared/i18n/dictionary.ts | head`

The dictionary uses a flat ko/en key map. We add 6 new entries.

- [ ] **Step 2: Add 6 keys**

Find the `kpi.*` block and append:

```ts
"kpi.realKpi.tooltip.real": {
  ko: "관측 N일 + LSTM 예측 합성",
  en: "N-day observed + LSTM forecast composite",
},
"kpi.realKpi.tooltip.insufficient": {
  ko: "관측 N일 / 14일 누적 후 실값 전환",
  en: "Observed N days / switches to real after 14 days",
},
"kpi.realKpi.tooltip.fxUnsupported": {
  ko: "JPY/EUR 비용은 USD 환산 미지원 — 연동 통화 USD/KRW 권장",
  en: "JPY/EUR costs not USD-convertible — prefer USD/KRW connections",
},
"kpi.realKpi.tooltip.snapshotStale": {
  ko: "LSTM snapshot 7일 경과 — rebuild 후 갱신",
  en: "LSTM snapshot >7 days old — refreshes after rebuild",
},
"kpi.realKpi.badge.ML1": {
  ko: "Forecast Mock",
  en: "Forecast Mock",
},
"kpi.realKpi.badge.ML2": {
  ko: "Stale",
  en: "Stale",
},
```

The placeholder `"N"` in tooltip strings is intentional — these are static labels referenced by InfoHint; runtime substitution is not required for this iteration.

- [ ] **Step 3: Verify tsc + the i18n key type**

Run: `npx tsc --noEmit`
Expected: clean. If the i18n module exports a `TranslationKey` union type derived from the dictionary, the new keys auto-extend it.

- [ ] **Step 4: Commit**

```bash
git add src/shared/i18n/dictionary.ts
git commit -m "i18n(composite): add ML1/ML2 badge + tooltip keys for real-KPI status"
```

---

## Task 9: Final verification

- [ ] **Step 1: Full type check**

Run: `npx tsc --noEmit`
Expected: clean exit.

- [ ] **Step 2: Full test suite**

Run: `npx vitest run`
Expected: 252 tests pass (existing 233 + new 19). If a previously-passing test now fails, investigate — likely a KPICards prop change leaked into a snapshot.

- [ ] **Step 3: Lint**

Run: `npx next lint`
Expected: clean.

- [ ] **Step 4: Manual dev server verification**

Run: `npm run dev` then open http://localhost:3000/dashboard

Verify all 4 scenarios:

| Scenario | Setup | Expected |
|---|---|---|
| 1. AppsFlyer disconnected | Default state (no app registered) | KPI cards show ROAS=142% / payback=47d (mockFallback) with `ML1` badge |
| 2. Cohort < 14d | `/dashboard/connections` → register an app, wait <14d | `ML1` badge, mock values |
| 3. Cohort ≥14d + snapshot fresh | App connected long enough OR fixture data | No badge, real values; HeroVerdict band P10/P50/P90 matches `real.payback` |
| 4. Snapshot stale | Edit `revenue-snapshot.json.generated_at` to 8 days ago | `ML2` badge, mock values |

Note: scenario 3 is hard to reach with live data on a fresh install. To exercise it during dev, temporarily set `MIN_BASIS_DAYS = 1` in `roas-payback.ts`, observe real values, then revert.

- [ ] **Step 5: No commit needed unless fixes were applied during Step 4. If fixes were applied, amend or new commit per the repo's hook rule (never `--amend` after pre-commit failure).**

---

## Task 10: PR

- [ ] **Step 1: Push branch and open PR**

```bash
git push -u origin feat/composite-roas-payback
gh pr create --title "feat(composite): UA-spend × LSTM-revenue real ROAS/payback KPI" --body "$(cat <<'EOF'
## Summary
- New `src/shared/api/composite/` domain with pure `computeRealKpi` (19 vitest cases) splicing cohort UA spend + LSTM revenue forecast into per-install ROAS / payback bands
- Thin `useRealKpi` hook wires the result into KPI cards + HeroVerdict / PortfolioVerdict from a single source of truth
- Status machine: `real` / `insufficient` / `fxUnsupported` / `mock` with precedence-ordered gating; mock fallback values pass through verbatim when not real
- Inverted band mapping: revenue P10 → payback P90 (slow revenue = late payback)

## Test plan
- [x] `npx tsc --noEmit` clean
- [x] `npx vitest run` — 252 tests pass (233 existing + 19 new)
- [x] `npx next lint` clean
- [x] Manual dev — 4 scenarios in spec §8.2 verified

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 2: Verify the harness adds CodeRabbit review + Vercel preview comment within ~30s.**

---

## Self-Review Checklist (run before PR)

- [ ] Spec §1 motivation reflected in plan goal/architecture
- [ ] Spec §2 decisions all locked in tests (Task 3) or implementation (Task 4)
- [ ] Spec §3 file tree matches Task 1/2/5/6/7 file paths
- [ ] Spec §4 types match Task 1 exactly (no drift between `RealKpiResult` and the test/impl files)
- [ ] Spec §5 algorithm step 1-6 reflected in Task 4 implementation
- [ ] Spec §6 status machine 7 rows tested in Task 3 Group 1 (7 cases)
- [ ] Spec §7 UI integration covered by Task 6 + Task 7
- [ ] Spec §8 testing plan — Task 3 covers all 6 test groups
- [ ] Spec §9 build order matches Task ordering
- [ ] Spec §10 out-of-scope items not implemented (no TitleHeatmap edits, no 60d externalization, no cron work)
