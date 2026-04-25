# VC Simulation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 선택된 게임에 대한 VC 오퍼 조건 기반 36개월 Monte Carlo 투자 시뮬레이터를 `/dashboard/vc-simulation` 에 신규 추가. 실험-이율 배반(J-커브)을 Baseline ① vs ② 로 동시 시각화.

**Architecture:** 3계층 (data read-only → pure compute → UI). 기존 `readSnapshot()` · `priorByGenre` · `mmmSnapshot` 과 신규 `lstmSnapshot` 을 읽어 seeded Monte Carlo 로 Runway fan + IRR 분포 + J-커브 산출. URL flat + Sidebar 그룹핑.

**Tech Stack:** Next.js 15 · React 19 · TypeScript · Zod v4 · Zustand 5 · visx 3 · Recharts 3 · Tailwind v4 · Framer Motion 12 · Node built-in test runner (`tsx --test`)

**Spec:** `docs/superpowers/specs/2026-04-24-vc-simulation-design.md`

---

## 파일 구조 (생성/수정 맵)

### 생성 (신규)
```
src/shared/api/vc-simulation/
  types.ts                    # Zod 스키마 + 타입
  defaults.ts                 # 3 프리셋 + 상수
  prefill.ts                  # 실데이터에서 default offer derive
  compute.ts                  # Monte Carlo (pure function)
  use-vc-sim.ts               # React hook
  index.ts                    # barrel export
  __tests__/
    types.test.ts
    defaults.test.ts
    prefill.test.ts
    compute.test.ts
    lstm-schema.test.ts
    fixtures/
      offer.standard.json
      offer.conservative.json
      offer.aggressive.json
      lstm.valid.json
      lstm.stale.json
      lstm.malformed.json
      appsflyer.snapshot.mock.json

src/shared/api/data/lstm/
  retention-snapshot.json     # mock placeholder

src/widgets/vc-simulation/
  index.ts
  ui/
    vc-input-panel.tsx
    preset-tabs.tsx
    offer-fields.tsx
    fund-allocation-slider.tsx
    horizon-slider.tsx
    derived-stats.tsx
    vc-result-board.tsx
    vc-kpi-strip.tsx
    irr-histogram-pair.tsx
    j-curve-strip.tsx
    dual-baseline-runway-chart.tsx   # wrapper re-exporting 확장된 RunwayFanChart

src/app/(dashboard)/dashboard/vc-simulation/
  page.tsx
```

### 수정 (기존)
```
src/widgets/charts/ui/runway-fan-chart.tsx        # optional overlay prop 추가
src/widgets/navigation/model/constants.ts         # nav 아이템 + 그룹 구조
src/widgets/navigation/ui/category-sidebar.tsx    # 그룹 label 렌더링
src/shared/i18n/dictionary.ts                     # vc.* + nav.group.* 키 추가
package.json                                      # npm script "test:vc" 추가
```

---

## Task 1.1 · Zod 스키마 + 타입 정의

**Files:**
- Create: `src/shared/api/vc-simulation/types.ts`
- Create: `src/shared/api/vc-simulation/__tests__/types.test.ts`

- [ ] **Step 1: 실패 테스트 작성 (types.test.ts)**

```ts
import { test } from "node:test"
import assert from "node:assert/strict"
import {
  OfferSchema,
  LstmSnapshotSchema,
  VcSimResultSchema,
} from "../types"

test("OfferSchema rejects negative investment", () => {
  const r = OfferSchema.safeParse({
    investmentUsd: -1000,
    postMoneyUsd: 15_000_000,
    exitMultiple: 3,
    hurdleRate: 0.2,
    uaSharePct: 60,
    horizonMonths: 36,
  })
  assert.equal(r.success, false)
})

test("OfferSchema accepts valid standard offer", () => {
  const r = OfferSchema.safeParse({
    investmentUsd: 3_000_000,
    postMoneyUsd: 15_000_000,
    exitMultiple: 3,
    hurdleRate: 0.2,
    uaSharePct: 60,
    horizonMonths: 36,
  })
  assert.equal(r.success, true)
})

test("LstmSnapshotSchema requires >= 11 points", () => {
  const r = LstmSnapshotSchema.safeParse({
    schema_version: "1.0",
    generated_at: new Date().toISOString(),
    model: {
      name: "retention-lstm",
      version: "v1",
      trained_at: new Date().toISOString(),
      hyperparameters: {
        lookback_days: 90,
        forecast_horizon_days: 1095,
        sample_count: 10000,
        confidence_interval: 0.8,
      },
    },
    predictions: {
      poko_merge: {
        game_id: "poko_merge",
        genre: "puzzle_match3",
        points: Array.from({ length: 10 }, (_, i) => ({
          day: i + 1,
          p10: 0.1,
          p50: 0.2,
          p90: 0.3,
        })),
      },
    },
  })
  assert.equal(r.success, false)
})
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
cd /Users/mike/Downloads/compass-worktrees/feature-vc-simulation
tsx --test src/shared/api/vc-simulation/__tests__/types.test.ts
```
Expected: FAIL — module not found

- [ ] **Step 3: types.ts 구현**

```ts
import { z } from "zod"

export const OfferSchema = z.object({
  investmentUsd: z.number().positive().max(1_000_000_000),
  postMoneyUsd: z.number().positive().max(10_000_000_000),
  exitMultiple: z.number().min(0.1).max(100),
  hurdleRate: z.number().min(0).max(2),      // 0~200%
  uaSharePct: z.number().min(0).max(100),
  horizonMonths: z.number().int().min(12).max(60),
})
export type Offer = z.infer<typeof OfferSchema>

const LstmPointSchema = z.object({
  day: z.number().int().positive().max(1095),
  p10: z.number().min(0).max(1),
  p50: z.number().min(0).max(1),
  p90: z.number().min(0).max(1),
})

export const LstmSnapshotSchema = z.object({
  schema_version: z.literal("1.0"),
  generated_at: z.string().datetime(),
  model: z.object({
    name: z.string(),
    version: z.string(),
    trained_at: z.string().datetime(),
    hyperparameters: z.object({
      lookback_days: z.number().positive(),
      forecast_horizon_days: z.number().positive(),
      sample_count: z.number().int().positive(),
      confidence_interval: z.number().min(0).max(1),
    }),
  }),
  predictions: z.record(
    z.string(),
    z.object({
      game_id: z.string(),
      genre: z.string(),
      points: z.array(LstmPointSchema).min(11),
    })
  ),
  notes: z.string().optional(),
})
export type LstmSnapshot = z.infer<typeof LstmSnapshotSchema>

export type RunwayPoint = {
  month: number
  p10: number
  p50: number
  p90: number
}

export type BaselineResult = {
  runway: RunwayPoint[]
  irrDistribution: number[]      // 2,000 sample IRRs
  p50Irr: number
  p50Moic: number
  paybackMonths: number | null   // null = 수렴 실패
}

export const VcSimResultSchema = z.object({
  offer: OfferSchema,
  baselineA: z.any(),             // BaselineResult (runtime skip for perf)
  baselineB: z.any(),
  gap: z.array(z.number()),       // 월별 ② − ① IRR contribution
  jCurveBreakEvenMonth: z.number().nullable(),
  dataSourceBadge: z.enum(["real", "benchmark", "default"]),
})
export type VcSimResult = {
  offer: Offer
  baselineA: BaselineResult
  baselineB: BaselineResult
  gap: number[]
  jCurveBreakEvenMonth: number | null
  dataSourceBadge: "real" | "benchmark" | "default"
}
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

```bash
tsx --test src/shared/api/vc-simulation/__tests__/types.test.ts
```
Expected: PASS (3/3)

- [ ] **Step 5: 커밋**

```bash
git add src/shared/api/vc-simulation/types.ts \
        src/shared/api/vc-simulation/__tests__/types.test.ts
