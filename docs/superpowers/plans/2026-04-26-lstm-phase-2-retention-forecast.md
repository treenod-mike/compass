# W9 Phase 2 — Retention Forecast Util Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Beta-Binomial shrinkage retention posterior + 3점-fit power-law D1→D1095 보간(+ floor)을 순수 함수 라이브러리로 구현. 부수효과 0건. 다음 PR(Phase 3 cron handler)이 본 라이브러리를 호출해 `retention-snapshot.json`을 생성하게 한다.

**Architecture:** 두 파일(`retention.ts`, `power-law.ts`) + 단위/통합 테스트 3개. `bayesianRetentionPosterior`는 기존 `betaQuantile`을 호출해 80% band(P10/P50/P90)를 산출. prior 변환은 기존 `betaBinomialModel.priorFromEmpirical`을 직접 재사용. 고수준 wrapper `retentionForecast`가 두 모듈을 합성해 `RetentionForecastPoint[]`(길이 1095)를 반환.

**Tech Stack:** TypeScript (NodeNext, strict), vitest, 기존 `bayesian-stats/` 라이브러리(`beta-quantile`, `beta-binomial`, `types`).

**Spec:** `docs/superpowers/specs/2026-04-26-lstm-phase-2-retention-forecast-design.md` (commit `8f12314`).

**Working directory:** `/Users/mike/Downloads/compass-worktrees/feature-lstm-phase-2-retention-forecast/` (branch `feat/lstm-phase-2-retention-forecast`, npm install 완료).

---

## File Structure

| 경로 | 책임 | 작업 |
|---|---|---|
| `src/shared/lib/bayesian-stats/retention.ts` | 80%-band posterior + 고수준 wrapper + 신규 에러 클래스 2개 | Create |
| `src/shared/lib/bayesian-stats/power-law.ts` | 3점 log-log fit + 1095일 보간 + floor + 신규 에러 클래스 2개 | Create |
| `src/shared/lib/bayesian-stats/__tests__/retention.test.ts` | retention 단위 테스트 | Create |
| `src/shared/lib/bayesian-stats/__tests__/power-law.test.ts` | power-law 단위 테스트 | Create |
| `src/shared/lib/bayesian-stats/__tests__/retention-forecast.test.ts` | 통합 테스트 (Merge:JP prior 사용) | Create |
| `src/shared/lib/bayesian-stats/index.ts` | 신규 re-export 추가 | Modify |

코드 라인 추정: retention.ts ~70, power-law.ts ~70, 테스트 합계 ~250, index.ts +6. 총 ~400줄.

---

## Task 1: retention.ts skeleton + 에러 클래스 정의

**Files:**
- Create: `src/shared/lib/bayesian-stats/retention.ts`
- Test: `src/shared/lib/bayesian-stats/__tests__/retention.test.ts`

- [ ] **Step 1: Write failing test for error classes**

```ts
// src/shared/lib/bayesian-stats/__tests__/retention.test.ts
import { describe, it, expect } from "vitest"
import {
  InvalidObservationError,
  InvalidPriorWeightError,
} from "../retention"

describe("retention error classes", () => {
  it("InvalidObservationError carries k and n", () => {
    const err = new InvalidObservationError({ k: 5, n: 3 })
    expect(err.name).toBe("InvalidObservationError")
    expect(err.message).toContain("k=5")
    expect(err.message).toContain("n=3")
  })

  it("InvalidPriorWeightError carries the bad weight", () => {
    const err = new InvalidPriorWeightError(-0.5)
    expect(err.name).toBe("InvalidPriorWeightError")
    expect(err.message).toContain("-0.5")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/mike/Downloads/compass-worktrees/feature-lstm-phase-2-retention-forecast && npx vitest run src/shared/lib/bayesian-stats/__tests__/retention.test.ts`

Expected: FAIL with "Cannot find module '../retention'".

