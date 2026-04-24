# Bayesian Stats Engine — 장르 기대치 vs 우리 실적 비교의 과학적 타당성 엔진

**Date**: 2026-04-21
**Branch**: `feat/bayesian-stats-engine` (예정; 현재 작업 branch `feat/appsflyer-pipeline`에서 이어짐)
**Status**: Design (implementation 전 단계)

---

## 1. 목적과 배경

### 1.1 현재 문제

Project Compass의 Market Gap 페이지는 "장르 기대치(prior) vs 우리 실적(posterior)" 비교로 Invest/Hold/Reduce 시그널을 산출한다. 현재 상태 점검 결과 다음 결함이 있다.

| # | 결함 | 영향 |
|---|------|------|
| 1 | Posterior가 `mockPriorPosterior` 하드코딩 (mock-data.ts:773) | 실데이터 비교 불가 |
| 2 | AppsFlyer route의 cohort KPI가 D0/D1/D3, prior는 D1/D7/D30 | depth 미스매치 blocker |
| 3 | Prior의 effective sample size를 엔진이 몰라서 overconfidence 발생 | 과학 타당성 결함 |
| 4 | 통계적 유효성 미확보 시에도 숫자를 반환 (validity gate 부재) | 거짓 정밀도 위험 |
| 5 | MMP vendor에 lock-in된 구현 (AppsFlyer 전용 타입) | 장기 운영 유연성 부족 |
| 6 | Revenue 단위 혼선 (prior-data.ts의 /100 vs memory 규칙 "plain USD") | 회계 숫자 신뢰성 |

### 1.2 이번 branch의 범위

**포함**:
- Empirical Bayes + Shrinkage 통계 엔진 (리텐션 = Beta-Binomial, 수익 = Log-normal MoM)
- MMP vendor-neutral adapter contract (현재 AppsFlyer 구현 하나)
- Validity gate 정책 (prior·posterior 각각 독립)
- Snapshot schema v2 (posterior + validity 필드)
- Sync 파이프라인 통합 (`/api/mmp/sync` 진입점)
- UI integration + mock fallback + methodology modal 투명성 확장
- 기술 해자 확장 훅 (Metric Registry, Plugin model interface)

**포함 안 함** (§10 상세):
다장르·다리전 Prior, 다 vendor MMP, 다 게임 MMP sync, 추가 지표(ARPDAU/CPI/LTV), MCMC 엔진, request-time recomputation, Sample Match-3 / Sample Puzzle / Sample Idle의 per-game prior-posterior (이들은 mock 유지).

### 1.3 성공 기준

1. **과학 타당성**: Beta-Binomial conjugate 수학이 analytical reference와 1e-3 tolerance 일치
2. **투명성**: snapshot 파일에 prior params, observations, engineVersion, validity 모두 기록되어 git diff로 감사 가능
3. **안전성**: validity gate 실패 시 엔진이 숫자 대신 explicit `invalid` 반환, UI가 "보류" 배지 노출
4. **확장성**: 새 지표 / 새 vendor / 새 게임 추가 시 엔진 코어 수정 없이 registry 엔트리 추가만으로 통합

---

## 2. 시스템 경계와 데이터 흐름

### 2.1 전체 아키텍처

```
┌─────────────────┐  1회/주 수동      ┌────────────────────────────────────┐
│  ST Crawler     │ ─────────────▶   │ prior snapshot                     │
│  (local CLI)    │                   │  .genrePrior.retention (P10/50/90) │
└─────────────────┘                   │  .genrePrior.monthlyRevenueUsd     │
                                      │  .metadata.nonNullCount (신규)     │
                                      └──────────┬─────────────────────────┘
                                                 │ build-time import
                                                 ▼
┌─────────────────┐  일 1회 cron      ┌────────────────────────────────────┐
│ MMP Vendor API  │ ─────────────▶   │ mmp snapshot (v2)                  │
│ (AppsFlyer 현재)│                   │  .cohorts (installs + retained)    │
└─────────────────┘   ↑               │  .revenue (monthly USD)             │
                      │               │  .posterior (engine 출력)           │
                      │               │  .metadata.validity                 │
              runMMPSync              └──────────┬─────────────────────────┘
                      │                          │ build-time import
                      ▼                          ▼
           ┌────────────────────┐     ┌────────────────────────────┐
           │ Bayesian Engine    │     │ UI Components               │
           │ (pure functions)   │     │  - PriorPosteriorChart      │
           │  - beta-binomial   │     │    (live snapshot 또는      │
           │  - lognormal-moments│    │     mock fallback)          │
           │  - validity gates   │    │  - Methodology Modal        │
           └────────────────────┘     │    (validity/engineVersion) │
                                      └────────────────────────────┘
```