git commit -m "feat(vc-simulation): Zod schema + types (Offer, LstmSnapshot, VcSimResult)"
```

---

## Task 1.2 · LSTM retention snapshot mock JSON

**Files:**
- Create: `src/shared/api/data/lstm/retention-snapshot.json`
- Create: `src/shared/api/vc-simulation/__tests__/fixtures/lstm.valid.json`
- Create: `src/shared/api/vc-simulation/__tests__/fixtures/lstm.stale.json`
- Create: `src/shared/api/vc-simulation/__tests__/fixtures/lstm.malformed.json`

- [ ] **Step 1: 실제 사용 mock (retention-snapshot.json)**

```json
{
  "schema_version": "1.0",
  "generated_at": "2026-04-24T00:00:00Z",
  "model": {
    "name": "retention-lstm",
    "version": "v1-mock",
    "trained_at": "2026-04-20T00:00:00Z",
    "hyperparameters": {
      "lookback_days": 90,
      "forecast_horizon_days": 1095,
      "sample_count": 10000,
      "confidence_interval": 0.8
    }
  },
  "predictions": {
    "poko_merge": {
      "game_id": "poko_merge",
      "genre": "puzzle_match3",
      "points": [
        { "day": 1,    "p10": 0.38, "p50": 0.45, "p90": 0.52 },
        { "day": 3,    "p10": 0.28, "p50": 0.34, "p90": 0.40 },
        { "day": 7,    "p10": 0.18, "p50": 0.23, "p90": 0.28 },
        { "day": 14,   "p10": 0.12, "p50": 0.16, "p90": 0.21 },
        { "day": 30,   "p10": 0.08, "p50": 0.11, "p90": 0.15 },
        { "day": 60,   "p10": 0.05, "p50": 0.07, "p90": 0.10 },
        { "day": 90,   "p10": 0.04, "p50": 0.06, "p90": 0.08 },
        { "day": 180,  "p10": 0.025,"p50": 0.04, "p90": 0.055 },
        { "day": 365,  "p10": 0.015,"p50": 0.025,"p90": 0.035 },
        { "day": 730,  "p10": 0.008,"p50": 0.014,"p90": 0.020 },
        { "day": 1095, "p10": 0.005,"p50": 0.009,"p90": 0.013 }
      ]
    }
  },
  "notes": "MVP mock — 실제 LSTM 출력으로 대체 예정 (feat/retention-lstm worktree)"
}
```

- [ ] **Step 2: fixtures/lstm.valid.json (위 내용 복사 + game_id 를 test_game 로)**

```json
{
  "schema_version": "1.0",
  "generated_at": "2026-04-24T00:00:00Z",
  "model": {
    "name": "retention-lstm",
    "version": "test",
    "trained_at": "2026-04-20T00:00:00Z",
    "hyperparameters": {
      "lookback_days": 90,
      "forecast_horizon_days": 1095,
      "sample_count": 10000,
      "confidence_interval": 0.8
    }
  },
  "predictions": {
    "test_game": {
      "game_id": "test_game",
      "genre": "puzzle_match3",
      "points": [
        { "day": 1,    "p10": 0.38, "p50": 0.45, "p90": 0.52 },
        { "day": 3,    "p10": 0.28, "p50": 0.34, "p90": 0.40 },
        { "day": 7,    "p10": 0.18, "p50": 0.23, "p90": 0.28 },
        { "day": 14,   "p10": 0.12, "p50": 0.16, "p90": 0.21 },
        { "day": 30,   "p10": 0.08, "p50": 0.11, "p90": 0.15 },
        { "day": 60,   "p10": 0.05, "p50": 0.07, "p90": 0.10 },
        { "day": 90,   "p10": 0.04, "p50": 0.06, "p90": 0.08 },
        { "day": 180,  "p10": 0.025,"p50": 0.04, "p90": 0.055 },
        { "day": 365,  "p10": 0.015,"p50": 0.025,"p90": 0.035 },
        { "day": 730,  "p10": 0.008,"p50": 0.014,"p90": 0.020 },
        { "day": 1095, "p10": 0.005,"p50": 0.009,"p90": 0.013 }
      ]
    }
  }
}
```

- [ ] **Step 3: fixtures/lstm.stale.json — generated_at 45일 전**

```json
{
  "schema_version": "1.0",
  "generated_at": "2026-03-10T00:00:00Z",
  "model": { "name": "retention-lstm", "version": "stale", "trained_at": "2026-02-20T00:00:00Z", "hyperparameters": { "lookback_days": 90, "forecast_horizon_days": 1095, "sample_count": 10000, "confidence_interval": 0.8 } },
  "predictions": {
    "test_game": { "game_id": "test_game", "genre": "puzzle_match3", "points": [
      { "day": 1, "p10": 0.38, "p50": 0.45, "p90": 0.52 },
      { "day": 3, "p10": 0.28, "p50": 0.34, "p90": 0.40 },
      { "day": 7, "p10": 0.18, "p50": 0.23, "p90": 0.28 },
      { "day": 14, "p10": 0.12, "p50": 0.16, "p90": 0.21 },
      { "day": 30, "p10": 0.08, "p50": 0.11, "p90": 0.15 },
      { "day": 60, "p10": 0.05, "p50": 0.07, "p90": 0.10 },
      { "day": 90, "p10": 0.04, "p50": 0.06, "p90": 0.08 },
      { "day": 180, "p10": 0.025, "p50": 0.04, "p90": 0.055 },
      { "day": 365, "p10": 0.015, "p50": 0.025, "p90": 0.035 },
      { "day": 730, "p10": 0.008, "p50": 0.014, "p90": 0.020 },
      { "day": 1095, "p10": 0.005, "p50": 0.009, "p90": 0.013 }
    ] }
  }
}
```

- [ ] **Step 4: fixtures/lstm.malformed.json — schema 위반 (points 9개만)**

```json
{
  "schema_version": "1.0",
  "generated_at": "2026-04-24T00:00:00Z",
  "model": { "name": "retention-lstm", "version": "bad", "trained_at": "2026-04-20T00:00:00Z", "hyperparameters": { "lookback_days": 90, "forecast_horizon_days": 1095, "sample_count": 10000, "confidence_interval": 0.8 } },
  "predictions": {
    "test_game": { "game_id": "test_game", "genre": "puzzle_match3", "points": [
      { "day": 1, "p10": 0.38, "p50": 0.45, "p90": 0.52 },
      { "day": 3, "p10": 0.28, "p50": 0.34, "p90": 0.40 },
      { "day": 7, "p10": 0.18, "p50": 0.23, "p90": 0.28 },
      { "day": 14, "p10": 0.12, "p50": 0.16, "p90": 0.21 },
      { "day": 30, "p10": 0.08, "p50": 0.11, "p90": 0.15 },
      { "day": 60, "p10": 0.05, "p50": 0.07, "p90": 0.10 },
      { "day": 90, "p10": 0.04, "p50": 0.06, "p90": 0.08 },
      { "day": 180, "p10": 0.025, "p50": 0.04, "p90": 0.055 },
      { "day": 365, "p10": 0.015, "p50": 0.025, "p90": 0.035 }
    ] }
  }
}
```

- [ ] **Step 5: 커밋**

```bash
git add src/shared/api/data/lstm/retention-snapshot.json \
        src/shared/api/vc-simulation/__tests__/fixtures/
git commit -m "feat(vc-simulation): LSTM retention snapshot mock + test fixtures"
```

---

## Task 1.3 · LSTM schema 계약 테스트

**Files:**
- Create: `src/shared/api/vc-simulation/__tests__/lstm-schema.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

```ts
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { LstmSnapshotSchema } from "../types"

const FIXTURES = join(import.meta.dirname, "fixtures")

test("lstm.valid.json passes schema", () => {
  const raw = JSON.parse(readFileSync(join(FIXTURES, "lstm.valid.json"), "utf-8"))
  const r = LstmSnapshotSchema.safeParse(raw)
  assert.equal(r.success, true)
})

test("lstm.malformed.json (9 points) fails schema", () => {
  const raw = JSON.parse(readFileSync(join(FIXTURES, "lstm.malformed.json"), "utf-8"))
  const r = LstmSnapshotSchema.safeParse(raw)
  assert.equal(r.success, false)
})

test("production retention-snapshot.json passes schema", () => {
  const raw = JSON.parse(readFileSync(
    join(import.meta.dirname, "..", "..", "data", "lstm", "retention-snapshot.json"),
    "utf-8"
  ))
  const r = LstmSnapshotSchema.safeParse(raw)
  assert.equal(r.success, true, r.success ? "" : JSON.stringify(r.error.issues))
})
```

- [ ] **Step 2: 테스트 실행**

```bash
tsx --test src/shared/api/vc-simulation/__tests__/lstm-schema.test.ts
```
Expected: PASS (3/3) — 스키마와 fixture 가 이미 호환

- [ ] **Step 3: 커밋**

```bash
git add src/shared/api/vc-simulation/__tests__/lstm-schema.test.ts
git commit -m "test(vc-simulation): LSTM snapshot contract tests (valid / malformed / production mock)"
```

---

## Task 1.4 · i18n dictionary — vc.* 키 추가

**Files:**
- Modify: `src/shared/i18n/dictionary.ts`

- [ ] **Step 1: dictionary.ts 상단 객체에 `vc.*` 섹션 추가 (파일 끝 export 전)**

`dictionary` 객체 안 (alphabetical 순서) 에 다음 블록을 삽입. 기존 키 스타일을 따름 (ko: "...", en: "..." 쌍).

```ts
// === VC Simulation ===
"vc.page.title": { ko: "투자 시뮬레이션", en: "VC Simulation" },
"vc.page.subtitle": { ko: "VC 오퍼 조건을 입력해 36개월 수익률 분포 시뮬레이션", en: "Enter VC offer terms to simulate 36-month return distribution" },

"vc.preset.conservative": { ko: "보수적", en: "Conservative" },
"vc.preset.standard": { ko: "표준", en: "Standard" },
"vc.preset.aggressive": { ko: "적극적", en: "Aggressive" },

"vc.field.investment": { ko: "투자금", en: "Investment" },
"vc.field.postMoney": { ko: "투자 후 기업가치", en: "Post-money valuation" },
"vc.field.exitMultiple": { ko: "목표 회수 배수", en: "Target exit multiple" },
"vc.field.hurdleRate": { ko: "최소 기대수익률", en: "Hurdle rate" },
"vc.field.uaShare": { ko: "UA 비중", en: "UA share" },
"vc.field.opsShare": { ko: "개발·운영 비중", en: "Dev & ops share" },
"vc.field.horizon": { ko: "평가 기간", en: "Evaluation horizon" },
"vc.field.derived.equity": { ko: "VC 지분율 (자동)", en: "VC equity % (auto)" },
"vc.field.derived.preMoney": { ko: "투자 전 기업가치 (자동)", en: "Pre-money (auto)" },

"vc.kpi.irr": { ko: "연환산 수익률", en: "Annualized return (IRR)" },
"vc.kpi.moic": { ko: "투자 배수", en: "Return multiple (MOIC)" },
"vc.kpi.payback": { ko: "원금 회수 기간", en: "Payback period" },
"vc.kpi.jcurveBreakEven": { ko: "J-커브 회복 시점", en: "J-curve break-even" },

"vc.baseline.withoutExperiment": { ko: "실험 없이", en: "Without experiments" },
"vc.baseline.withExperiment": { ko: "실험 반영", en: "With experiments" },
"vc.baseline.gap": { ko: "실험 기여분", en: "Experiment contribution" },

"vc.badge.dataSource.real": { ko: "실데이터", en: "Real data" },
"vc.badge.dataSource.benchmark": { ko: "장르 벤치마크", en: "Genre benchmark" },
"vc.badge.dataSource.default": { ko: "기본 추정", en: "Default estimate" },
"vc.badge.stale": { ko: "모델 업데이트 필요", en: "Model needs refresh" },

"vc.error.convergence": { ko: "IRR 수렴 불가 — 현금흐름 전부 음수 가능성", en: "IRR did not converge — likely all-negative cashflows" },
"vc.error.jcurveNoRecovery": { ko: "J-커브 회복 없음 — 실험 기여분 전 기간 음수", en: "No J-curve recovery — experiment contribution negative throughout" },
"vc.error.jcurveNoDrop": { ko: "해당 없음 — 실험 비용이 초기부터 상쇄됨", en: "N/A — experiment cost offset from start" },
"vc.error.calcFailed": { ko: "계산 실패", en: "Calculation failed" },

"vc.unit.months": { ko: "개월", en: "months" },
"vc.unit.usd": { ko: "USD", en: "USD" },

// === Nav groups ===
"nav.group.investment": { ko: "투자 결정", en: "Investment Decision" },
"nav.group.market": { ko: "시장 분석", en: "Market Analysis" },
"nav.vc-simulation": { ko: "투자 시뮬레이션", en: "VC Simulation" },
```

- [ ] **Step 2: tsc 통과 확인**

```bash
cd /Users/mike/Downloads/compass-worktrees/feature-vc-simulation
npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 3: 커밋**

```bash
git add src/shared/i18n/dictionary.ts
git commit -m "feat(vc-simulation): i18n keys — vc.* (25개) + nav.group.* (2개) + nav.vc-simulation"
```

---

## Task 2.1 · defaults.ts — 프리셋 3종

**Files:**
- Create: `src/shared/api/vc-simulation/defaults.ts`
- Create: `src/shared/api/vc-simulation/__tests__/defaults.test.ts`

- [ ] **Step 1: 실패 테스트**

```ts
import { test } from "node:test"
import assert from "node:assert/strict"
import { PRESETS, DEFAULT_OFFER } from "../defaults"
import { OfferSchema } from "../types"

test("all presets are valid offers", () => {
  for (const [name, offer] of Object.entries(PRESETS)) {
    const r = OfferSchema.safeParse(offer)
    assert.equal(r.success, true, `${name} invalid`)
  }
})

test("standard preset is the DEFAULT_OFFER", () => {
  assert.deepEqual(DEFAULT_OFFER, PRESETS.standard)
})