- [ ] **Step 3: Create retention.ts with error classes only**

```ts
// src/shared/lib/bayesian-stats/retention.ts
import { betaQuantile } from "./beta-quantile"
import { betaBinomialModel, type BetaParams, type BinomialObs } from "./beta-binomial"
import type { EmpiricalDist } from "./types"

export class InvalidObservationError extends Error {
  constructor(public readonly observation: BinomialObs) {
    super(`Invalid observation: k=${observation.k} > n=${observation.n}`)
    this.name = "InvalidObservationError"
  }
}

export class InvalidPriorWeightError extends Error {
  constructor(public readonly weight: number) {
    super(`priorWeight must be > 0, got ${weight}`)
    this.name = "InvalidPriorWeightError"
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/shared/lib/bayesian-stats/__tests__/retention.test.ts`

Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
cd /Users/mike/Downloads/compass-worktrees/feature-lstm-phase-2-retention-forecast
git add src/shared/lib/bayesian-stats/retention.ts src/shared/lib/bayesian-stats/__tests__/retention.test.ts
git commit -m "$(cat <<'EOF'
feat(bayesian-stats): scaffold retention module with error classes

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: bayesianRetentionPosterior

**Files:**
- Modify: `src/shared/lib/bayesian-stats/retention.ts`
- Modify: `src/shared/lib/bayesian-stats/__tests__/retention.test.ts`

- [ ] **Step 1: Append failing tests for bayesianRetentionPosterior**

Add to `__tests__/retention.test.ts` (in addition to existing tests):

```ts
import { bayesianRetentionPosterior } from "../retention"

describe("bayesianRetentionPosterior", () => {
  const prior = { alpha: 2, beta: 8 }

  it("default weight=1: posterior = Beta(2+k, 8+n-k), p50 ≈ mean", () => {
    const result = bayesianRetentionPosterior({
      prior,
      observation: { k: 80, n: 100 },
    })
    expect(result.posterior.alpha).toBeCloseTo(82, 5)
    expect(result.posterior.beta).toBeCloseTo(28, 5)
    expect(result.p50).toBeCloseTo(0.7455, 2)
    expect(result.p10).toBeLessThan(result.p50)
    expect(result.p90).toBeGreaterThan(result.p50)
    expect(result.p10).toBeGreaterThan(0.65)
    expect(result.p90).toBeLessThan(0.85)
  })

  it("priorWeight=0.5 halves prior pseudo-counts", () => {
    const result = bayesianRetentionPosterior({
      prior,
      observation: { k: 80, n: 100 },
      priorWeight: 0.5,
    })
    expect(result.posterior.alpha).toBeCloseTo(81, 5)  // 2*0.5 + 80
    expect(result.posterior.beta).toBeCloseTo(24, 5)   // 8*0.5 + 20
  })

  it("n=0 returns weighted prior unchanged", () => {
    const result = bayesianRetentionPosterior({
      prior,
      observation: { k: 0, n: 0 },
    })
    expect(result.posterior.alpha).toBeCloseTo(2, 5)
    expect(result.posterior.beta).toBeCloseTo(8, 5)
  })

  it("k > n throws InvalidObservationError", () => {
    expect(() =>
      bayesianRetentionPosterior({ prior, observation: { k: 50, n: 30 } }),
    ).toThrow(InvalidObservationError)
  })

  it("priorWeight ≤ 0 throws InvalidPriorWeightError", () => {
    expect(() =>
      bayesianRetentionPosterior({ prior, observation: { k: 50, n: 100 }, priorWeight: 0 }),
    ).toThrow(InvalidPriorWeightError)
    expect(() =>
      bayesianRetentionPosterior({ prior, observation: { k: 50, n: 100 }, priorWeight: -1 }),
    ).toThrow(InvalidPriorWeightError)
  })

  it("p10 ≤ p50 ≤ p90 invariant for skewed prior", () => {
    const skewedPrior = { alpha: 1.2, beta: 18 }  // mean ~ 0.06
    const result = bayesianRetentionPosterior({
      prior: skewedPrior,
      observation: { k: 5, n: 100 },
    })
    expect(result.p10).toBeLessThanOrEqual(result.p50)
    expect(result.p50).toBeLessThanOrEqual(result.p90)
  })
})
```

