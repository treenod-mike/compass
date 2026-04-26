# W9 Phase 2 — Retention Forecast Util Design Spec

**날짜**: 2026-04-26
**작업 식별자**: W9 Phase 2
**상태**: Draft (구현 시작 전)
**상위 spec**: `docs/superpowers/specs/2026-04-26-lstm-retention-pipeline-design.md` (PR #13, main 머지)
**의존성**:
- W9 Phase 1 (`RevenueSnapshotSchema` + loader, PR #14 머지)
- 기존 `src/shared/lib/bayesian-stats/` 라이브러리 (Beta-Binomial, betaQuantile 등 — PR #4 ceede63 흡수)
**소비자**: Phase 3 Vercel cron handler (`/api/lstm/cron`)

---

## 1. 목적 / 비목적

### 목적
W9 spec §4.1(Beta-Binomial shrinkage) + §4.2(power-law D1→D1095 보간)에 정의된 두 알고리즘을 **순수 함수 라이브러리**로 구현. 입력은 `(observation, prior)`, 출력은 `(day, p10, p50, p90)` 배열. 부수 효과(파일 IO, 네트워크, 환경변수) 0건.

이 단계의 산출물은 widget을 직접 변경하지 않는다. 다음 PR(Phase 3 cron handler)이 본 util을 호출해 `retention-snapshot.json`을 Vercel Blob에 쓰면, 그 시점부터 widget 데이터 소스가 mock에서 real로 자연스럽게 전환된다.

### 비목적
- ARPDAU 추정(§4.3), Revenue 합성(§4.4) — Phase 3 cron handler 책임. 본 util은 retention만 다룸.
- File IO, Vercel Blob, env lookup — 모두 Phase 3 cron handler 책임.
- Stale-prior 감쇠 0.5x 결정 — caller(cron handler)가 `priorWeight` 매개변수로 주입. 본 util은 weight를 받기만 함.
- Widget UI 변경 — 본 PR에서 변경 0건. §7 Consumer Widget Preview는 향후 wiring 단계에서의 표시 형태를 미리 명시할 뿐.

---

## 2. Scope

W9 spec §4의 4개 알고리즘 중 **§4.1 + §4.2만** 본 PR에 포함:

| spec 절 | 본 PR 포함 여부 | 책임 위치 |
|---|---|---|
| §4.1 Beta-Binomial shrinkage retention posterior | ✅ | `bayesian-stats/retention.ts` |
| §4.2 Power-law D1→D1095 보간 (+ floor) | ✅ | `bayesian-stats/power-law.ts` |
| §4.3 ARPDAU trailing-14d | ❌ Phase 3 | `app/api/lstm/cron/route.ts` |
| §4.4 Revenue forecast 합성 | ❌ Phase 3 | `app/api/lstm/cron/route.ts` |

---

## 3. 알고리즘

### 3.1 Beta-Binomial shrinkage (W9 spec §4.1 인용)

각 day-N (N ∈ {1, 7, 30}):
- 관측: `k = retainedByDay.dN`, `n = installs`
- prior: `priorByGenre[genre].dN ~ Beta(α₀, β₀)` (mean/sd → α/β 변환)
- posterior: `Beta(α₀×w + k, β₀×w + n − k)` — `w` = `priorWeight` (기본 1.0, stale 시 caller가 0.5)
- `p10, p50, p90` = posterior CDF의 10/50/90 quantile (`betaQuantile`, 기존 라이브러리 호출)

**W9 spec 보강**: 상위 spec §4.1은 `p50 = (α₀ + k) / (α₀ + β₀ + n)`(posterior **mean**)으로 단축 표기. 본 PR은 mean이 아닌 **CDF의 50% quantile(median)** 을 일관되게 사용 — 비대칭 Beta(α 또는 β가 작을 때)에서도 p10 ≤ p50 ≤ p90 정의역이 무너지지 않게. α, β > 1 영역에서 mean과 median 차이는 1% 이하라 W9 spec의 의도와 충돌하지 않음.

### 3.2 Power-law fit (W9 spec §4.2 인용)
`r(t) = a × t^(-b)`, log-log 선형 회귀:
- `log r = log a − b × log t`
- 3 점(D1, D7, D30) least-squares fit → `(a, b)`
- P10/P50/P90 각각 별도 fit → 3개의 `(a, b)` 쌍
- `b ≤ 0` 산출 시 throw `NonDecreasingCurveError`

### 3.3 Floor 산출 (W9 spec 보강 — Mike 결정)

W9 spec §4.2는 pure power-law `r(t) = a × t^(-b)`만 명시. 이는 `t → ∞`에서 0으로 수렴하므로 D1095 LTV가 비현실적으로 작아짐. 대응:

```
1. prior(D1, D7, D30 mean)에 power-law fit → (a_prior, b_prior)
2. floor = a_prior × 365^(-b_prior) / 3
3. 모든 P10/P50/P90 곡선에 동일 floor 적용:
     r_floored(t) = max(a × t^(-b), floor)
```

근거: prior는 장르 평균이고, 실제 잔존율은 평균보다 낮음. floor를 prior D365의 1/3로 잡으면 장르마다 자동 조정되며, magic number 직접 박지 않음.

---

## 4. API 표면

```ts
// src/shared/lib/bayesian-stats/retention.ts

export type BetaPrior = { alpha: number; beta: number }
export type BinomialObs = { k: number; n: number }
export type PriorMoments = { mean: number; sd: number }

export function betaFromMoments(p: PriorMoments): BetaPrior

export function bayesianRetentionPosterior(args: {
  prior: BetaPrior
  observation: BinomialObs
  priorWeight?: number  // default 1.0
}): {
  posterior: BetaPrior
  p10: number
  p50: number
  p90: number
}

export type RetentionForecastPoint = {
  day: number
  p10: number
  p50: number
  p90: number
}

export function retentionForecast(args: {
  observations: { d1: BinomialObs; d7: BinomialObs; d30: BinomialObs }
  priors: { d1: PriorMoments; d7: PriorMoments; d30: PriorMoments }
  priorWeight?: number  // default 1.0
  maxDay?: number  // default 1095
}): RetentionForecastPoint[]

// src/shared/lib/bayesian-stats/power-law.ts

export type PowerLawFit = { a: number; b: number }

export function fitPowerLaw(
  points: Array<{ day: number; value: number }>
): PowerLawFit

export function extrapolatePowerLawCurve(args: {
  fit: PowerLawFit
  maxDay: number
  floor: number
}): number[]  // length === maxDay, index i → day (i+1)
```

`bayesian-stats/index.ts`는 위 함수/타입을 추가 export. 기존 export 무변경.

---

## 5. Edge case

| 상황 | 처리 |
|---|---|
| `observation.n === 0` | posterior = prior 그대로 |
| `observation.k > observation.n` | throw `InvalidObservationError` |
| `prior.sd === 0` 또는 `mean(1−mean) ≤ sd²` | throw `DegenerateDistributionError` |
| `prior.mean ≤ 0` 또는 `≥ 1` | throw `InvalidPriorMomentsError` |
| power-law fit이 `b ≤ 0` 산출 | throw `NonDecreasingCurveError` |
| `maxDay > 1095` 또는 `maxDay ≤ 0` | throw `MaxDayOutOfRangeError` |
| `priorWeight ≤ 0` | throw `InvalidPriorWeightError` |

기존 `bayesian-stats/`의 `DegenerateDistributionError` 클래스를 재사용. 신규 에러 클래스는 같은 파일에 정의.

---

## 6. 테스트 전략

### 6.1 단위 테스트 (`__tests__/retention.test.ts`, `__tests__/power-law.test.ts`)

**`betaFromMoments`**:
- mean=0.2, sd=0.1 → α≈3, β≈12 (수치 검증)
- mean(1−mean) = sd² 인 degenerate case → throw

**`bayesianRetentionPosterior`**:
- prior Beta(2, 8), obs k=80/n=100 → posterior Beta(82, 28), p50=82/110≈0.7455
- priorWeight=0.5: prior Beta(2, 8), obs k=80/n=100 → posterior Beta(81, 24)
- n=0: posterior = prior

**`fitPowerLaw`**:
- (1, 0.5), (7, 0.3), (30, 0.15) → b ≈ 0.36, a ≈ 0.5
- (1, 0.3), (7, 0.5), (30, 0.7) → throw `NonDecreasingCurveError`

**`extrapolatePowerLawCurve`**:
- 곡선 길이 1095, 마지막 값 ≥ floor

**Edge cases**: 위 §5 표 7개 모두 별도 테스트.

### 6.2 Integration 테스트 (`__tests__/retention-forecast.test.ts`)

골든 케이스 1개 — `poko_merge`(gameKey)가 속한 `merge_jp`(genre) prior와 합리적 cohort 가정:
- obs: D1=70/100, D7=35/100, D30=15/100
- prior: `merge-jp-snapshot.json`의 `priorByGenre.merge_jp` 실제 값 (장르 단위, gameKey 단위 아님)
- 출력 길이 1095, 12개 sample day(1, 7, 14, 30, 60, 90, 180, 365, 540, 730, 900, 1095) snapshot 매칭
- 모든 day에서 `p10 ≤ p50 ≤ p90`, `p50` monotone non-increasing
- D1095 ≥ floor

---

## 7. Consumer Widget Preview (gameboard 톤)

본 PR은 widget을 변경하지 않는다. 그러나 본 util이 산출하는 `RetentionForecastPoint[]`가 향후(Phase 5) 어떤 시각으로 표시될지를 spec에 미리 명시한다 — Mike 요청에 따라 gameboard 톤(Pretendard Variable, metric-card 스타일).

### 7.1 RetentionCurve chart 소비

기존 `src/widgets/charts/ui/retention-curve.tsx`는 이미 P10/P50/P90 fan chart를 그린다. 본 util 출력의 매핑:

```
RetentionForecastPoint[]  →  RetentionDataPoint[] (mock-data.ts 타입)
{ day, p10, p50, p90 }   →  { day, retentionLowBand, retentionMedian, retentionUpperBand }
```

시각 레이어 (gameboard 톤 그대로 유지):
```
┌──────────────────────────────────────────────────┐
│  RETENTION CURVE             [3년 1095일 보기 ▾] │  ← 10px uppercase muted label
│                                                  │
│  ▒▒▒▒░░░░  P90 band (light fill)                 │
│  ━━━━━━━━  P50 line (1.5px brand blue)           │
│  ▒▒▒▒░░░░  P10 band                              │
│   ●         P50 dot (solid, observed cohort)     │
│   ┊         Asymptotic Arrival (dashed gray)     │
│                                                  │
│  D1   D7   D30   D90   D365   D1095              │  ← Geist Mono tabular
└──────────────────────────────────────────────────┘
```

차트는 무변경 — 데이터 소스만 mock에서 본 util 출력으로 swap.

### 7.2 KPI card 소비

`src/widgets/dashboard/ui/kpi-cards.tsx` 패턴(label 10px uppercase + value 32~36px extrabold + unit 14px semibold)에 retention 메트릭이 들어갈 자리:

```
┌─────────────────────┐
│  D7 RETENTION       │  ← 10px uppercase tracking-wider muted
│                     │
│   34.2 %            │  ← 36px extrabold, 14px semibold unit
│   ▍ 31.8 — 36.5     │  ← 12px tabular muted, P10–P90 band
│                     │
│  prior weight 0.5   │  ← 10px muted, stale 시만 표시
└─────────────────────┘
```

매핑:
```ts
const d7 = forecast.find(p => p.day === 7)
const value = d7.p50 * 100      // → 34.2 %
const band = [d7.p10 * 100, d7.p90 * 100]  // → 31.8 — 36.5
```

D30, D90, D365 카드도 동일 패턴.

### 7.3 색상 / 톤 재확인

본 util은 색상/톤을 결정하지 않는다 — `chart-colors.ts`의 `RETENTION_CURVE_COLORS` 와 `chart-typography.ts`의 `CHART_TYPO`가 이미 gameboard 표준을 정의. 본 util은 숫자만 만든다.

---

## 8. 본 PR이 하지 않는 것 (Scope 밖)

- `/api/lstm/cron` route handler 작성
- `vercel.json` cron 항목 추가
- Vercel Blob `retention-snapshot.json` put
- `RetentionCurve` chart의 데이터 소스 swap
- KPI card 신설/배치
- ARPDAU 추정, Revenue 합성

위 항목은 모두 Phase 3 이후 별도 PR.

---

## 9. 검증 기준

- [ ] `tsc --noEmit` clean (worktree 전체)
- [ ] `npm test` pass — 신규 단위 + integration 테스트 포함
- [ ] 기존 89+ 테스트 회귀 0건
- [ ] 신규 함수 4개의 cyclomatic complexity ≤ 8 (단위 테스트로 가지치기 가능 수준)
- [ ] `bayesian-stats/index.ts` 의 신규 export가 자기충족적 (외부 import 없이 type 추론 완결)
- [ ] CodeRabbit 리뷰 thread 모두 resolve