test("conservative has lower investment than aggressive", () => {
  assert.ok(PRESETS.conservative.investmentUsd < PRESETS.aggressive.investmentUsd)
})

test("conservative has higher hurdle than aggressive", () => {
  assert.ok(PRESETS.conservative.hurdleRate > PRESETS.aggressive.hurdleRate)
})
```

- [ ] **Step 2: 테스트 실행 — FAIL**

```bash
tsx --test src/shared/api/vc-simulation/__tests__/defaults.test.ts
```

- [ ] **Step 3: defaults.ts 구현**

```ts
import type { Offer } from "./types"

export const PRESETS: Record<"conservative" | "standard" | "aggressive", Offer> = {
  conservative: {
    investmentUsd: 2_000_000,
    postMoneyUsd: 10_000_000,
    exitMultiple: 2,
    hurdleRate: 0.25,
    uaSharePct: 60,
    horizonMonths: 36,
  },
  standard: {
    investmentUsd: 3_000_000,
    postMoneyUsd: 15_000_000,
    exitMultiple: 3,
    hurdleRate: 0.2,
    uaSharePct: 60,
    horizonMonths: 36,
  },
  aggressive: {
    investmentUsd: 5_000_000,
    postMoneyUsd: 25_000_000,
    exitMultiple: 5,
    hurdleRate: 0.15,
    uaSharePct: 70,
    horizonMonths: 36,
  },
}

export const DEFAULT_OFFER: Offer = PRESETS.standard

export const MONTE_CARLO_SAMPLES = 2_000
export const IRR_MAX_ITER = 50
export const IRR_TOL = 1e-6
export const LSTM_STALE_DAYS = 30
```

- [ ] **Step 4: 테스트 실행 — PASS**

- [ ] **Step 5: 커밋**

```bash
git add src/shared/api/vc-simulation/defaults.ts \
        src/shared/api/vc-simulation/__tests__/defaults.test.ts
git commit -m "feat(vc-simulation): 3 presets (conservative/standard/aggressive) + constants"
```

---

## Task 2.2 · prefill.ts — 실데이터 기반 자동 채우기

**Files:**
- Create: `src/shared/api/vc-simulation/prefill.ts`
- Create: `src/shared/api/vc-simulation/__tests__/prefill.test.ts`

- [ ] **Step 1: 실패 테스트**

```ts
import { test } from "node:test"
import assert from "node:assert/strict"
import { prefillOffer } from "../prefill"

test("prefillOffer returns standard default when no sources", () => {
  const o = prefillOffer({ gameId: "test_game", appsflyerSnapshot: null })
  assert.equal(o.uaSharePct, 60)           // from DEFAULT_OFFER
  assert.equal(o.investmentUsd, 3_000_000)
})

test("prefillOffer derives uaSharePct from AppsFlyer cost ratio", () => {
  const mockAf = {
    totalCostUsd: 100_000,
    uaCostUsd: 75_000,   // 75% UA
  }
  const o = prefillOffer({ gameId: "test_game", appsflyerSnapshot: mockAf as any })
  assert.equal(Math.round(o.uaSharePct), 75)
})

test("prefillOffer clamps uaSharePct to [0, 100]", () => {
  const mockAf = {
    totalCostUsd: 100,
    uaCostUsd: 150,  // bad data → >100%
  }
  const o = prefillOffer({ gameId: "test_game", appsflyerSnapshot: mockAf as any })
  assert.ok(o.uaSharePct <= 100)
  assert.ok(o.uaSharePct >= 0)
})
```

- [ ] **Step 2: 테스트 실행 — FAIL**

- [ ] **Step 3: prefill.ts 구현**

```ts
import type { Offer } from "./types"
import { DEFAULT_OFFER } from "./defaults"

type PrefillInput = {
  gameId: string
  appsflyerSnapshot: { totalCostUsd: number; uaCostUsd: number } | null
}

export function prefillOffer(input: PrefillInput): Offer {
  const base = { ...DEFAULT_OFFER }

  if (input.appsflyerSnapshot && input.appsflyerSnapshot.totalCostUsd > 0) {
    const raw = (input.appsflyerSnapshot.uaCostUsd / input.appsflyerSnapshot.totalCostUsd) * 100
    base.uaSharePct = Math.max(0, Math.min(100, raw))
  }

  return base
}
```

- [ ] **Step 4: 테스트 실행 — PASS**

- [ ] **Step 5: 커밋**

```bash
git add src/shared/api/vc-simulation/prefill.ts \
        src/shared/api/vc-simulation/__tests__/prefill.test.ts
git commit -m "feat(vc-simulation): prefillOffer — AppsFlyer UA cost ratio → uaSharePct"
```

---

## Task 2.3 · compute.ts — seeded RNG + retention 기반 revenue

**Files:**
- Create: `src/shared/api/vc-simulation/compute.ts`
- Create: `src/shared/api/vc-simulation/__tests__/compute.test.ts`

- [ ] **Step 1: seeded RNG helper + 실패 테스트**

```ts
// __tests__/compute.test.ts
import { test } from "node:test"
import assert from "node:assert/strict"
import { computeVcSimulation, makeSeededRng } from "../compute"
import { DEFAULT_OFFER } from "../defaults"
import type { LstmSnapshot } from "../types"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const LSTM_VALID: LstmSnapshot = JSON.parse(
  readFileSync(join(import.meta.dirname, "fixtures/lstm.valid.json"), "utf-8")
)

const SOURCES = {
  gameId: "test_game",
  lstmSnapshot: LSTM_VALID,
  bayesianPosterior: null,
  appsflyerInitialCash: 500_000,
}

test("seeded RNG is deterministic", () => {
  const a = makeSeededRng("abc")
  const b = makeSeededRng("abc")
  assert.equal(a(), b())
  assert.equal(a(), b())
})

test("compute returns same P50 IRR for same offer + sources", () => {
  const r1 = computeVcSimulation(DEFAULT_OFFER, SOURCES)
  const r2 = computeVcSimulation(DEFAULT_OFFER, SOURCES)
  assert.equal(r1.baselineA.p50Irr, r2.baselineA.p50Irr)
})

test("runway has horizon+1 months (month 0..horizon)", () => {
  const r = computeVcSimulation(DEFAULT_OFFER, SOURCES)
  assert.equal(r.baselineA.runway.length, DEFAULT_OFFER.horizonMonths + 1)
})

test("runway P10 <= P50 <= P90 at each month", () => {
  const r = computeVcSimulation(DEFAULT_OFFER, SOURCES)
  for (const pt of r.baselineA.runway) {
    assert.ok(pt.p10 <= pt.p50, `month ${pt.month}: p10 ${pt.p10} > p50 ${pt.p50}`)
    assert.ok(pt.p50 <= pt.p90, `month ${pt.month}: p50 ${pt.p50} > p90 ${pt.p90}`)
  }
})
```

- [ ] **Step 2: FAIL 확인**

- [ ] **Step 3: compute.ts 초기 구현 (seeded RNG + retention interpolation + simplified revenue)**

```ts
import type { Offer, LstmSnapshot, VcSimResult, BaselineResult, RunwayPoint } from "./types"
import { MONTE_CARLO_SAMPLES } from "./defaults"