- [ ] **Step 2: Run tests to verify FAIL**

Run: `npx vitest run src/shared/lib/bayesian-stats/__tests__/retention.test.ts`

Expected: 6 failures with "bayesianRetentionPosterior is not exported".

- [ ] **Step 3: Implement bayesianRetentionPosterior**

Append to `src/shared/lib/bayesian-stats/retention.ts`:

```ts
export function bayesianRetentionPosterior(args: {
  prior: BetaParams
  observation: BinomialObs
  priorWeight?: number
}): {
  posterior: BetaParams
  p10: number
  p50: number
  p90: number
} {
  const { prior, observation, priorWeight = 1 } = args
  if (!(priorWeight > 0)) throw new InvalidPriorWeightError(priorWeight)
  if (observation.k > observation.n) throw new InvalidObservationError(observation)

  const posterior: BetaParams = {
    alpha: prior.alpha * priorWeight + observation.k,
    beta: prior.beta * priorWeight + (observation.n - observation.k),
  }
  return {
    posterior,
    p10: betaQuantile(posterior.alpha, posterior.beta, 0.1),
    p50: betaQuantile(posterior.alpha, posterior.beta, 0.5),
    p90: betaQuantile(posterior.alpha, posterior.beta, 0.9),
  }
}
```

- [ ] **Step 4: Run tests to verify PASS**

Run: `npx vitest run src/shared/lib/bayesian-stats/__tests__/retention.test.ts`

Expected: PASS (8 tests total — 2 from Task 1 + 6 new).

- [ ] **Step 5: Commit**

```bash
git add src/shared/lib/bayesian-stats/retention.ts src/shared/lib/bayesian-stats/__tests__/retention.test.ts
git commit -m "$(cat <<'EOF'
feat(bayesian-stats): bayesianRetentionPosterior with 80% band

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: power-law.ts — fitPowerLaw

**Files:**
- Create: `src/shared/lib/bayesian-stats/power-law.ts`
- Create: `src/shared/lib/bayesian-stats/__tests__/power-law.test.ts`

- [ ] **Step 1: Write failing tests for fitPowerLaw and NonDecreasingCurveError**

```ts
// src/shared/lib/bayesian-stats/__tests__/power-law.test.ts
import { describe, it, expect } from "vitest"
import { fitPowerLaw, NonDecreasingCurveError } from "../power-law"

describe("fitPowerLaw", () => {
  it("3-point retention curve: returns positive a, b", () => {
    const fit = fitPowerLaw([
      { day: 1, value: 0.5 },
      { day: 7, value: 0.3 },
      { day: 30, value: 0.15 },
    ])
    expect(fit.a).toBeCloseTo(0.53, 1)
    expect(fit.b).toBeCloseTo(0.35, 1)
  })

  it("non-decreasing curve throws NonDecreasingCurveError", () => {
    expect(() =>
      fitPowerLaw([
        { day: 1, value: 0.3 },
        { day: 7, value: 0.5 },
        { day: 30, value: 0.7 },
      ]),
    ).toThrow(NonDecreasingCurveError)
  })

  it("perfect power-law recovers exact a, b", () => {
    // r(t) = 0.6 × t^(-0.4)
    // r(1) = 0.6, r(10) = 0.6 × 10^-0.4 ≈ 0.2389, r(100) ≈ 0.0951
    const fit = fitPowerLaw([
      { day: 1, value: 0.6 },
      { day: 10, value: 0.6 * Math.pow(10, -0.4) },
      { day: 100, value: 0.6 * Math.pow(100, -0.4) },
    ])
    expect(fit.a).toBeCloseTo(0.6, 4)
    expect(fit.b).toBeCloseTo(0.4, 4)
  })

  it("rejects fewer than 2 points", () => {
    expect(() => fitPowerLaw([{ day: 1, value: 0.5 }])).toThrow()
  })

  it("rejects non-positive day or value", () => {
    expect(() =>
      fitPowerLaw([
        { day: 0, value: 0.5 },
        { day: 7, value: 0.3 },
      ]),
    ).toThrow()
    expect(() =>
      fitPowerLaw([
        { day: 1, value: 0 },
        { day: 7, value: 0.3 },
      ]),
    ).toThrow()
  })
})
```

- [ ] **Step 2: Run tests to verify FAIL**

Run: `npx vitest run src/shared/lib/bayesian-stats/__tests__/power-law.test.ts`

Expected: FAIL with "Cannot find module '../power-law'".

- [ ] **Step 3: Create power-law.ts with fitPowerLaw**

```ts
// src/shared/lib/bayesian-stats/power-law.ts
export type PowerLawFit = { a: number; b: number }

