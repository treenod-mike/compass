# Bayesian Stats Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Project Compass에 과학적 타당성을 갖춘 Bayesian 통계 엔진(Empirical Bayes + Shrinkage) + MMP vendor-neutral adapter contract를 도입해, Poco Merge의 MMP 실측 리텐션·수익을 Sensor Tower Merge×JP Top 20 empirical prior와 비교한다.

**Architecture:** Pure engine(`shared/lib/bayesian-stats/`) + MMP adapter(`shared/api/mmp/appsflyer/`) + Snapshot JSON(single source of truth) + UI mock fallback. Prior는 ST crawler 주간 실행, Posterior는 MMP sync 일 1회 계산되어 snapshot에 persist. Validity gate 실패 시 UI에 "보류" 시그널.

**Tech Stack:** TypeScript 5.6 + Next.js 15 App Router + Zod + Vitest + existing Sensor Tower crawler (Playwright) + AppsFlyer API (current MMP vendor).

**Spec reference:** `docs/superpowers/specs/2026-04-21-bayesian-stats-engine-design.md`

---

## Phase 0: Branch Setup

### Task 0.1: 새 feature branch 생성

**Files:**
- Branch: `feat/bayesian-stats-engine`

- [ ] **Step 1: 현재 branch 상태 확인**

Run: `git status && git branch --show-current`
Expected: clean working tree, current branch `feat/appsflyer-pipeline`

- [ ] **Step 2: 새 branch 생성 + 전환**

Run: `git checkout -b feat/bayesian-stats-engine`
Expected: `Switched to a new branch 'feat/bayesian-stats-engine'`

- [ ] **Step 3: commit (branch 생성만은 commit 필요 없음, skip)**

Skip. 다음 Phase에서 첫 기능 커밋.

---

## Phase 1: Bayesian Engine Core (TDD)

순수 함수 엔진. 수학 정합성을 테스트가 보장한다. 파일 경로 규약: 테스트는 같은 디렉토리의 `__tests__/<module>.test.ts`.

### Task 1.1: 공통 타입 정의

**Files:**
- Create: `src/shared/lib/bayesian-stats/types.ts`
- Create: `src/shared/lib/bayesian-stats/version.ts`

- [ ] **Step 1: version 상수 작성**

```ts
// src/shared/lib/bayesian-stats/version.ts
export const ENGINE_VERSION = "bayesian-stats@0.1.0"
```

- [ ] **Step 2: 공통 타입 작성**

```ts
// src/shared/lib/bayesian-stats/types.ts
export type EmpiricalDist = { p10: number; p50: number; p90: number }

export type CredibleInterval = {
  mean: number
  ci_low: number
  ci_high: number
  sampleSize: number
}

export type Validity =
  | { valid: true }
  | {
      valid: false
      reason:
        | "insufficient_installs"
        | "insufficient_history"
        | "prior_unavailable"
        | "prior_invalid_n"
        | "prior_degenerate"
        | "prior_stale"
        | "engine_error"
      need?: number
      have?: number
      detail?: string
    }

// NOTE: validity-wrapped interval is defined in `src/shared/api/mmp/types.ts`,
// where posterior outputs may be null when validity fails. The pure engine always
// returns CredibleInterval (never null fields), so no wrapper is exported from here.

export interface BayesianModel<TPriorParams, TObservation> {
  name: string
  priorFromEmpirical: (empirical: EmpiricalDist, effectiveN: number) => TPriorParams
  posterior: (prior: TPriorParams, obs: TObservation) => CredibleInterval
  priorAsInterval: (prior: TPriorParams) => CredibleInterval
}

export class DegenerateDistributionError extends Error {
  constructor(public readonly empirical: EmpiricalDist) {
    super(`Degenerate empirical distribution: p10=${empirical.p10}, p90=${empirical.p90}`)
    this.name = "DegenerateDistributionError"
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/shared/lib/bayesian-stats/types.ts src/shared/lib/bayesian-stats/version.ts
git commit -m "feat(bayesian-stats): core types and engine version constant"
```

### Task 1.2: Beta quantile (Numerical Recipes betaincinv port)

**Files:**
- Create: `src/shared/lib/bayesian-stats/beta-quantile.ts`
- Test: `src/shared/lib/bayesian-stats/__tests__/beta-quantile.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

```ts
// src/shared/lib/bayesian-stats/__tests__/beta-quantile.test.ts
import { describe, it, expect } from "vitest"
import { betaQuantile } from "../beta-quantile"

describe("betaQuantile", () => {
  it("Beta(1,1) = uniform → quantile(p) = p", () => {
    expect(betaQuantile(1, 1, 0.25)).toBeCloseTo(0.25, 6)
    expect(betaQuantile(1, 1, 0.50)).toBeCloseTo(0.50, 6)
    expect(betaQuantile(1, 1, 0.75)).toBeCloseTo(0.75, 6)
  })

  it("Beta(8,2): matches scipy reference", () => {
    // scipy.stats.beta.ppf([0.025, 0.5, 0.975], 8, 2)
    // → [0.4822, 0.8212, 0.9783]
    expect(betaQuantile(8, 2, 0.025)).toBeCloseTo(0.4822, 3)
    expect(betaQuantile(8, 2, 0.5)).toBeCloseTo(0.8212, 3)
    expect(betaQuantile(8, 2, 0.975)).toBeCloseTo(0.9783, 3)
  })

  it("Beta(35,115): matches scipy reference", () => {
    // scipy.stats.beta.ppf(0.025, 35, 115) ≈ 0.1765
    expect(betaQuantile(35, 115, 0.025)).toBeCloseTo(0.1765, 3)
    expect(betaQuantile(35, 115, 0.975)).toBeCloseTo(0.3060, 3)
  })

  it("throws on invalid p", () => {
    expect(() => betaQuantile(1, 1, -0.1)).toThrow()
    expect(() => betaQuantile(1, 1, 1.1)).toThrow()
  })

  it("throws on non-positive shape params", () => {
    expect(() => betaQuantile(0, 1, 0.5)).toThrow()
    expect(() => betaQuantile(1, -1, 0.5)).toThrow()
  })
})
```

- [ ] **Step 2: 테스트 실행 → FAIL 확인**

Run: `npx vitest run src/shared/lib/bayesian-stats/__tests__/beta-quantile.test.ts`
Expected: FAIL — `Cannot find module '../beta-quantile'`

- [ ] **Step 3: 구현 작성 (Numerical Recipes §6.4 betaincinv)**

```ts
// src/shared/lib/bayesian-stats/beta-quantile.ts

/**
 * Regularized incomplete beta inverse.
 * Port of Numerical Recipes in C, 3rd ed., §6.4 (betaincinv).
 * Returns x such that I_x(a,b) = p, where I is the regularized incomplete beta.
 *
 * scipy.stats.beta.ppf 참조 구현. 1e-6 수렴, 최대 20 Newton-Raphson iter.
 */
export function betaQuantile(a: number, b: number, p: number): number {
  if (!(a > 0)) throw new Error(`betaQuantile: a must be > 0, got ${a}`)
  if (!(b > 0)) throw new Error(`betaQuantile: b must be > 0, got ${b}`)
  if (!(p >= 0 && p <= 1)) throw new Error(`betaQuantile: p must be in [0,1], got ${p}`)
  if (p === 0) return 0
  if (p === 1) return 1

  // Initial guess via Cornish-Fisher approximation on arcsine-transformed normal
  const EPS = 1e-8
  const a1 = a - 1
  const b1 = b - 1
  let x: number
  if (a >= 1 && b >= 1) {
    const pp = p < 0.5 ? p : 1 - p
    const t = Math.sqrt(-2 * Math.log(pp))
    let xApprox = (2.30753 + t * 0.27061) / (1 + t * (0.99229 + t * 0.04481)) - t
    if (p < 0.5) xApprox = -xApprox
    const al = (xApprox * xApprox - 3) / 6
    const h = 2 / (1 / (2 * a - 1) + 1 / (2 * b - 1))
    const w = (xApprox * Math.sqrt(al + h)) / h - (1 / (2 * b - 1) - 1 / (2 * a - 1)) * (al + 5 / 6 - 2 / (3 * h))
    x = a / (a + b * Math.exp(2 * w))
  } else {
    const lna = Math.log(a / (a + b))
    const lnb = Math.log(b / (a + b))
    const t = Math.exp(a * lna) / a
    const u = Math.exp(b * lnb) / b
    const w = t + u
    x = p < t / w ? Math.pow(a * w * p, 1 / a) : 1 - Math.pow(b * w * (1 - p), 1 / b)
  }

  // Newton-Raphson refinement
  const afac = -lnGamma(a) - lnGamma(b) + lnGamma(a + b)
  for (let j = 0; j < 20; j++) {
    if (x === 0 || x === 1) return x
    const err = regularizedIncompleteBeta(a, b, x) - p
    let t = Math.exp(a1 * Math.log(x) + b1 * Math.log(1 - x) + afac)
    const u2 = err / t
    t = u2 / (1 - 0.5 * Math.min(1, u2 * (a1 / x - b1 / (1 - x))))
    x -= t
    if (x <= 0) x = 0.5 * (x + t)
    if (x >= 1) x = 0.5 * (x + t + 1)
    if (Math.abs(t) < EPS * x && j > 0) break
  }
  return x
}

/** ln(Gamma(x)) via Lanczos approximation (NR §6.1) */
function lnGamma(x: number): number {
  const cof = [
    76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5,
  ]
  let y = x
  let tmp = x + 5.5
  tmp -= (x + 0.5) * Math.log(tmp)
  let ser = 1.000000000190015
  for (let j = 0; j < 6; j++) {
    y += 1
    ser += cof[j] / y
  }
  return -tmp + Math.log((2.5066282746310005 * ser) / x)
}

/** Regularized incomplete beta I_x(a,b) (NR §6.4) */
function regularizedIncompleteBeta(a: number, b: number, x: number): number {
  if (x === 0) return 0
  if (x === 1) return 1
  const bt = Math.exp(lnGamma(a + b) - lnGamma(a) - lnGamma(b) + a * Math.log(x) + b * Math.log(1 - x))
  if (x < (a + 1) / (a + b + 2)) return (bt * betaContinuedFraction(a, b, x)) / a
  return 1 - (bt * betaContinuedFraction(b, a, 1 - x)) / b
}

function betaContinuedFraction(a: number, b: number, x: number): number {
  const MAXIT = 200
  const EPS = 3e-7
  const FPMIN = 1e-30
  const qab = a + b
  const qap = a + 1
  const qam = a - 1
  let c = 1
  let d = 1 - (qab * x) / qap
  if (Math.abs(d) < FPMIN) d = FPMIN
  d = 1 / d
  let h = d
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2))
    d = 1 + aa * d
    if (Math.abs(d) < FPMIN) d = FPMIN
    c = 1 + aa / c
    if (Math.abs(c) < FPMIN) c = FPMIN
    d = 1 / d
    h *= d * c
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2))
    d = 1 + aa * d
    if (Math.abs(d) < FPMIN) d = FPMIN
    c = 1 + aa / c
    if (Math.abs(c) < FPMIN) c = FPMIN
    d = 1 / d
    const del = d * c
    h *= del
    if (Math.abs(del - 1) < EPS) return h
  }
  throw new Error("betaContinuedFraction did not converge")
}
```

- [ ] **Step 4: 테스트 실행 → PASS 확인**

Run: `npx vitest run src/shared/lib/bayesian-stats/__tests__/beta-quantile.test.ts`
Expected: PASS (5개 테스트 모두)

- [ ] **Step 5: Commit**

```bash
git add src/shared/lib/bayesian-stats/beta-quantile.ts src/shared/lib/bayesian-stats/__tests__/beta-quantile.test.ts
git commit -m "feat(bayesian-stats): beta quantile via Numerical Recipes betaincinv"
```

### Task 1.3: Effective sample size + Beta-Binomial model

**Files:**
- Create: `src/shared/lib/bayesian-stats/effective-sample-size.ts`
- Create: `src/shared/lib/bayesian-stats/beta-binomial.ts`
- Test: `src/shared/lib/bayesian-stats/__tests__/beta-binomial.test.ts`

- [ ] **Step 1: effective-sample-size 작성**

```ts
// src/shared/lib/bayesian-stats/effective-sample-size.ts

/** Prior strength cap policy: min of (non-null sample count, 100). */
export const PRIOR_EFFECTIVE_N_MAX = 100

export function computeEffectiveN(nonNullCount: number): number {
  if (nonNullCount < 0) return 0
  return Math.min(nonNullCount, PRIOR_EFFECTIVE_N_MAX)
}
```

- [ ] **Step 2: Beta-Binomial 실패 테스트 작성**

```ts
// src/shared/lib/bayesian-stats/__tests__/beta-binomial.test.ts
import { describe, it, expect } from "vitest"
import { betaBinomialModel } from "../beta-binomial"
import { DegenerateDistributionError } from "../types"

