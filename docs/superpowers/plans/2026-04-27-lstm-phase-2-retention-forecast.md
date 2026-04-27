# LSTM Phase 2 — Retention & Revenue Forecast Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Daily Vercel cron이 AppsFlyer cohort summary와 Sensor Tower 장르 prior를 결합해 retention(D1~D1095)과 revenue(0~365d) forecast를 산출하고 두 Vercel Blob snapshot으로 publish하는 compute layer 구현.

**Architecture:** Pure-function 5 모듈(arpdau, sufficiency, forecast-builder, blob-writer, retentionForecast 재사용) + thin cron orchestrator + CLI dry-run. AppsFlyer cron(UTC 18:00) 30분 후에 실행. 본 브랜치에 이미 추가된 `retentionForecast`/`fitPowerLaw`/`extrapolatePowerLawCurve` primitive를 그대로 호출.

**Tech Stack:** Next.js 15 App Router, TypeScript, Vitest, `@vercel/blob`, Zod, 기존 `bayesian-stats` 라이브러리.

**Spec:** `docs/superpowers/specs/2026-04-27-lstm-phase-2-retention-forecast-design.md`

---

## File Structure

```
Modify:
  src/shared/api/appsflyer/types.ts              (AppSchema + genre/region optional)
  vercel.json                                     (lstm cron entry 추가)
  package.json                                    (lstm:dry script 추가)
  src/widgets/connections/ui/connection-dialog.tsx (genre/region select 추가)

Create:
  src/shared/api/lstm/arpdau.ts
  src/shared/api/lstm/__tests__/arpdau.test.ts
  src/shared/api/lstm/sufficiency.ts
  src/shared/api/lstm/__tests__/sufficiency.test.ts
  src/shared/api/lstm/forecast-builder.ts
  src/shared/api/lstm/__tests__/forecast-builder.test.ts
  src/shared/api/lstm/blob-writer.ts
  src/shared/api/lstm/__tests__/blob-writer.test.ts
  src/app/api/lstm/cron/route.ts
  src/app/api/lstm/cron/__tests__/route.test.ts
  scripts/lstm-dry-run.ts
```

---

## Task 1: Extend AppSchema with optional genre/region

**Files:**
- Modify: `src/shared/api/appsflyer/types.ts:145-152`

- [ ] **Step 1: Add genre/region optional fields to AppSchema**

`src/shared/api/appsflyer/types.ts`의 `AppSchema` 정의를 다음으로 교체:

```ts
export const AppSchema = z.object({
  appId: z.string().regex(/^[a-zA-Z0-9._-]{3,64}$/),
  accountId: z.string().regex(/^acc_[a-f0-9]{8}$/),
  gameKey: GameKeySchema,
  label: z.string().max(80),
  createdAt: z.string().datetime(),
  // LSTM Phase 2: 장르/지역 prior lookup용. 미설정 게임은 sufficiency check에서 skip
  genre: z.string().min(1).max(40).optional(),
  region: z.string().min(2).max(8).optional(),
})
export type App = z.infer<typeof AppSchema>
```

- [ ] **Step 2: Run typecheck**

```bash
cd "/Users/mike/Downloads/compass-worktrees/feature-lstm-phase-2-retention-forecast"
npx tsc --noEmit
```

Expected: PASS (기존 등록 앱은 optional이라 backward compat)

- [ ] **Step 3: Commit**

```bash
git add src/shared/api/appsflyer/types.ts
git commit -m "feat(appsflyer): add optional genre/region to AppSchema for LSTM prior lookup"
```

---

## Task 2: arpdau.ts — TDD

**Files:**
- Create: `src/shared/api/lstm/arpdau.ts`
- Test: `src/shared/api/lstm/__tests__/arpdau.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/shared/api/lstm/__tests__/arpdau.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { estimateArpdau } from "../arpdau"

const cohort = (date: string, installs: number, d1: number | null, d7: number | null, d30: number | null) => ({
  cohortDate: date,
  installs,
  retainedByDay: { d1, d7, d30 },
})

describe("estimateArpdau", () => {
  it("returns sum(revenue)/sum(DAU) over 14d window", () => {
    const cohorts = Array.from({ length: 14 }, (_, i) =>
      cohort(`2026-04-${String(i + 1).padStart(2, "0")}`, 100, 50, 25, 10),
    )
    const revenueDaily = Array.from({ length: 14 }, (_, i) => ({
      date: `2026-04-${String(i + 1).padStart(2, "0")}`,
      sumUsd: 25,
    }))
    const r = estimateArpdau({ revenueDaily, cohorts, windowDays: 14 })
    expect(r.effectiveDays).toBe(14)
    expect(r.arpdauUsd).toBeGreaterThan(0)
    expect(Number.isFinite(r.arpdauUsd)).toBe(true)
  })

  it("returns 0 when DAU is zero across the window", () => {
    const cohorts = [cohort("2026-04-01", 0, 0, 0, 0)]
    const r = estimateArpdau({
      revenueDaily: [{ date: "2026-04-01", sumUsd: 100 }],
      cohorts,
      windowDays: 14,
    })
    expect(r.arpdauUsd).toBe(0)
    expect(r.effectiveDays).toBe(1)
  })

  it("returns 0 when revenue is zero", () => {
    const cohorts = [cohort("2026-04-01", 100, 50, 25, 10)]
    const r = estimateArpdau({
      revenueDaily: [{ date: "2026-04-01", sumUsd: 0 }],
      cohorts,
      windowDays: 14,
    })
    expect(r.arpdauUsd).toBe(0)
  })

  it("uses available days when window exceeds data", () => {
    const cohorts = Array.from({ length: 7 }, (_, i) =>
      cohort(`2026-04-${String(i + 1).padStart(2, "0")}`, 100, 50, 25, 10),
    )
    const revenueDaily = Array.from({ length: 7 }, (_, i) => ({
      date: `2026-04-${String(i + 1).padStart(2, "0")}`,
      sumUsd: 30,
    }))
    const r = estimateArpdau({ revenueDaily, cohorts, windowDays: 14 })
    expect(r.effectiveDays).toBe(7)
  })

  it("treats null retention as zero (no DAU contribution)", () => {
    const r = estimateArpdau({
      revenueDaily: [{ date: "2026-04-01", sumUsd: 50 }],
      cohorts: [cohort("2026-04-01", 100, null, null, null)],
      windowDays: 14,
    })
    expect(r.arpdauUsd).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/shared/api/lstm/__tests__/arpdau.test.ts
```

Expected: FAIL with "Cannot find module '../arpdau'"

- [ ] **Step 3: Implement `arpdau.ts`**