### 2.2 경계 원칙

1. **엔진은 pure**: I/O·네트워크·파일 접근 금지. 입력 = prior params + observations, 출력 = `CredibleInterval | InvalidResult`. 테스트 용이성 + B 확장 시 재사용.
2. **Snapshot이 single source of truth**: Prior는 ST snapshot 파일, Posterior는 MMP snapshot 파일. UI는 snapshot 파일만 읽음. 재현성 + 감사 + git diff로 통계 변화 추적 가능.
3. **Mock fallback은 UI 레이어**: 엔진은 Poco Merge 데이터가 없으면 snapshot 생성 안 함. UI가 snapshot 존재·validity 여부 체크 → 없거나 invalid면 기존 mock 사용. **엔진이 mock을 몰라야 테스트·버전링 가능**.

---

## 3. Bayesian Engine Core

### 3.1 위치와 파일 구성

```
src/shared/lib/bayesian-stats/
├── index.ts                       # 공개 API barrel
├── types.ts                       # 핵심 타입 (CredibleInterval, BayesianModel, Validity)
├── beta-binomial.ts               # 리텐션 모델 (rate data, conjugate)
├── lognormal.ts                   # 수익 모델 (right-skewed $, MoM)
├── effective-sample-size.ts       # Prior strength cap 정책
├── validity.ts                    # validatePrior / validateRetentionPosterior / validateRevenuePosterior
├── metric-registry.ts             # 지표 plugin 레지스트리 (§10)
├── build-rows.ts                  # UI row assembly (§9-2)
├── beta-quantile.ts               # Numerical Recipes betaincinv 포팅 (내부)
├── version.ts                     # ENGINE_VERSION 상수
└── __tests__/
    ├── beta-binomial.test.ts
    ├── lognormal.test.ts
    ├── priors.test.ts
    ├── shrinkage.test.ts
    ├── validity.test.ts
    └── e2e.test.ts
```

### 3.2 공통 타입

```ts
// types.ts
export type CredibleInterval = {
  mean: number           // posterior mean (point estimate)
  ci_low: number         // 2.5% quantile
  ci_high: number        // 97.5% quantile
  sampleSize: number     // effective n (prior pseudo-counts + observed n)
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

export type PosteriorResult =
  | { status: "computed"; interval: CredibleInterval }
  | { status: "invalid"; validity: Validity }

export type BayesianModel<TPriorParams, TObservation> = {
  name: string
  priorFromEmpirical: (empirical: EmpiricalDist, effectiveN: number) => TPriorParams
  posterior: (prior: TPriorParams, obs: TObservation) => CredibleInterval
  priorAsInterval: (prior: TPriorParams) => CredibleInterval
}

export type EmpiricalDist = { p10: number; p50: number; p90: number }
```

### 3.3 Beta-Binomial (리텐션)

**Prior 추출** — Method of Moments with capped effective sample size:

```
μ = P50
σ = (P90 − P10) / (2 × 1.2816)       // 0.10/0.90 → 표준정규 quantile 스케일
variance = σ²
raw_total = μ(1−μ)/variance − 1
α_raw = μ × raw_total
β_raw = (1−μ) × raw_total

scale = min(1, effectiveN / raw_total)
α = α_raw × scale
β = β_raw × scale
```

- `effectiveN = min(bundle.metadata.topN − nullCount, 100)` — 실제 non-null 표본 수, 상한 100.
- 상한 100 근거: ST Top 100 바깥은 long-tail noise 급증 + 크롤 부담 + posterior shrinkage 과도.
- Degenerate 입력(P90 ≤ P10 또는 variance ≤ 0) → `DegenerateDistributionError` throw.

**Posterior**:

```
α_post = α + k            (k = retained users)
β_post = β + n − k        (n = installs, n−k = churned)
mean   = α_post / (α_post + β_post)
ci_low  = Beta.quantile(α_post, β_post, 0.025)
ci_high = Beta.quantile(α_post, β_post, 0.975)
```

**Beta quantile 구현**: Numerical Recipes `betaincinv` 알고리즘 자체 포팅 (~60 LOC). scipy.stats.beta.ppf 참조값과 1e-3 tolerance.

### 3.4 Log-normal (수익)

**가정**: 월 수익은 right-skewed, 양수. log-scale에서 Gaussian 근사 → Normal-Normal conjugate on log-scale.

**Prior 추출**:
```
μ_log = log(P50)
σ_log = (log(P90) − log(P10)) / (2 × 1.2816)
prior = { μ_log, σ_log, n_prior = effectiveN }
```