describe("Beta-Binomial model", () => {
  describe("priorFromEmpirical (Method of Moments, capped α+β)", () => {
    it("recovers α,β from known empirical quantiles", () => {
      // Beta(8, 2) analytical: mean=0.8, P10≈0.631, P50≈0.821, P90≈0.927
      const prior = betaBinomialModel.priorFromEmpirical(
        { p10: 0.631, p50: 0.821, p90: 0.927 },
        20,
      )
      expect(prior.alpha / (prior.alpha + prior.beta)).toBeCloseTo(0.8, 2)
      expect(prior.alpha + prior.beta).toBeLessThanOrEqual(20 + 1e-6)
    })

    it("caps α+β at effectiveN", () => {
      const prior = betaBinomialModel.priorFromEmpirical(
        { p10: 0.55, p50: 0.60, p90: 0.65 },  // tight distribution → large α+β
        50,
      )
      expect(prior.alpha + prior.beta).toBeLessThanOrEqual(50 + 1e-6)
    })

    it("throws on degenerate (p90 <= p10)", () => {
      expect(() =>
        betaBinomialModel.priorFromEmpirical({ p10: 0.5, p50: 0.5, p90: 0.5 }, 20),
      ).toThrow(DegenerateDistributionError)
    })
  })

  describe("posterior (Beta-Binomial conjugate)", () => {
    it("n=0 → posterior mean = prior mean", () => {
      const prior = { alpha: 8, beta: 2 }
      const post = betaBinomialModel.posterior(prior, { n: 0, k: 0 })
      expect(post.mean).toBeCloseTo(0.8, 6)
    })

    it("n=∞ → posterior mean → observed rate", () => {
      const prior = { alpha: 8, beta: 2 }   // prior mean 0.8
      const post = betaBinomialModel.posterior(prior, { n: 100_000, k: 30_000 })
      expect(post.mean).toBeCloseTo(0.3, 3)
    })

    it("n small → shrinkage (posterior between prior and observed)", () => {
      const prior = { alpha: 8, beta: 2 }
      const post = betaBinomialModel.posterior(prior, { n: 10, k: 3 })
      expect(post.mean).toBeGreaterThan(0.3)
      expect(post.mean).toBeLessThan(0.8)
    })

    it("CI matches analytical Beta quantile (1e-3 tolerance)", () => {
      const prior = { alpha: 10, beta: 40 }
      const post = betaBinomialModel.posterior(prior, { n: 100, k: 25 })
      // Posterior: Beta(35, 115)
      // scipy.stats.beta.ppf([0.025, 0.975], 35, 115) → [0.1765, 0.3060]
      expect(post.ci_low).toBeCloseTo(0.1765, 3)
      expect(post.ci_high).toBeCloseTo(0.3060, 3)
    })

    it("sampleSize = prior pseudo-counts + observed n", () => {
      const prior = { alpha: 8, beta: 2 }  // pseudo-counts = 10
      const post = betaBinomialModel.posterior(prior, { n: 100, k: 30 })
      expect(post.sampleSize).toBe(110)
    })
  })

  describe("priorAsInterval", () => {
    it("returns prior mean and 95% CI from Beta(α,β)", () => {
      const prior = { alpha: 8, beta: 2 }
      const interval = betaBinomialModel.priorAsInterval(prior)
      expect(interval.mean).toBeCloseTo(0.8, 6)
      expect(interval.ci_low).toBeGreaterThan(0.4)
      expect(interval.ci_high).toBeLessThan(1.0)
    })
  })
})
```

- [ ] **Step 3: 테스트 실행 → FAIL**

Run: `npx vitest run src/shared/lib/bayesian-stats/__tests__/beta-binomial.test.ts`
Expected: FAIL — module not found

- [ ] **Step 4: beta-binomial 구현**

```ts
// src/shared/lib/bayesian-stats/beta-binomial.ts
import { betaQuantile } from "./beta-quantile"
import {
  BayesianModel,
  CredibleInterval,
  DegenerateDistributionError,
  EmpiricalDist,
} from "./types"

export type BetaParams = { alpha: number; beta: number }
export type BinomialObs = { n: number; k: number }

// z-score for P10/P90 on standard normal: z(0.9) = 1.2815515655446004
const Z_80 = 1.2815515655446004
const Z_RANGE = 2 * Z_80   // ≈ 2.5631

function priorFromEmpirical(empirical: EmpiricalDist, effectiveN: number): BetaParams {
  if (empirical.p90 <= empirical.p10) throw new DegenerateDistributionError(empirical)
  const mu = empirical.p50
  if (!(mu > 0 && mu < 1)) throw new DegenerateDistributionError(empirical)

  const sigma = (empirical.p90 - empirical.p10) / Z_RANGE
  const variance = sigma * sigma
  const maxVariance = mu * (1 - mu)
  if (variance >= maxVariance) throw new DegenerateDistributionError(empirical)

  const rawTotal = (mu * (1 - mu)) / variance - 1
  const alphaRaw = mu * rawTotal
  const betaRaw = (1 - mu) * rawTotal

  const scale = effectiveN > 0 && rawTotal > effectiveN ? effectiveN / rawTotal : 1
  return { alpha: alphaRaw * scale, beta: betaRaw * scale }
}

function posterior(prior: BetaParams, obs: BinomialObs): CredibleInterval {
  const aPost = prior.alpha + obs.k
  const bPost = prior.beta + (obs.n - obs.k)
  const mean = aPost / (aPost + bPost)
  const ci_low = betaQuantile(aPost, bPost, 0.025)
  const ci_high = betaQuantile(aPost, bPost, 0.975)
  const sampleSize = Math.round(prior.alpha + prior.beta + obs.n)
  return { mean, ci_low, ci_high, sampleSize }
}

function priorAsInterval(prior: BetaParams): CredibleInterval {
  const mean = prior.alpha / (prior.alpha + prior.beta)
  const ci_low = betaQuantile(prior.alpha, prior.beta, 0.025)
  const ci_high = betaQuantile(prior.alpha, prior.beta, 0.975)
  const sampleSize = Math.round(prior.alpha + prior.beta)
  return { mean, ci_low, ci_high, sampleSize }
}

export const betaBinomialModel: BayesianModel<BetaParams, BinomialObs> = {
  name: "beta-binomial",
  priorFromEmpirical,
  posterior,
  priorAsInterval,
}
```

- [ ] **Step 5: 테스트 실행 → PASS**

Run: `npx vitest run src/shared/lib/bayesian-stats/__tests__/beta-binomial.test.ts`
Expected: PASS (모든 describe 블록)

- [ ] **Step 6: Commit**

```bash
git add src/shared/lib/bayesian-stats/beta-binomial.ts src/shared/lib/bayesian-stats/effective-sample-size.ts src/shared/lib/bayesian-stats/__tests__/beta-binomial.test.ts
git commit -m "feat(bayesian-stats): beta-binomial model with MoM prior extraction and capped effectiveN"
```

### Task 1.4: Log-normal model

**Files:**
- Create: `src/shared/lib/bayesian-stats/lognormal.ts`
- Test: `src/shared/lib/bayesian-stats/__tests__/lognormal.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

```ts
// src/shared/lib/bayesian-stats/__tests__/lognormal.test.ts
import { describe, it, expect } from "vitest"
import { lognormalModel } from "../lognormal"

describe("Log-normal model", () => {
  describe("priorFromEmpirical", () => {
    it("recovers μ_log, σ_log from known log-normal", () => {
      // LogNormal(μ=10, σ=1): P50=e^10≈22026, P10/P90 analytical
      const prior = lognormalModel.priorFromEmpirical(
        { p10: 6118, p50: 22026, p90: 79305 },
        20,
      )
      expect(prior.muLog).toBeCloseTo(10.0, 1)
      expect(prior.sigmaLog).toBeCloseTo(1.0, 1)
      expect(prior.nPrior).toBe(20)
    })

    it("throws on degenerate (p50 <= 0)", () => {
      expect(() =>
        lognormalModel.priorFromEmpirical({ p10: 0, p50: 0, p90: 1 }, 20),
      ).toThrow()
    })
  })

  describe("posterior (Normal-Normal conjugate on log-scale)", () => {
    it("n_obs=0 → posterior = prior (as interval)", () => {
      const prior = { muLog: 10, sigmaLog: 1, nPrior: 20 }
      const post = lognormalModel.posterior(prior, { monthlyRevenueUsd: [], monthsCount: 0 })
      const priorInterval = lognormalModel.priorAsInterval(prior)
      expect(post.mean).toBeCloseTo(priorInterval.mean, 2)
    })

    it("n_obs large → posterior mean ≈ observed geometric mean", () => {
      const prior = { muLog: 10, sigmaLog: 1, nPrior: 20 }
      const observed = Array.from({ length: 100 }, () => 1_000_000)  // constant $1M
      const post = lognormalModel.posterior(prior, { monthlyRevenueUsd: observed, monthsCount: 100 })
      // μ_obs = log(1e6) ≈ 13.816, variance=0, so treat with small epsilon
      expect(post.mean).toBeGreaterThan(500_000)
      expect(post.mean).toBeLessThan(2_000_000)
    })

    it("CI bounds in monotone (ci_low < mean < ci_high)", () => {
      const prior = { muLog: 10, sigmaLog: 1, nPrior: 20 }
      const post = lognormalModel.posterior(prior, {
        monthlyRevenueUsd: [1_000_000, 1_500_000, 800_000, 1_200_000],
        monthsCount: 4,
      })
      expect(post.ci_low).toBeLessThan(post.mean)
      expect(post.mean).toBeLessThan(post.ci_high)
    })
  })
})
```

- [ ] **Step 2: 테스트 실행 → FAIL**

Run: `npx vitest run src/shared/lib/bayesian-stats/__tests__/lognormal.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: 구현 작성**

```ts
// src/shared/lib/bayesian-stats/lognormal.ts
import { BayesianModel, CredibleInterval, EmpiricalDist, DegenerateDistributionError } from "./types"

export type LogNormalParams = { muLog: number; sigmaLog: number; nPrior: number }
export type RevenueObs = { monthlyRevenueUsd: number[]; monthsCount: number }

const Z_80 = 1.2815515655446004
const Z_RANGE = 2 * Z_80
const MIN_SIGMA_OBS = 0.01   // floor to avoid divide-by-zero in precision-weighted mean

function priorFromEmpirical(empirical: EmpiricalDist, effectiveN: number): LogNormalParams {
  if (!(empirical.p50 > 0)) throw new DegenerateDistributionError(empirical)
  if (!(empirical.p10 > 0) || !(empirical.p90 > 0)) throw new DegenerateDistributionError(empirical)
  if (empirical.p90 <= empirical.p10) throw new DegenerateDistributionError(empirical)
  const muLog = Math.log(empirical.p50)
  const sigmaLog = (Math.log(empirical.p90) - Math.log(empirical.p10)) / Z_RANGE
  if (!(sigmaLog > 0)) throw new DegenerateDistributionError(empirical)
  return { muLog, sigmaLog, nPrior: Math.max(1, effectiveN) }
}

function posterior(prior: LogNormalParams, obs: RevenueObs): CredibleInterval {
  if (obs.monthsCount === 0 || obs.monthlyRevenueUsd.length === 0) {
    return priorAsInterval(prior)
  }
  const logs = obs.monthlyRevenueUsd.filter((x) => x > 0).map(Math.log)
  if (logs.length === 0) return priorAsInterval(prior)

  const muObs = logs.reduce((s, x) => s + x, 0) / logs.length
  const sigmaObs = logs.length > 1 ? Math.sqrt(variance(logs, muObs)) : MIN_SIGMA_OBS
  const effectiveSigmaObs = Math.max(sigmaObs, MIN_SIGMA_OBS)

  const tauPrior = prior.nPrior / (prior.sigmaLog * prior.sigmaLog)
  const tauObs = logs.length / (effectiveSigmaObs * effectiveSigmaObs)
  const muPost = (tauPrior * prior.muLog + tauObs * muObs) / (tauPrior + tauObs)
  const sigmaPost = Math.sqrt(1 / (tauPrior + tauObs))

  const mean = Math.exp(muPost + (sigmaPost * sigmaPost) / 2)
  const ci_low = Math.exp(muPost - 1.96 * sigmaPost)
  const ci_high = Math.exp(muPost + 1.96 * sigmaPost)
  return { mean, ci_low, ci_high, sampleSize: prior.nPrior + logs.length }
}

function priorAsInterval(prior: LogNormalParams): CredibleInterval {
  const mean = Math.exp(prior.muLog + (prior.sigmaLog * prior.sigmaLog) / 2)
  const ci_low = Math.exp(prior.muLog - 1.96 * prior.sigmaLog)
  const ci_high = Math.exp(prior.muLog + 1.96 * prior.sigmaLog)
  return { mean, ci_low, ci_high, sampleSize: prior.nPrior }
}

function variance(xs: number[], mean: number): number {
  const n = xs.length
  if (n < 2) return 0
  let s = 0
  for (const x of xs) {
    const d = x - mean
    s += d * d
  }
  return s / (n - 1)
}

export const lognormalModel: BayesianModel<LogNormalParams, RevenueObs> = {
  name: "lognormal-mom",
  priorFromEmpirical,
  posterior,
  priorAsInterval,
}
```

- [ ] **Step 4: 테스트 실행 → PASS**

Run: `npx vitest run src/shared/lib/bayesian-stats/__tests__/lognormal.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/shared/lib/bayesian-stats/lognormal.ts src/shared/lib/bayesian-stats/__tests__/lognormal.test.ts
git commit -m "feat(bayesian-stats): log-normal revenue model with Normal-Normal conjugate update"
```

### Task 1.5: Validity gates

**Files:**
- Create: `src/shared/lib/bayesian-stats/validity.ts`
- Test: `src/shared/lib/bayesian-stats/__tests__/validity.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