export class NonDecreasingCurveError extends Error {
  constructor(public readonly slope: number) {
    super(`Power-law fit produced non-decreasing curve: b=${slope.toFixed(4)} (expected b > 0)`)
    this.name = "NonDecreasingCurveError"
  }
}

/**
 * Fit r(t) = a × t^(-b) via log-log least-squares regression.
 * Requires ≥ 2 points with day > 0 and value > 0.
 */
export function fitPowerLaw(points: Array<{ day: number; value: number }>): PowerLawFit {
  if (points.length < 2) {
    throw new Error(`fitPowerLaw requires at least 2 points, got ${points.length}`)
  }
  for (const p of points) {
    if (!(p.day > 0)) throw new Error(`fitPowerLaw: day must be > 0, got ${p.day}`)
    if (!(p.value > 0)) throw new Error(`fitPowerLaw: value must be > 0, got ${p.value}`)
  }
  const n = points.length
  const xs = points.map((p) => Math.log(p.day))
  const ys = points.map((p) => Math.log(p.value))
  const xMean = xs.reduce((s, x) => s + x, 0) / n
  const yMean = ys.reduce((s, y) => s + y, 0) / n
  let num = 0
  let den = 0
  for (let i = 0; i < n; i++) {
    num += (xs[i]! - xMean) * (ys[i]! - yMean)
    den += (xs[i]! - xMean) ** 2
  }
  if (den === 0) throw new Error(`fitPowerLaw: zero variance in log(day)`)
  const slope = num / den   // = -b
  const b = -slope
  if (!(b > 0)) throw new NonDecreasingCurveError(b)
  const intercept = yMean - slope * xMean   // = log a
  const a = Math.exp(intercept)
  return { a, b }
}
```

- [ ] **Step 4: Run tests to verify PASS**

Run: `npx vitest run src/shared/lib/bayesian-stats/__tests__/power-law.test.ts`

Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/shared/lib/bayesian-stats/power-law.ts src/shared/lib/bayesian-stats/__tests__/power-law.test.ts
git commit -m "$(cat <<'EOF'
feat(bayesian-stats): fitPowerLaw via log-log regression

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: power-law.ts — extrapolatePowerLawCurve + MaxDayOutOfRangeError

**Files:**
- Modify: `src/shared/lib/bayesian-stats/power-law.ts`
- Modify: `src/shared/lib/bayesian-stats/__tests__/power-law.test.ts`

- [ ] **Step 1: Append failing tests**

Add to `__tests__/power-law.test.ts`:

```ts
import { extrapolatePowerLawCurve, MaxDayOutOfRangeError } from "../power-law"