**Posterior** (precision-weighted mean on log-scale):
```
observed_log = obs.revenueByMonth.map(log)
μ_obs = mean(observed_log)
σ_obs = stddev(observed_log)    // n_obs ≥ 3 필요
n_obs = observed_log.length

τ_prior = n_prior / σ_log²
τ_obs   = n_obs   / σ_obs²
μ_post_log  = (τ_prior × μ_log + τ_obs × μ_obs) / (τ_prior + τ_obs)
σ_post_log  = sqrt(1 / (τ_prior + τ_obs))

mean    = exp(μ_post_log + σ_post_log²/2)
ci_low  = exp(μ_post_log − 1.96 × σ_post_log)
ci_high = exp(μ_post_log + 1.96 × σ_post_log)
```

### 3.5 Engine Version

```ts
// version.ts
export const ENGINE_VERSION = "bayesian-stats@0.1.0"
```

Major bump = breaking semantic 변경 (모델 교체 등). Minor = 새 지표/모델 추가. Patch = 파라미터 조정. Snapshot에 기록되어 drift 감사.

---

## 4. Prior 추출 및 다차원 번들 구조

### 4.1 파일 레이아웃

```
src/shared/api/data/
├── sensor-tower/
│   ├── merge-jp-snapshot.json         # 현재 (Top 20)
│   ├── match3-jp-snapshot.json        # 미래 (후속 branch)
│   ├── arcade-kr-snapshot.json        # 미래
│   └── last-updated.json
└── mmp/
    ├── poco-merge-mmp-snapshot.json   # 신규 (이번 branch placeholder 커밋)
    └── last-updated.json
```

### 4.2 Prior Bundle 타입

```ts
// src/shared/api/prior-data.ts (재구성)
export type PriorBundleKey = { genre: string; region: string }

export type PriorBundle = {
  key: PriorBundleKey
  effectiveN: number              // min(topN − nullCount, 100)
  fetchedAt: string
  ageDays: number
  isStale: boolean                // >14일 (UI warn)
  retention: {
    d1:  EmpiricalDist
    d7:  EmpiricalDist
    d30: EmpiricalDist
  }
  monthlyRevenueUsd: EmpiricalDist
  monthlyDownloads: EmpiricalDist
  topGamesForAudit: TopGame[]     // git diff 감사용, UI 미노출
  crawlerVersion: string
  nonNullCount: Record<string, number>
}

const loadedBundles: Record<string, PriorBundle> = {
  "Merge:JP": loadSnapshot("./data/sensor-tower/merge-jp-snapshot.json"),
}

export function getPrior(key: PriorBundleKey): PriorBundle | null
export function listAvailablePriors(): PriorBundleKey[]
```

### 4.3 Game Registry (명시적 매핑)

```ts
// src/shared/api/game-registry.ts
export const gameRegistry = {
  "poco-merge": {
    genre: "Merge",
    region: "JP",
    mmpVendor: "appsflyer",
    mmpAppIdEnv: "POCO_MERGE_APP_ID",   // 런타임 env에서 주입
  },
} as const satisfies Record<string, GameRegistryEntry>
```

Sample Match-3 / Sample Puzzle / Sample Idle는 registry에 없음 → prior-posterior chart는 mock 계속 사용.

### 4.4 Revenue 단위 정정

**결정**: snapshot(크롤러 출력)에서 직접 plain USD 정수로 저장. `prior-data.ts`의 `/100` 스케일링 제거.

**검증 테스트** (e2e.test.ts):
```ts
expect(priorBundle.monthlyRevenueUsd.p50).toBeGreaterThan(1_000_000)    // $1M 최소
expect(priorBundle.monthlyRevenueUsd.p50).toBeLessThan(100_000_000)    // $100M 최대
```

---

## 5. 통계 타당성 게이트

### 5.1 Prior Validity

```ts
// validity.ts (prior 검증)
function validatePrior(bundle: PriorBundle, metric: MetricKey): Validity {
  const n = bundle.nonNullCount[metric]
  if (n < 10) return { valid: false, reason: "prior_invalid_n", need: 10, have: n }
  const emp = metricPriorAccessor(bundle, metric)
  if (emp.p90 <= emp.p10) return { valid: false, reason: "prior_degenerate" }
  if (bundle.ageDays > 30) return { valid: false, reason: "prior_stale" }
  return { valid: true }
}
```

**임계값 근거**:
- `n ≥ 10`: MoM variance 추정 수렴 최소 표본
- `P90 > P10`: degenerate 분포에서 α,β 계산 시 수치 붕괴 방지
- `ageDays ≤ 30`: 시장 구조 변동 기준 하드 컷 (stale 14일 warning과 별도)