```ts
// src/shared/lib/bayesian-stats/__tests__/validity.test.ts
import { describe, it, expect } from "vitest"
import {
  validatePriorBasic,
  validateRetentionPosterior,
  validateRevenuePosterior,
} from "../validity"

describe("validity gates", () => {
  describe("validatePriorBasic", () => {
    it("n >= 10 passes, n = 9 fails", () => {
      expect(validatePriorBasic({ nonNullCount: 10, p10: 0.1, p50: 0.3, p90: 0.5, ageDays: 1 })).toEqual({ valid: true })
      const r = validatePriorBasic({ nonNullCount: 9, p10: 0.1, p50: 0.3, p90: 0.5, ageDays: 1 })
      expect(r.valid).toBe(false)
      if (!r.valid) expect(r.reason).toBe("prior_invalid_n")
    })

    it("degenerate distribution (p90 <= p10) fails", () => {
      const r = validatePriorBasic({ nonNullCount: 20, p10: 0.3, p50: 0.3, p90: 0.3, ageDays: 1 })
      expect(r.valid).toBe(false)
      if (!r.valid) expect(r.reason).toBe("prior_degenerate")
    })

    it("ageDays > 30 fails", () => {
      const r = validatePriorBasic({ nonNullCount: 20, p10: 0.1, p50: 0.3, p90: 0.5, ageDays: 31 })
      expect(r.valid).toBe(false)
      if (!r.valid) expect(r.reason).toBe("prior_stale")
    })
  })

  describe("validateRetentionPosterior", () => {
    it("D1: installs >= 25 passes, < 25 fails", () => {
      expect(validateRetentionPosterior({ installs: 25, retained: 15 }, 1)).toEqual({ valid: true })
      const r = validateRetentionPosterior({ installs: 24, retained: 14 }, 1)
      expect(r.valid).toBe(false)
      if (!r.valid) expect(r.reason).toBe("insufficient_installs")
    })

    it("D7: installs >= 80 passes, < 80 fails", () => {
      expect(validateRetentionPosterior({ installs: 80, retained: 20 }, 7)).toEqual({ valid: true })
      expect(validateRetentionPosterior({ installs: 79, retained: 20 }, 7).valid).toBe(false)
    })

    it("D30: installs >= 200 passes, < 200 fails", () => {
      expect(validateRetentionPosterior({ installs: 200, retained: 20 }, 30)).toEqual({ valid: true })
      expect(validateRetentionPosterior({ installs: 199, retained: 20 }, 30).valid).toBe(false)
    })
  })

  describe("validateRevenuePosterior", () => {
    it("monthsCount >= 3 and all revenues >= $1000 passes", () => {
      expect(validateRevenuePosterior({ monthlyRevenueUsd: [5000, 6000, 7000], monthsCount: 3 })).toEqual({ valid: true })
    })

    it("monthsCount < 3 fails", () => {
      const r = validateRevenuePosterior({ monthlyRevenueUsd: [5000, 6000], monthsCount: 2 })
      expect(r.valid).toBe(false)
      if (!r.valid) expect(r.reason).toBe("insufficient_history")
    })
  })
})
```

- [ ] **Step 2: 테스트 실행 → FAIL**

Run: `npx vitest run src/shared/lib/bayesian-stats/__tests__/validity.test.ts`
Expected: FAIL

- [ ] **Step 3: 구현 작성**

```ts
// src/shared/lib/bayesian-stats/validity.ts
import { Validity } from "./types"

const MIN_PRIOR_N = 10
const MAX_PRIOR_AGE_DAYS = 30

export function validatePriorBasic(args: {
  nonNullCount: number
  p10: number
  p50: number
  p90: number
  ageDays: number
}): Validity {
  if (args.nonNullCount < MIN_PRIOR_N) {
    return { valid: false, reason: "prior_invalid_n", need: MIN_PRIOR_N, have: args.nonNullCount }
  }
  if (!(args.p90 > args.p10)) {
    return { valid: false, reason: "prior_degenerate", detail: `p10=${args.p10} p90=${args.p90}` }
  }
  if (args.ageDays > MAX_PRIOR_AGE_DAYS) {
    return { valid: false, reason: "prior_stale", have: args.ageDays, need: MAX_PRIOR_AGE_DAYS }
  }
  return { valid: true }
}

const RETENTION_N_THRESHOLD: Record<1 | 7 | 30, number> = { 1: 25, 7: 80, 30: 200 }

export function validateRetentionPosterior(
  obs: { installs: number; retained: number },
  dayN: 1 | 7 | 30,
): Validity {
  const threshold = RETENTION_N_THRESHOLD[dayN]
  if (obs.installs < threshold) {
    return { valid: false, reason: "insufficient_installs", need: threshold, have: obs.installs }
  }
  return { valid: true }
}

const MIN_REVENUE_MONTHS = 3
const MIN_MONTHLY_REVENUE_USD = 1_000

export function validateRevenuePosterior(obs: { monthlyRevenueUsd: number[]; monthsCount: number }): Validity {
  if (obs.monthsCount < MIN_REVENUE_MONTHS) {
    return { valid: false, reason: "insufficient_history", need: MIN_REVENUE_MONTHS, have: obs.monthsCount }
  }
  const hasLowFloor = obs.monthlyRevenueUsd.some((r) => r < MIN_MONTHLY_REVENUE_USD)
  if (hasLowFloor) {
    return { valid: false, reason: "insufficient_history", detail: "monthly revenue below $1000 floor" }
  }
  return { valid: true }
}
```

- [ ] **Step 4: 테스트 실행 → PASS**

Run: `npx vitest run src/shared/lib/bayesian-stats/__tests__/validity.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/shared/lib/bayesian-stats/validity.ts src/shared/lib/bayesian-stats/__tests__/validity.test.ts
git commit -m "feat(bayesian-stats): validity gates for prior and posterior"
```

### Task 1.6: Engine barrel + metric registry skeleton

**Files:**
- Create: `src/shared/lib/bayesian-stats/metric-registry.ts`
- Create: `src/shared/lib/bayesian-stats/index.ts`

- [ ] **Step 1: metric-registry 작성 (skeleton, 실제 accessor는 Phase 7에서)**

```ts
// src/shared/lib/bayesian-stats/metric-registry.ts
import { BayesianModel } from "./types"
import { betaBinomialModel, BetaParams, BinomialObs } from "./beta-binomial"
import { lognormalModel, LogNormalParams, RevenueObs } from "./lognormal"

export type MetricKey =
  | "retention_d1"
  | "retention_d7"
  | "retention_d30"
  | "monthly_revenue_usd"

export type MetricModelMap = {
  retention_d1: BayesianModel<BetaParams, BinomialObs>
  retention_d7: BayesianModel<BetaParams, BinomialObs>
  retention_d30: BayesianModel<BetaParams, BinomialObs>
  monthly_revenue_usd: BayesianModel<LogNormalParams, RevenueObs>
}

export const METRIC_MODELS: MetricModelMap = {
  retention_d1: betaBinomialModel,
  retention_d7: betaBinomialModel,
  retention_d30: betaBinomialModel,
  monthly_revenue_usd: lognormalModel,
}
```

- [ ] **Step 2: barrel export**

```ts
// src/shared/lib/bayesian-stats/index.ts
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
```

- [ ] **Step 3: typecheck**

Run: `npx tsc --noEmit`
Expected: no errors in `src/shared/lib/bayesian-stats/`

- [ ] **Step 4: 전체 엔진 테스트 재실행**

Run: `npx vitest run src/shared/lib/bayesian-stats`
Expected: all pass

- [ ] **Step 5: Commit**

```bash
git add src/shared/lib/bayesian-stats/metric-registry.ts src/shared/lib/bayesian-stats/index.ts
git commit -m "feat(bayesian-stats): metric registry skeleton and public barrel"
```

---

## Phase 2: Prior Bundle Refactor

기존 `prior-data.ts`를 PriorBundle 타입으로 재구성 + crawler snapshot에 nonNullCount 추가.

### Task 2.1: Crawler schema에 nonNullCount optional 추가

**Files:**
- Modify: `crawler/src/schemas/snapshot.ts`

- [ ] **Step 1: snapshot.ts의 metadata 확장**

Existing location: `crawler/src/schemas/snapshot.ts`. `metadata` 오브젝트에 `nonNullCount` optional 추가.

```ts
// crawler/src/schemas/snapshot.ts — metadata 내부에 추가
metadata: z.object({
  fetchedAt: z.string(),
  fetchedBy: z.string(),
  genre: z.string(),
  region: z.string(),
  topN: z.number().int().positive(),
  tier: z.string(),
  crawlerVersion: z.string(),
  warnings: z.array(z.string()),
  // NEW:
  nonNullCount: z
    .object({
      retention_d1: z.number().int().nonnegative(),
      retention_d7: z.number().int().nonnegative(),
      retention_d30: z.number().int().nonnegative(),
      monthlyRevenueUsd: z.number().int().nonnegative(),
      monthlyDownloads: z.number().int().nonnegative(),
    })
    .optional(),
}),
```

- [ ] **Step 2: Crawler 테스트 실행**

Run: `cd crawler && npx vitest run`
Expected: PASS (기존 테스트 회귀 없음 — optional 필드 추가)

- [ ] **Step 3: Commit**

```bash
git add crawler/src/schemas/snapshot.ts
git commit -m "feat(crawler): add optional nonNullCount to snapshot metadata schema"
```

### Task 2.2: Crawler to-prior에서 nonNullCount 계산

**Files:**
- Modify: `crawler/src/transformers/to-prior.ts`
- Modify: `crawler/src/index.ts` (metadata에 nonNullCount 주입)

- [ ] **Step 1: to-prior.ts에 helper 추가**

```ts
// crawler/src/transformers/to-prior.ts — 파일 끝에 추가
export function computeNonNullCount(games: TopGame[]): {
  retention_d1: number
  retention_d7: number
  retention_d30: number
  monthlyRevenueUsd: number
  monthlyDownloads: number
} {
  return {
    retention_d1: games.filter((g) => typeof g.retention.d1 === "number").length,
    retention_d7: games.filter((g) => typeof g.retention.d7 === "number").length,
    retention_d30: games.filter((g) => typeof g.retention.d30 === "number").length,
    monthlyRevenueUsd: games.filter((g) => typeof g.revenue.last90dTotalUsd === "number").length,
    monthlyDownloads: games.filter((g) => typeof g.downloads.last90dTotal === "number").length,
  }
}
```

- [ ] **Step 2: index.ts에서 snapshot.metadata에 주입**

위치: `crawler/src/index.ts`의 `const snapshot = { ... }` 블록. `metadata`에 `nonNullCount: computeNonNullCount(topGames)` 추가.

```ts
// crawler/src/index.ts
import { computeGenrePrior, computeNonNullCount } from "./transformers/to-prior.js"
// ...
const snapshot = {
  $schemaVersion: 1 as const,
  metadata: {
    fetchedAt: new Date().toISOString(),
    fetchedBy: "crawler@local",
    genre: targets.genre,
    region: targets.region,
    topN: topGames.length,
    tier: targets.chart,
    crawlerVersion: CRAWLER_VERSION,
    warnings,
    nonNullCount: computeNonNullCount(topGames),   // NEW
  },
  topGames,
  genrePrior,
}
```

- [ ] **Step 3: Typecheck**

Run: `cd crawler && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add crawler/src/transformers/to-prior.ts crawler/src/index.ts
git commit -m "feat(crawler): record nonNullCount per metric in snapshot metadata"
```

### Task 2.3: 기존 snapshot JSON 패치 (수동 한 번)

**Files:**
- Modify: `src/shared/api/data/sensor-tower/merge-jp-snapshot.json`

- [ ] **Step 1: 현재 snapshot의 실제 non-null count 확인**

Run:
```bash
python3 -c "
import json
d = json.load(open('src/shared/api/data/sensor-tower/merge-jp-snapshot.json'))
count = lambda field: sum(1 for g in d['topGames'] if g[field[0]][field[1]] is not None)
print('retention_d1:', count(('retention','d1')))
print('retention_d7:', count(('retention','d7')))
print('retention_d30:', count(('retention','d30')))
print('revenue:', count(('revenue','last90dTotalUsd')))
print('downloads:', count(('downloads','last90dTotal')))
"
```

Expected output: 5줄 숫자 (대략 16/16/16/20/20).

- [ ] **Step 2: snapshot.metadata.nonNullCount 추가 (수동)**

Edit `src/shared/api/data/sensor-tower/merge-jp-snapshot.json`: `metadata` 오브젝트의 `warnings` 배열 바로 뒤에 다음 추가:

```json
    "nonNullCount": {
      "retention_d1": <step1 결과>,
      "retention_d7": <step1 결과>,
      "retention_d30": <step1 결과>,
      "monthlyRevenueUsd": <step1 결과>,
      "monthlyDownloads": <step1 결과>
    }
```

- [ ] **Step 3: Commit**

```bash
git add src/shared/api/data/sensor-tower/merge-jp-snapshot.json
git commit -m "chore(data): backfill nonNullCount in current merge-jp snapshot"
```

### Task 2.4: prior-data.ts 재구성 — PriorBundle 타입 + /100 제거