describe("extrapolatePowerLawCurve", () => {
  const fit = { a: 0.5, b: 0.36 }

  it("returns array of length maxDay; index i = day (i+1)", () => {
    const curve = extrapolatePowerLawCurve({ fit, maxDay: 1095, floor: 0.01 })
    expect(curve.length).toBe(1095)
    expect(curve[0]).toBeCloseTo(0.5, 5)               // day 1: 0.5 × 1^-0.36 = 0.5
    expect(curve[6]).toBeCloseTo(0.5 * Math.pow(7, -0.36), 5)   // day 7
  })

  it("applies floor: never below floor", () => {
    const curve = extrapolatePowerLawCurve({ fit, maxDay: 1095, floor: 0.05 })
    expect(Math.min(...curve)).toBeGreaterThanOrEqual(0.05)
  })

  it("monotone non-increasing", () => {
    const curve = extrapolatePowerLawCurve({ fit, maxDay: 100, floor: 0 })
    for (let i = 1; i < curve.length; i++) {
      expect(curve[i]!).toBeLessThanOrEqual(curve[i - 1]!)
    }
  })

  it("maxDay > 1095 throws MaxDayOutOfRangeError", () => {
    expect(() => extrapolatePowerLawCurve({ fit, maxDay: 1100, floor: 0 })).toThrow(MaxDayOutOfRangeError)
  })

  it("maxDay ≤ 0 throws MaxDayOutOfRangeError", () => {
    expect(() => extrapolatePowerLawCurve({ fit, maxDay: 0, floor: 0 })).toThrow(MaxDayOutOfRangeError)
    expect(() => extrapolatePowerLawCurve({ fit, maxDay: -5, floor: 0 })).toThrow(MaxDayOutOfRangeError)
  })

  it("negative floor throws", () => {
    expect(() => extrapolatePowerLawCurve({ fit, maxDay: 100, floor: -0.1 })).toThrow()
  })
})
```

- [ ] **Step 2: Run tests to verify FAIL**

Run: `npx vitest run src/shared/lib/bayesian-stats/__tests__/power-law.test.ts`

Expected: 6 failures with "extrapolatePowerLawCurve is not exported".

- [ ] **Step 3: Append implementation**

Append to `src/shared/lib/bayesian-stats/power-law.ts`:

```ts
export class MaxDayOutOfRangeError extends Error {
  constructor(public readonly maxDay: number) {
    super(`maxDay must be in (0, 1095], got ${maxDay}`)
    this.name = "MaxDayOutOfRangeError"
  }
}

const MAX_FORECAST_DAYS = 1095

export function extrapolatePowerLawCurve(args: {
  fit: PowerLawFit
  maxDay: number
  floor: number
}): number[] {
  const { fit, maxDay, floor } = args
  if (!(maxDay > 0) || maxDay > MAX_FORECAST_DAYS) throw new MaxDayOutOfRangeError(maxDay)
  if (!(floor >= 0)) throw new Error(`floor must be ≥ 0, got ${floor}`)
  const out = new Array<number>(maxDay)
  for (let i = 0; i < maxDay; i++) {
    const day = i + 1
    const raw = fit.a * Math.pow(day, -fit.b)
    out[i] = Math.max(raw, floor)
  }
  return out
}
```

- [ ] **Step 4: Run tests to verify PASS**

Run: `npx vitest run src/shared/lib/bayesian-stats/__tests__/power-law.test.ts`

Expected: PASS (11 tests total — 5 from Task 3 + 6 new).

- [ ] **Step 5: Commit**

```bash
git add src/shared/lib/bayesian-stats/power-law.ts src/shared/lib/bayesian-stats/__tests__/power-law.test.ts
git commit -m "$(cat <<'EOF'
feat(bayesian-stats): extrapolatePowerLawCurve with floor + range guard

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: retentionForecast (high-level wrapper) + integration test

**Files:**
- Modify: `src/shared/lib/bayesian-stats/retention.ts`
- Create: `src/shared/lib/bayesian-stats/__tests__/retention-forecast.test.ts`