### 5.2 Posterior Validity (리텐션, Beta-Binomial)

```ts
function validateRetentionPosterior(obs: {installs: number; retained: number}, dayN: 1|7|30): Validity {
  const threshold = { 1: 25, 7: 80, 30: 200 }[dayN]
  if (obs.installs < threshold) {
    return { valid: false, reason: "insufficient_installs", need: threshold, have: obs.installs }
  }
  return { valid: true }
}
```

**Depth별 임계값 근거**: D30 base rate(~10%) 기준으로 Wilson CI 폭이 의사결정 가능 수준(±5pp)까지 좁혀지려면 n ≥ 200 필요. D1(~60%)은 25, D7(~25%)은 80이 동일 조건.

### 5.3 Posterior Validity (수익, Log-normal)

- 최소 3개월 데이터 (variance 추정 최소)
- 월 수익 ≥ $1,000 (floor noise 제거)
- 실패 시 `insufficient_history`

### 5.4 Signal 계산 게이트

```ts
// shared/lib/market-signal.ts 확장
export type MarketSignal = "invest" | "hold" | "reduce" | "unavailable"

export function computeMarketSignalSafe(args: {
  priorValidity: Validity
  postValidity: Validity
  prior: number
  posterior: number
}): MarketSignalResult {
  if (!args.priorValidity.valid)
    return { signal: "unavailable", deltaPct: null, direction: "unknown", reason: `prior:${args.priorValidity.reason}` }
  if (!args.postValidity.valid)
    return { signal: "unavailable", deltaPct: null, direction: "unknown", reason: `posterior:${args.postValidity.reason}` }
  return computeMarketSignal(args.prior, args.posterior)
}
```

---

## 6. MMP Adapter Contract + AppsFlyer 구현

### 6.1 디렉토리 구조

```
src/shared/api/
├── mmp/
│   ├── types.ts             # MMPSnapshot, MMPAdapter 인터페이스
│   ├── schemas.ts           # Zod (MMPSnapshotSchema)
│   ├── index.ts             # 현재 활성 adapter export
│   ├── posterior-derive.ts  # observations → engine 호출
│   ├── snapshot.ts          # atomic write, read, validation
│   ├── lock.ts              # vendor-neutral sync lock
│   └── appsflyer/           # 구체 adapter (현재 활성)
│       ├── client.ts        # 기존 유지
│       ├── fetcher.ts       # 기존 유지, KPI 수정
│       ├── errors.ts        # 기존 유지
│       ├── adapter.ts       # AF raw row → MMPCohortObservation
│       └── __tests__/
```

### 6.2 Vendor-neutral Types

```ts
// mmp/types.ts
export type MMPVendor = "appsflyer" | "adjust" | "singular" | "kochava" | "branch"

export type MMPCohortObservation = {
  cohortDate: string         // "2026-04-15"
  installs: number           // 총 install 수
  retainedByDay: {
    d1:  number | null       // retained count (rate 아님)
    d7:  number | null
    d30: number | null
  }
}

export type MMPRevenueObservation = {
  month: string              // "2026-04"
  revenueUsd: number         // plain USD (vendor별 스케일링은 adapter에서)
  payingUsers?: number
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
  posterior: {
    retention: {
      d1:  CredibleInterval & { validity: Validity }
      d7:  CredibleInterval & { validity: Validity }
      d30: CredibleInterval & { validity: Validity }
    }
    monthlyRevenueUsd: CredibleInterval & { validity: Validity }
    priorSource: {
      genre: string
      region: string
      priorFetchedAt: string
      priorSchemaVersion: 1
    }
    engineVersion: string
  } | null
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

export interface MMPAdapter {
  vendor: MMPVendor
  fetchSnapshot: (opts: MMPFetchOptions) => Promise<Omit<MMPSnapshot, "posterior">>
}
```

### 6.3 AppsFlyer 구현 수정 6개

현재 `src/app/api/appsflyer/sync/route.ts`의 결함 교정:

| # | 현재 | 수정 후 |
|---|------|---------|
| 1 | cohort KPI `retention_day_0,1,3` | `retention_day_1,7,30` + `users_day_1,7,30` |
| 2 | rate만 요청 | rate + retained count 병행 → Beta-Binomial 가능 |
| 3 | `groupings: ["pid"]` (source별) | `[]` (전체 코호트); source별은 B 확장 |
| 4 | 윈도우 `start = 오늘 − 30일, end = 오늘` | `start = 어제 − 29일, end = 어제` (ST 정합) |
| 5 | `appIds[0]` 임시 처리 | `gameRegistry.lookup(gameKey).mmpAppIdEnv` → env 주입 |
| 6 | Snapshot 저장 경로 모호 | `src/shared/api/data/mmp/<gameKey>-mmp-snapshot.json` 고정 |