**Files:**
- Modify: `src/shared/api/prior-data.ts`
- Test: `src/shared/api/__tests__/prior-data.test.ts`

- [ ] **Step 1: 실패 테스트 작성 (revenue 단위 회귀 방지)**

```ts
// src/shared/api/__tests__/prior-data.test.ts
import { describe, it, expect } from "vitest"
import { getPrior, listAvailablePriors } from "../prior-data"

describe("prior-data bundle", () => {
  it("Merge:JP bundle is available", () => {
    const keys = listAvailablePriors()
    expect(keys).toContainEqual({ genre: "Merge", region: "JP" })
  })

  it("getPrior returns bundle with effectiveN", () => {
    const bundle = getPrior({ genre: "Merge", region: "JP" })
    expect(bundle).not.toBeNull()
    expect(bundle!.effectiveN).toBeGreaterThan(0)
    expect(bundle!.effectiveN).toBeLessThanOrEqual(100)
  })

  it("revenue is in plain USD (not cents)", () => {
    // Merge×JP Top 20의 90일 수익 중간값은 $10M~$1B 범위 (cents 아님)
    const bundle = getPrior({ genre: "Merge", region: "JP" })!
    const revenueP50 = bundle.monthlyRevenueUsd.p50
    expect(revenueP50).toBeGreaterThan(1_000_000)
    expect(revenueP50).toBeLessThan(5_000_000_000)
  })

  it("retention values are fractions in [0,1]", () => {
    const bundle = getPrior({ genre: "Merge", region: "JP" })!
    expect(bundle.retention.d1.p50).toBeGreaterThan(0)
    expect(bundle.retention.d1.p50).toBeLessThan(1)
    expect(bundle.retention.d30.p50).toBeGreaterThan(0)
    expect(bundle.retention.d30.p50).toBeLessThan(1)
  })

  it("null-safe getPrior for unknown key", () => {
    expect(getPrior({ genre: "Unknown", region: "XX" })).toBeNull()
  })
})
```

- [ ] **Step 2: 테스트 실행 → FAIL (새 API 아직 없음)**

Run: `npx vitest run src/shared/api/__tests__/prior-data.test.ts`
Expected: FAIL

- [ ] **Step 3: prior-data.ts 재작성**

```ts
// src/shared/api/prior-data.ts (전체 재작성)
import { z } from "zod"
import snapshotJson from "./data/sensor-tower/merge-jp-snapshot.json"
import { computeEffectiveN, type EmpiricalDist } from "@/shared/lib/bayesian-stats"

const PercentileSchema = z.object({
  p10: z.number(),
  p50: z.number(),
  p90: z.number(),
})

const SnapshotSchema = z.object({
  $schemaVersion: z.literal(1),
  metadata: z.object({
    fetchedAt: z.string(),
    fetchedBy: z.string(),
    genre: z.string(),
    region: z.string(),
    topN: z.number(),
    tier: z.string(),
    crawlerVersion: z.string(),
    warnings: z.array(z.string()),
    nonNullCount: z
      .object({
        retention_d1: z.number().int().nonnegative(),
        retention_d7: z.number().int().nonnegative(),
        retention_d30: z.number().int().nonnegative(),
        monthlyRevenueUsd: z.number().int().nonnegative(),
        monthlyDownloads: z.number().int().nonnegative(),
      })
      .optional(),
  }),
  topGames: z.array(
    z.object({
      rank: z.number(),
      name: z.string(),
      publisher: z.string(),
      appIds: z.object({ ios: z.string().nullable(), android: z.string().nullable() }),
      downloads: z.object({
        last90dTotal: z.number().nullable(),
        monthly: z.array(z.object({ month: z.string(), value: z.number() })),
      }),
      revenue: z.object({
        last90dTotalUsd: z.number().nullable(),
        monthly: z.array(z.object({ month: z.string(), value: z.number() })),
      }),
      retention: z.object({
        d1: z.number().nullable(),
        d7: z.number().nullable(),
        d30: z.number().nullable(),
        sampleSize: z.string(),
        fetchedAt: z.string(),
      }),
    }),
  ),
  genrePrior: z.object({
    retention: z.object({
      d1: PercentileSchema,
      d7: PercentileSchema,
      d30: PercentileSchema,
    }),
    monthlyRevenueUsd: PercentileSchema,
    monthlyDownloads: PercentileSchema,
  }),
})

export type PriorBundleKey = { genre: string; region: string }

export type PriorBundle = {
  key: PriorBundleKey
  effectiveN: number
  fetchedAt: string
  ageDays: number
  isStale: boolean
  retention: { d1: EmpiricalDist; d7: EmpiricalDist; d30: EmpiricalDist }
  monthlyRevenueUsd: EmpiricalDist
  monthlyDownloads: EmpiricalDist
  nonNullCount: {
    retention_d1: number
    retention_d7: number
    retention_d30: number
    monthlyRevenueUsd: number
    monthlyDownloads: number
  }
  topGamesForAudit: z.infer<typeof SnapshotSchema>["topGames"]
  crawlerVersion: string
}

const STALE_DAYS = 14

function daysBetween(a: Date, b: Date): number {
  return Math.floor(Math.abs(a.getTime() - b.getTime()) / 86_400_000)
}

function buildBundle(raw: unknown): PriorBundle {
  const s = SnapshotSchema.parse(raw)
  const fetchedAtDate = new Date(s.metadata.fetchedAt)
  const ageDays = daysBetween(new Date(), fetchedAtDate)

  // Fallback when old snapshot lacks nonNullCount (runtime count from topGames)
  const nonNullCount = s.metadata.nonNullCount ?? {
    retention_d1: s.topGames.filter((g) => g.retention.d1 != null).length,
    retention_d7: s.topGames.filter((g) => g.retention.d7 != null).length,
    retention_d30: s.topGames.filter((g) => g.retention.d30 != null).length,
    monthlyRevenueUsd: s.topGames.filter((g) => g.revenue.last90dTotalUsd != null).length,
    monthlyDownloads: s.topGames.filter((g) => g.downloads.last90dTotal != null).length,
  }

  const minNonNull = Math.min(
    nonNullCount.retention_d1,
    nonNullCount.retention_d7,
    nonNullCount.retention_d30,
    nonNullCount.monthlyRevenueUsd,
  )

  return {
    key: { genre: s.metadata.genre, region: s.metadata.region },
    effectiveN: computeEffectiveN(minNonNull),
    fetchedAt: s.metadata.fetchedAt,
    ageDays,
    isStale: ageDays > STALE_DAYS,
    retention: s.genrePrior.retention,
    monthlyRevenueUsd: s.genrePrior.monthlyRevenueUsd,
    monthlyDownloads: s.genrePrior.monthlyDownloads,
    nonNullCount,
    topGamesForAudit: s.topGames,
    crawlerVersion: s.metadata.crawlerVersion,
  }
}

const bundles: Record<string, PriorBundle> = {
  "Merge:JP": buildBundle(snapshotJson),
}

export function getPrior(key: PriorBundleKey): PriorBundle | null {
  return bundles[`${key.genre}:${key.region}`] ?? null
}

export function listAvailablePriors(): PriorBundleKey[] {
  return Object.keys(bundles).map((k) => {
    const [genre, region] = k.split(":")
    return { genre, region }
  })
}
```

- [ ] **Step 4: 기존 사용처 호환 확인 (prior-posterior-chart.tsx)**

현재 `prior-posterior-chart.tsx`는 `priorByGenre.Merge.JP.retention`을 import 중. 이 파일은 Phase 7에서 교체하지만, 타입 체크 깨짐 방지를 위해 전이 경로 제공:

```ts
// src/shared/api/prior-data.ts 하단에 backward-compat export 추가
/** @deprecated — use getPrior({genre:"Merge",region:"JP"}) instead. Remaining usage in prior-posterior-chart.tsx will migrate in Phase 7. */
export const priorByGenre = {
  Merge: {
    JP: {
      retention: bundles["Merge:JP"]!.retention,
      monthlyRevenueUsd: bundles["Merge:JP"]!.monthlyRevenueUsd,
      monthlyDownloads: bundles["Merge:JP"]!.monthlyDownloads,
    },
  },
} as const

/** @deprecated */
export const priorMetadata = {
  fetchedAt: bundles["Merge:JP"]!.fetchedAt,
  genre: "Merge",
  region: "JP",
  warnings: [] as string[],
}

/** @deprecated */
export const priorTopGames = bundles["Merge:JP"]!.topGamesForAudit

/** @deprecated */
export function isPriorStale(maxDays = STALE_DAYS): boolean {
  return bundles["Merge:JP"]!.ageDays > maxDays
}

/** @deprecated */
export function priorAgeDays(): number {
  return bundles["Merge:JP"]!.ageDays
}
```

- [ ] **Step 5: 테스트 실행 → PASS**

Run: `npx vitest run src/shared/api/__tests__/prior-data.test.ts`
Expected: PASS (5개)

- [ ] **Step 6: 전체 타입 체크**

Run: `npx tsc --noEmit`
Expected: no new errors (기존 import 사용 코드는 deprecated export로 보호됨)

- [ ] **Step 7: Commit**

```bash
git add src/shared/api/prior-data.ts src/shared/api/__tests__/prior-data.test.ts
git commit -m "refactor(prior-data): PriorBundle with effectiveN, removed /100 revenue scaling"
```

---

## Phase 3: MMP Contract + AppsFlyer Adapter 이전

기존 `shared/api/appsflyer/` → `shared/api/mmp/appsflyer/`로 이동 후 vendor-neutral contract 추가.

### Task 3.1: AppsFlyer 디렉토리 이동 (git mv)

**Files:**
- Move: `src/shared/api/appsflyer/*` → `src/shared/api/mmp/appsflyer/*`

- [ ] **Step 1: mmp 디렉토리 생성 및 이동**

Run:
```bash
mkdir -p src/shared/api/mmp
git mv src/shared/api/appsflyer src/shared/api/mmp/appsflyer
```

- [ ] **Step 2: import 경로 일괄 업데이트**

Files referencing `@/shared/api/appsflyer` → `@/shared/api/mmp/appsflyer`. grep으로 확인:

Run: `grep -rn "shared/api/appsflyer" src/ --include="*.ts" --include="*.tsx"`

각 파일에서 경로 치환.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: 기존 AppsFlyer 테스트 실행**

Run: `npx vitest run src/shared/api/mmp/appsflyer`
Expected: PASS (모든 기존 테스트)

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(mmp): relocate appsflyer/ under mmp/ to prepare vendor-neutral contract"
```

### Task 3.2: MMP vendor-neutral types + schemas

**Files:**
- Create: `src/shared/api/mmp/types.ts`
- Create: `src/shared/api/mmp/schemas.ts`

- [ ] **Step 1: types 작성**

```ts
// src/shared/api/mmp/types.ts
import type { CredibleInterval, Validity } from "@/shared/lib/bayesian-stats"

export type MMPVendor = "appsflyer" | "adjust" | "singular" | "kochava" | "branch"

export type MMPCohortObservation = {
  cohortDate: string            // "2026-04-15"
  installs: number
  retainedByDay: {
    d1: number | null
    d7: number | null
    d30: number | null
  }
}

export type MMPRevenueObservation = {
  month: string                 // "2026-04"
  revenueUsd: number
  payingUsers?: number
}

// NOTE: We re-declare the full shape (not intersect with CredibleInterval) because
// intersecting `{mean: number}` with `{mean: number | null}` collapses to `number`.
// When validity.valid === false, mean/ci_low/ci_high are set to null.
export type CredibleIntervalWithValidity = {
  mean: number | null
  ci_low: number | null
  ci_high: number | null
  sampleSize: number
  validity: Validity
}

export type MMPSnapshotPosterior = {
  retention: {
    d1: CredibleIntervalWithValidity
    d7: CredibleIntervalWithValidity
    d30: CredibleIntervalWithValidity
  }
  monthlyRevenueUsd: CredibleIntervalWithValidity
  priorSource: {
    genre: string
    region: string
    priorFetchedAt: string
    priorSchemaVersion: 1
  }
  engineVersion: string
}

export type MMPSnapshot = {
  $schemaVersion: 2
  vendor: MMPVendor
  vendorApiVersion: string
  gameKey: string
  fetchedAt: string
  dateRange: { from: string; to: string }
  cohorts: MMPCohortObservation[]
  revenue: MMPRevenueObservation[]
  posterior: MMPSnapshotPosterior | null
  metadata: {
    warnings: string[]
    validity: {
      cohortsValid: boolean
      revenueValid: boolean
      reasonCodes: string[]
    }
    priorEngineRunAt: string | null
  }
}

export type MMPFetchOptions = {
  appId: string
  gameKey: string
  dateRange: { from: string; to: string }
}

export interface MMPAdapter {
  vendor: MMPVendor
  fetchRaw: (opts: MMPFetchOptions) => Promise<Omit<MMPSnapshot, "posterior" | "$schemaVersion">>
}
```

- [ ] **Step 2: schemas 작성**

```ts
// src/shared/api/mmp/schemas.ts
import { z } from "zod"