- [ ] **Step 1: Write failing integration test**

```ts
// src/shared/lib/bayesian-stats/__tests__/retention-forecast.test.ts
import { describe, it, expect } from "vitest"
import { retentionForecast, type RetentionForecastPoint } from "../retention"
import { getPrior } from "@/shared/api/prior-data"

describe("retentionForecast (integration)", () => {
  const bundle = getPrior({ genre: "Merge", region: "JP" })!

  const observations = {
    d1: { k: 70, n: 100 },
    d7: { k: 35, n: 100 },
    d30: { k: 15, n: 100 },
  }

  it("returns 1095-point curve with monotone non-increasing p50", () => {
    const curve = retentionForecast({
      observations,
      priors: bundle.retention,
      priorEffectiveN: bundle.effectiveN,
    })
    expect(curve).toHaveLength(1095)
    for (let i = 1; i < curve.length; i++) {
      expect(curve[i]!.p50).toBeLessThanOrEqual(curve[i - 1]!.p50)
    }
  })

  it("p10 ≤ p50 ≤ p90 at every day", () => {
    const curve = retentionForecast({
      observations,
      priors: bundle.retention,
      priorEffectiveN: bundle.effectiveN,
    })
    for (const point of curve) {
      expect(point.p10).toBeLessThanOrEqual(point.p50)
      expect(point.p50).toBeLessThanOrEqual(point.p90)
    }
  })

  it("D1 / D7 / D30 of P50 are positive and < 1", () => {
    const curve = retentionForecast({
      observations,
      priors: bundle.retention,
      priorEffectiveN: bundle.effectiveN,
    })
    const get = (day: number) => curve.find((p) => p.day === day)!
    expect(get(1).p50).toBeGreaterThan(0)
    expect(get(1).p50).toBeLessThan(1)
    expect(get(7).p50).toBeGreaterThan(0)
    expect(get(30).p50).toBeGreaterThan(0)
    expect(get(1).p50).toBeGreaterThan(get(7).p50)
    expect(get(7).p50).toBeGreaterThan(get(30).p50)
  })

  it("D1095 is at or above floor (never zero)", () => {
    const curve = retentionForecast({
      observations,
      priors: bundle.retention,
      priorEffectiveN: bundle.effectiveN,
    })
    const last = curve[curve.length - 1]!
    expect(last.day).toBe(1095)
    expect(last.p10).toBeGreaterThan(0)
    expect(last.p50).toBeGreaterThan(0)
    expect(last.p90).toBeGreaterThan(0)
  })

  it("priorWeight=0.5 shifts P50 closer to observation than weight=1", () => {
    const baseline = retentionForecast({
      observations,
      priors: bundle.retention,
      priorEffectiveN: bundle.effectiveN,
      priorWeight: 1,
    })
    const halved = retentionForecast({
      observations,
      priors: bundle.retention,
      priorEffectiveN: bundle.effectiveN,
      priorWeight: 0.5,
    })
    // Lower priorWeight → posterior pulled more toward observation. Sign of
    // shift depends on whether obs is above or below prior median; just assert
    // the curves are not identical.
    const baselineD1 = baseline.find((p) => p.day === 1)!.p50
    const halvedD1 = halved.find((p) => p.day === 1)!.p50
    expect(halvedD1).not.toBeCloseTo(baselineD1, 4)
  })

  it("default maxDay=1095, custom maxDay=365 returns 365 points", () => {
    const curve = retentionForecast({
      observations,
      priors: bundle.retention,
      priorEffectiveN: bundle.effectiveN,
      maxDay: 365,
    })
    expect(curve).toHaveLength(365)
    expect(curve[curve.length - 1]!.day).toBe(365)
  })
})
```

- [ ] **Step 2: Run tests to verify FAIL**

Run: `npx vitest run src/shared/lib/bayesian-stats/__tests__/retention-forecast.test.ts`