### 6.4 Observations → Engine

```ts
// mmp/posterior-derive.ts
export function derivePosterior(
  raw: Omit<MMPSnapshot, "posterior">,
  prior: PriorBundle,
): MMPSnapshot["posterior"] {
  const agg = aggregateCohorts(raw.cohorts)   // 전체 코호트 합산

  const priorParams = {
    d1:  betaBinomialModel.priorFromEmpirical(prior.retention.d1,  prior.effectiveN),
    d7:  betaBinomialModel.priorFromEmpirical(prior.retention.d7,  prior.effectiveN),
    d30: betaBinomialModel.priorFromEmpirical(prior.retention.d30, prior.effectiveN),
  }

  const v1  = validateRetentionPosterior({installs: agg.installs, retained: agg.retained_d1  ?? 0}, 1)
  const v7  = validateRetentionPosterior({installs: agg.installs, retained: agg.retained_d7  ?? 0}, 7)
  const v30 = validateRetentionPosterior({installs: agg.installs, retained: agg.retained_d30 ?? 0}, 30)

  const makeRow = (v: Validity, params: BetaParams, obs: BinomialObs): CredibleInterval & {validity: Validity} => {
    if (!v.valid) return { mean: null as any, ci_low: null as any, ci_high: null as any, sampleSize: obs.n, validity: v }
    return { ...betaBinomialModel.posterior(params, obs), validity: { valid: true } }
  }

  return {
    retention: {
      d1:  makeRow(v1,  priorParams.d1,  { n: agg.installs, k: agg.retained_d1  ?? 0 }),
      d7:  makeRow(v7,  priorParams.d7,  { n: agg.installs, k: agg.retained_d7  ?? 0 }),
      d30: makeRow(v30, priorParams.d30, { n: agg.installs, k: agg.retained_d30 ?? 0 }),
    },
    monthlyRevenueUsd: /* 동일 패턴 */,
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

---

## 7. Snapshot Schema v2

### 7.1 MMP Snapshot (Zod)

`src/shared/api/mmp/schemas.ts`에 Section 6.2 타입을 Zod로 미러링. Discriminated union으로 `Validity`, `posterior: null | {...}`. 핵심 필드:

- `$schemaVersion: z.literal(2)`
- `vendor: z.enum([...])`
- `gameKey: z.string().min(1)`
- `cohorts: z.array(MMPCohortObservationSchema)`
- `posterior: PosteriorSchema.nullable()`
- `metadata.validity`

### 7.2 ST Prior Snapshot 확장 (하위 호환)

`crawler/src/schemas/snapshot.ts`에 `metadata.nonNullCount` optional 필드 추가. 구 snapshot은 런타임에 `topGames`를 스캔해 계산, 신 snapshot은 필드 직독.

### 7.3 구 AppsFlyer Snapshot 마이그레이션

- 구 v1 snapshot 파일(`shared/api/data/appsflyer/*`) 발견 시: `readSnapshot()`이 `$schemaVersion !== 2` → null 반환
- 삭제 대신 무시 → 다음 sync가 v2 경로 (`shared/api/data/mmp/`)에 새로 씀
- 코드 레벨: `src/shared/api/appsflyer/` → `src/shared/api/mmp/appsflyer/`로 이동

### 7.4 Engine Version Bump → 재계산 트리거

- Snapshot의 `posterior.engineVersion ≠ 현재 ENGINE_VERSION` → UI "재계산 필요" 배지
- `npm run mmp:recompute`: raw cohorts 유지, posterior만 재계산
- `npm run mmp:sync`: raw + posterior 둘 다 재실행

---

## 8. Sync 파이프라인 통합

### 8.1 엔트리 포인트

```
POST /api/mmp/sync
  body: { gameKey: "poco-merge", dryRun?: boolean }
  ├─ gameRegistry.lookup(gameKey) → { genre, region, vendor, mmpAppIdEnv }
  ├─ getPrior({genre, region}) → PriorBundle
  │    ├─ null → 400 "prior_unavailable"
  │    └─ validity fail → 400 "prior_invalid: <reason>"
  ├─ acquireLock("mmp.lock")
  ├─ MMPAdapterRegistry[vendor].fetchSnapshot({appId, dateRange})
  ├─ derivePosterior(rawSnap, prior) → posterior + validity
  ├─ MMPSnapshotSchema.parse(finalSnap)
  ├─ writeSnapshotAtomic(`data/mmp/${gameKey}-mmp-snapshot.json`)
  ├─ appendAuditLog(...)
  └─ releaseLock
```

### 8.2 CLI / Cron

```jsonc
// package.json scripts
"mmp:sync":      "tsx scripts/mmp-sync.ts",
"mmp:sync:dry":  "tsx scripts/mmp-sync.ts --dry-run",
"mmp:recompute": "tsx scripts/mmp-recompute.ts"
```

- **Prior (ST)**: 주 1회 수동
- **Posterior (MMP)**: 일 1회 cron (Vercel Cron 또는 로컬 launchd)
- **Recompute**: engine bump 후 수동

### 8.3 동시성 Lock

Vendor-neutral lockfile `.mmp.lock` (repo root, `.gitignore` 등록, stale >30분 자동 해제). Crawler의 `.crawler.lock` 패턴 재사용. `public/` 하위 금지 — Next.js가 정적 서빙할 수 있음.

### 8.4 에러 분류

```ts
type MMPSyncError =
  | { code: "prior_unavailable"; detail: { genre: string; region: string } }
  | { code: "prior_invalid"; reason: string }
  | { code: "mmp_auth_error"; vendor: MMPVendor }
  | { code: "mmp_rate_limited"; retryAfterSec: number }
  | { code: "mmp_timeout" }
  | { code: "mmp_validation_error"; path: string }
  | { code: "engine_error"; detail: string }
```

- `prior_*` / `mmp_auth_error`: 500, snapshot 미저장
- `mmp_rate_limited`: client backoff 재시도
- `engine_error`: raw는 저장, `posterior=null`, 다음 recompute 재시도

### 8.5 Observability

`logs/mmp-sync-<date>.jsonl`: sync 1회당 한 줄. `gameKey, priorKey, priorFetchedAt, engineVersion, cohortsCount, installsTotal, posteriorValidity, durationMs`. `.gitignore`.

### 8.6 UI 반영

- Dev: HMR이 JSON import 재평가 → 즉시 반영
- Production: `export const revalidate = 3600` on `src/app/(dashboard)/dashboard/market-gap/page.tsx` (ISR 시간당)

---

## 9. UI Integration

### 9.1 Data access 레이어

`src/shared/api/posterior-data.ts` 신규:

```ts
import mmpSnapshotJson from "./data/mmp/poco-merge-mmp-snapshot.json" with { type: "json" }

let validated: MMPSnapshot | null = null
try { validated = MMPSnapshotSchema.parse(mmpSnapshotJson) } catch { validated = null }

export function getPosterior(gameKey: "poco-merge"): MMPSnapshot | null
export function hasLivePosterior(gameKey: "poco-merge"): boolean
```

Placeholder snapshot (이번 branch 커밋):
```json
{
  "$schemaVersion": 2,
  "vendor": "appsflyer",
  "vendorApiVersion": "cohorts-v1",
  "gameKey": "poco-merge",
  "fetchedAt": "1970-01-01T00:00:00.000Z",
  "dateRange": { "from": "1970-01-01", "to": "1970-01-01" },
  "cohorts": [],
  "revenue": [],
  "posterior": null,
  "metadata": { "warnings": ["placeholder — awaiting first MMP sync"], "validity": { "cohortsValid": false, "revenueValid": false, "reasonCodes": ["no_sync_yet"] }, "priorEngineRunAt": null }
}
```

### 9.2 Chart Integration

```ts
// market-gap/page.tsx
const rows = hasLivePosterior("poco-merge")
  ? buildPriorPosteriorRows({ gameKey: "poco-merge" })
  : mockPriorPosterior

<PriorPosteriorChart data={rows} source={hasLivePosterior("poco-merge") ? "live" : "mock"} />
```

`buildPriorPosteriorRows`: pure 함수. Prior + Posterior 조회 → metric별 row 반환. Invalid 시 `posterior.mean = null`.

### 9.3 "Unavailable" Signal UI

- Invest/Hold/Reduce 대신 **회색 "보류" 뱃지** (`--signal-pending`)
- Tooltip: 관측치 have / need 표시
- Chart: prior band만, posterior blank + "축적 중" placeholder

### 9.4 Methodology Modal 확장

L0 언어 (엔지니어/과학자 대상)로 다음 4 블록 노출:
1. **장르 기대치 (Prior)**: 소스, 표본 수, Beta(α,β), effectiveN
2. **우리 실적 (Posterior)**: 소스, 기간, 관측 표본, 모델 이름, 엔진 버전
3. **시그널 계산**: 임계값(±5%), validity 게이트 현재 상태 (D1/D7/D30 각각)
4. **재현성**: priorFetchedAt, engineVersion, snapshot 파일 경로

L1 UI(운영자)에는 기존 "장르 기대치 vs 우리 실적" 언어 유지.

### 9.5 i18n

`src/shared/i18n/dictionary.ts`에 신규 키:
- `market.signal.unavailable.*`
- `market.methodology.engine.*`
- `market.validity.insufficientInstalls.*`
- `market.validity.priorStale.*`

---

## 10. 기술 해자 (B 확장 패스)

### 10.1 Metric Registry 패턴

```ts
// metric-registry.ts
export const METRIC_REGISTRY: Record<string, MetricDefinition<any, any>> = {
  retention_d1:  { model: betaBinomialModel, priorAccessor: b => b.retention.d1, observationAccessor: s => ({n: totalInstalls(s), k: totalRetained(s, 1)}), validate: (obs) => validateRetentionPosterior(obs, 1) },
  retention_d7:  { /* 동일 패턴 */ },
  retention_d30: { /* 동일 패턴 */ },
  monthly_revenue_usd: { model: lognormalModel, /* ... */ },
}
```

새 지표 추가 = 엔트리 하나 + 모델 구현 1파일. 엔진 코어·snapshot 스키마 수정 불필요 (스키마에 `dynamic metrics` 필드는 v3에서).

### 10.2 Plugin Model Interface

`BayesianModel<TPriorParams, TObservation>` (Section 3.2 정의). 4개 메서드만 구현: `priorFromEmpirical`, `posterior`, `priorAsInterval`, optional `sampleFromPrior` (bootstrap용).

### 10.3 확장 로드맵 (후속 feature branch)

```
feat/crawler-multi-target     → ST crawler를 Target[]로
feat/genre-registry           → gameRegistry 다장르 매핑
feat/mmp-multi-game           → MMP sync game array loop
feat/mmp-vendor-adjust        → Adjust adapter
feat/mmp-vendor-singular      → Singular adapter
feat/metric-arpdau            → ARPDAU 추가
feat/metric-ltv               → LTV day 30/60/90
feat/engine-hierarchical      → Hierarchical Bayes (engine v0.2)
feat/engine-mcmc              → Stan/JAX 통합 (engine v1.0)
feat/scientist-view           → L2 과학자 뷰 (엔진 raw 출력 페이지)
```

각 feature는 기존 엔진·타입·스키마 변경 없이 추가 레이어만. 역호환.

### 10.4 Version 매트릭스

```
bayesian-stats@0.1.0 — Beta-Binomial + Log-normal (이번 branch)
bayesian-stats@0.2.0 — Metric Registry 확장, hierarchical prior (옵션)
bayesian-stats@1.0.0 — MCMC 대안 엔진, Sensor Tower + MMP + 내부 실험 통합
```

---

## 11. Testing Strategy

### 11.1 엔진 수학 정합성

`beta-binomial.test.ts`:
- n=0 → posterior = prior (mean, CI 일치)
- n→∞ → posterior mean → observed rate (prior 영향 소멸)
- Shrinkage: n=10이면 posterior mean이 prior와 observed 사이
- CI는 analytical Beta quantile과 1e-3 tolerance 일치 (scipy 참조)

`lognormal.test.ts`:
- 알려진 분포(Log-normal(μ=10, σ=1))에서 Prior MoM → μ_log, σ_log 복원
- n_obs=∞ → posterior mean → observed mean
- Precision-weighted mean 정확성

### 11.2 Prior 추출 정합성

`priors.test.ts`:
- MoM 역산: 주어진 μ, σ² → α, β 계산 후 다시 mean, variance → 입력과 일치
- Effective sample size cap: α + β ≤ 100
- Degenerate input (p10=p50=p90) → `DegenerateDistributionError`

### 11.3 Validity Gate 경계

`validity.test.ts`: 모든 reason code에 대해 트리거·비트리거 경계값 테스트
- `prior_invalid_n`: n=9 fail, n=10 pass
- `prior_stale`: ageDays=31 fail, 30 pass
- `insufficient_installs`: D30에서 installs=199 fail, 200 pass

### 11.4 MMP Adapter Contract

`mmp/appsflyer/adapter.test.ts`:
- AppsFlyer raw cohort row fixture → `MMPCohortObservation` 정확 변환
- `users_day_N` 필드 부재 시 `retainedByDay.d7 = null` 처리
- Revenue: USD 스케일링 검증

### 11.5 End-to-End Fixture Test

`e2e.test.ts`:
- 고정 ST snapshot + 고정 MMP snapshot → 고정 posterior 기대값 1e-4 tolerance
- Engine version bump 시 이 테스트로 "수학 의도 외 변화 없음" 확인

### 11.6 UI Fallback Test

`prior-posterior-chart.test.tsx` (Testing Library):
- `hasLivePosterior=false` → mockPriorPosterior 렌더링
- `hasLivePosterior=true, validity.D30=invalid` → D30 row "보류" 뱃지
- Methodology modal에 engineVersion 노출

---

## 12. Out of Scope

### 12.1 이번 branch에 포함 안 함

1. 다장르·다리전 Prior (Merge JP 외) — 후속 `feat/crawler-multi-target` + `feat/genre-registry`
2. 다 vendor MMP (Adjust, Singular, Kochava, Branch) — 후속 `feat/mmp-vendor-*`
3. 다 게임 MMP sync — 후속 `feat/mmp-multi-game`
4. 추가 지표 (ARPDAU, CPI, LTV, ROAS) — 후속 `feat/metric-*`
5. Hierarchical Bayesian / MCMC — 후속 engine v0.2~v1.0
6. Request-time recomputation
7. 실시간 cohort 스트리밍
8. A/B test 실험 결과 반영 (PRISM 파이프라인은 별도)
9. L2 과학자 뷰 UI
10. Revenue unit audit 전수 조사 (이번 branch는 단위 정정만, 회귀 스위트는 별도)

### 12.2 명시적으로 제거·무시

- Sample Match-3, Sample Puzzle, Sample Idle의 per-game prior-posterior (mock 유지, registry 제외)
- 기존 `src/shared/api/appsflyer/` → `src/shared/api/mmp/appsflyer/` 이동
- 구 AppsFlyer snapshot 파일 자동 마이그레이션 (무시 + 다음 sync가 v2로 대체)

---

## 13. 파일 변경 요약 (구현 청사진)

### 13.1 신규 파일
```
src/shared/lib/bayesian-stats/
  index.ts, types.ts, beta-binomial.ts, lognormal.ts,
  effective-sample-size.ts, validity.ts, metric-registry.ts,
  build-rows.ts, beta-quantile.ts, version.ts
  __tests__/ (6개: beta-binomial, lognormal, priors, shrinkage, validity, e2e)