const ValiditySchema = z.discriminatedUnion("valid", [
  z.object({ valid: z.literal(true) }),
  z.object({
    valid: z.literal(false),
    reason: z.enum([
      "insufficient_installs",
      "insufficient_history",
      "prior_unavailable",
      "prior_invalid_n",
      "prior_degenerate",
      "prior_stale",
      "engine_error",
    ]),
    need: z.number().optional(),
    have: z.number().optional(),
    detail: z.string().optional(),
  }),
])

const CIWithValiditySchema = z.object({
  mean: z.number().nullable(),
  ci_low: z.number().nullable(),
  ci_high: z.number().nullable(),
  sampleSize: z.number().int().nonnegative(),
  validity: ValiditySchema,
})

const MMPCohortObservationSchema = z.object({
  cohortDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  installs: z.number().int().nonnegative(),
  retainedByDay: z.object({
    d1: z.number().int().nonnegative().nullable(),
    d7: z.number().int().nonnegative().nullable(),
    d30: z.number().int().nonnegative().nullable(),
  }),
})

const MMPRevenueObservationSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  revenueUsd: z.number().nonnegative(),
  payingUsers: z.number().int().nonnegative().optional(),
})

export const MMPSnapshotSchema = z.object({
  $schemaVersion: z.literal(2),
  vendor: z.enum(["appsflyer", "adjust", "singular", "kochava", "branch"]),
  vendorApiVersion: z.string(),
  gameKey: z.string().min(1),
  fetchedAt: z.string().datetime(),
  dateRange: z.object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
  cohorts: z.array(MMPCohortObservationSchema),
  revenue: z.array(MMPRevenueObservationSchema),
  posterior: z
    .object({
      retention: z.object({
        d1: CIWithValiditySchema,
        d7: CIWithValiditySchema,
        d30: CIWithValiditySchema,
      }),
      monthlyRevenueUsd: CIWithValiditySchema,
      priorSource: z.object({
        genre: z.string(),
        region: z.string(),
        priorFetchedAt: z.string().datetime(),
        priorSchemaVersion: z.literal(1),
      }),
      engineVersion: z.string(),
    })
    .nullable(),
  metadata: z.object({
    warnings: z.array(z.string()),
    validity: z.object({
      cohortsValid: z.boolean(),
      revenueValid: z.boolean(),
      reasonCodes: z.array(z.string()),
    }),
    priorEngineRunAt: z.string().datetime().nullable(),
  }),
})
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/shared/api/mmp/types.ts src/shared/api/mmp/schemas.ts
git commit -m "feat(mmp): vendor-neutral types and zod schema v2"
```

### Task 3.3: AppsFlyer KPI 수정 (route.ts + fetcher 경로)

**Files:**
- Modify: `src/app/api/appsflyer/sync/route.ts` (legacy, will deprecate in Phase 4)
- Note: 이 task에서는 KPI만 교정. route 자체는 Phase 4에서 /api/mmp/sync로 대체.

- [ ] **Step 1: cohort KPI 수정**

Edit `src/app/api/appsflyer/sync/route.ts`:

```ts
// 기존:
const cohort: CohortParams | null = dry_run
  ? null
  : {
      appId,
      from,
      to,
      cohortType: "user_acquisition",
      groupings: ["pid"],
      kpis: ["retention_day_0", "retention_day_1", "retention_day_3"],
    }

// 수정 후:
const cohort: CohortParams | null = dry_run
  ? null
  : {
      appId,
      from,
      to,
      cohortType: "user_acquisition",
      groupings: [],    // 전체 코호트
      kpis: [
        "retention_day_1",
        "retention_day_7",
        "retention_day_30",
        "users_day_1",
        "users_day_7",
        "users_day_30",
      ],
    }