Create `src/shared/api/lstm/arpdau.ts`:

```ts
import type { CohortObservation } from "../appsflyer/types"

export type ArpdauResult = {
  arpdauUsd: number
  effectiveDays: number
}

/**
 * trailing windowDays 윈도우에서 Σrevenue / Σ DAU(t).
 * DAU(t) = Σ cohort_size(t-a) × observed_retention(a) using D1/D7/D30 anchor flat-step.
 * 데이터 없거나 분모 0이면 silent zero 반환 (throw 안 함).
 */
export function estimateArpdau(args: {
  revenueDaily: { date: string; sumUsd: number }[]
  cohorts: CohortObservation[]
  windowDays?: number
}): ArpdauResult {
  const { revenueDaily, cohorts, windowDays = 14 } = args
  if (revenueDaily.length === 0) return { arpdauUsd: 0, effectiveDays: 0 }

  // 정렬된 날짜 마지막 N일
  const sortedRevenue = [...revenueDaily].sort((a, b) => a.date.localeCompare(b.date))
  const window = sortedRevenue.slice(-windowDays)
  const effectiveDays = window.length
  const totalRevenue = window.reduce((s, r) => s + r.sumUsd, 0)

  if (totalRevenue === 0) return { arpdauUsd: 0, effectiveDays }

  // 윈도우 내 각 일자의 DAU 추정
  const totalDau = window.reduce((sumDau, dayRow) => {
    const t = dayRow.date
    return sumDau + estimateDauOnDate(t, cohorts)
  }, 0)

  if (totalDau === 0) return { arpdauUsd: 0, effectiveDays }
  return { arpdauUsd: totalRevenue / totalDau, effectiveDays }
}

/**
 * DAU(t) = Σ cohort_size(t-age) × stepRetention(age)
 * stepRetention: D1=age 1~6, D7=age 7~29, D30=age 30+ (간단한 step approximation)
 */
function estimateDauOnDate(targetDate: string, cohorts: CohortObservation[]): number {
  let dau = 0
  const target = new Date(targetDate).getTime()
  for (const c of cohorts) {
    const ageDays = Math.floor((target - new Date(c.cohortDate).getTime()) / 86_400_000)
    if (ageDays < 0) continue
    if (ageDays === 0) {
      dau += c.installs
      continue
    }
    const r = stepRetention(ageDays, c)
    if (r > 0) dau += c.installs * r
  }
  return dau
}

function stepRetention(age: number, c: CohortObservation): number {
  const installs = c.installs
  if (installs === 0) return 0
  const d1 = c.retainedByDay.d1 ?? 0
  const d7 = c.retainedByDay.d7 ?? 0
  const d30 = c.retainedByDay.d30 ?? 0
  if (age >= 30) return d30 / installs
  if (age >= 7) return d7 / installs
  if (age >= 1) return d1 / installs
  return 1
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/shared/api/lstm/__tests__/arpdau.test.ts
```

Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/shared/api/lstm/arpdau.ts src/shared/api/lstm/__tests__/arpdau.test.ts
git commit -m "feat(lstm): estimateArpdau — trailing 14d revenue/DAU with step retention"
```

---

## Task 3: sufficiency.ts — TDD

**Files:**
- Create: `src/shared/api/lstm/sufficiency.ts`
- Test: `src/shared/api/lstm/__tests__/sufficiency.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/shared/api/lstm/__tests__/sufficiency.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { checkSufficiency } from "../sufficiency"
import type { CohortSummary } from "../../appsflyer/types"

const buildSummary = (cohortDays: number, revenueDays: number, lastD30: number | null): CohortSummary => ({
  updatedAt: new Date().toISOString(),
  cohorts: Array.from({ length: cohortDays }, (_, i) => ({
    cohortDate: `2026-03-${String(i + 1).padStart(2, "0")}`,
    installs: 100,
    retainedByDay: { d1: 50, d7: 25, d30: i === cohortDays - 1 ? lastD30 : 10 },
  })),
  revenue: {
    daily: Array.from({ length: revenueDays }, (_, i) => ({
      date: `2026-03-${String(i + 1).padStart(2, "0")}`,
      sumUsd: 30,
      purchasers: 5,
    })),
    total: { sumUsd: revenueDays * 30, purchasers: revenueDays * 5 },
  },
})