src/shared/api/
  game-registry.ts
  posterior-data.ts
  mmp/
    types.ts, schemas.ts, index.ts, posterior-derive.ts,
    snapshot.ts, lock.ts
    appsflyer/ (기존 appsflyer/ 이동 + adapter.ts 추가)
  data/mmp/
    poco-merge-mmp-snapshot.json (placeholder)
    last-updated.json

src/app/api/mmp/sync/
  route.ts

scripts/
  mmp-sync.ts, mmp-recompute.ts

docs/superpowers/specs/
  2026-04-21-bayesian-stats-engine-design.md (이 파일)
```

### 13.2 수정 파일
```
src/shared/api/prior-data.ts             # PriorBundle 타입 + nonNullCount, /100 제거
src/shared/lib/market-signal.ts          # "unavailable" signal 추가
src/shared/ui/methodology-modal.tsx      # L0 블록 4개 확장
src/shared/i18n/dictionary.ts            # unavailable / validity / methodology.engine 키
src/widgets/charts/ui/prior-posterior-chart.tsx  # source prop + 보류 뱃지
src/app/(dashboard)/dashboard/market-gap/page.tsx # live/mock 분기 + revalidate
crawler/src/schemas/snapshot.ts          # metadata.nonNullCount optional
crawler/src/transformers/to-prior.ts     # nonNullCount 계산
package.json                             # mmp:sync, mmp:recompute, mmp:sync:dry
```

### 13.3 삭제 (또는 이동)
```
src/shared/api/appsflyer/  →  src/shared/api/mmp/appsflyer/
src/app/api/appsflyer/sync/route.ts  →  참조 제거, /api/mmp/sync가 대체
```

---

## 14. 참고 자료

- 기존 crawler 설계: `docs/superpowers/specs/2026-04-20-sensortower-crawler-design.md`
- 기존 AppsFlyer 파이프라인 설계: `docs/superpowers/specs/2026-04-20-appsflyer-api-pipeline-design.md`
- L0/L1/L2 언어 레이어링 정책: `docs/superpowers/specs/2026-04-15-compass-positioning-language-layering-design.md`
- Beta 분포 참조: scipy.stats.beta (Python), Numerical Recipes §6.4 (betaincinv)
- Empirical Bayes + Shrinkage: Efron & Hastie, *Computer Age Statistical Inference* Ch. 7