Expected: 6 failures with "retentionForecast is not exported".

- [ ] **Step 3: Implement retentionForecast in retention.ts**

Append to `src/shared/lib/bayesian-stats/retention.ts`:

```ts
import { fitPowerLaw, extrapolatePowerLawCurve } from "./power-law"

export type RetentionForecastPoint = {
  day: number
  p10: number
  p50: number
  p90: number
}

export function retentionForecast(args: {
  observations: { d1: BinomialObs; d7: BinomialObs; d30: BinomialObs }
  priors: { d1: EmpiricalDist; d7: EmpiricalDist; d30: EmpiricalDist }
  priorEffectiveN: number
  priorWeight?: number
  maxDay?: number
}): RetentionForecastPoint[] {
  const { observations, priors, priorEffectiveN, priorWeight = 1, maxDay = 1095 } = args

  // 1. Convert each EmpiricalDist prior → BetaParams via existing engine.
  const priorBeta = {
    d1: betaBinomialModel.priorFromEmpirical(priors.d1, priorEffectiveN),
    d7: betaBinomialModel.priorFromEmpirical(priors.d7, priorEffectiveN),
    d30: betaBinomialModel.priorFromEmpirical(priors.d30, priorEffectiveN),
  }

  // 2. Compute 80% band posterior at each anchor day.
  const post = {
    d1: bayesianRetentionPosterior({ prior: priorBeta.d1, observation: observations.d1, priorWeight }),
    d7: bayesianRetentionPosterior({ prior: priorBeta.d7, observation: observations.d7, priorWeight }),
    d30: bayesianRetentionPosterior({ prior: priorBeta.d30, observation: observations.d30, priorWeight }),
  }

  // 3. Floor: fit power-law on prior medians (p50), evaluate at day 365, divide by 3.
  const priorFitForFloor = fitPowerLaw([
    { day: 1, value: priors.d1.p50 },
    { day: 7, value: priors.d7.p50 },
    { day: 30, value: priors.d30.p50 },
  ])
  const floor = (priorFitForFloor.a * Math.pow(365, -priorFitForFloor.b)) / 3

  // 4. Fit power-law for each band quantile.
  const fits = {
    p10: fitPowerLaw([
      { day: 1, value: post.d1.p10 },
      { day: 7, value: post.d7.p10 },
      { day: 30, value: post.d30.p10 },
    ]),
    p50: fitPowerLaw([
      { day: 1, value: post.d1.p50 },
      { day: 7, value: post.d7.p50 },
      { day: 30, value: post.d30.p50 },
    ]),
    p90: fitPowerLaw([
      { day: 1, value: post.d1.p90 },
      { day: 7, value: post.d7.p90 },
      { day: 30, value: post.d30.p90 },
    ]),
  }

  // 5. Extrapolate each band, with shared floor.
  const curveP10 = extrapolatePowerLawCurve({ fit: fits.p10, maxDay, floor })
  const curveP50 = extrapolatePowerLawCurve({ fit: fits.p50, maxDay, floor })
  const curveP90 = extrapolatePowerLawCurve({ fit: fits.p90, maxDay, floor })

  // 6. Zip into RetentionForecastPoint[].
  const out: RetentionForecastPoint[] = new Array(maxDay)
  for (let i = 0; i < maxDay; i++) {
    out[i] = {
      day: i + 1,
      p10: curveP10[i]!,
      p50: curveP50[i]!,
      p90: curveP90[i]!,
    }
  }
  return out
}
```

- [ ] **Step 4: Run tests to verify PASS**

Run: `npx vitest run src/shared/lib/bayesian-stats/__tests__/`

Expected: All retention + power-law + retention-forecast tests pass (8 + 11 + 6 = 25 tests, plus existing).

- [ ] **Step 5: Commit**