describe("checkSufficiency", () => {
  it("returns ok when 30+ cohorts, 14+ revenue days, D30>0, genre+region present, prior known", () => {
    const r = checkSufficiency(buildSummary(30, 14, 10), {
      appId: "x",
      genre: "Merge",
      region: "JP",
    })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.genreKey).toBe("Merge:JP")
  })

  it("rejects insufficient cohort history (<30d)", () => {
    const r = checkSufficiency(buildSummary(20, 14, 10), {
      appId: "x",
      genre: "Merge",
      region: "JP",
    })
    expect(r).toEqual({ ok: false, gameId: "x", reason: "insufficient_cohort_history" })
  })

  it("rejects insufficient revenue history (<14d)", () => {
    const r = checkSufficiency(buildSummary(30, 7, 10), {
      appId: "x",
      genre: "Merge",
      region: "JP",
    })
    expect(r).toEqual({ ok: false, gameId: "x", reason: "insufficient_revenue_history" })
  })

  it("rejects dead D30 retention (latest cohort D30=0)", () => {
    const r = checkSufficiency(buildSummary(30, 14, 0), {
      appId: "x",
      genre: "Merge",
      region: "JP",
    })
    expect(r).toEqual({ ok: false, gameId: "x", reason: "dead_d30_retention" })
  })

  it("rejects missing genre", () => {
    const r = checkSufficiency(buildSummary(30, 14, 10), { appId: "x", region: "JP" })
    expect(r).toEqual({ ok: false, gameId: "x", reason: "missing_genre_meta" })
  })

  it("rejects unknown genre/region prior", () => {
    const r = checkSufficiency(buildSummary(30, 14, 10), {
      appId: "x",
      genre: "Unknown",
      region: "ZZ",
    })
    expect(r).toEqual({ ok: false, gameId: "x", reason: "unknown_genre_prior" })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/shared/api/lstm/__tests__/sufficiency.test.ts
```

Expected: FAIL — module not found

- [ ] **Step 3: Implement `sufficiency.ts`**

Create `src/shared/api/lstm/sufficiency.ts`:

```ts
import type { CohortSummary } from "../appsflyer/types"
import { getPrior } from "../prior-data"

export type SufficiencyReason =
  | "insufficient_cohort_history"
  | "insufficient_revenue_history"
  | "dead_d30_retention"
  | "missing_genre_meta"
  | "unknown_genre_prior"

export type SufficiencyResult =
  | { ok: true; gameId: string; genreKey: string }
  | { ok: false; gameId: string; reason: SufficiencyReason }

const MIN_COHORT_DAYS = 30
const MIN_REVENUE_DAYS = 14

export function checkSufficiency(
  cohortSummary: CohortSummary,
  appsMeta: { appId: string; genre?: string; region?: string },
): SufficiencyResult {
  const { appId, genre, region } = appsMeta
  if (cohortSummary.cohorts.length < MIN_COHORT_DAYS) {
    return { ok: false, gameId: appId, reason: "insufficient_cohort_history" }
  }
  if (cohortSummary.revenue.daily.length < MIN_REVENUE_DAYS) {
    return { ok: false, gameId: appId, reason: "insufficient_revenue_history" }
  }
  const last = cohortSummary.cohorts[cohortSummary.cohorts.length - 1]!
  if ((last.retainedByDay.d30 ?? 0) === 0) {
    return { ok: false, gameId: appId, reason: "dead_d30_retention" }
  }
  if (!genre || !region) {
    return { ok: false, gameId: appId, reason: "missing_genre_meta" }
  }
  if (!getPrior({ genre, region })) {
    return { ok: false, gameId: appId, reason: "unknown_genre_prior" }
  }
  return { ok: true, gameId: appId, genreKey: `${genre}:${region}` }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/shared/api/lstm/__tests__/sufficiency.test.ts
```

Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/shared/api/lstm/sufficiency.ts src/shared/api/lstm/__tests__/sufficiency.test.ts
git commit -m "feat(lstm): checkSufficiency — 5-gate input validation before forecast"
```

---

## Task 4: forecast-builder.ts — TDD

**Files:**
- Create: `src/shared/api/lstm/forecast-builder.ts`
- Test: `src/shared/api/lstm/__tests__/forecast-builder.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/shared/api/lstm/__tests__/forecast-builder.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { buildGameForecast } from "../forecast-builder"
import type { CohortSummary } from "../../appsflyer/types"
import type { EmpiricalDist } from "../../../lib/bayesian-stats"

const PRIOR: { d1: EmpiricalDist; d7: EmpiricalDist; d30: EmpiricalDist } = {
  d1: { p10: 0.4, p50: 0.55, p90: 0.65 },
  d7: { p10: 0.18, p50: 0.28, p90: 0.38 },
  d30: { p10: 0.06, p50: 0.11, p90: 0.18 },
}

const realisticSummary: CohortSummary = {
  updatedAt: "2026-04-26T00:00:00Z",
  cohorts: Array.from({ length: 32 }, (_, i) => ({
    cohortDate: `2026-03-${String((i % 30) + 1).padStart(2, "0")}`,
    installs: 800,
    retainedByDay: { d1: 480, d7: 240, d30: 96 },
  })),
  revenue: {
    daily: Array.from({ length: 14 }, (_, i) => ({
      date: `2026-04-${String(i + 1).padStart(2, "0")}`,
      sumUsd: 4500,
      purchasers: 120,
    })),
    total: { sumUsd: 14 * 4500, purchasers: 14 * 120 },
  },
}

describe("buildGameForecast", () => {
  it("produces 1095-day retention curve and 366-point revenue forecast", () => {
    const r = buildGameForecast({
      cohortSummary: realisticSummary,
      appsMeta: { appId: "x", genre: "Merge", region: "JP" },
      prior: PRIOR,
      priorEffectiveN: 30,
    })
    expect(r.retentionCurve.length).toBe(1095)
    expect(r.revenueForecast.length).toBe(366)
    expect(r.arpdauUsd).toBeGreaterThan(0)
    expect(r.installsAssumption).toBe(800)
  })

  it("enforces P10 ≤ P50 ≤ P90 at every retention point", () => {
    const r = buildGameForecast({
      cohortSummary: realisticSummary,
      appsMeta: { appId: "x", genre: "Merge", region: "JP" },
      prior: PRIOR,
      priorEffectiveN: 30,
    })
    for (const pt of r.retentionCurve) {
      expect(pt.p10).toBeLessThanOrEqual(pt.p50)
      expect(pt.p50).toBeLessThanOrEqual(pt.p90)
    }
  })

  it("enforces P10 ≤ P50 ≤ P90 at every revenue point", () => {
    const r = buildGameForecast({
      cohortSummary: realisticSummary,
      appsMeta: { appId: "x", genre: "Merge", region: "JP" },
      prior: PRIOR,
      priorEffectiveN: 30,
    })
    for (const pt of r.revenueForecast) {
      expect(pt.revenueP10).toBeLessThanOrEqual(pt.revenueP50)
      expect(pt.revenueP50).toBeLessThanOrEqual(pt.revenueP90)
    }
  })

  it("returns arpdau=0 and zeroed revenue forecast when no revenue (does not throw)", () => {
    const noRevenue: CohortSummary = {
      ...realisticSummary,
      revenue: {
        daily: Array.from({ length: 14 }, (_, i) => ({
          date: `2026-04-${String(i + 1).padStart(2, "0")}`,
          sumUsd: 0,
          purchasers: 0,
        })),
        total: { sumUsd: 0, purchasers: 0 },
      },
    }
    const r = buildGameForecast({
      cohortSummary: noRevenue,
      appsMeta: { appId: "x", genre: "Merge", region: "JP" },
      prior: PRIOR,
      priorEffectiveN: 30,
    })
    expect(r.arpdauUsd).toBe(0)
    expect(r.revenueForecast.every((p) => p.revenueP50 === 0)).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/shared/api/lstm/__tests__/forecast-builder.test.ts
```

Expected: FAIL — module not found

- [ ] **Step 3: Implement `forecast-builder.ts`**

Create `src/shared/api/lstm/forecast-builder.ts`:

```ts
import type { CohortSummary } from "../appsflyer/types"
import type { EmpiricalDist } from "../../lib/bayesian-stats"
import { retentionForecast, type RetentionForecastPoint } from "../../lib/bayesian-stats/retention"
import { estimateArpdau } from "./arpdau"

export type RevenueForecastPoint = {
  day: number
  dauP50: number
  revenueP10: number
  revenueP50: number
  revenueP90: number
}

export type ForecastResult = {
  retentionCurve: RetentionForecastPoint[]
  revenueForecast: RevenueForecastPoint[]
  arpdauUsd: number
  installsAssumption: number
  effectiveDays: number
}

const RETENTION_MAX_DAY = 1095
const DEFAULT_HORIZON = 365
const ARPDAU_WINDOW = 14

export function buildGameForecast(args: {
  cohortSummary: CohortSummary
  appsMeta: { appId: string; genre: string; region: string }
  prior: { d1: EmpiricalDist; d7: EmpiricalDist; d30: EmpiricalDist }
  priorEffectiveN: number
  horizonDays?: number
}): ForecastResult {
  const { cohortSummary, prior, priorEffectiveN } = args
  const horizonDays = args.horizonDays ?? DEFAULT_HORIZON

  // 1. Sum cohort observations into BinomialObs per anchor
  const observations = aggregateBinomialObs(cohortSummary)

  // 2. Retention forecast (1~1095) via existing primitive
  const retentionCurve = retentionForecast({
    observations,
    priors: prior,
    priorEffectiveN,
    maxDay: RETENTION_MAX_DAY,
  })

  // 3. ARPDAU
  const { arpdauUsd, effectiveDays } = estimateArpdau({
    revenueDaily: cohortSummary.revenue.daily,
    cohorts: cohortSummary.cohorts,
    windowDays: ARPDAU_WINDOW,
  })

  // 4. installs assumption = trailing 14d cohort install mean
  const installsAssumption = trailingMeanInstalls(cohortSummary, ARPDAU_WINDOW)

  // 5. Revenue forecast (0..horizonDays) via convolution
  const revenueForecast = buildRevenueForecast({
    retentionCurve,
    arpdauUsd,
    installsAssumption,
    horizonDays,
  })

  return { retentionCurve, revenueForecast, arpdauUsd, installsAssumption, effectiveDays }
}

function aggregateBinomialObs(summary: CohortSummary) {
  let n_d1 = 0, k_d1 = 0
  let n_d7 = 0, k_d7 = 0
  let n_d30 = 0, k_d30 = 0
  for (const c of summary.cohorts) {
    if (c.retainedByDay.d1 !== null) {
      n_d1 += c.installs
      k_d1 += c.retainedByDay.d1
    }
    if (c.retainedByDay.d7 !== null) {
      n_d7 += c.installs
      k_d7 += c.retainedByDay.d7
    }
    if (c.retainedByDay.d30 !== null) {
      n_d30 += c.installs
      k_d30 += c.retainedByDay.d30
    }
  }
  return {
    d1: { n: n_d1, k: k_d1 },
    d7: { n: n_d7, k: k_d7 },
    d30: { n: n_d30, k: k_d30 },
  }
}

function trailingMeanInstalls(summary: CohortSummary, windowDays: number): number {
  const last = summary.cohorts.slice(-windowDays)
  if (last.length === 0) return 0
  const sum = last.reduce((s, c) => s + c.installs, 0)
  return sum / last.length
}

function buildRevenueForecast(args: {
  retentionCurve: RetentionForecastPoint[]
  arpdauUsd: number
  installsAssumption: number
  horizonDays: number
}): RevenueForecastPoint[] {
  const { retentionCurve, arpdauUsd, installsAssumption, horizonDays } = args
  const out: RevenueForecastPoint[] = []
  // retentionCurve indexed by [day-1]; day=0 means t=0 (just installed cohort)
  for (let t = 0; t <= horizonDays; t++) {
    let dauP10 = 0, dauP50 = 0, dauP90 = 0
    // age range 0..min(t, RETENTION_MAX_DAY)
    const maxAge = Math.min(t, retentionCurve.length)
    for (let age = 0; age <= maxAge; age++) {
      if (age === 0) {
        dauP10 += installsAssumption
        dauP50 += installsAssumption
        dauP90 += installsAssumption
        continue
      }
      const r = retentionCurve[age - 1]!
      dauP10 += installsAssumption * r.p10
      dauP50 += installsAssumption * r.p50
      dauP90 += installsAssumption * r.p90
    }
    let p10 = dauP10 * arpdauUsd
    let p50 = dauP50 * arpdauUsd
    let p90 = dauP90 * arpdauUsd
    // monotonic clamp (수치오차 보호)
    if (p10 > p50) p10 = p50
    if (p90 < p50) p90 = p50
    out.push({ day: t, dauP50, revenueP10: p10, revenueP50: p50, revenueP90: p90 })
  }
  return out
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/shared/api/lstm/__tests__/forecast-builder.test.ts
```

Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/shared/api/lstm/forecast-builder.ts src/shared/api/lstm/__tests__/forecast-builder.test.ts
git commit -m "feat(lstm): buildGameForecast — retention(1095d) + revenue(0..365d) convolution"
```

---

## Task 5: blob-writer.ts — TDD

**Files:**
- Create: `src/shared/api/lstm/blob-writer.ts`
- Test: `src/shared/api/lstm/__tests__/blob-writer.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/shared/api/lstm/__tests__/blob-writer.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest"

vi.mock("@vercel/blob", () => {
  const put = vi.fn(async (path: string) => ({ url: `https://blob.test/${path}` }))
  return { put }
})

import { put as mockPut } from "@vercel/blob"
import { writeLstmSnapshots } from "../blob-writer"
import type { LstmSnapshot } from "../../vc-simulation/types"
import type { RevenueSnapshot } from "../revenue-snapshot"

const validRetention: LstmSnapshot = {
  schema_version: "1.0",
  generated_at: "2026-04-27T18:30:00Z",
  model: {
    name: "retention-bayesian-shrinkage",
    version: "phase-2",
    trained_at: "2026-04-27T18:30:00Z",
    hyperparameters: {
      lookback_days: 30,
      forecast_horizon_days: 1095,
      sample_count: 1,
      confidence_interval: 0.8,
    },
  },
  predictions: {
    poko_merge: {
      game_id: "poko_merge",
      genre: "Merge",
      points: Array.from({ length: 11 }, (_, i) => ({
        day: i + 1,
        p10: 0.5 - i * 0.04,
        p50: 0.55 - i * 0.04,
        p90: 0.6 - i * 0.04,
      })),
    },
  },
}

const validRevenue: RevenueSnapshot = {
  schema_version: "1.0",
  generated_at: "2026-04-27T18:30:00Z",
  source_retention_at: "2026-04-27T18:30:00Z",
  arpdau: { perGame: { poko_merge: 0.55 }, currency: "USD", windowDays: 14 },
  installsAssumption: { perGame: { poko_merge: 800 }, basis: "trailing-14d-mean" },
  forecast: [
    {
      game_id: "poko_merge",
      points: [
        { day: 0, dauP50: 800, revenueP10: 200, revenueP50: 220, revenueP90: 240 },
      ],
    },
  ],
}

describe("writeLstmSnapshots", () => {
  it("publishes both snapshots to expected paths", async () => {
    const r = await writeLstmSnapshots({
      retentionSnapshot: validRetention,
      revenueSnapshot: validRevenue,
    })
    expect(r.retentionUrl).toContain("lstm/retention-snapshot.json")
    expect(r.revenueUrl).toContain("lstm/revenue-snapshot.json")
    expect(mockPut).toHaveBeenCalledTimes(2)
  })

  it("skips revenue put when revenueSnapshot is null", async () => {
    vi.mocked(mockPut).mockClear()
    const r = await writeLstmSnapshots({
      retentionSnapshot: validRetention,
      revenueSnapshot: null,
    })
    expect(r.retentionUrl).toContain("lstm/retention-snapshot.json")
    expect(r.revenueUrl).toBeNull()
    expect(mockPut).toHaveBeenCalledTimes(1)
  })

  it("throws on invalid retention snapshot", async () => {
    const broken = { ...validRetention, predictions: {} as never }
    await expect(
      writeLstmSnapshots({ retentionSnapshot: broken, revenueSnapshot: null }),
    ).rejects.toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/shared/api/lstm/__tests__/blob-writer.test.ts
```

Expected: FAIL — module not found

- [ ] **Step 3: Implement `blob-writer.ts`**

Create `src/shared/api/lstm/blob-writer.ts`:

```ts
import { put } from "@vercel/blob"
import { LstmSnapshotSchema, type LstmSnapshot } from "../vc-simulation/types"
import { RevenueSnapshotSchema, type RevenueSnapshot } from "./revenue-snapshot"

const RETENTION_PATH = "lstm/retention-snapshot.json"
const REVENUE_PATH = "lstm/revenue-snapshot.json"
const RETRY_BACKOFFS = [500, 1000, 2000]

export async function writeLstmSnapshots(args: {
  retentionSnapshot: LstmSnapshot
  revenueSnapshot: RevenueSnapshot | null
}): Promise<{ retentionUrl: string; revenueUrl: string | null }> {
  // 1. Validate output 직전
  LstmSnapshotSchema.parse(args.retentionSnapshot)
  if (args.revenueSnapshot) RevenueSnapshotSchema.parse(args.revenueSnapshot)

  // 2. Put retention with retry
  const retentionUrl = await putWithRetry(
    RETENTION_PATH,
    JSON.stringify(args.retentionSnapshot),
  )

  // 3. Put revenue with retry (conditional)
  let revenueUrl: string | null = null
  if (args.revenueSnapshot) {
    revenueUrl = await putWithRetry(
      REVENUE_PATH,
      JSON.stringify(args.revenueSnapshot),
    )
  }

  return { retentionUrl, revenueUrl }
}

async function putWithRetry(path: string, body: string): Promise<string> {
  let lastErr: unknown = null
  for (let attempt = 0; attempt <= RETRY_BACKOFFS.length; attempt++) {
    try {
      const result = await put(path, body, {
        access: "public",
        contentType: "application/json",
        addRandomSuffix: false,
        allowOverwrite: true,
      })
      return result.url
    } catch (err) {
      lastErr = err
      if (attempt < RETRY_BACKOFFS.length) {
        await new Promise((r) => setTimeout(r, RETRY_BACKOFFS[attempt]!))
      }
    }
  }
  throw lastErr
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/shared/api/lstm/__tests__/blob-writer.test.ts
```

Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/shared/api/lstm/blob-writer.ts src/shared/api/lstm/__tests__/blob-writer.test.ts
git commit -m "feat(lstm): writeLstmSnapshots — dual blob publish with retry + zod validation"
```

---

## Task 6: cron route — TDD

**Files:**
- Create: `src/app/api/lstm/cron/route.ts`
- Test: `src/app/api/lstm/cron/__tests__/route.test.ts`

cron route는 외부 의존(Blob fetch + writer)이 많아 fetch helper를 inline로 두되 모듈 단위로 mock 가능하도록 구조화한다.

- [ ] **Step 1: Write failing test**

Create `src/app/api/lstm/cron/__tests__/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@vercel/blob", () => ({
  list: vi.fn(),
  head: vi.fn(),
  put: vi.fn(async (path: string) => ({ url: `https://blob.test/${path}` })),
}))

vi.mock("../../../../../shared/api/lstm/blob-writer", () => ({
  writeLstmSnapshots: vi.fn(async () => ({
    retentionUrl: "https://blob.test/lstm/retention-snapshot.json",
    revenueUrl: "https://blob.test/lstm/revenue-snapshot.json",
  })),
}))

const mockReadAllApps = vi.fn()
const mockReadCohortSummary = vi.fn()

vi.mock("../io", () => ({
  readAllApps: () => mockReadAllApps(),
  readCohortSummary: (id: string) => mockReadCohortSummary(id),
}))

import { GET } from "../route"
import { writeLstmSnapshots } from "../../../../../shared/api/lstm/blob-writer"

const SECRET = "test-secret"
beforeEach(() => {
  vi.clearAllMocks()
  process.env.CRON_SECRET = SECRET
})

const cohortSummary = (cohortDays: number, revenueDays: number) => ({
  updatedAt: "2026-04-27T00:00:00Z",
  cohorts: Array.from({ length: cohortDays }, (_, i) => ({
    cohortDate: `2026-03-${String((i % 30) + 1).padStart(2, "0")}`,
    installs: 800,
    retainedByDay: { d1: 480, d7: 240, d30: 96 },
  })),
  revenue: {
    daily: Array.from({ length: revenueDays }, (_, i) => ({
      date: `2026-04-${String(i + 1).padStart(2, "0")}`,
      sumUsd: 4500,
      purchasers: 120,
    })),
    total: { sumUsd: revenueDays * 4500, purchasers: revenueDays * 120 },
  },
})

const buildRequest = (token: string | null) =>
  new Request("https://example.com/api/lstm/cron", {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  })

describe("GET /api/lstm/cron", () => {
  it("returns 401 when CRON_SECRET missing or wrong", async () => {
    const res = await GET(buildRequest("wrong"))
    expect(res.status).toBe(401)
  })

  it("returns 200 with empty publish when no apps registered", async () => {
    mockReadAllApps.mockResolvedValueOnce([])
    const res = await GET(buildRequest(SECRET))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.processed).toEqual([])
    expect(body.snapshots).toBeNull()
    expect(writeLstmSnapshots).not.toHaveBeenCalled()
  })

  it("processes a single sufficient app and publishes both snapshots", async () => {
    mockReadAllApps.mockResolvedValueOnce([
      { appId: "poko_merge", gameKey: "portfolio", label: "P", genre: "Merge", region: "JP" },
    ])
    mockReadCohortSummary.mockResolvedValueOnce(cohortSummary(32, 14))
    const res = await GET(buildRequest(SECRET))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.processed).toEqual(["poko_merge"])
    expect(body.skipped).toEqual([])
    expect(writeLstmSnapshots).toHaveBeenCalledTimes(1)
  })

  it("skips a game missing genre/region meta (skipped[] reason populated)", async () => {
    mockReadAllApps.mockResolvedValueOnce([
      { appId: "x", gameKey: "portfolio", label: "P" },
    ])
    mockReadCohortSummary.mockResolvedValueOnce(cohortSummary(32, 14))
    const res = await GET(buildRequest(SECRET))
    const body = await res.json()
    expect(body.processed).toEqual([])
    expect(body.skipped).toEqual([{ gameId: "x", reason: "missing_genre_meta" }])
    expect(writeLstmSnapshots).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Create stub `io.ts` so imports resolve**

Create `src/app/api/lstm/cron/io.ts`:

```ts
import { list } from "@vercel/blob"
import { AppSchema, CohortSummarySchema, type App, type CohortSummary } from "../../../../shared/api/appsflyer/types"

const APPS_PREFIX = "appsflyer/apps/"
const COHORT_PATH = (appId: string) => `appsflyer/cohort/${appId}/summary.json`

export async function readAllApps(): Promise<App[]> {
  const { blobs } = await list({ prefix: APPS_PREFIX })
  const out: App[] = []
  for (const b of blobs) {
    if (!b.pathname.endsWith(".json")) continue
    const res = await fetch(b.url)
    if (!res.ok) continue
    const json = await res.json()
    const parsed = AppSchema.safeParse(json)
    if (parsed.success) out.push(parsed.data)
  }
  return out
}

export async function readCohortSummary(appId: string): Promise<CohortSummary | null> {
  const { blobs } = await list({ prefix: COHORT_PATH(appId), limit: 1 })
  if (blobs.length === 0) return null
  const res = await fetch(blobs[0]!.url)
  if (!res.ok) return null
  const json = await res.json()
  const parsed = CohortSummarySchema.safeParse(json)
  return parsed.success ? parsed.data : null
}
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npx vitest run src/app/api/lstm/cron/__tests__/route.test.ts
```

Expected: FAIL — `route.ts` not found

- [ ] **Step 4: Implement `route.ts`**

Create `src/app/api/lstm/cron/route.ts`:

```ts
import { NextResponse } from "next/server"
import { checkSufficiency, type SufficiencyReason } from "../../../../shared/api/lstm/sufficiency"
import { buildGameForecast } from "../../../../shared/api/lstm/forecast-builder"
import { writeLstmSnapshots } from "../../../../shared/api/lstm/blob-writer"
import { getPrior } from "../../../../shared/api/prior-data"
import type { LstmSnapshot } from "../../../../shared/api/vc-simulation/types"
import type { RevenueSnapshot } from "../../../../shared/api/lstm/revenue-snapshot"
import { readAllApps, readCohortSummary } from "./io"

type Skipped = { gameId: string; reason: SufficiencyReason | "zero_arpdau" | "forecast_failed" | "input_schema_invalid" }

export const dynamic = "force-dynamic"

export async function GET(req: Request): Promise<Response> {
  const startedAt = Date.now()
  const auth = req.headers.get("authorization") ?? ""
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("unauthorized", { status: 401 })
  }

  let apps: Awaited<ReturnType<typeof readAllApps>>
  try {
    apps = await readAllApps()
  } catch {
    return NextResponse.json({ ok: false, error: "blob_fetch_failed" }, { status: 502 })
  }

  if (apps.length === 0) {
    return NextResponse.json({
      ok: true,
      processed: [],
      skipped: [],
      snapshots: null,
      elapsedMs: Date.now() - startedAt,
    })
  }

  const processed: string[] = []
  const skipped: Skipped[] = []
  const retentionPredictions: LstmSnapshot["predictions"] = {}
  const revenueArpdau: Record<string, number> = {}
  const revenueInstalls: Record<string, number> = {}
  const revenueForecasts: RevenueSnapshot["forecast"] = []

  for (const app of apps) {
    let summary: Awaited<ReturnType<typeof readCohortSummary>>
    try {
      summary = await readCohortSummary(app.appId)
    } catch {
      skipped.push({ gameId: app.appId, reason: "input_schema_invalid" })
      continue
    }
    if (!summary) {
      skipped.push({ gameId: app.appId, reason: "input_schema_invalid" })
      continue
    }

    const suff = checkSufficiency(summary, {
      appId: app.appId,
      genre: app.genre,
      region: app.region,
    })
    if (!suff.ok) {
      skipped.push({ gameId: suff.gameId, reason: suff.reason })
      continue
    }

    const bundle = getPrior({ genre: app.genre!, region: app.region! })
    if (!bundle) {
      skipped.push({ gameId: app.appId, reason: "unknown_genre_prior" })
      continue
    }

    let result
    try {
      result = buildGameForecast({
        cohortSummary: summary,
        appsMeta: { appId: app.appId, genre: app.genre!, region: app.region! },
        prior: bundle.retention,
        priorEffectiveN: bundle.effectiveN,
      })
    } catch {
      skipped.push({ gameId: app.appId, reason: "forecast_failed" })
      continue
    }

    retentionPredictions[app.appId] = {
      game_id: app.appId,
      genre: app.genre!,
      points: result.retentionCurve,
    }

    if (result.arpdauUsd === 0) {
      skipped.push({ gameId: app.appId, reason: "zero_arpdau" })
    } else {
      revenueArpdau[app.appId] = result.arpdauUsd
      revenueInstalls[app.appId] = result.installsAssumption
      revenueForecasts.push({ game_id: app.appId, points: result.revenueForecast })
    }

    processed.push(app.appId)
  }

  if (processed.length === 0) {
    return NextResponse.json({
      ok: true,
      processed,
      skipped,
      snapshots: null,
      elapsedMs: Date.now() - startedAt,
    })
  }

  const generatedAt = new Date().toISOString()
  const retentionSnapshot: LstmSnapshot = {
    schema_version: "1.0",
    generated_at: generatedAt,
    model: {
      name: "retention-bayesian-shrinkage",
      version: "phase-2",
      trained_at: generatedAt,
      hyperparameters: {
        lookback_days: 30,
        forecast_horizon_days: 1095,
        sample_count: 1,
        confidence_interval: 0.8,
      },
    },
    predictions: retentionPredictions,
  }

  const revenueSnapshot: RevenueSnapshot | null =
    revenueForecasts.length > 0
      ? {
          schema_version: "1.0",
          generated_at: generatedAt,
          source_retention_at: generatedAt,
          arpdau: { perGame: revenueArpdau, currency: "USD", windowDays: 14 },
          installsAssumption: { perGame: revenueInstalls, basis: "trailing-14d-mean" },
          forecast: revenueForecasts,
        }
      : null

  let urls
  try {
    urls = await writeLstmSnapshots({ retentionSnapshot, revenueSnapshot })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: "blob_put_failed", message: String(err) },
      { status: 502 },
    )
  }

  return NextResponse.json({
    ok: true,
    processed,
    skipped,
    snapshots: urls,
    elapsedMs: Date.now() - startedAt,
  })
}
```

NOTE: `getPrior(...).retention` 형태로 priors를 가져온다. 이것이 `PriorBundle` 타입에 존재해야 함. 만약 prior-data.ts의 `PriorBundle`이 `retention: { d1, d7, d30 }` 필드를 갖지 않으면 Step 5에서 typecheck가 실패할 수 있음. 그 경우 prior-data.ts를 확인하여 정확한 필드명 사용 (`getPrior`가 반환하는 구조에 맞게 한 줄 수정).

- [ ] **Step 5: Run test to verify it passes**

```bash
npx vitest run src/app/api/lstm/cron/__tests__/route.test.ts
npx tsc --noEmit
```

Expected: PASS (4 tests) and tsc clean. tsc error 발생 시 `getPrior` 반환 구조에 맞게 `bundle.retention` 부분을 조정.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/lstm/cron/ src/shared/api/lstm/
git commit -m "feat(lstm): cron route + io helpers — dual snapshot publish on UTC 18:30"
```

---

## Task 7: vercel.json cron entry

**Files:**
- Modify: `vercel.json`

- [ ] **Step 1: Add lstm cron entry**

`vercel.json`을 다음으로 교체:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  "buildCommand": "next build",
  "installCommand": "npm install --legacy-peer-deps",
  "crons": [
    { "path": "/api/appsflyer/cron", "schedule": "0 18 * * *" },
    { "path": "/api/lstm/cron",      "schedule": "30 18 * * *" }
  ]
}
```

- [ ] **Step 2: Verify JSON parses**

```bash
node -e "JSON.parse(require('fs').readFileSync('vercel.json','utf8')); console.log('ok')"
```

Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add vercel.json
git commit -m "feat(lstm): schedule daily cron at UTC 18:30 (KST 03:30)"
```

---

## Task 8: dry-run script + package.json

**Files:**
- Create: `scripts/lstm-dry-run.ts`
- Modify: `package.json`

- [ ] **Step 1: Implement dry-run script**

Create `scripts/lstm-dry-run.ts`:

```ts
#!/usr/bin/env tsx
import { readAllApps, readCohortSummary } from "../src/app/api/lstm/cron/io"
import { checkSufficiency } from "../src/shared/api/lstm/sufficiency"
import { buildGameForecast } from "../src/shared/api/lstm/forecast-builder"
import { getPrior } from "../src/shared/api/prior-data"

async function main() {
  const args = process.argv.slice(2)
  const gameIdFlag = args.find((a) => a.startsWith("--gameId="))?.split("=")[1]

  const apps = await readAllApps()
  const targets = gameIdFlag ? apps.filter((a) => a.appId === gameIdFlag) : apps
  if (targets.length === 0) {
    console.error(`no apps matched (filter=${gameIdFlag ?? "*"})`)
    process.exit(1)
  }

  const out: unknown[] = []
  for (const app of targets) {
    const summary = await readCohortSummary(app.appId)
    if (!summary) {
      out.push({ gameId: app.appId, status: "no_cohort_summary" })
      continue
    }
    const suff = checkSufficiency(summary, app)
    if (!suff.ok) {
      out.push({ gameId: app.appId, status: "skipped", reason: suff.reason })
      continue
    }
    const bundle = getPrior({ genre: app.genre!, region: app.region! })
    if (!bundle) {
      out.push({ gameId: app.appId, status: "skipped", reason: "unknown_genre_prior" })
      continue
    }
    const result = buildGameForecast({
      cohortSummary: summary,
      appsMeta: { appId: app.appId, genre: app.genre!, region: app.region! },
      prior: bundle.retention,
      priorEffectiveN: bundle.effectiveN,
    })
    out.push({
      gameId: app.appId,
      arpdauUsd: result.arpdauUsd,
      installsAssumption: result.installsAssumption,
      day30RetentionP50: result.retentionCurve[29]?.p50,
      day90RevenueP50: result.revenueForecast[90]?.revenueP50,
      // 전체 dump가 필요하면 환경변수 LSTM_DRY_FULL=1
      ...(process.env.LSTM_DRY_FULL === "1"
        ? { retentionCurve: result.retentionCurve, revenueForecast: result.revenueForecast }
        : {}),
    })
  }
  console.log(JSON.stringify(out, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
```

- [ ] **Step 2: Add `lstm:dry` script to package.json**

`package.json`의 `"scripts"` 블록에 추가 (`crawl:cpi:verify` 줄 뒤):

```json
    "lstm:dry": "tsx scripts/lstm-dry-run.ts",
```

- [ ] **Step 3: Verify script signature**

```bash
npx tsc --noEmit
```

Expected: PASS. (실제 실행은 BLOB_READ_WRITE_TOKEN 필요해 로컬 실행 안 함, Mike가 배포 후 검증.)

- [ ] **Step 4: Commit**

```bash
git add scripts/lstm-dry-run.ts package.json
git commit -m "feat(lstm): npm run lstm:dry — CLI dry-run for sanity check vs dashboard"
```

---

## Task 9: connection-dialog UI — genre/region select

**Files:**
- Modify: `src/widgets/connections/ui/connection-dialog.tsx`

dialog의 form에 두 select 추가. genre는 자유 입력보다 지원 prior 기준 enum이 안전하므로 `priorByGenre` keys에서 도출.

- [ ] **Step 1: Inspect current dialog form structure**

```bash
grep -n "genre\|region\|gameKey\|appId\|label" src/widgets/connections/ui/connection-dialog.tsx | head -30
```

이 결과를 바탕으로 다음 단계에서 form fields 사이 적절한 위치를 잡는다 (보통 `gameKey` select 직후).

- [ ] **Step 2: Add genre/region select fields**

`connection-dialog.tsx`에서 form state 정의부에 두 필드 추가:

```ts
const [genre, setGenre] = useState<string>("")
const [region, setRegion] = useState<string>("")
```

submit payload에 두 필드 포함 (등록 API 호출 위치에서 `body`에 `genre, region` 전달).

UI: `gameKey` select 직후에 추가:

```tsx
<label className="block text-sm">
  <span className="text-fg-2">Genre</span>
  <select
    value={genre}
    onChange={(e) => setGenre(e.target.value)}
    className="mt-1 w-full rounded-card border border-bg-3 bg-bg-1 px-2 py-1.5 text-sm"
  >
    <option value="">선택</option>
    <option value="Merge">Merge</option>
    <option value="Match-3">Match-3</option>
    <option value="Puzzle">Puzzle</option>
    <option value="Idle">Idle</option>
  </select>
</label>
<label className="block text-sm">
  <span className="text-fg-2">Region</span>
  <select
    value={region}
    onChange={(e) => setRegion(e.target.value)}
    className="mt-1 w-full rounded-card border border-bg-3 bg-bg-1 px-2 py-1.5 text-sm"
  >
    <option value="">선택</option>
    <option value="JP">JP</option>
    <option value="KR">KR</option>
    <option value="US">US</option>
    <option value="GLOBAL">GLOBAL</option>
  </select>
</label>
```

- [ ] **Step 3: Update register API to accept and store genre/region**

`src/app/api/appsflyer/register/route.ts` (또는 `RegisterRequestSchema`)이 dialog에서 보낸 `genre`, `region`을 받아 Blob `appsflyer/apps/{appId}.json`의 `App` 객체에 저장하도록 수정. `RegisterRequestSchema`에 두 optional 필드 추가:

```ts
genre: z.string().min(1).max(40).optional(),
region: z.string().min(2).max(8).optional(),
```

저장 시 `App` 객체 build 부분에 `genre, region` 펴넣기.

- [ ] **Step 4: Run typecheck + tests**

```bash
npx tsc --noEmit
npx vitest run
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/widgets/connections/ui/connection-dialog.tsx src/app/api/appsflyer/register/
git commit -m "feat(connections): collect genre/region in registration dialog (LSTM Phase 2 prereq)"
```

---

## Task 10: Backfill poko_merge meta + final verification

**Files:** none (운영자 수동 작업)

- [ ] **Step 1: Run final test suite**

```bash
npx vitest run
npx tsc --noEmit
```

Expected: PASS, ~25 신규 테스트 모두 그린.

- [ ] **Step 2: Push branch + open PR**

```bash
git push -u origin feat/lstm-phase-2-retention-forecast
gh pr create --base main --head feat/lstm-phase-2-retention-forecast \
  --title "feat(lstm): Phase 2 — retention & revenue forecast pipeline" \
  --body "$(cat <<'EOF'
## Summary
- LSTM Phase 2 compute layer: arpdau / sufficiency / forecast-builder / blob-writer / cron route + dry-run
- Vercel Cron 추가: UTC 18:30 일 1회 (AppsFlyer cron 30분 후)
- AppsFlyer connections dialog에 genre/region select 추가
- Spec: \`docs/superpowers/specs/2026-04-27-lstm-phase-2-retention-forecast-design.md\`

## Test plan
- [x] vitest 신규 ~25 테스트 통과
- [x] tsc clean
- [ ] Vercel preview에서 build 통과
- [ ] 머지 후 connections에서 poko_merge에 genre/region 입력 (Merge / JP)
- [ ] 다음 cron tick(UTC 18:30) 후 \`npm run lstm:dry\` 실행하여 결과 stdout 출력
- [ ] Mike가 dry-run 출력값을 dashboard 실측과 비교 (ARPDAU/installs/D30 retention/D90 revenue, 허용 ±5~10%)

## Phase 3 (별도 PR)
VC simulation / RevenueForecast chart / KPI 카드를 mock JSON에서 Blob fetch로 wiring + UI stale 배지(>7일).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: After merge — Mike's manual backfill**

connections dialog에서 poko_merge 카드 클릭 → genre=Merge, region=JP 입력해 저장. (또는 Vercel Blob Studio에서 `appsflyer/apps/poko_merge.json`을 직접 편집.)

- [ ] **Step 4: After first cron tick — sanity check**

```bash
npm run lstm:dry -- --gameId=poko_merge
```

dry-run JSON 결과를 dashboard와 비교:

| 항목 | dry-run 키 | dashboard | 허용 |
|---|---|---|---|
| ARPDAU | `arpdauUsd` | KPI ARPDAU | ±5% |
| installs | `installsAssumption` | connections card 14d/14 | ±10% |
| Day-30 retention | `day30RetentionP50` | RetentionCurve 차트 day-30 | ±5%p |
| Day-90 revenue | `day90RevenueP50` | RevenueForecast 차트 day-90 | ±10% |

차이가 허용범위 밖 → algorithm regression suspected → unit test 추가 후 fix PR.

---

## Self-Review

**1. Spec coverage:**
- §2 Architecture (cron 18:30, partial publish) → Tasks 6, 7
- §3.1 arpdau → Task 2
- §3.2 sufficiency → Task 3
- §3.3 forecast-builder → Task 4
- §3.4 blob-writer → Task 5
- §3.5 cron route → Task 6
- §3.6 dry-run → Task 8
- §4 Data flow → Task 6 의 통합
- §5 Error handling (401/blob fetch fail/sufficiency/zero arpdau/blob put fail) → Task 6 (cron route 내부 try/catch + skipped[] 분기)
- §6 Testing (unit + dry-run, golden 없음) → Tasks 2~6 의 vitest + Task 8 의 CLI
- §2 신규 의존성 (AppsFlyer apps Blob에 genre/region 추가, dialog 확장) → Task 1, 9
- §7 Delivery (단일 PR, Phase 3 분리) → Task 10

**2. Placeholder scan:** 없음. "TBD/TODO" 없음, 모든 코드 블록 완전.

**3. Type consistency:**
- `RetentionForecastPoint` 사용 — Task 4에서 import, Task 6에서 사용.
- `RevenueForecastPoint` 사용 — Task 4에서 정의, Task 6에서 사용.
- `LstmSnapshot.predictions` 타입 — Task 6에서 사용 (vc-simulation/types.ts).
- `RevenueSnapshot.forecast` 타입 — Task 6에서 사용 (lstm/revenue-snapshot.ts).
- `App.genre/region` (Task 1에서 추가) — Task 6/8/9에서 사용.

**4. Ambiguity check:**
- Task 6 `bundle.retention` 부분 — `PriorBundle` 실제 구조와 불일치할 가능성. Task 6 Step 4의 NOTE에서 명시적으로 다룸.
- 실제 prior-data.ts의 `PriorBundle`이 다른 필드명을 쓸 경우 typecheck 단계에서 자연 발견 + 수정 1줄. 위험도 낮음.