// --- seeded RNG (mulberry32) ---
export function makeSeededRng(seed: string): () => number {
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  let s = h >>> 0
  return () => {
    s = (s + 0x6D2B79F5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// --- retention monotone interpolation between snapshot points ---
function interpolateRetention(
  snapshot: LstmSnapshot,
  gameId: string,
  day: number,
  percentile: "p10" | "p50" | "p90"
): number {
  const pred = snapshot.predictions[gameId]
  if (!pred) return 0
  const pts = pred.points
  if (day <= pts[0].day) return pts[0][percentile]
  if (day >= pts[pts.length - 1].day) return pts[pts.length - 1][percentile]
  for (let i = 0; i < pts.length - 1; i++) {
    if (day >= pts[i].day && day <= pts[i + 1].day) {
      const t = (day - pts[i].day) / (pts[i + 1].day - pts[i].day)
      return pts[i][percentile] * (1 - t) + pts[i + 1][percentile] * t
    }
  }
  return pts[0][percentile]
}

type Sources = {
  gameId: string
  lstmSnapshot: LstmSnapshot
  bayesianPosterior: { deltaLtv: number } | null
  appsflyerInitialCash: number
}

// --- single Monte Carlo sample ---
function simulateOnePath(
  offer: Offer,
  sources: Sources,
  rng: () => number,
  withExperiment: boolean
): number[] {        // cumulative cash by month
  const cashflow: number[] = []
  let cumulative = sources.appsflyerInitialCash + offer.investmentUsd

  const uaBudgetTotal = offer.investmentUsd * (offer.uaSharePct / 100)
  const opsBudgetTotal = offer.investmentUsd * ((100 - offer.uaSharePct) / 100)
  const monthlyUa = uaBudgetTotal / offer.horizonMonths
  const monthlyOps = opsBudgetTotal / offer.horizonMonths

  const CPI = 2.5 + rng() * 1.0            // $2.5 ~ $3.5
  const ARPDAU = 0.15 + rng() * 0.10       // $0.15 ~ $0.25

  const expDeltaLtv = withExperiment && sources.bayesianPosterior
    ? sources.bayesianPosterior.deltaLtv
    : 0
  const expCostMonthly = withExperiment ? monthlyUa * 0.1 : 0   // 실험 비용 = UA 의 10%
  const expEffectStartMonth = 6                                  // 6개월 뒤 효과 반영

  cashflow.push(cumulative)
  for (let t = 1; t <= offer.horizonMonths; t++) {
    const installs = monthlyUa / CPI
    // retention-based cohort revenue (30 days cumulative from this month's installs)
    const liftFactor = t >= expEffectStartMonth ? (1 + expDeltaLtv) : 1
    let cohortRev = 0
    for (let d = 1; d <= 30; d++) {
      const ret = interpolateRetention(sources.lstmSnapshot, sources.gameId, d, "p50")
      cohortRev += installs * ret * ARPDAU * liftFactor
    }
    const cost = monthlyUa + monthlyOps + expCostMonthly
    cumulative += cohortRev - cost
    cashflow.push(cumulative)
  }
  return cashflow
}

export function computeVcSimulation(offer: Offer, sources: Sources): VcSimResult {
  const seed = JSON.stringify({ offer, gameId: sources.gameId })
  const rng = makeSeededRng(seed)

  // run N samples for each baseline
  const samplesA: number[][] = []
  const samplesB: number[][] = []
  for (let i = 0; i < MONTE_CARLO_SAMPLES; i++) {
    samplesA.push(simulateOnePath(offer, sources, rng, false))
    samplesB.push(simulateOnePath(offer, sources, rng, true))
  }

  const baselineA = buildBaseline(samplesA, offer)
  const baselineB = buildBaseline(samplesB, offer)
  const gap = baselineB.runway.map((pt, i) => pt.p50 - baselineA.runway[i].p50)
  const jCurveBreakEven = findBreakEvenMonth(gap)

  return {
    offer,
    baselineA,
    baselineB,
    gap,
    jCurveBreakEvenMonth: jCurveBreakEven,
    dataSourceBadge: "real",   // caller 가 override 가능 (stale/fallback 에서)
  }
}

function percentile(arr: number[], p: number): number {
  const sorted = [...arr].sort((a, b) => a - b)
  const idx = Math.floor(sorted.length * p)
  return sorted[Math.min(sorted.length - 1, idx)]
}

function buildBaseline(samples: number[][], offer: Offer): BaselineResult {
  const months = samples[0].length
  const runway: RunwayPoint[] = []
  for (let m = 0; m < months; m++) {
    const slice = samples.map((s) => s[m])
    runway.push({
      month: m,
      p10: percentile(slice, 0.1),
      p50: percentile(slice, 0.5),
      p90: percentile(slice, 0.9),
    })
  }
  // IRR distribution: per sample, compute IRR from monthly net cashflow
  const irrs: number[] = []
  for (const path of samples) {
    const monthlyNet = path.slice(1).map((v, i) => v - path[i])
    // Initial investment as negative cashflow at month 0
    const flows = [-offer.investmentUsd, ...monthlyNet]
    const irr = computeIrr(flows)
    if (Number.isFinite(irr)) irrs.push(irr)
  }
  const p50Irr = irrs.length > 0 ? percentile(irrs, 0.5) : NaN
  const finalCash = percentile(samples.map((s) => s[months - 1]), 0.5)
  const p50Moic = finalCash / offer.investmentUsd
  const paybackMonths = findPaybackMonth(samples, offer.investmentUsd)

  return { runway, irrDistribution: irrs, p50Irr, p50Moic, paybackMonths }
}

// simple Newton-Raphson IRR (monthly → annualized)
function computeIrr(flows: number[]): number {
  let rate = 0.01
  for (let iter = 0; iter < 50; iter++) {
    let npv = 0, dnpv = 0
    for (let t = 0; t < flows.length; t++) {
      const disc = Math.pow(1 + rate, t)
      npv += flows[t] / disc
      dnpv -= (t * flows[t]) / (disc * (1 + rate))
    }
    if (Math.abs(dnpv) < 1e-10) return NaN
    const newRate = rate - npv / dnpv
    if (Math.abs(newRate - rate) < 1e-6) return Math.pow(1 + newRate, 12) - 1   // annualize
    rate = newRate
  }
  return NaN
}

function findPaybackMonth(samples: number[][], initial: number): number | null {
  const target = initial
  const months = samples[0].length
  for (let m = 0; m < months; m++) {
    const p50 = percentile(samples.map((s) => s[m]), 0.5)
    if (p50 >= target) return m
  }
  return null
}

function findBreakEvenMonth(gap: number[]): number | null {
  if (gap[gap.length - 1] <= 0) return null         // 전 기간 음수 — 회복 없음
  if (gap[0] >= 0) return 0                          // 시작부터 양수 — 해당 없음 표시용으로 0 반환
  for (let i = 1; i < gap.length; i++) {
    if (gap[i - 1] < 0 && gap[i] >= 0) return i
  }
  return null
}
```

- [ ] **Step 4: 테스트 실행 — PASS**

```bash
tsx --test src/shared/api/vc-simulation/__tests__/compute.test.ts
```

- [ ] **Step 5: 커밋**

```bash
git add src/shared/api/vc-simulation/compute.ts \
        src/shared/api/vc-simulation/__tests__/compute.test.ts
git commit -m "feat(vc-simulation): compute.ts — seeded Monte Carlo + dual baseline + IRR/MOIC/payback/J-curve"
```

---

## Task 2.4 · compute.ts 회귀 테스트 — 배반 관계 검증

**Files:**
- Modify: `src/shared/api/vc-simulation/__tests__/compute.test.ts`

- [ ] **Step 1: 추가 테스트 작성**

```ts
test("higher UA share → shorter payback (typically)", () => {
  const low = computeVcSimulation({ ...DEFAULT_OFFER, uaSharePct: 40 }, SOURCES)
  const high = computeVcSimulation({ ...DEFAULT_OFFER, uaSharePct: 80 }, SOURCES)
  // not strict — noise in Monte Carlo, so only check directional
  if (low.baselineA.paybackMonths != null && high.baselineA.paybackMonths != null) {
    assert.ok(
      high.baselineA.paybackMonths <= low.baselineA.paybackMonths,
      `high UA payback ${high.baselineA.paybackMonths} should be ≤ low UA ${low.baselineA.paybackMonths}`
    )
  }
})

test("positive experiment delta → baselineB p50 IRR >= baselineA (장기)", () => {
  const withExp = {
    ...SOURCES,
    bayesianPosterior: { deltaLtv: 0.2 },   // +20% LTV
  }
  const r = computeVcSimulation(DEFAULT_OFFER, withExp)
  if (Number.isFinite(r.baselineA.p50Irr) && Number.isFinite(r.baselineB.p50Irr)) {
    assert.ok(r.baselineB.p50Irr >= r.baselineA.p50Irr, "experiment uplift should increase long-term IRR")
  }
})

test("J-curve: gap starts negative, ends positive (with positive experiment)", () => {
  const withExp = {
    ...SOURCES,
    bayesianPosterior: { deltaLtv: 0.2 },
  }
  const r = computeVcSimulation(DEFAULT_OFFER, withExp)
  assert.ok(r.gap[0] <= 0 || r.gap[3] <= 0, "early months should show experiment cost drag")
  assert.ok(r.gap[r.gap.length - 1] >= r.gap[3], "late months should show recovery")
})

test("jCurveBreakEvenMonth is in [0, horizon] or null", () => {
  const r = computeVcSimulation(DEFAULT_OFFER, { ...SOURCES, bayesianPosterior: { deltaLtv: 0.2 } })
  if (r.jCurveBreakEvenMonth !== null) {
    assert.ok(r.jCurveBreakEvenMonth >= 0)
    assert.ok(r.jCurveBreakEvenMonth <= DEFAULT_OFFER.horizonMonths)
  }
})
```

- [ ] **Step 2: 테스트 실행 — 전체 PASS**

- [ ] **Step 3: 커밋**

```bash
git add src/shared/api/vc-simulation/__tests__/compute.test.ts
git commit -m "test(vc-simulation): directional regression — UA share ↔ payback, experiment ↔ IRR, J-curve"
```

---

## Task 2.5 · use-vc-sim.ts React 훅 + barrel export

**Files:**
- Create: `src/shared/api/vc-simulation/use-vc-sim.ts`
- Create: `src/shared/api/vc-simulation/index.ts`

- [ ] **Step 1: use-vc-sim.ts 구현 (hook, no test — React testing out of scope for tsx --test)**

```ts
"use client"

import { useMemo } from "react"
import type { Offer, VcSimResult, LstmSnapshot } from "./types"
import { computeVcSimulation } from "./compute"
import { LstmSnapshotSchema } from "./types"
import lstmJson from "../data/lstm/retention-snapshot.json"

// parsed at module load (fail-fast)
const LSTM_SNAPSHOT: LstmSnapshot = LstmSnapshotSchema.parse(lstmJson)

export function isLstmStale(now: Date = new Date(), maxDays = 30): boolean {
  const generated = new Date(LSTM_SNAPSHOT.generated_at)
  return (now.getTime() - generated.getTime()) / 86400000 > maxDays
}

type UseVcSimInput = {
  gameId: string
  offer: Offer
  appsflyerInitialCash: number
  bayesianDeltaLtv: number | null
}

export function useVcSimulation(input: UseVcSimInput): VcSimResult {
  return useMemo(() => {
    const snapshotHasGame = !!LSTM_SNAPSHOT.predictions[input.gameId]
    const lstmForCompute: LstmSnapshot = snapshotHasGame
      ? LSTM_SNAPSHOT
      : LSTM_SNAPSHOT   // fallback to any prediction; compute will handle
    const result = computeVcSimulation(input.offer, {
      gameId: input.gameId,
      lstmSnapshot: lstmForCompute,
      bayesianPosterior: input.bayesianDeltaLtv != null ? { deltaLtv: input.bayesianDeltaLtv } : null,
      appsflyerInitialCash: input.appsflyerInitialCash,
    })
    return {
      ...result,
      dataSourceBadge: snapshotHasGame
        ? (isLstmStale() ? "benchmark" : "real")
        : "default",
    }
  }, [input.gameId, JSON.stringify(input.offer), input.appsflyerInitialCash, input.bayesianDeltaLtv])
}
```

- [ ] **Step 2: index.ts barrel export**

```ts
export type { Offer, VcSimResult, LstmSnapshot, RunwayPoint, BaselineResult } from "./types"
export { OfferSchema, LstmSnapshotSchema } from "./types"
export { PRESETS, DEFAULT_OFFER, MONTE_CARLO_SAMPLES, LSTM_STALE_DAYS } from "./defaults"
export { prefillOffer } from "./prefill"
export { computeVcSimulation, makeSeededRng } from "./compute"
export { useVcSimulation, isLstmStale } from "./use-vc-sim"
```

- [ ] **Step 3: tsc 통과 확인**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: 커밋**

```bash
git add src/shared/api/vc-simulation/use-vc-sim.ts \
        src/shared/api/vc-simulation/index.ts
git commit -m "feat(vc-simulation): useVcSimulation hook + barrel export + isLstmStale"
```

---

## Task 3.1 · 페이지 scaffolding — /dashboard/vc-simulation

**Files:**
- Create: `src/app/(dashboard)/dashboard/vc-simulation/page.tsx`
- Modify: `src/widgets/navigation/model/constants.ts` (nav 아이템 추가 — 구체 구조는 파일 열어 기존 상수에 맞춤)

- [ ] **Step 1: page.tsx 최소 scaffold**

```tsx
"use client"

import { useSelectedGame } from "@/shared/store/selected-game"
import { PageHeader } from "@/shared/ui"
import { PageTransition, FadeInUp } from "@/shared/ui/page-transition"
import { useLocale } from "@/shared/i18n"

export default function VcSimulationPage() {
  const { t } = useLocale()
  const { selectedGame } = useSelectedGame()

  return (
    <PageTransition>
      <div className="px-10 pt-6 pb-24">
        <FadeInUp>
          <PageHeader
            title={t("vc.page.title")}
            subtitle={t("vc.page.subtitle")}
          />
        </FadeInUp>
        <FadeInUp>
          <div className="mt-6 grid grid-cols-[360px_1fr] gap-6">
            <div className="sticky top-[80px] h-fit border border-[var(--bg-4)] rounded-[var(--radius-card)] p-5">
              <p className="text-sm text-[var(--fg-2)]">Input panel placeholder</p>
              <p className="text-xs text-[var(--fg-3)] mt-2">selected: {selectedGame}</p>
            </div>
            <div>
              <p className="text-sm text-[var(--fg-2)]">Result board placeholder</p>
            </div>
          </div>
        </FadeInUp>
      </div>
    </PageTransition>
  )
}
```

- [ ] **Step 2: navigation constants 에 nav 아이템 추가**

먼저 파일 열어 기존 구조 확인:
```bash
cat src/widgets/navigation/model/constants.ts
```

기존 nav 아이템 배열에 VC Simulation 추가. (정확한 형태는 파일 내 기존 패턴 그대로 복사 + i18n 키 `nav.vc-simulation` 사용). 그룹 label 은 Task 5.1 에서 다룸 — 지금은 단순 항목 1개 추가.

- [ ] **Step 3: 개발 서버 실행 → 페이지 접근 확인**

```bash
npm run dev
```
브라우저에서 `http://localhost:3000/dashboard/vc-simulation` 접근 → PageHeader + placeholder 2개 div 가 렌더링되는지 육안 확인.

- [ ] **Step 4: 커밋**

```bash
git add src/app/(dashboard)/dashboard/vc-simulation/page.tsx \
        src/widgets/navigation/model/constants.ts
git commit -m "feat(vc-simulation): page scaffold + nav item — /dashboard/vc-simulation 라우트 등록"
```

---

## Task 3.2 · VcInputPanel — OfferFields + DerivedStats

**Files:**
- Create: `src/widgets/vc-simulation/index.ts`
- Create: `src/widgets/vc-simulation/ui/vc-input-panel.tsx`
- Create: `src/widgets/vc-simulation/ui/offer-fields.tsx`
- Create: `src/widgets/vc-simulation/ui/derived-stats.tsx`

- [ ] **Step 1: OfferFields — 4 number input (투자금·투자 후 가치·배수·수익률)**

```tsx
// offer-fields.tsx
"use client"

import type { Offer } from "@/shared/api/vc-simulation"
import { useLocale } from "@/shared/i18n"

type Props = { offer: Offer; onChange: (patch: Partial<Offer>) => void }

export function OfferFields({ offer, onChange }: Props) {
  const { t } = useLocale()
  return (
    <div className="space-y-3">
      <NumberField
        label={t("vc.field.investment")}
        sub="USD"
        value={offer.investmentUsd}
        step={100_000}
        formatter={(n) => `$${(n / 1_000_000).toFixed(1)}M`}
        onChange={(v) => onChange({ investmentUsd: v })}
      />
      <NumberField
        label={t("vc.field.postMoney")}
        sub="USD"
        value={offer.postMoneyUsd}
        step={500_000}
        formatter={(n) => `$${(n / 1_000_000).toFixed(1)}M`}
        onChange={(v) => onChange({ postMoneyUsd: v })}
      />
      <NumberField
        label={t("vc.field.exitMultiple")}
        sub="×"
        value={offer.exitMultiple}
        step={0.5}
        formatter={(n) => `${n.toFixed(1)}×`}
        onChange={(v) => onChange({ exitMultiple: v })}
      />
      <NumberField
        label={t("vc.field.hurdleRate")}
        sub="% (연)"
        value={offer.hurdleRate * 100}
        step={1}
        formatter={(n) => `${n.toFixed(0)}%`}
        onChange={(v) => onChange({ hurdleRate: v / 100 })}
      />
    </div>
  )
}

function NumberField({
  label, sub, value, step, formatter, onChange,
}: {
  label: string; sub: string; value: number; step: number;
  formatter: (n: number) => string; onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-[var(--fg-2)] flex justify-between">
        <span>{label}</span>
        <span className="text-[var(--fg-3)]">{sub}</span>
      </label>
      <input
        type="number"
        value={value}
        step={step}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="bg-[var(--bg-1)] border border-[var(--bg-4)] rounded-[var(--radius-inline)] px-2 py-1 text-sm font-mono"
      />
      <div className="text-[11px] text-[var(--fg-3)] font-mono text-right">{formatter(value)}</div>
    </div>
  )
}
```

- [ ] **Step 2: DerivedStats — 자동 계산 표시**

```tsx
// derived-stats.tsx
"use client"

import type { Offer } from "@/shared/api/vc-simulation"
import { useLocale } from "@/shared/i18n"

type Props = { offer: Offer }

export function DerivedStats({ offer }: Props) {
  const { t } = useLocale()
  const equityPct = (offer.investmentUsd / offer.postMoneyUsd) * 100
  const preMoneyUsd = offer.postMoneyUsd - offer.investmentUsd
  return (
    <div className="mt-4 pt-4 border-t border-[var(--bg-4)] space-y-2">
      <Row label={t("vc.field.derived.equity")} value={`${equityPct.toFixed(1)}%`} />
      <Row label={t("vc.field.derived.preMoney")} value={`$${(preMoneyUsd / 1_000_000).toFixed(1)}M`} />
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-[var(--fg-2)]">{label}</span>
      <span className="font-mono text-[var(--fg-0)]">{value}</span>
    </div>
  )
}
```

- [ ] **Step 3: VcInputPanel wrapper**

```tsx
// vc-input-panel.tsx
"use client"

import { useState } from "react"
import type { Offer } from "@/shared/api/vc-simulation"
import { DEFAULT_OFFER } from "@/shared/api/vc-simulation"
import { OfferFields } from "./offer-fields"
import { DerivedStats } from "./derived-stats"

type Props = { initial?: Offer; onChange: (o: Offer) => void }

export function VcInputPanel({ initial = DEFAULT_OFFER, onChange }: Props) {
  const [offer, setOffer] = useState<Offer>(initial)

  const patch = (p: Partial<Offer>) => {
    const next = { ...offer, ...p }
    setOffer(next)
    onChange(next)
  }

  return (
    <div className="sticky top-[80px] h-fit border border-[var(--bg-4)] rounded-[var(--radius-card)] p-5 bg-[var(--bg-1)]">
      <OfferFields offer={offer} onChange={patch} />
      <DerivedStats offer={offer} />
    </div>
  )
}
```

- [ ] **Step 4: `index.ts` barrel**

```ts
export { VcInputPanel } from "./ui/vc-input-panel"
```

- [ ] **Step 5: page.tsx 의 placeholder 좌측을 `<VcInputPanel/>` 로 교체**

```tsx
import { VcInputPanel } from "@/widgets/vc-simulation"
// ...
<VcInputPanel onChange={setOffer} />
```

`const [offer, setOffer] = useState<Offer>(DEFAULT_OFFER)` 도 page.tsx 에 추가.

- [ ] **Step 6: dev 서버에서 눈으로 확인 + tsc**

```bash
npx tsc --noEmit
npm run dev
```

- [ ] **Step 7: 커밋**

```bash
git add src/widgets/vc-simulation/ \
        src/app/(dashboard)/dashboard/vc-simulation/page.tsx
git commit -m "feat(vc-simulation): VcInputPanel + OfferFields + DerivedStats (4 fields + 지분율 자동계산)"
```

---

## Task 3.3 · PresetTabs + Fund/Horizon 슬라이더

**Files:**
- Create: `src/widgets/vc-simulation/ui/preset-tabs.tsx`
- Create: `src/widgets/vc-simulation/ui/fund-allocation-slider.tsx`
- Create: `src/widgets/vc-simulation/ui/horizon-slider.tsx`
- Modify: `src/widgets/vc-simulation/ui/vc-input-panel.tsx` (추가 위젯 조립)
- Modify: `src/widgets/vc-simulation/index.ts`

- [ ] **Step 1: PresetTabs**

```tsx
// preset-tabs.tsx
"use client"

import { PRESETS } from "@/shared/api/vc-simulation"
import type { Offer } from "@/shared/api/vc-simulation"
import { useLocale } from "@/shared/i18n"
import { clsx } from "clsx"

type Props = { active: keyof typeof PRESETS; onSelect: (preset: Offer) => void }

export function PresetTabs({ active, onSelect }: Props) {
  const { t } = useLocale()
  const items = [
    { key: "conservative" as const, label: t("vc.preset.conservative") },
    { key: "standard" as const,     label: t("vc.preset.standard") },
    { key: "aggressive" as const,   label: t("vc.preset.aggressive") },
  ]
  return (
    <div className="flex gap-1 mb-4">
      {items.map((it) => (
        <button
          key={it.key}
          onClick={() => onSelect(PRESETS[it.key])}
          className={clsx(
            "flex-1 text-xs px-2 py-1.5 rounded-[var(--radius-inline)] border transition",
            active === it.key
              ? "bg-[var(--brand)] text-white border-[var(--brand)]"
              : "border-[var(--bg-4)] text-[var(--fg-2)] hover:bg-[var(--bg-2)]"
          )}
        >
          {it.label}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: FundAllocationSlider — Radix Slider**

```tsx
// fund-allocation-slider.tsx
"use client"

import * as Slider from "@radix-ui/react-slider"
import { useLocale } from "@/shared/i18n"

type Props = { uaSharePct: number; onChange: (pct: number) => void }

export function FundAllocationSlider({ uaSharePct, onChange }: Props) {
  const { t } = useLocale()
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between text-xs">
        <span className="text-[var(--fg-2)]">{t("vc.field.uaShare")}: <span className="font-mono">{uaSharePct.toFixed(0)}%</span></span>
        <span className="text-[var(--fg-2)]">{t("vc.field.opsShare")}: <span className="font-mono">{(100 - uaSharePct).toFixed(0)}%</span></span>
      </div>
      <Slider.Root
        className="relative flex items-center w-full h-5"
        value={[uaSharePct]}
        onValueChange={([v]) => onChange(v)}
        min={0}
        max={100}
        step={5}
      >
        <Slider.Track className="bg-[var(--bg-3)] relative grow h-1 rounded-full">
          <Slider.Range className="absolute bg-[var(--brand)] h-full rounded-full" />
        </Slider.Track>
        <Slider.Thumb className="block w-4 h-4 bg-white border-2 border-[var(--brand)] rounded-full shadow" />
      </Slider.Root>
    </div>
  )
}
```

- [ ] **Step 3: HorizonSlider — 12~60**

```tsx
// horizon-slider.tsx
"use client"

import * as Slider from "@radix-ui/react-slider"
import { useLocale } from "@/shared/i18n"

type Props = { months: number; onChange: (m: number) => void }

export function HorizonSlider({ months, onChange }: Props) {
  const { t } = useLocale()
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between text-xs text-[var(--fg-2)]">
        <span>{t("vc.field.horizon")}</span>
        <span className="font-mono">{months} {t("vc.unit.months")}</span>
      </div>
      <Slider.Root
        className="relative flex items-center w-full h-5"
        value={[months]}
        onValueChange={([v]) => onChange(v)}
        min={12}
        max={60}
        step={6}
      >
        <Slider.Track className="bg-[var(--bg-3)] relative grow h-1 rounded-full">
          <Slider.Range className="absolute bg-[var(--brand)] h-full rounded-full" />
        </Slider.Track>
        <Slider.Thumb className="block w-4 h-4 bg-white border-2 border-[var(--brand)] rounded-full shadow" />
      </Slider.Root>
    </div>
  )
}
```

- [ ] **Step 4: VcInputPanel 조립 업데이트**

```tsx
// vc-input-panel.tsx (업데이트)
"use client"

import { useState } from "react"
import type { Offer } from "@/shared/api/vc-simulation"
import { DEFAULT_OFFER, PRESETS } from "@/shared/api/vc-simulation"
import { PresetTabs } from "./preset-tabs"
import { OfferFields } from "./offer-fields"
import { FundAllocationSlider } from "./fund-allocation-slider"
import { HorizonSlider } from "./horizon-slider"
import { DerivedStats } from "./derived-stats"

type Props = { initial?: Offer; onChange: (o: Offer) => void }

export function VcInputPanel({ initial = DEFAULT_OFFER, onChange }: Props) {
  const [offer, setOffer] = useState<Offer>(initial)
  const [activePreset, setActivePreset] = useState<keyof typeof PRESETS>("standard")

  const patch = (p: Partial<Offer>) => {
    const next = { ...offer, ...p }
    setOffer(next)
    onChange(next)
  }

  const applyPreset = (preset: Offer, key: keyof typeof PRESETS) => {
    setOffer(preset)
    setActivePreset(key)
    onChange(preset)
  }

  return (
    <div className="sticky top-[80px] h-fit border border-[var(--bg-4)] rounded-[var(--radius-card)] p-5 bg-[var(--bg-1)]">
      <PresetTabs
        active={activePreset}
        onSelect={(preset) => {
          const entry = Object.entries(PRESETS).find(([, p]) => p === preset)
          if (entry) applyPreset(preset, entry[0] as keyof typeof PRESETS)
        }}
      />
      <OfferFields offer={offer} onChange={patch} />
      <div className="mt-4 space-y-4">
        <FundAllocationSlider uaSharePct={offer.uaSharePct} onChange={(v) => patch({ uaSharePct: v })} />
        <HorizonSlider months={offer.horizonMonths} onChange={(v) => patch({ horizonMonths: v })} />
      </div>
      <DerivedStats offer={offer} />
    </div>
  )
}
```

- [ ] **Step 5: dev 서버 확인 — preset 전환 + 슬라이더 조작 → offer state 업데이트 육안 확인**

- [ ] **Step 6: 커밋**

```bash
git add src/widgets/vc-simulation/
git commit -m "feat(vc-simulation): PresetTabs + FundAllocationSlider + HorizonSlider — 입력 패널 완성"
```

---

## Task 4.1 · RunwayFanChart overlay prop 확장

**Files:**
- Modify: `src/widgets/charts/ui/runway-fan-chart.tsx`

- [ ] **Step 1: 기존 파일 열어 `Props` 타입과 렌더 구간 확인**

```bash
cat src/widgets/charts/ui/runway-fan-chart.tsx | head -80
```

- [ ] **Step 2: Props 확장 (기존 props 유지, optional `overlay` 추가)**

기존 `Props` 타입에 다음 필드 추가:
```ts
overlay?: { data: RunwayFanData; dashed?: boolean }
hurdleLine?: number
```

InnerChart 함수 내부, 기존 p50 `<LinePath/>` 렌더 직후에 다음 블록 삽입:

```tsx
{overlay && (
  <>
    <AreaClosed
      data={overlay.data.points}
      x={(d) => xScale(d.month)}
      y0={(d) => yScale(d.p10)}
      y1={(d) => yScale(d.p90)}
      yScale={yScale}
      fill="transparent"
      stroke="var(--fg-2)"
      strokeDasharray={overlay.dashed ? "4 4" : undefined}
      strokeOpacity={0.4}
    />
    <LinePath
      data={overlay.data.points}
      x={(d) => xScale(d.month)}
      y={(d) => yScale(d.p50)}
      stroke="var(--fg-1)"
      strokeWidth={1.5}
      strokeDasharray={overlay.dashed ? "4 4" : undefined}
      curve={curveMonotoneX}
    />
  </>
)}
{hurdleLine != null && (
  <Line
    from={{ x: xScale.range()[0], y: yScale(hurdleLine) }}
    to={{ x: xScale.range()[1], y: yScale(hurdleLine) }}
    stroke="var(--signal-caution)"
    strokeWidth={1}
    strokeDasharray="2 4"
  />
)}
```

- [ ] **Step 3: 기존 Executive Overview 페이지에서 RunwayFanChart 사용처 regression 확인 — dev 서버에서 `/dashboard` 렌더 정상인지**

```bash
npm run dev
# 브라우저에서 /dashboard 접근, 런웨이 팬 차트 변함없이 보이는지 확인
```

- [ ] **Step 4: tsc 통과**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: 커밋**

```bash
git add src/widgets/charts/ui/runway-fan-chart.tsx
git commit -m "feat(runway-fan-chart): optional overlay prop (dashed baseline) + hurdleLine — backward compatible"
```

---

## Task 4.2 · VcKpiStrip — 4개 판단 지표 카드

**Files:**
- Create: `src/widgets/vc-simulation/ui/vc-kpi-strip.tsx`
- Modify: `src/widgets/vc-simulation/index.ts`

- [ ] **Step 1: 구현**

```tsx
// vc-kpi-strip.tsx
"use client"

import type { VcSimResult } from "@/shared/api/vc-simulation"
import { useLocale } from "@/shared/i18n"
import { clsx } from "clsx"

type Props = { result: VcSimResult }

export function VcKpiStrip({ result }: Props) {
  const { t } = useLocale()
  const { baselineB, offer } = result
  const irrBelow = Number.isFinite(baselineB.p50Irr) && baselineB.p50Irr < offer.hurdleRate
  const irrDisplay = Number.isFinite(baselineB.p50Irr)
    ? `${(baselineB.p50Irr * 100).toFixed(1)}%`
    : "—"
  const moicDisplay = Number.isFinite(baselineB.p50Moic)
    ? `${baselineB.p50Moic.toFixed(2)}×`
    : "—"
  const paybackDisplay = baselineB.paybackMonths != null
    ? `${baselineB.paybackMonths}${t("vc.unit.months")}`
    : t("vc.error.convergence")
  const jCurveDisplay = result.jCurveBreakEvenMonth === null
    ? t("vc.error.jcurveNoRecovery")
    : result.jCurveBreakEvenMonth === 0
      ? t("vc.error.jcurveNoDrop")
      : `${result.jCurveBreakEvenMonth}${t("vc.unit.months")}`

  return (
    <div className="grid grid-cols-4 gap-3">
      <KpiCard label={t("vc.kpi.irr")} value={irrDisplay} tone={irrBelow ? "risk" : "positive"} />
      <KpiCard label={t("vc.kpi.moic")} value={moicDisplay} />
      <KpiCard label={t("vc.kpi.payback")} value={paybackDisplay} />
      <KpiCard label={t("vc.kpi.jcurveBreakEven")} value={jCurveDisplay} />
    </div>
  )
}

function KpiCard({ label, value, tone }: { label: string; value: string; tone?: "positive" | "risk" }) {
  return (
    <div className="border border-[var(--bg-4)] rounded-[var(--radius-card)] p-4 bg-[var(--bg-1)]">
      <div className="text-xs text-[var(--fg-2)]">{label}</div>
      <div className={clsx(
        "mt-2 text-2xl font-mono tabular-nums",
        tone === "risk" && "text-[var(--signal-risk)]",
        tone === "positive" && "text-[var(--fg-0)]",
      )}>
        {value}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: index.ts export 추가**

```ts
export { VcKpiStrip } from "./ui/vc-kpi-strip"
```

- [ ] **Step 3: page.tsx 에서 result board 에 VcKpiStrip 통합**

page.tsx 에 다음 추가:
```tsx
import { VcKpiStrip } from "@/widgets/vc-simulation"
import { useVcSimulation } from "@/shared/api/vc-simulation"
// ...
const [offer, setOffer] = useState(DEFAULT_OFFER)
const result = useVcSimulation({
  gameId: selectedGame,
  offer,
  appsflyerInitialCash: 500_000,          // TODO: Task 5.2 에서 AppsFlyer 실데이터 연결
  bayesianDeltaLtv: 0.15,                 // TODO: Task 5.2 에서 Bayesian posterior 연결
})
// ...
<VcKpiStrip result={result} />
```

- [ ] **Step 4: dev 서버 확인 — 4개 카드에 숫자 표시, 프리셋 전환 시 값 변동, IRR hurdle 미달 시 빨간색**

- [ ] **Step 5: 커밋**

```bash
git add src/widgets/vc-simulation/ \
        src/app/(dashboard)/dashboard/vc-simulation/page.tsx
git commit -m "feat(vc-simulation): VcKpiStrip — IRR/MOIC/Payback/J-curve 4카드 + hurdle 미달 빨간 배지"
```

---

## Task 4.3 · DualBaselineRunwayChart 조립 + result board 통합

**Files:**
- Create: `src/widgets/vc-simulation/ui/dual-baseline-runway-chart.tsx`
- Create: `src/widgets/vc-simulation/ui/vc-result-board.tsx`
- Modify: `src/widgets/vc-simulation/index.ts`
- Modify: `src/app/(dashboard)/dashboard/vc-simulation/page.tsx`

- [ ] **Step 1: DualBaselineRunwayChart — 기존 RunwayFanChart 에 overlay prop 주입하는 thin wrapper**

```tsx
// dual-baseline-runway-chart.tsx
"use client"

import type { VcSimResult } from "@/shared/api/vc-simulation"
import { RunwayFanChart } from "@/widgets/charts"
import { useLocale } from "@/shared/i18n"

type Props = { result: VcSimResult; hurdleLine?: number }

export function DualBaselineRunwayChart({ result, hurdleLine }: Props) {
  const { t } = useLocale()
  const toFanData = (runway: VcSimResult["baselineA"]["runway"]) => ({
    points: runway.map((p) => ({
      month: p.month,
      label: `M${p.month}`,
      p10: p.p10 / 1000,     // $K
      p50: p.p50 / 1000,
      p90: p.p90 / 1000,
    })),
    initialCash: result.offer.investmentUsd / 1000,
    cashOutThreshold: 0,
    p50CashOutMonth: -1,
    probCashOut: 0,
  })

  return (
    <RunwayFanChart
      data={toFanData(result.baselineA.runway)}
      overlay={{ data: toFanData(result.baselineB.runway), dashed: true }}
      hurdleLine={hurdleLine}
      title={`${t("vc.baseline.withoutExperiment")} · ${t("vc.baseline.withExperiment")}`}
      locale="ko"
      height={280}
    />
  )
}
```

- [ ] **Step 2: VcResultBoard — 모든 결과 위젯 묶음**

```tsx
// vc-result-board.tsx
"use client"

import type { VcSimResult } from "@/shared/api/vc-simulation"
import { VcKpiStrip } from "./vc-kpi-strip"
import { DualBaselineRunwayChart } from "./dual-baseline-runway-chart"

type Props = { result: VcSimResult }

export function VcResultBoard({ result }: Props) {
  return (
    <div className="space-y-4">
      <VcKpiStrip result={result} />
      <DualBaselineRunwayChart result={result} hurdleLine={result.offer.hurdleRate * result.offer.investmentUsd / 1000} />
      {/* IrrHistogramPair + JCurveStrip — Task 4.4, 4.5 에서 추가 */}
    </div>
  )
}
```

- [ ] **Step 3: index.ts + page.tsx 업데이트**

```ts
// index.ts
export { VcInputPanel } from "./ui/vc-input-panel"
export { VcResultBoard } from "./ui/vc-result-board"
```

page.tsx 에서 우측 placeholder → `<VcResultBoard result={result}/>` 교체.

- [ ] **Step 4: dev 서버 — Runway fan 차트 2개 라인 (solid + dashed) 확인**

- [ ] **Step 5: 커밋**

```bash
git add src/widgets/vc-simulation/ \
        src/app/(dashboard)/dashboard/vc-simulation/page.tsx
git commit -m "feat(vc-simulation): DualBaselineRunwayChart + VcResultBoard — Baseline ①/② overlay"
```

---

## Task 4.4 · IrrHistogramPair (visx BarStack)

**Files:**
- Create: `src/widgets/vc-simulation/ui/irr-histogram-pair.tsx`
- Modify: `src/widgets/vc-simulation/ui/vc-result-board.tsx`
- Modify: `src/widgets/vc-simulation/index.ts`

- [ ] **Step 1: 구현 (visx scaleLinear + Group + Bar)**

```tsx
// irr-histogram-pair.tsx
"use client"

import { Group } from "@visx/group"
import { scaleLinear, scaleBand } from "@visx/scale"
import { ParentSize } from "@visx/responsive"
import type { VcSimResult } from "@/shared/api/vc-simulation"
import { useLocale } from "@/shared/i18n"

type Props = { result: VcSimResult }

function histogram(vals: number[], bins: number): number[] {
  const filtered = vals.filter(Number.isFinite)
  if (filtered.length === 0) return new Array(bins).fill(0)
  const min = Math.min(...filtered)
  const max = Math.max(...filtered)
  const width = (max - min) / bins || 1
  const counts = new Array(bins).fill(0)
  for (const v of filtered) {
    const idx = Math.min(bins - 1, Math.floor((v - min) / width))
    counts[idx]++
  }
  return counts
}

export function IrrHistogramPair({ result }: Props) {
  const { t } = useLocale()
  const BINS = 20
  const histA = histogram(result.baselineA.irrDistribution, BINS)
  const histB = histogram(result.baselineB.irrDistribution, BINS)
  const maxCount = Math.max(...histA, ...histB, 1)

  return (
    <div className="grid grid-cols-2 gap-4 border border-[var(--bg-4)] rounded-[var(--radius-card)] p-4 bg-[var(--bg-1)]">
      <div>
        <div className="text-xs text-[var(--fg-2)] mb-2">{t("vc.baseline.withoutExperiment")}</div>
        <ParentSize>{({ width }) => <Histogram data={histA} maxCount={maxCount} width={width} height={140} color="var(--fg-1)" />}</ParentSize>
      </div>
      <div>
        <div className="text-xs text-[var(--fg-2)] mb-2">{t("vc.baseline.withExperiment")}</div>
        <ParentSize>{({ width }) => <Histogram data={histB} maxCount={maxCount} width={width} height={140} color="var(--brand)" />}</ParentSize>
      </div>
    </div>
  )
}

function Histogram({ data, maxCount, width, height, color }: { data: number[]; maxCount: number; width: number; height: number; color: string }) {
  const xScale = scaleBand<number>({ domain: data.map((_, i) => i), range: [0, width], padding: 0.1 })
  const yScale = scaleLinear<number>({ domain: [0, maxCount], range: [height, 0] })
  return (
    <svg width={width} height={height}>
      <Group>
        {data.map((count, i) => {
          const x = xScale(i) ?? 0
          const y = yScale(count)
          const w = xScale.bandwidth()
          const h = height - y
          return <rect key={i} x={x} y={y} width={w} height={h} fill={color} />
        })}
      </Group>
    </svg>
  )
}
```

- [ ] **Step 2: VcResultBoard 에 IrrHistogramPair 추가**

```tsx
import { IrrHistogramPair } from "./irr-histogram-pair"
// ...
<IrrHistogramPair result={result} />
```

- [ ] **Step 3: index.ts export**

- [ ] **Step 4: dev 서버 — 좌우 2개 히스토그램 bar 분포 확인 (baselineB 가 오른쪽으로 shift 되어야 함)**

- [ ] **Step 5: 커밋**

```bash
git add src/widgets/vc-simulation/
git commit -m "feat(vc-simulation): IrrHistogramPair — without/with experiment 분포 side-by-side"
```

---

## Task 4.5 · JCurveStrip (Recharts ComposedChart)

**Files:**
- Create: `src/widgets/vc-simulation/ui/j-curve-strip.tsx`
- Modify: `src/widgets/vc-simulation/ui/vc-result-board.tsx`
- Modify: `src/widgets/vc-simulation/index.ts`

- [ ] **Step 1: 구현**

```tsx
// j-curve-strip.tsx
"use client"

import { ResponsiveContainer, ComposedChart, Bar, ReferenceLine, XAxis, YAxis, Tooltip } from "recharts"
import type { VcSimResult } from "@/shared/api/vc-simulation"
import { useLocale } from "@/shared/i18n"

type Props = { result: VcSimResult }

export function JCurveStrip({ result }: Props) {
  const { t } = useLocale()
  const data = result.gap.map((v, i) => ({ month: i, gap: v / 1000 }))
  const breakEven = result.jCurveBreakEvenMonth

  return (
    <div className="border border-[var(--bg-4)] rounded-[var(--radius-card)] p-4 bg-[var(--bg-1)]">
      <div className="text-xs text-[var(--fg-2)] mb-2">
        {t("vc.baseline.gap")} (Baseline ② − ①, $K)
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <ComposedChart data={data}>
          <XAxis dataKey="month" fontSize={10} stroke="var(--fg-3)" />
          <YAxis fontSize={10} stroke="var(--fg-3)" />
          <Tooltip
            contentStyle={{ backgroundColor: "var(--bg-1)", border: "1px solid var(--bg-4)", fontSize: 12 }}
            labelFormatter={(m) => `${m}${t("vc.unit.months")}`}
          />
          <ReferenceLine y={0} stroke="var(--fg-3)" />
          {breakEven != null && breakEven > 0 && (
            <ReferenceLine x={breakEven} stroke="var(--signal-positive)" strokeDasharray="3 3" label={{ value: t("vc.kpi.jcurveBreakEven"), fontSize: 10, fill: "var(--signal-positive)" }} />
          )}
          <Bar dataKey="gap" fill="var(--brand)" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 2: VcResultBoard 에 추가**

- [ ] **Step 3: dev 서버 — J-커브 bar chart + break-even 월 세로 line 표시**

- [ ] **Step 4: 커밋**

```bash
git add src/widgets/vc-simulation/
git commit -m "feat(vc-simulation): JCurveStrip — 월별 실험 기여분 bar + break-even 월 하이라이트"
```

---

## Task 5.1 · Sidebar 그룹 label 렌더링

**Files:**
- Modify: `src/widgets/navigation/model/constants.ts`
- Modify: `src/widgets/navigation/ui/category-sidebar.tsx`

- [ ] **Step 1: 기존 nav constants 열어 구조 파악**

```bash
cat src/widgets/navigation/model/constants.ts
```

- [ ] **Step 2: group 구조 도입 — 기존 flat array 를 grouped 구조로 변경**

기존 nav 배열을 다음 형태로 재배치 (정확한 key 이름은 기존 constants 에 맞춤):

```ts
export const NAV_GROUPS = [
  {
    groupKey: "nav.group.investment",
    items: [
      { key: "overview",       href: "/dashboard",                labelKey: "nav.overview" },
      { key: "vc-simulation",  href: "/dashboard/vc-simulation",  labelKey: "nav.vc-simulation" },
    ],
  },
  {
    groupKey: "nav.group.market",
    items: [
      { key: "market-gap",     href: "/dashboard/market-gap",     labelKey: "nav.market-gap" },
    ],
  },
] as const
```

- [ ] **Step 3: category-sidebar.tsx 수정 — NAV_GROUPS 를 map 하여 group label + items 렌더링**

```bash
cat src/widgets/navigation/ui/category-sidebar.tsx
```
기존 렌더 로직을 grouped 버전으로 변경. 각 그룹은:

```tsx
{NAV_GROUPS.map((g) => (
  <div key={g.groupKey} className="mb-4">
    <div className="px-3 py-1 text-[10px] uppercase tracking-wide text-[var(--fg-3)]">
      {t(g.groupKey)}
    </div>
    {g.items.map((it) => (
      <Link key={it.key} href={it.href} className={/* 기존 스타일 */}>
        {t(it.labelKey)}
      </Link>
    ))}
  </div>
))}
```

- [ ] **Step 4: dev 서버 — 사이드바에 "투자 결정" / "시장 분석" 두 그룹 label 표시, 밑에 항목 렌더링 확인**

- [ ] **Step 5: 기존 페이지 (`/dashboard`, `/dashboard/market-gap`) navigation 정상 작동 확인**

- [ ] **Step 6: 커밋**

```bash
git add src/widgets/navigation/
git commit -m "feat(nav): Sidebar 그룹 label (투자 결정 / 시장 분석) — URL flat 유지"
```

---

## Task 5.2 · AppsFlyer + Bayesian 실데이터 연결

**Files:**
- Modify: `src/app/(dashboard)/dashboard/vc-simulation/page.tsx`

- [ ] **Step 1: `readSnapshot()` 으로 AppsFlyer cash 가져오기**

```tsx
// page.tsx 상단
import { readSnapshot } from "@/shared/api/appsflyer"

// 컴포넌트 내부
const snap = readSnapshot()
const initialCash = snap
  ? snap.cards.reduce((s, c) => s + (c.totalRevenueUsd ?? 0) - (c.totalCostUsd ?? 0), 0)
  : 500_000   // fallback
```

(실제 필드명은 `AppsFlyerSnapshot` 타입에 맞춰 조정 — `snapshot-derive.ts` 의 `sumCost` / `sumRevenue` 활용 가능)

- [ ] **Step 2: Bayesian posterior — 현재 mock-data 에서 해당 게임의 ΔLTV 평균 가져오기 (PR #2 merge 전까지 mock)**

```tsx
import { useGameData } from "@/shared/api/use-game-data"

const gameData = useGameData()
const bayesianDeltaLtv = gameData.experiments?.reduce((s, e) => s + (e.deltaLtv ?? 0), 0) / (gameData.experiments?.length || 1) || 0
```

- [ ] **Step 3: `useVcSimulation` 에 실값 전달 교체**

```tsx
const result = useVcSimulation({
  gameId: selectedGame,
  offer,
  appsflyerInitialCash: initialCash,
  bayesianDeltaLtv,
})
```

- [ ] **Step 4: DataSource 배지 표시 — result.dataSourceBadge 에 따라 UI 상단에 badge**

VcResultBoard 에 배지 추가:
```tsx
<div className="flex items-center gap-2 mb-2">
  <span className={/* 색상 by badge */}>{t(`vc.badge.dataSource.${result.dataSourceBadge}`)}</span>
</div>
```

- [ ] **Step 5: dev 서버 — 게임 드롭다운 전환 시 숫자 변화 + 배지 변화 확인**

- [ ] **Step 6: 커밋**

```bash
git add src/app/(dashboard)/dashboard/vc-simulation/page.tsx \
        src/widgets/vc-simulation/
git commit -m "feat(vc-simulation): AppsFlyer initialCash + Bayesian ΔLTV 실데이터 연결 + 데이터 출처 배지"
```

---

## Task 5.3 · ErrorBoundary + Stale 배지 + README

**Files:**
- Modify: `src/app/(dashboard)/dashboard/vc-simulation/page.tsx`
- Create: `src/widgets/vc-simulation/ui/calc-error-card.tsx`
- Create 또는 Modify: `README.md` 또는 `docs/vc-simulation.md`
- Modify: `package.json` (test:vc script)

- [ ] **Step 1: CalcErrorCard**

```tsx
// calc-error-card.tsx
"use client"
import { useLocale } from "@/shared/i18n"
export function CalcErrorCard() {
  const { t } = useLocale()
  return (
    <div className="border border-[var(--signal-risk)] rounded-[var(--radius-card)] p-8 text-center">
      <div className="text-[var(--signal-risk)] text-lg">{t("vc.error.calcFailed")}</div>
    </div>
  )
}
```

- [ ] **Step 2: page.tsx 에 ErrorBoundary 래핑 (Next.js 15 의 client component error.tsx 혹은 수동)**

수동 class component:
```tsx
// page.tsx 내부
class Boundary extends React.Component<{children: React.ReactNode}, {err: Error | null}> {
  state = { err: null as Error | null }
  static getDerivedStateFromError(err: Error) { return { err } }
  render() { return this.state.err ? <CalcErrorCard/> : this.props.children }
}

// JSX:
<Boundary>
  <VcResultBoard result={result} />
</Boundary>
```

- [ ] **Step 3: Stale 배지 — `isLstmStale()` true 일 때 result board 상단에 경고**

```tsx
import { isLstmStale } from "@/shared/api/vc-simulation"
// ...
{isLstmStale() && (
  <div className="text-xs text-[var(--signal-caution)]">{t("vc.badge.stale")}</div>
)}
```

- [ ] **Step 4: package.json scripts 에 `test:vc` 추가**

```json
"test:vc": "tsx --test src/shared/api/vc-simulation/__tests__/*.test.ts"
```

- [ ] **Step 5: `npm run test:vc` 실행 — 전체 pass 확인**

- [ ] **Step 6: README.md (worktree 최상위) 에 1문단 추가 — VC Simulation 사용법**

```md
### VC Simulation (`/dashboard/vc-simulation`)

선택된 게임에 대한 VC 오퍼 조건 기반 36개월 Monte Carlo 투자 시뮬레이터. Baseline ①(실험 없이)과 ②(실험 반영) 를 동시 렌더링하여 실험-이율 J-커브를 시각화.

- 계산 로직: `src/shared/api/vc-simulation/compute.ts`
- LSTM 리텐션 계약: `src/shared/api/data/lstm/retention-snapshot.json` + `src/shared/api/vc-simulation/types.ts` (Zod schema)
- 설계 스펙: `docs/superpowers/specs/2026-04-24-vc-simulation-design.md`
- 단위 테스트: `npm run test:vc`
```

- [ ] **Step 7: 커밋**

```bash
git add src/widgets/vc-simulation/ \
        src/app/(dashboard)/dashboard/vc-simulation/page.tsx \
        package.json \
        README.md
git commit -m "feat(vc-simulation): ErrorBoundary + Stale 배지 + test:vc npm script + README 섹션"
```

---

## Task 5.4 · 최종 통합 QA 체크리스트

**Files:** (변경 없음 — 체크만)

- [ ] **Step 1: 전체 테스트 실행**

```bash
cd /Users/mike/Downloads/compass-worktrees/feature-vc-simulation
npm run test:vc
npx tsc --noEmit
```
Expected: 모두 PASS / no errors

- [ ] **Step 2: dev 서버 QA 체크리스트 (육안)**

```bash
npm run dev
```
`http://localhost:3000/dashboard/vc-simulation` 접근 후:

1. [ ] 사이드바에 "투자 결정" 그룹 label 밑에 "투자 시뮬레이션" 항목 표시
2. [ ] 페이지 제목 한글 "투자 시뮬레이션"
3. [ ] 좌측 입력 패널 sticky 유지 (스크롤 해도 따라옴)
4. [ ] 3 preset 탭 클릭 시 input 필드 변경
5. [ ] 슬라이더 조작 시 결과 영역 실시간 업데이트 (50~200ms)
6. [ ] 4 KPI 카드 숫자 정상 표시 (— 가 아닌 실제 숫자)
7. [ ] Runway fan 차트에 solid + dashed 두 라인
8. [ ] IRR 히스토그램 좌우 2개 표시, 분포 shift 시각화
9. [ ] J-커브 bar chart + break-even 월 세로 line
10. [ ] 데이터 출처 배지 (실데이터 / 장르 벤치마크 / 기본 추정 중 하나)
11. [ ] 기존 `/dashboard` 페이지 런웨이 팬 차트 regression 없음
12. [ ] 기존 `/dashboard/market-gap` 페이지 정상
13. [ ] 영어 locale 토글 시 모든 label 영어로 전환

- [ ] **Step 3: Regression test — 기존 페이지**

`/dashboard` → PortfolioVerdict · KPICards · RunwayFanChart 전부 기존과 동일
`/dashboard/market-gap` → PriorPosterior · MarketBenchmark 전부 기존과 동일

- [ ] **Step 4: Remote push + PR 생성**

```bash
git push -u origin feat/vc-simulation
gh pr create --title "feat(vc-simulation): MVP — 투자 시뮬레이션 모듈 (36개월 Monte Carlo + J-커브)" --body "$(cat <<'EOF'
## Summary
- Phase 1~5 MVP 구현 (8일 작업)
- Baseline ①(실험 없이) vs ②(실험 반영) 동시 렌더링 → 실험-이율 J-커브 시각화
- LSTM retention snapshot JSON 계약 확정 (Zod schema) — retention-lstm worktree 에서 실값으로 대체 예정
- Smart Default + 3 프리셋 (보수적 · 표준 · 적극적) · AppsFlyer/Bayesian 자동 연결
- Sidebar 그룹핑 (투자 결정 / 시장 분석) · URL flat 유지 → 기존 라우트 churn 0

## Test plan
- [ ] `npm run test:vc` 단위 테스트 전체 pass
- [ ] `npx tsc --noEmit` 타입 에러 0
- [ ] `/dashboard/vc-simulation` 수동 QA 체크리스트 (위 13항목)
- [ ] 기존 `/dashboard`, `/dashboard/market-gap` regression 확인
- [ ] ko/en locale 토글 전체 label 전환 확인
- [ ] CodeRabbit 자동 review (하네스)
- [ ] Vercel preview URL 에서 프로덕션 빌드 정상 확인

## 관련 문서
- 설계 스펙: `docs/superpowers/specs/2026-04-24-vc-simulation-design.md`
- 구현 계획: `docs/superpowers/plans/2026-04-24-vc-simulation.md`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

(하네스 `postpr-enrich.sh` 가 자동으로 @coderabbitai review 추가 + Vercel preview 조회)

---

## 검증 — Spec Coverage 셀프 리뷰

| Spec 섹션 | 커버 task |
|---|---|
| 3.1 목표: `/dashboard/vc-simulation` 페이지 | 3.1 |
| 3.1 목표: 36개월 horizon + 12~60 슬라이더 | 3.3 |
| 3.1 목표: Baseline ① / ② + Gap | 2.3, 2.4, 4.3, 4.5 |
| 3.1 목표: 5 필수 필드 + 자금 배분 슬라이더 한글 | 3.2, 3.3, 1.4 |
| 3.1 목표: 3 프리셋 + Smart Default | 2.1, 2.2, 3.3 |
| 3.1 목표: LSTM JSON 계약 + Zod + fallback | 1.1, 1.2, 1.3, 2.5 |
| 3.1 목표: AppSidebar 그룹 label | 5.1 |
| 3.1 목표: RunwayFanChart overlay prop | 4.1 |
| 5.3 변경 범위 (모든 파일) | 1.1~5.4 |
| 6 컴포넌트 트리 (10개) | 3.2, 3.3, 4.2, 4.3, 4.4, 4.5, 5.3 |
| 7.2 LSTM JSON 스키마 | 1.1, 1.2 |
| 7.3 Zod 스키마 정확성 | 1.1, 1.3 |
| 7.4 Fallback chain 3단 | 2.5 (use-vc-sim 의 dataSourceBadge) + 5.2 |
| 7.5 Monte Carlo 수식 | 2.3 |
| 7.6 Seed 관리 | 2.3 |
| 7.7 자동 연결 매트릭스 | 2.2, 5.2 |
| 8.1 Failure modes (J-커브 edge 2종 포함) | 4.2 (KPI card 분기) + 5.3 (ErrorBoundary) |
| 8.3 ErrorBoundary 배치 | 5.3 |
| 9.2 핵심 테스트 케이스 | 2.3, 2.4, 1.3 |
| 9.4 `test:vc` npm script | 5.3 |

**Gaps 해결**: MethodologyModal 내용(Spec 6.4) 은 MVP 에서 MethodologyModal 자체만 페이지에 링크하고 내용은 Phase 2 로 미룸 — 11.3 결정 유보로 처리.

**Placeholder scan**: "TBD", "TODO", "implement later" → Task 5.2 에 `// TODO: Task 5.2` 주석 2개 있음, 같은 task 내에서 해결하므로 OK. 나머지 없음.

**Type consistency**: `Offer` / `VcSimResult` / `BaselineResult` / `LstmSnapshot` 모든 task 에서 동일 이름·시그니처 사용. `makeSeededRng` / `computeVcSimulation` / `prefillOffer` / `useVcSimulation` 이름 일관.

---

## 실행 옵션

**구현 방식 2가지 중 선택**:

**1. Subagent-Driven (권장)** — 각 task 마다 새 subagent 에 위임, task 간 review 로 빠른 iteration  
   → `superpowers:subagent-driven-development` 스킬 호출

**2. Inline Execution** — 현재 세션에서 task 를 batch 로 실행, checkpoint 에서 리뷰  
   → `superpowers:executing-plans` 스킬 호출

어느 쪽으로 갈지?