```

- [ ] **Step 2: 윈도우 수정 (어제 기준 30일)**

```ts
// 기존 windowFromNow를 다음으로 교체
function windowFromNow(days: number): { from: string; to: string } {
  const now = new Date()
  const toDate = new Date(now)
  toDate.setUTCDate(toDate.getUTCDate() - 1)   // yesterday
  const fromDate = new Date(toDate)
  fromDate.setUTCDate(fromDate.getUTCDate() - (days - 1))
  return { from: fromDate.toISOString().slice(0, 10), to: toDate.toISOString().slice(0, 10) }
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/app/api/appsflyer/sync/route.ts
git commit -m "fix(appsflyer): request D1/D7/D30 retention + users counts, align window with ST"
```

### Task 3.4: AppsFlyer adapter — raw rows → MMP observations

**Files:**
- Create: `src/shared/api/mmp/appsflyer/adapter.ts`
- Test: `src/shared/api/mmp/appsflyer/__tests__/adapter.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

```ts
// src/shared/api/mmp/appsflyer/__tests__/adapter.test.ts
import { describe, it, expect } from "vitest"
import { cohortRowsToObservations, masterRowsToRevenue } from "../adapter"

describe("AppsFlyer adapter", () => {
  describe("cohortRowsToObservations", () => {
    it("extracts installs + retained counts per cohort", () => {
      const rows = [
        {
          install_date: "2026-04-15",
          users: 100,
          users_day_1: 60,
          users_day_7: 25,
          users_day_30: 10,
        },
      ]
      const obs = cohortRowsToObservations(rows)
      expect(obs).toEqual([
        {
          cohortDate: "2026-04-15",
          installs: 100,
          retainedByDay: { d1: 60, d7: 25, d30: 10 },
        },
      ])
    })

    it("nullifies missing day fields", () => {
      const rows = [{ install_date: "2026-04-15", users: 50, users_day_1: 30 }]
      const obs = cohortRowsToObservations(rows)
      expect(obs[0].retainedByDay).toEqual({ d1: 30, d7: null, d30: null })
    })

    it("skips rows without install_date or users", () => {
      const rows = [
        { install_date: "2026-04-15", users: 100, users_day_1: 60 },
        { users: 50, users_day_1: 20 },           // no install_date
        { install_date: "2026-04-16" },           // no users
      ]
      expect(cohortRowsToObservations(rows).length).toBe(1)
    })
  })

  describe("masterRowsToRevenue", () => {
    it("aggregates per-month revenue in USD", () => {
      const rows = [
        { date: "2026-04-01", revenue: 1000 },
        { date: "2026-04-15", revenue: 2500 },
        { date: "2026-03-20", revenue: 1500 },
      ]
      const rev = masterRowsToRevenue(rows)
      expect(rev).toContainEqual({ month: "2026-04", revenueUsd: 3500 })
      expect(rev).toContainEqual({ month: "2026-03", revenueUsd: 1500 })
    })
  })
})
```

- [ ] **Step 2: 테스트 실행 → FAIL**

Run: `npx vitest run src/shared/api/mmp/appsflyer/__tests__/adapter.test.ts`
Expected: FAIL

- [ ] **Step 3: 구현 작성**

```ts
// src/shared/api/mmp/appsflyer/adapter.ts
import type { MMPCohortObservation, MMPRevenueObservation } from "../types"
import type { CohortRow, MasterRow } from "./types"

function numOrNull(v: unknown): number | null {
  return typeof v === "number" && !Number.isNaN(v) ? v : null
}

function numOrZero(v: unknown): number {
  return typeof v === "number" && !Number.isNaN(v) ? v : 0
}

export function cohortRowsToObservations(rows: CohortRow[]): MMPCohortObservation[] {
  const out: MMPCohortObservation[] = []
  for (const row of rows) {
    const cohortDate = typeof row.install_date === "string" ? row.install_date : null
    const installs = numOrNull(row.users)
    if (!cohortDate || installs == null) continue
    out.push({
      cohortDate,
      installs,
      retainedByDay: {
        d1: numOrNull(row.users_day_1),
        d7: numOrNull(row.users_day_7),
        d30: numOrNull(row.users_day_30),
      },
    })
  }
  return out
}

export function masterRowsToRevenue(rows: MasterRow[]): MMPRevenueObservation[] {
  const byMonth = new Map<string, number>()
  for (const row of rows) {
    const dateStr = typeof row.date === "string" ? row.date : null
    if (!dateStr || dateStr.length < 7) continue
    const month = dateStr.slice(0, 7)
    const rev = numOrZero(row.revenue)
    byMonth.set(month, (byMonth.get(month) ?? 0) + rev)
  }
  const out: MMPRevenueObservation[] = []
  for (const [month, revenueUsd] of byMonth.entries()) {
    out.push({ month, revenueUsd })
  }
  return out.sort((a, b) => (a.month < b.month ? -1 : 1))
}
```

- [ ] **Step 4: 테스트 실행 → PASS**

Run: `npx vitest run src/shared/api/mmp/appsflyer/__tests__/adapter.test.ts`
Expected: PASS (4개)

- [ ] **Step 5: Commit**

```bash
git add src/shared/api/mmp/appsflyer/adapter.ts src/shared/api/mmp/appsflyer/__tests__/adapter.test.ts
git commit -m "feat(mmp/appsflyer): adapter for AF raw rows → MMP observations"
```

### Task 3.5: Posterior derive (vendor-neutral)

**Files:**
- Create: `src/shared/api/mmp/posterior-derive.ts`
- Test: `src/shared/api/mmp/__tests__/posterior-derive.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

```ts
// src/shared/api/mmp/__tests__/posterior-derive.test.ts
import { describe, it, expect } from "vitest"
import { derivePosterior, aggregateCohorts } from "../posterior-derive"
import type { PriorBundle } from "@/shared/api/prior-data"

const mockPrior: PriorBundle = {
  key: { genre: "Merge", region: "JP" },
  effectiveN: 16,
  fetchedAt: "2026-04-20T00:00:00.000Z",
  ageDays: 1,
  isStale: false,
  retention: {
    d1:  { p10: 0.32, p50: 0.58, p90: 0.70 },
    d7:  { p10: 0.14, p50: 0.27, p90: 0.39 },
    d30: { p10: 0.06, p50: 0.10, p90: 0.16 },
  },
  monthlyRevenueUsd: { p10: 1_000_000, p50: 10_000_000, p90: 100_000_000 },
  monthlyDownloads: { p10: 10_000, p50: 100_000, p90: 1_000_000 },
  nonNullCount: {
    retention_d1: 16, retention_d7: 16, retention_d30: 16,
    monthlyRevenueUsd: 20, monthlyDownloads: 20,
  },
  topGamesForAudit: [],
  crawlerVersion: "0.2.0",
}

describe("posterior-derive", () => {
  it("aggregateCohorts sums installs and retained across cohorts", () => {
    const agg = aggregateCohorts([
      { cohortDate: "2026-04-01", installs: 1000, retainedByDay: { d1: 600, d7: 250, d30: 100 } },
      { cohortDate: "2026-04-02", installs: 1500, retainedByDay: { d1: 900, d7: 400, d30: null } },
    ])
    expect(agg.installs).toBe(2500)
    expect(agg.retained_d1).toBe(1500)
    expect(agg.retained_d7).toBe(650)
    expect(agg.retained_d30).toBe(100)   // null is treated as 0, but installs for that cohort aren't counted for d30 denominator
    expect(agg.installs_d30).toBe(1000)  // only first cohort has D30 data
  })

  it("derivePosterior produces valid intervals when installs ≥ thresholds", () => {
    const cohorts = [
      { cohortDate: "2026-04-01", installs: 500, retainedByDay: { d1: 300, d7: 130, d30: 50 } },
    ]
    const revenue = [
      { month: "2026-01", revenueUsd: 5_000_000 },
      { month: "2026-02", revenueUsd: 6_000_000 },
      { month: "2026-03", revenueUsd: 7_000_000 },
    ]
    const post = derivePosterior(cohorts, revenue, mockPrior)

    expect(post).not.toBeNull()
    expect(post!.retention.d1.validity.valid).toBe(true)
    expect(post!.retention.d7.validity.valid).toBe(true)
    expect(post!.retention.d30.validity.valid).toBe(true)
    expect(post!.monthlyRevenueUsd.validity.valid).toBe(true)
    expect(post!.priorSource.genre).toBe("Merge")
    expect(post!.engineVersion).toMatch(/^bayesian-stats@/)
  })

  it("marks posterior invalid when insufficient installs", () => {
    const cohorts = [
      { cohortDate: "2026-04-01", installs: 10, retainedByDay: { d1: 5, d7: 2, d30: 1 } },
    ]
    const post = derivePosterior(cohorts, [], mockPrior)
    expect(post!.retention.d1.validity.valid).toBe(false)   // 10 < 25
    expect(post!.retention.d7.validity.valid).toBe(false)
    expect(post!.retention.d30.validity.valid).toBe(false)
    expect(post!.monthlyRevenueUsd.validity.valid).toBe(false)  // no revenue history
  })
})
```

- [ ] **Step 2: 테스트 실행 → FAIL**

Run: `npx vitest run src/shared/api/mmp/__tests__/posterior-derive.test.ts`
Expected: FAIL

- [ ] **Step 3: 구현 작성**

```ts
// src/shared/api/mmp/posterior-derive.ts
import {
  ENGINE_VERSION,
  betaBinomialModel,
  lognormalModel,
  validateRetentionPosterior,
  validateRevenuePosterior,
  type CredibleInterval,
  type Validity,
} from "@/shared/lib/bayesian-stats"
import type { PriorBundle } from "@/shared/api/prior-data"
import type {
  MMPCohortObservation,
  MMPRevenueObservation,
  MMPSnapshotPosterior,
  CredibleIntervalWithValidity,
} from "./types"

export type AggregatedCohorts = {
  installs: number
  installs_d1: number
  installs_d7: number
  installs_d30: number
  retained_d1: number
  retained_d7: number
  retained_d30: number
}

export function aggregateCohorts(cohorts: MMPCohortObservation[]): AggregatedCohorts {
  let installs = 0
  let installs_d1 = 0, installs_d7 = 0, installs_d30 = 0
  let retained_d1 = 0, retained_d7 = 0, retained_d30 = 0
  for (const c of cohorts) {
    installs += c.installs
    if (c.retainedByDay.d1 != null) { installs_d1 += c.installs; retained_d1 += c.retainedByDay.d1 }
    if (c.retainedByDay.d7 != null) { installs_d7 += c.installs; retained_d7 += c.retainedByDay.d7 }
    if (c.retainedByDay.d30 != null) { installs_d30 += c.installs; retained_d30 += c.retainedByDay.d30 }
  }
  return { installs, installs_d1, installs_d7, installs_d30, retained_d1, retained_d7, retained_d30 }
}

function wrap(result: CredibleInterval, v: Validity): CredibleIntervalWithValidity {
  return { ...result, validity: v }
}

function invalid(v: Validity): CredibleIntervalWithValidity {
  return { mean: null, ci_low: null, ci_high: null, sampleSize: 0, validity: v }
}

export function derivePosterior(
  cohorts: MMPCohortObservation[],
  revenue: MMPRevenueObservation[],
  prior: PriorBundle,
): MMPSnapshotPosterior | null {
  const agg = aggregateCohorts(cohorts)

  const priorParams = {
    d1: betaBinomialModel.priorFromEmpirical(prior.retention.d1, prior.effectiveN),
    d7: betaBinomialModel.priorFromEmpirical(prior.retention.d7, prior.effectiveN),
    d30: betaBinomialModel.priorFromEmpirical(prior.retention.d30, prior.effectiveN),
  }
  const revPriorParams = lognormalModel.priorFromEmpirical(prior.monthlyRevenueUsd, prior.effectiveN)

  const computeRetention = (day: 1 | 7 | 30, installs: number, retained: number): CredibleIntervalWithValidity => {
    const v = validateRetentionPosterior({ installs, retained }, day)
    if (!v.valid) return invalid(v)
    return wrap(betaBinomialModel.posterior(priorParams[`d${day}`], { n: installs, k: retained }), v)
  }

  const revenueObs = revenue.map((r) => r.revenueUsd)
  const revValidity = validateRevenuePosterior({ monthlyRevenueUsd: revenueObs, monthsCount: revenue.length })
  const revenuePosterior: CredibleIntervalWithValidity = revValidity.valid
    ? wrap(lognormalModel.posterior(revPriorParams, { monthlyRevenueUsd: revenueObs, monthsCount: revenue.length }), revValidity)
    : invalid(revValidity)

  return {
    retention: {
      d1: computeRetention(1, agg.installs_d1, agg.retained_d1),
      d7: computeRetention(7, agg.installs_d7, agg.retained_d7),
      d30: computeRetention(30, agg.installs_d30, agg.retained_d30),
    },
    monthlyRevenueUsd: revenuePosterior,
    priorSource: {
      genre: prior.key.genre,
      region: prior.key.region,
      priorFetchedAt: prior.fetchedAt,
      priorSchemaVersion: 1,
    },
    engineVersion: ENGINE_VERSION,
  }
}
```

- [ ] **Step 4: 테스트 실행 → PASS**

Run: `npx vitest run src/shared/api/mmp/__tests__/posterior-derive.test.ts`
Expected: PASS (3개)

- [ ] **Step 5: Commit**

```bash
git add src/shared/api/mmp/posterior-derive.ts src/shared/api/mmp/__tests__/posterior-derive.test.ts
git commit -m "feat(mmp): posterior-derive connects cohorts+revenue+prior to Bayesian engine"
```

### Task 3.6: MMP snapshot storage (atomic read/write + lock)

**Files:**
- Create: `src/shared/api/mmp/snapshot.ts`
- Create: `src/shared/api/mmp/lock.ts`

- [ ] **Step 1: lock.ts 작성 (crawler/lockfile 패턴 재사용)**

```ts
// src/shared/api/mmp/lock.ts
import { existsSync, readFileSync, writeFileSync, unlinkSync } from "node:fs"
import { resolve } from "node:path"

const LOCK_PATH = resolve(".mmp.lock")
const STALE_MS = 30 * 60_000   // 30 minutes

type LockBody = { pid: number; acquiredAt: string }

export function acquireLock(): boolean {
  if (existsSync(LOCK_PATH)) {
    try {
      const body = JSON.parse(readFileSync(LOCK_PATH, "utf8")) as LockBody
      const ageMs = Date.now() - new Date(body.acquiredAt).getTime()
      if (ageMs < STALE_MS) return false
    } catch {
      // malformed — treat as stale
    }
  }
  writeFileSync(LOCK_PATH, JSON.stringify({ pid: process.pid, acquiredAt: new Date().toISOString() }))
  return true
}

export function releaseLock(): void {
  try {
    if (existsSync(LOCK_PATH)) unlinkSync(LOCK_PATH)
  } catch {
    /* best-effort */
  }
}
```

- [ ] **Step 2: snapshot.ts 작성**

```ts
// src/shared/api/mmp/snapshot.ts
import { writeFileSync, readFileSync, renameSync, mkdirSync, existsSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { MMPSnapshotSchema } from "./schemas"
import type { MMPSnapshot } from "./types"

const DATA_DIR = resolve("src/shared/api/data/mmp")

function snapshotPath(gameKey: string): string {
  return resolve(DATA_DIR, `${gameKey}-mmp-snapshot.json`)
}

export function writeSnapshotAtomic(snapshot: MMPSnapshot): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
  const finalPath = snapshotPath(snapshot.gameKey)
  const tmpPath = `${finalPath}.tmp-${process.pid}`
  const parsed = MMPSnapshotSchema.parse(snapshot)  // throws on schema mismatch
  writeFileSync(tmpPath, JSON.stringify(parsed, null, 2))
  renameSync(tmpPath, finalPath)
}

export function readSnapshot(gameKey: string): MMPSnapshot | null {
  const p = snapshotPath(gameKey)
  if (!existsSync(p)) return null
  try {
    const raw = JSON.parse(readFileSync(p, "utf8"))
    return MMPSnapshotSchema.parse(raw)
  } catch {
    return null
  }
}
```

- [ ] **Step 3: 타입 체크**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/shared/api/mmp/snapshot.ts src/shared/api/mmp/lock.ts
git commit -m "feat(mmp): atomic snapshot writer and sync lockfile"
```

### Task 3.7: MMP index barrel

**Files:**
- Create: `src/shared/api/mmp/index.ts`

- [ ] **Step 1: 작성**

```ts
// src/shared/api/mmp/index.ts
export * from "./types"
export { MMPSnapshotSchema } from "./schemas"
export { derivePosterior, aggregateCohorts } from "./posterior-derive"
export { writeSnapshotAtomic, readSnapshot } from "./snapshot"
export { acquireLock, releaseLock } from "./lock"
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/shared/api/mmp/index.ts
git commit -m "feat(mmp): public barrel"
```

---

## Phase 4: Game Registry + MMP Sync Route

### Task 4.1: game-registry.ts

**Files:**
- Create: `src/shared/api/game-registry.ts`

- [ ] **Step 1: 작성**

```ts
// src/shared/api/game-registry.ts
import type { MMPVendor } from "./mmp/types"

export type GameRegistryEntry = {
  gameKey: string
  displayName: string
  genre: string
  region: string
  mmpVendor: MMPVendor
  mmpAppIdEnv: string   // env variable name, NOT the value
}

const registry: Record<string, GameRegistryEntry> = {
  "poco-merge": {
    gameKey: "poco-merge",
    displayName: "Poco Merge",
    genre: "Merge",
    region: "JP",
    mmpVendor: "appsflyer",
    mmpAppIdEnv: "POCO_MERGE_APPSFLYER_APP_ID",
  },
}

export function getGameRegistryEntry(gameKey: string): GameRegistryEntry | null {
  return registry[gameKey] ?? null
}

export function listRegisteredGames(): GameRegistryEntry[] {
  return Object.values(registry)
}
```

- [ ] **Step 2: Commit**

```bash
git add src/shared/api/game-registry.ts
git commit -m "feat(game-registry): single-entry registry for Poco Merge"
```

### Task 4.2: POST /api/mmp/sync route

**Files:**
- Create: `src/app/api/mmp/sync/route.ts`

- [ ] **Step 1: route 작성**

```ts
// src/app/api/mmp/sync/route.ts
import { NextResponse } from "next/server"
import { z } from "zod"
import { getGameRegistryEntry } from "@/shared/api/game-registry"
import { getPrior } from "@/shared/api/prior-data"
import { validatePriorBasic } from "@/shared/lib/bayesian-stats"
import { derivePosterior, writeSnapshotAtomic, acquireLock, releaseLock } from "@/shared/api/mmp"
import type { MMPSnapshot } from "@/shared/api/mmp/types"
import { runAppsFlyerSync } from "@/shared/api/mmp/appsflyer"
import { cohortRowsToObservations, masterRowsToRevenue } from "@/shared/api/mmp/appsflyer/adapter"

export const runtime = "nodejs"

const BodySchema = z.object({
  gameKey: z.string().min(1),
  dryRun: z.boolean().optional(),
})

function windowFromNow(days: number): { from: string; to: string } {
  const now = new Date()
  const toDate = new Date(now)
  toDate.setUTCDate(toDate.getUTCDate() - 1)
  const fromDate = new Date(toDate)
  fromDate.setUTCDate(fromDate.getUTCDate() - (days - 1))
  return { from: fromDate.toISOString().slice(0, 10), to: toDate.toISOString().slice(0, 10) }
}

export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, code: "bad_request" }, { status: 400 })
  }
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, code: "bad_request", issue: parsed.error.issues[0] }, { status: 400 })
  }
  const { gameKey, dryRun } = parsed.data

  const entry = getGameRegistryEntry(gameKey)
  if (!entry) {
    return NextResponse.json({ ok: false, code: "unknown_game", gameKey }, { status: 404 })
  }

  const prior = getPrior({ genre: entry.genre, region: entry.region })
  if (!prior) {
    return NextResponse.json(
      { ok: false, code: "prior_unavailable", detail: { genre: entry.genre, region: entry.region } },
      { status: 424 },
    )
  }
  for (const metric of ["retention_d1", "retention_d7", "retention_d30", "monthlyRevenueUsd"] as const) {
    const dist = metric === "monthlyRevenueUsd" ? prior.monthlyRevenueUsd : prior.retention[metric.replace("retention_", "") as "d1" | "d7" | "d30"]
    const v = validatePriorBasic({
      nonNullCount: prior.nonNullCount[metric],
      p10: dist.p10, p50: dist.p50, p90: dist.p90,
      ageDays: prior.ageDays,
    })
    if (!v.valid) {
      return NextResponse.json({ ok: false, code: "prior_invalid", metric, reason: v.reason }, { status: 424 })
    }
  }

  const devToken = process.env.APPSFLYER_DEV_TOKEN
  const appId = process.env[entry.mmpAppIdEnv]
  if (!devToken || !appId) {
    return NextResponse.json({ ok: false, code: "mmp_auth_error", vendor: entry.mmpVendor }, { status: 424 })
  }

  if (!acquireLock()) {
    return NextResponse.json({ ok: false, code: "sync_in_progress" }, { status: 409 })
  }

  try {
    const { from, to } = windowFromNow(30)
    const { snapshot: afSnap } = await runAppsFlyerSync({
      devToken,
      appIds: [appId],
      homeCurrency: "USD",
      master: { appId, reportType: "daily_report", from, to, groupings: [], kpis: ["installs", "revenue", "cost"] },
      cohort: {
        appId, from, to,
        cohortType: "user_acquisition",
        groupings: [],
        kpis: ["retention_day_1","retention_day_7","retention_day_30","users_day_1","users_day_7","users_day_30"],
      },
    })

    const cohorts = cohortRowsToObservations(afSnap.cohort?.rows ?? [])
    const revenue = masterRowsToRevenue(afSnap.master?.rows ?? [])
    const posterior = derivePosterior(cohorts, revenue, prior)

    const mmpSnap: MMPSnapshot = {
      $schemaVersion: 2,
      vendor: entry.mmpVendor,
      vendorApiVersion: "appsflyer/cohorts-v1",
      gameKey: entry.gameKey,
      fetchedAt: new Date().toISOString(),
      dateRange: { from, to },
      cohorts,
      revenue,
      posterior,
      metadata: {
        warnings: [],
        validity: {
          cohortsValid: cohorts.length > 0,
          revenueValid: revenue.length >= 3,
          reasonCodes: [],
        },
        priorEngineRunAt: new Date().toISOString(),
      },
    }

    if (!dryRun) writeSnapshotAtomic(mmpSnap)

    return NextResponse.json({ ok: true, snapshot: dryRun ? mmpSnap : { gameKey, fetchedAt: mmpSnap.fetchedAt } })
  } catch (err) {
    const msg = (err as Error).message
    return NextResponse.json({ ok: false, code: "engine_error", detail: msg }, { status: 500 })
  } finally {
    releaseLock()
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/app/api/mmp/sync/route.ts
git commit -m "feat(mmp): POST /api/mmp/sync — vendor-neutral entry with prior+posterior orchestration"
```

### Task 4.3: Legacy AppsFlyer route deprecated-but-kept

**Files:**
- Modify: `src/app/api/appsflyer/sync/route.ts`

- [ ] **Step 1: 경고 로그 + /api/mmp/sync 안내 추가**

Insert at top of `POST` handler:

```ts
// DEPRECATED: use /api/mmp/sync with { gameKey: "poco-merge" } instead.
// Kept for legacy pipelines; will be removed after feat/bayesian-stats-engine stabilizes.
console.warn("[DEPRECATED] /api/appsflyer/sync called — migrate to /api/mmp/sync")
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/appsflyer/sync/route.ts
git commit -m "chore(appsflyer): mark /api/appsflyer/sync deprecated in favor of /api/mmp/sync"
```

### Task 4.4: CLI — scripts/mmp-sync.ts

**Files:**
- Create: `scripts/mmp-sync.ts`

- [ ] **Step 1: 작성**

```ts
// scripts/mmp-sync.ts
import "dotenv/config"
import { listRegisteredGames } from "@/shared/api/game-registry"

const DEFAULT_URL = process.env.MMP_SYNC_URL ?? "http://localhost:3000/api/mmp/sync"
const DRY_RUN = process.argv.includes("--dry-run")

async function main() {
  const games = listRegisteredGames()
  if (games.length === 0) {
    console.error("No games registered in game-registry.")
    process.exit(1)
  }
  for (const g of games) {
    console.log(`[mmp:sync] ${g.gameKey} (vendor=${g.mmpVendor}, prior=${g.genre}:${g.region})`)
    const res = await fetch(DEFAULT_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ gameKey: g.gameKey, dryRun: DRY_RUN }),
    })
    const json = await res.json()
    console.log(`  status: ${res.status}`, json.ok ? "✓" : `✗ ${json.code}`)
  }
}

main().catch((e) => {
  console.error("[mmp:sync] failure:", e)
  process.exit(1)
})
```

- [ ] **Step 2: package.json scripts 추가**

Add to `package.json` `scripts`:

```jsonc
"mmp:sync":     "tsx scripts/mmp-sync.ts",
"mmp:sync:dry": "tsx scripts/mmp-sync.ts --dry-run"
```

- [ ] **Step 3: Commit**

```bash
git add scripts/mmp-sync.ts package.json
git commit -m "feat(mmp): CLI script to trigger sync for all registered games"
```

### Task 4.5: .gitignore for mmp.lock and logs

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: .gitignore 추가**

Append to `.gitignore`:

```
# MMP sync artifacts
.mmp.lock
logs/mmp-sync-*.jsonl
```

- [ ] **Step 2: Commit**

```bash
git add .gitignore
git commit -m "chore: gitignore mmp sync lockfile and logs"
```

---

## Phase 5: Data Placeholder

### Task 5.1: Poco Merge placeholder snapshot

**Files:**
- Create: `src/shared/api/data/mmp/poco-merge-mmp-snapshot.json`

- [ ] **Step 1: placeholder 파일 생성**

```bash
mkdir -p src/shared/api/data/mmp
cat > src/shared/api/data/mmp/poco-merge-mmp-snapshot.json << 'JSON'
{
  "$schemaVersion": 2,
  "vendor": "appsflyer",
  "vendorApiVersion": "appsflyer/cohorts-v1",
  "gameKey": "poco-merge",
  "fetchedAt": "1970-01-01T00:00:00.000Z",
  "dateRange": { "from": "1970-01-01", "to": "1970-01-01" },
  "cohorts": [],
  "revenue": [],
  "posterior": null,
  "metadata": {
    "warnings": ["placeholder — awaiting first MMP sync"],
    "validity": {
      "cohortsValid": false,
      "revenueValid": false,
      "reasonCodes": ["no_sync_yet"]
    },
    "priorEngineRunAt": null
  }
}
JSON
```

- [ ] **Step 2: Schema 검증 테스트**

Run:
```bash
npx tsx -e "
import { MMPSnapshotSchema } from './src/shared/api/mmp/schemas'
import fs from 'node:fs'
const raw = JSON.parse(fs.readFileSync('src/shared/api/data/mmp/poco-merge-mmp-snapshot.json', 'utf8'))
console.log(MMPSnapshotSchema.parse(raw).gameKey === 'poco-merge' ? 'OK' : 'FAIL')
"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add src/shared/api/data/mmp/poco-merge-mmp-snapshot.json
git commit -m "chore(data): placeholder poco-merge MMP snapshot (awaiting first sync)"
```

---

## Phase 6: Market Signal "unavailable" state

### Task 6.1: Extend MarketSignal type

**Files:**
- Modify: `src/shared/lib/market-signal.ts`
- Test: `src/shared/lib/__tests__/market-signal.test.ts` (create if missing)

- [ ] **Step 1: 실패 테스트 작성**

```ts
// src/shared/lib/__tests__/market-signal.test.ts
import { describe, it, expect } from "vitest"
import { computeMarketSignal, computeMarketSignalSafe } from "../market-signal"

describe("computeMarketSignalSafe", () => {
  it("returns unavailable when prior is invalid", () => {
    const r = computeMarketSignalSafe({
      priorValidity: { valid: false, reason: "prior_stale" },
      postValidity: { valid: true },
      prior: 20, posterior: 25,
    })
    expect(r.signal).toBe("unavailable")
    expect(r.reason).toContain("prior")
  })

  it("returns unavailable when posterior is invalid", () => {
    const r = computeMarketSignalSafe({
      priorValidity: { valid: true },
      postValidity: { valid: false, reason: "insufficient_installs" },
      prior: 20, posterior: 25,
    })
    expect(r.signal).toBe("unavailable")
    expect(r.reason).toContain("posterior")
  })

  it("delegates to computeMarketSignal when both valid", () => {
    const r = computeMarketSignalSafe({
      priorValidity: { valid: true },
      postValidity: { valid: true },
      prior: 20, posterior: 25,
    })
    expect(["invest", "hold", "reduce"]).toContain(r.signal)
  })
})
```

- [ ] **Step 2: FAIL**

Run: `npx vitest run src/shared/lib/__tests__/market-signal.test.ts`

- [ ] **Step 3: 구현**

```ts
// src/shared/lib/market-signal.ts — 기존 파일에 추가
import type { Validity } from "@/shared/lib/bayesian-stats"

export type MarketSignal = "invest" | "hold" | "reduce" | "unavailable"

export type MarketSignalResult = {
  signal: MarketSignal
  deltaPct: number | null
  direction: "above" | "at" | "below" | "unknown"
  reason?: string
}

// 기존 computeMarketSignal 함수 반환 타입 업데이트: deltaPct: number | null, direction에 "unknown" 추가
// (코드 본체는 변경 없이, unavailable 분기를 처리하지 않으므로 null 반환 안 함)

export function computeMarketSignalSafe(args: {
  priorValidity: Validity
  postValidity: Validity
  prior: number
  posterior: number
}): MarketSignalResult {
  if (!args.priorValidity.valid) {
    return { signal: "unavailable", deltaPct: null, direction: "unknown", reason: `prior:${args.priorValidity.reason}` }
  }
  if (!args.postValidity.valid) {
    return { signal: "unavailable", deltaPct: null, direction: "unknown", reason: `posterior:${args.postValidity.reason}` }
  }
  return computeMarketSignal(args.prior, args.posterior)
}
```

- [ ] **Step 4: PASS**

Run: `npx vitest run src/shared/lib/__tests__/market-signal.test.ts`
Expected: PASS

- [ ] **Step 5: 기존 시그널 소비처 타입 호환 확인**

Run: `npx tsc --noEmit`
Expected: no errors (existing callers that don't need `unavailable` branch still work).

- [ ] **Step 6: Commit**

```bash
git add src/shared/lib/market-signal.ts src/shared/lib/__tests__/market-signal.test.ts
git commit -m "feat(market-signal): add 'unavailable' state and computeMarketSignalSafe wrapper"
```

---

## Phase 7: UI Integration

### Task 7.1: posterior-data.ts

**Files:**
- Create: `src/shared/api/posterior-data.ts`

- [ ] **Step 1: 작성**

```ts
// src/shared/api/posterior-data.ts
import pocoMergeSnap from "./data/mmp/poco-merge-mmp-snapshot.json"
import { MMPSnapshotSchema } from "./mmp/schemas"
import type { MMPSnapshot } from "./mmp/types"

type GameKey = "poco-merge"

const snapshots: Record<GameKey, MMPSnapshot | null> = {
  "poco-merge": safeParse(pocoMergeSnap),
}

function safeParse(raw: unknown): MMPSnapshot | null {
  try { return MMPSnapshotSchema.parse(raw) } catch { return null }
}

export function getPosterior(gameKey: GameKey): MMPSnapshot | null {
  return snapshots[gameKey] ?? null
}

export function hasLivePosterior(gameKey: GameKey): boolean {
  const s = snapshots[gameKey]
  return !!(s && s.posterior && new Date(s.fetchedAt).getTime() > 0)
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/shared/api/posterior-data.ts
git commit -m "feat(api): posterior-data module with build-time MMP snapshot load"
```

### Task 7.2: build-rows for PriorPosteriorChart

**Files:**
- Create: `src/shared/lib/bayesian-stats/build-rows.ts`

- [ ] **Step 1: 작성**

```ts
// src/shared/lib/bayesian-stats/build-rows.ts
import { betaBinomialModel } from "./beta-binomial"
import { lognormalModel } from "./lognormal"
import type { PriorBundle } from "@/shared/api/prior-data"
import type { MMPSnapshot } from "@/shared/api/mmp/types"

export type PriorPosteriorRow = {
  metric: string
  prior: { mean: number; ci_low: number; ci_high: number }
  posterior: { mean: number | null; ci_low: number | null; ci_high: number | null }
  validity: { valid: boolean; reason?: string }
}

/** Build UI-ready rows from prior bundle + MMP snapshot. Retention as percent (×100). */
export function buildPriorPosteriorRows(args: {
  prior: PriorBundle
  snapshot: MMPSnapshot
}): PriorPosteriorRow[] {
  const { prior, snapshot } = args
  const rows: PriorPosteriorRow[] = []
  if (!snapshot.posterior) return rows

  const retentionDays: Array<"d1" | "d7" | "d30"> = ["d1", "d7", "d30"]
  const labels: Record<string, string> = { d1: "D1 Retention", d7: "D7 Retention", d30: "D30 Retention" }

  for (const day of retentionDays) {
    const priorParams = betaBinomialModel.priorFromEmpirical(prior.retention[day], prior.effectiveN)
    const priorInterval = betaBinomialModel.priorAsInterval(priorParams)
    const post = snapshot.posterior.retention[day]
    rows.push({
      metric: labels[day],
      prior: {
        mean: priorInterval.mean * 100,
        ci_low: priorInterval.ci_low * 100,
        ci_high: priorInterval.ci_high * 100,
      },
      posterior: {
        mean: post.mean != null ? post.mean * 100 : null,
        ci_low: post.ci_low != null ? post.ci_low * 100 : null,
        ci_high: post.ci_high != null ? post.ci_high * 100 : null,
      },
      validity: post.validity.valid ? { valid: true } : { valid: false, reason: post.validity.reason },
    })
  }

  // revenue row (USD, not percent)
  const revPriorParams = lognormalModel.priorFromEmpirical(prior.monthlyRevenueUsd, prior.effectiveN)
  const revPriorInterval = lognormalModel.priorAsInterval(revPriorParams)
  const revPost = snapshot.posterior.monthlyRevenueUsd
  rows.push({
    metric: "Monthly Revenue (USD)",
    prior: { mean: revPriorInterval.mean, ci_low: revPriorInterval.ci_low, ci_high: revPriorInterval.ci_high },
    posterior: { mean: revPost.mean, ci_low: revPost.ci_low, ci_high: revPost.ci_high },
    validity: revPost.validity.valid ? { valid: true } : { valid: false, reason: revPost.validity.reason },
  })

  return rows
}
```

- [ ] **Step 2: barrel export 추가**

```ts
// src/shared/lib/bayesian-stats/index.ts — 기존에 추가
export { buildPriorPosteriorRows } from "./build-rows"
export type { PriorPosteriorRow } from "./build-rows"
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/shared/lib/bayesian-stats/build-rows.ts src/shared/lib/bayesian-stats/index.ts
git commit -m "feat(bayesian-stats): build UI rows from prior bundle + MMP snapshot"
```

### Task 7.3: PriorPosteriorChart source prop + invalid badge

**Files:**
- Modify: `src/widgets/charts/ui/prior-posterior-chart.tsx`

- [ ] **Step 1: props 확장 + validity 처리**

Edit `prior-posterior-chart.tsx`:

```ts
// type PriorPosteriorChartProps
type PriorPosteriorChartProps = {
  data: (PriorPosterior & { validity?: { valid: boolean; reason?: string } })[]
  source?: "live" | "mock"
}
```

기존 렌더링 루프에서 `item.validity?.valid === false` 체크 후:
- posterior 영역 blank
- "보류 — 데이터 부족" 배지 (gray `--signal-pending`)

```tsx
{item.validity && !item.validity.valid ? (
  <div className="flex items-center gap-2 text-xs text-[var(--signal-pending)]">
    <span className="px-2 py-0.5 rounded-[var(--radius-inline)] border border-[var(--signal-pending)]">
      보류
    </span>
    <span>{item.validity.reason ?? "데이터 부족"}</span>
  </div>
) : (
  /* 기존 posterior 밴드 렌더링 */
)}
```

Source 배지 (상단):
```tsx
{source === "live" ? (
  <span className="text-xs text-[var(--fg-2)]">실데이터 (MMP)</span>
) : (
  <span className="text-xs text-[var(--fg-3)]">mock 데이터</span>
)}
```

- [ ] **Step 2: typecheck**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/widgets/charts/ui/prior-posterior-chart.tsx
git commit -m "feat(chart): prior-posterior source prop and validity badge"
```

### Task 7.4: market-gap page — live/mock branch + ISR

**Files:**
- Modify: `src/app/(dashboard)/dashboard/market-gap/page.tsx`

- [ ] **Step 1: ISR revalidate 추가**

File top:
```ts
export const revalidate = 3600
```

- [ ] **Step 2: live/mock 분기**

기존 `<PriorPosteriorChart data={mockPriorPosterior} />` 교체:

```tsx
import { hasLivePosterior, getPosterior } from "@/shared/api/posterior-data"
import { getPrior } from "@/shared/api/prior-data"
import { buildPriorPosteriorRows } from "@/shared/lib/bayesian-stats"

// inside component
const livePrior = getPrior({ genre: "Merge", region: "JP" })
const liveSnap  = getPosterior("poco-merge")
const useLive   = hasLivePosterior("poco-merge") && livePrior && liveSnap
const chartRows = useLive
  ? buildPriorPosteriorRows({ prior: livePrior!, snapshot: liveSnap! })
  : mockPriorPosterior.map((r) => ({ ...r, validity: { valid: true } as const }))

<PriorPosteriorChart data={chartRows} source={useLive ? "live" : "mock"} />
```

- [ ] **Step 3: typecheck**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add "src/app/(dashboard)/dashboard/market-gap/page.tsx"
git commit -m "feat(market-gap): live MMP posterior with mock fallback + hourly ISR"
```

### Task 7.5: Methodology modal extension

**Files:**
- Modify: `src/shared/ui/methodology-modal.tsx`

- [ ] **Step 1: 4 섹션 블록 추가 (Prior / Posterior / Signal / Reproducibility)**

Add props:
```ts
type MethodologyModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  // NEW:
  priorBundle?: { key: {genre: string; region: string}; fetchedAt: string; effectiveN: number; ageDays: number }
  snapshot?: { fetchedAt: string; engineVersion: string } | null
  validitySummary?: { d1: boolean; d7: boolean; d30: boolean; revenue: boolean }
}
```

Render sections when provided (use existing modal layout). L0 language: 명시적으로 "Prior / Posterior / Engine Version" 기술 용어 노출 허용. L1 본 UI는 기존 언어 유지.

- [ ] **Step 2: market-gap page에서 props 주입**

기존 `MethodologyModal` 호출에 새 props 전달.

- [ ] **Step 3: Commit**

```bash
git add src/shared/ui/methodology-modal.tsx "src/app/(dashboard)/dashboard/market-gap/page.tsx"
git commit -m "feat(methodology-modal): expose prior source, engine version, validity"
```

### Task 7.6: i18n keys

**Files:**
- Modify: `src/shared/i18n/dictionary.ts`

- [ ] **Step 1: 키 추가**

```ts
// 기존 dictionary에 추가
"market.signal.unavailable":         { ko: "보류", en: "Unavailable" },
"market.signal.unavailable.reason":  { ko: "데이터 부족", en: "Insufficient data" },
"market.source.live":                { ko: "실데이터 (MMP)", en: "Live MMP data" },
"market.source.mock":                { ko: "목업 데이터", en: "Mock data" },
"market.methodology.engine":         { ko: "엔진", en: "Engine" },
"market.methodology.priorSource":    { ko: "장르 기대치 소스", en: "Prior source" },
"market.methodology.posteriorSource":{ ko: "우리 실적 소스", en: "Posterior source" },
"market.methodology.reproducibility":{ ko: "재현성", en: "Reproducibility" },
"market.validity.insufficientInstalls.ko": "설치 ≥ {need}건 필요 (현재 {have}건)",
"market.validity.insufficientInstalls.en": "Need installs ≥ {need} (have {have})",
"market.validity.priorStale":        { ko: "장르 기대치 데이터가 30일 이상 경과", en: "Prior data older than 30 days" },
```

- [ ] **Step 2: 사용처에서 t() 호출 연결**

prior-posterior-chart.tsx의 배지와 methodology-modal의 라벨에 `t("market.signal.unavailable")` 등 적용.

- [ ] **Step 3: Commit**

```bash
git add src/shared/i18n/dictionary.ts src/widgets/charts/ui/prior-posterior-chart.tsx src/shared/ui/methodology-modal.tsx
git commit -m "feat(i18n): unavailable/validity/methodology keys (ko/en)"
```

---

## Phase 8: End-to-End Fixture Test

### Task 8.1: E2E engine + adapter + derive integration test

**Files:**
- Create: `src/shared/lib/bayesian-stats/__tests__/e2e.test.ts`
- Create: `src/shared/lib/bayesian-stats/__tests__/fixtures/merge-jp-prior-fixture.json`
- Create: `src/shared/lib/bayesian-stats/__tests__/fixtures/mmp-cohorts-fixture.json`

- [ ] **Step 1: prior fixture 생성**

```bash
# 현재 merge-jp-snapshot에서 필요 필드만 추출
python3 -c "
import json
d = json.load(open('src/shared/api/data/sensor-tower/merge-jp-snapshot.json'))
print(json.dumps({'genrePrior': d['genrePrior'], 'nonNullCount': d['metadata'].get('nonNullCount', {'retention_d1': 16, 'retention_d7': 16, 'retention_d30': 16, 'monthlyRevenueUsd': 20, 'monthlyDownloads': 20})}, indent=2))
" > src/shared/lib/bayesian-stats/__tests__/fixtures/merge-jp-prior-fixture.json
```

- [ ] **Step 2: cohort fixture 생성 (hand-authored)**

```bash
cat > src/shared/lib/bayesian-stats/__tests__/fixtures/mmp-cohorts-fixture.json << 'JSON'
{
  "cohorts": [
    { "cohortDate": "2026-04-01", "installs": 1000, "retainedByDay": { "d1": 620, "d7": 280, "d30": 105 } },
    { "cohortDate": "2026-04-02", "installs": 1200, "retainedByDay": { "d1": 780, "d7": 320, "d30": 130 } },
    { "cohortDate": "2026-04-03", "installs": 1100, "retainedByDay": { "d1": 700, "d7": 300, "d30": 120 } }
  ],
  "revenue": [
    { "month": "2026-01", "revenueUsd": 8500000 },
    { "month": "2026-02", "revenueUsd": 9200000 },
    { "month": "2026-03", "revenueUsd": 10500000 }
  ]
}
JSON
```

- [ ] **Step 3: 테스트 작성**

```ts
// src/shared/lib/bayesian-stats/__tests__/e2e.test.ts
import { describe, it, expect } from "vitest"
import priorFixture from "./fixtures/merge-jp-prior-fixture.json"
import mmpFixture from "./fixtures/mmp-cohorts-fixture.json"
import { computeEffectiveN } from "../effective-sample-size"
import type { PriorBundle } from "@/shared/api/prior-data"
import { derivePosterior } from "@/shared/api/mmp/posterior-derive"

describe("E2E: prior fixture × mmp fixture × engine", () => {
  it("produces stable posterior (regression anchor)", () => {
    const prior: PriorBundle = {
      key: { genre: "Merge", region: "JP" },
      effectiveN: computeEffectiveN(Math.min(
        priorFixture.nonNullCount.retention_d1,
        priorFixture.nonNullCount.retention_d7,
        priorFixture.nonNullCount.retention_d30,
        priorFixture.nonNullCount.monthlyRevenueUsd,
      )),
      fetchedAt: "2026-04-20T00:00:00.000Z",
      ageDays: 1,
      isStale: false,
      retention: priorFixture.genrePrior.retention,
      monthlyRevenueUsd: priorFixture.genrePrior.monthlyRevenueUsd,
      monthlyDownloads: priorFixture.genrePrior.monthlyDownloads,
      nonNullCount: priorFixture.nonNullCount,
      topGamesForAudit: [],
      crawlerVersion: "0.2.0",
    }
    const post = derivePosterior(mmpFixture.cohorts, mmpFixture.revenue, prior)
    expect(post).not.toBeNull()
    // D1 validity true (installs=3300 > 25); mean between 0 and 1
    expect(post!.retention.d1.validity.valid).toBe(true)
    expect(post!.retention.d1.mean).toBeGreaterThan(0.5)
    expect(post!.retention.d1.mean).toBeLessThan(0.8)
    // D30 validity true (installs for d30 = 3300 > 200)
    expect(post!.retention.d30.validity.valid).toBe(true)
    // Revenue validity true (3 months, all > $1000)
    expect(post!.monthlyRevenueUsd.validity.valid).toBe(true)
    expect(post!.monthlyRevenueUsd.mean).toBeGreaterThan(1_000_000)
  })
})
```

- [ ] **Step 4: 테스트 실행 → PASS**

Run: `npx vitest run src/shared/lib/bayesian-stats/__tests__/e2e.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/shared/lib/bayesian-stats/__tests__/e2e.test.ts src/shared/lib/bayesian-stats/__tests__/fixtures/
git commit -m "test(bayesian-stats): e2e fixture regression anchor"
```

---

## Phase 9: Full Suite + Smoke

### Task 9.1: Full test suite passes

- [ ] **Step 1: 루트 vitest 실행**

Run: `npx vitest run`
Expected: all tests pass (기존 + 신규)

- [ ] **Step 2: Crawler vitest 실행**

Run: `cd crawler && npx vitest run`
Expected: pass

- [ ] **Step 3: Typecheck 전체**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: (추가 커밋 없음 — all green 확인만)**

### Task 9.2: Dev 서버 smoke test

- [ ] **Step 1: Dev 서버 기동**

Run: `npm run dev` (background OK)

- [ ] **Step 2: Market Gap 페이지 확인**

Browser: `http://localhost:3000/dashboard/market-gap`

확인:
- [ ] PriorPosteriorChart가 "mock 데이터" 배지로 렌더링 (placeholder snapshot은 fetchedAt=epoch → useLive=false)
- [ ] 기존 시그널/차트 회귀 없음 (Invest/Hold/Reduce 뱃지 정상)
- [ ] Console 에러 없음

- [ ] **Step 3: Dry-run MMP sync**

Placeholder 상태에서는 실제 AppsFlyer 호출 못 하지만, game-registry 검증과 prior validity는 확인 가능:

Run: `curl -X POST http://localhost:3000/api/mmp/sync -H "content-type: application/json" -d '{"gameKey":"unknown","dryRun":true}'`
Expected response: 404 `unknown_game`

Run: `curl -X POST http://localhost:3000/api/mmp/sync -H "content-type: application/json" -d '{"gameKey":"poco-merge","dryRun":true}'`
Expected: 424 `mmp_auth_error` (env 없음) — prior validity는 통과했음을 확인

- [ ] **Step 4: Dev 서버 종료**

### Task 9.3: Final commit + branch push

- [ ] **Step 1: Git log 확인**

Run: `git log --oneline feat/appsflyer-pipeline..feat/bayesian-stats-engine | head -30`
Expected: ~20 commits across Phases 1-9.

- [ ] **Step 2: Branch push (리모트 리뷰용)**

Run: `git push -u origin feat/bayesian-stats-engine`

- [ ] **Step 3: PR 작성은 사용자 확인 후에**

사용자에게 PR 제목/본문 제안을 요청받을 때까지 대기.

---

## Post-Plan Notes

**검증 기준 (모두 체크되어야 완료)**:
- [ ] Bayesian engine tests pass (beta-binomial, lognormal, validity, e2e)
- [ ] Prior bundle: effectiveN, nonNullCount 정확 주입, /100 제거
- [ ] MMP adapter: D1/D7/D30 + users_day_N 요청, raw→observations 변환 테스트 통과
- [ ] POST /api/mmp/sync: 입력 검증, game-registry, prior validity, 파이프라인 오케스트레이션
- [ ] UI: live/mock 분기, unavailable 뱃지, methodology modal 4블록
- [ ] Typecheck & 전체 suite 녹색
- [ ] Dev smoke: market-gap 페이지 회귀 없음

**후속 branch (기술 해자 확장)**:
- `feat/crawler-multi-target` — ST crawler Target[] 지원
- `feat/genre-registry` — gameRegistry 다장르
- `feat/mmp-vendor-adjust` — Adjust adapter
- `feat/metric-arpdau`, `feat/metric-ltv` — 추가 지표
- `feat/engine-hierarchical` — v0.2.0

**참조**:
- Spec: `docs/superpowers/specs/2026-04-21-bayesian-stats-engine-design.md`
- Crawler spec: `docs/superpowers/specs/2026-04-20-sensortower-crawler-design.md`
- AppsFlyer pipeline spec: `docs/superpowers/specs/2026-04-20-appsflyer-api-pipeline-design.md`