```bash
git add src/shared/lib/bayesian-stats/retention.ts src/shared/lib/bayesian-stats/__tests__/retention-forecast.test.ts
git commit -m "$(cat <<'EOF'
feat(bayesian-stats): retentionForecast — composes shrinkage + power-law

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: index.ts re-exports + final verification

**Files:**
- Modify: `src/shared/lib/bayesian-stats/index.ts`

- [ ] **Step 1: Add re-exports**

Replace `src/shared/lib/bayesian-stats/index.ts` content:

```ts
export * from "./types"
export * from "./version"
export * from "./effective-sample-size"
export { betaBinomialModel } from "./beta-binomial"
export type { BetaParams, BinomialObs } from "./beta-binomial"
export { lognormalModel } from "./lognormal"
export type { LogNormalParams, RevenueObs } from "./lognormal"
export { validatePriorBasic, validateRetentionPosterior, validateRevenuePosterior } from "./validity"
export { METRIC_MODELS } from "./metric-registry"
export type { MetricKey, MetricModelMap } from "./metric-registry"

// W9 Phase 2 — retention forecast util
export {
  bayesianRetentionPosterior,
  retentionForecast,
  InvalidObservationError,
  InvalidPriorWeightError,
} from "./retention"
export type { RetentionForecastPoint } from "./retention"
export {
  fitPowerLaw,
  extrapolatePowerLawCurve,
  NonDecreasingCurveError,
  MaxDayOutOfRangeError,
} from "./power-law"
export type { PowerLawFit } from "./power-law"
```

- [ ] **Step 2: Verify type-check**

Run: `npx tsc --noEmit`

Expected: No errors.

- [ ] **Step 3: Run full test suite — no regressions**

Run: `npx vitest run`

Expected: All tests pass. Existing 89+ tests + new ~25 tests = ~114+ green.

- [ ] **Step 4: Verify imports work from the public path**

Quick smoke check via Node REPL:

```bash
npx tsx -e "
const m = require('./src/shared/lib/bayesian-stats')
console.log(typeof m.bayesianRetentionPosterior)  // 'function'
console.log(typeof m.retentionForecast)           // 'function'
console.log(typeof m.fitPowerLaw)                 // 'function'
console.log(typeof m.extrapolatePowerLawCurve)    // 'function'
console.log(typeof m.InvalidObservationError)     // 'function'
console.log(typeof m.MaxDayOutOfRangeError)       // 'function'
"
```

Expected: 6 'function' lines.

- [ ] **Step 5: Commit**

```bash
git add src/shared/lib/bayesian-stats/index.ts
git commit -m "$(cat <<'EOF'
feat(bayesian-stats): re-export Phase 2 retention forecast util

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Final Checklist (Spec §9)

- [ ] `tsc --noEmit` clean
- [ ] `npm test` pass — 신규 단위 + integration 테스트 포함
- [ ] 기존 89+ 테스트 회귀 0건
- [ ] 신규 함수의 cyclomatic complexity ≤ 8 (각 함수가 단일 책임)
- [ ] `bayesian-stats/index.ts` 의 신규 export 가 자기충족적
- [ ] PR 생성 후 CodeRabbit 리뷰 thread 모두 resolve

PR title: `feat(bayesian-stats): retention forecast util — Beta-Binomial + power-law (W9 Phase 2)`

PR body skeleton:
```
## Summary
- Beta-Binomial 80%-band posterior (re-uses existing priorFromEmpirical)
- 3-point log-log power-law fit + 1095-day extrapolation with prior-derived floor
- High-level retentionForecast wrapper composing the two

## Spec
docs/superpowers/specs/2026-04-26-lstm-phase-2-retention-forecast-design.md (8f12314)

## Test plan
- [ ] Unit tests for retention.ts and power-law.ts
- [ ] Integration test using Merge:JP prior bundle
- [ ] tsc --noEmit clean
- [ ] Full vitest suite green (no regressions)
```
