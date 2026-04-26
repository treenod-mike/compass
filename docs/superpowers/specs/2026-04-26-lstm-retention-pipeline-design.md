# LSTM Retention & Revenue Pipeline — Design Spec

**날짜**: 2026-04-26
**작업 식별자**: W9
**상태**: Draft (구현 시작 전)
**의존성**: W1 (AppsFlyer post-registration workflow, PR #4 머지됨)
**소비자**: VC Simulation (PR #9 머지됨), `RevenueForecast` chart, KPI cards

---

## 1. 목적 / 비목적

### 목적
실제 AppsFlyer cohort 데이터로부터 다음 두 snapshot을 매일 생성:
1. **Retention forecast** — 게임별 D1~D1095 retention curve (P10/P50/P90 밴드)
2. **Revenue forecast** — installs × retention × ARPDAU로 합성된 DAU/매출 P10/P50/P90

VC simulation, `RevenueForecast` chart, KPI cards가 mock 데이터 의존을 끊고 실데이터 위에서 작동하게 한다.

### 비목적
- 실 LSTM neural network training. Vercel Hobby + Cron에 GPU 없음, AppsFlyer 14-day backfill window는 LSTM 학습 set으로 부족, 등록 앱 1~3개로 sequential pattern learning의 통계적 power 부족. 이름은 "LSTM"으로 유지(기존 schema 호환)하되 내부 알고리즘은 통계적 추정.
- CPI 추정. CPI는 별도 파이프라인(W1.5 LevelPlay benchmark, MMM Phase 2)이 책임. 본 스펙은 unit-economics 표시(ROAS, payback)에서만 CPI를 참조.
- ARPDAU의 시간 변동 모델링. 현 단계는 trailing-window 평균으로 단일 점추정 (밴드는 retention 불확실성으로만 형성).

---

## 2. Unit Economics 흐름

```
                  ┌──────────────────┐
   Marketing $$ ─►│ ÷ CPI (LevelPlay)│─► installs/day  ┐
                  └──────────────────┘                 │
                                                       ▼
                  ┌──────────────────┐    ┌─────────────────────┐
   AppsFlyer ────►│ Cohort summary   │───►│ Retention forecast  │
   cohort         │ (W1)             │    │ (Bayesian shrinkage)│
                  └──────────────────┘    └─────────────────────┘
                                                       │
                                                       ▼
                  ┌──────────────────┐    ┌─────────────────────┐
   AppsFlyer ────►│ in_app_events    │───►│ ARPDAU estimate     │
   events (W1)    │ daily $/DAU      │    │ (trailing 14d mean) │
                  └──────────────────┘    └─────────────────────┘
                                                       │
                                                       ▼
                  ┌──────────────────────────────────────────┐
                  │ DAU(t) = Σ installs(t-a) × retention(a)  │
                  │ Revenue(t) = DAU(t) × ARPDAU             │
                  │ ROAS(t) = Revenue(t) / Spend(t)          │
                  └──────────────────────────────────────────┘
```

Mike가 제시한 핵심 chain:
- **Retention × Installs → DAU**
- **DAU × ARPDAU → Revenue**
- **CPI**: revenue chain의 일부가 아닌 spend 측 (`spend = installs × CPI`). 표시 단계에서 ROAS/payback 계산 시에만 결합.

---

## 3. 입력 데이터 모델

### 3.1 AppsFlyer Cohort Summary (W1 제공)
경로: Vercel Blob `appsflyer/cohort/{appId}/summary.json`
스키마: `src/shared/api/appsflyer/types.ts → CohortSummarySchema`

필요 필드:
- `cohorts[]` — `{ cohortDate, installs, retainedByDay: { d1, d7, d30 } }` (W1이 14-day window로 매일 갱신)
- `revenue.daily[]` — `{ date, sumUsd, purchasers }` (W1 in_app_events 집계)

### 3.2 Genre Prior (Sensor Tower)
경로: `src/shared/api/data/sensor-tower/merge-jp-snapshot.json`
스키마: `src/shared/api/prior-data.ts → priorByGenre` (기존)

필요 필드:
- `priorByGenre[genre]` — `{ d1: {mean, sd}, d7: {mean, sd}, d30: {mean, sd} }`

### 3.3 CPI Benchmark (참조만, 본 파이프라인 입력 아님)
경로: `src/shared/api/data/cpi-benchmarks/levelplay-snapshot.json`
용도: 본 파이프라인이 생성한 revenue snapshot을 소비하는 widget이 ROAS/payback을 계산할 때 별도 lookup.

### 3.4 게임 등록 메타
경로: Vercel Blob `appsflyer/apps/{appId}.json`
필요 필드: `gameKey` (장르 매핑용 — `sample-match-3 → puzzle_match3` 등 lookup table 별도 정의)

---

## 4. 알고리즘

### 4.1 Retention forecast (Beta-Binomial shrinkage)

각 게임 g, 각 day-N 관측치 (N ∈ {1, 7, 30}):
- 관측: `k = retainedByDay.dN`, `n = installs` (cohort summary에서)
- prior: `priorByGenre[genre].dN ~ Beta(α₀, β₀)` 변환 (mean/sd → α/β)
- posterior: `Beta(α₀ + k, β₀ + n - k)`
- `p50 = (α₀ + k) / (α₀ + β₀ + n)`
- `p10, p90` = posterior CDF 의 10/90 quantile (Beta CDF closed-form: `regularizedIncompleteBeta` — 기존 `src/shared/lib/bayesian-stats/`에 있음 (PR #2 의존))

### 4.2 D1~D1095 보간 (Power-law decay)

D1, D7, D30 세 점만으로 1095일 forecast — 표준 mobile gaming retention curve 형태:
- `r(t) = a × t^(-b)` (power-law)
- `(D1, D7, D30) → (a, b)` 회귀 (log-log 선형 회귀, 3 점)
- 이로부터 D2, D3, ..., D1095 보간
- P10/P50/P90 각각 별도 보간 → 동일 schema의 `points[]` 채움

### 4.3 ARPDAU 추정

```
ARPDAU = sum(revenue.daily[last 14 days].sumUsd) / sum(DAU(t) for last 14 days)
DAU(t) = Σ_{a=0..t} cohort_size(t-a) × retention_observed(a)
```

- trailing 14-day mean (15-day window이지만 1일 lag로 14)
- `retention_observed`: 관측된 cohort retention (W1의 `retainedByDay`)
- ARPDAU 단일 점추정. 분산은 매출 일별 표준편차로 별도 산출 가능하나 v1에서는 점추정만.

### 4.4 Revenue forecast 합성

미래 t ∈ [today+1, today+90]:
- `installs(t)` 가정: 최근 14일 installs 평균을 forward fill (UA budget 변동은 별도 시나리오)
- `DAU(t) = Σ_{a=0..t-today_age} installs(t-a) × retention_p50(a)` — P50 retention만으로 점추정
- `Revenue(t) = DAU(t) × ARPDAU`
- 밴드: P10/P90 retention curve로 동일 합성 → `revenueP10/P50/P90`

---

## 5. 출력 스키마

기존 `LstmSnapshot` schema 호환을 깨지 않도록 **두 snapshot으로 분리**:

### 5.1 `retention-snapshot.json` (기존 호환)
경로: Vercel Blob `lstm/retention-snapshot.json` (현재 mock 위치 동일)
스키마: `LstmSnapshotSchema` (`src/shared/api/vc-simulation/types.ts`) — 변경 없음

`model.name` = `"retention-bayesian-shrinkage"`로 변경, `version` = `"v1-statistical"`. `hyperparameters.sample_count`는 cohort summary 의 총 installs로 redefine.

### 5.2 `revenue-snapshot.json` (신규)
경로: Vercel Blob `lstm/revenue-snapshot.json`
스키마 (신규):
```ts
export const RevenueSnapshotSchema = z.object({
  schema_version: z.literal("1.0"),
  generated_at: z.string().datetime(),
  source_retention_at: z.string().datetime(),  // retention snapshot generated_at 동기 추적
  arpdau: z.object({
    perGame: z.record(z.string(), z.number().positive()),  // game_id → KRW (or USD)
    currency: z.enum(["KRW", "USD"]),
    windowDays: z.number().int().positive(),
  }),
  installsAssumption: z.object({
    perGame: z.record(z.string(), z.number().positive()),  // game_id → installs/day forward
    method: z.literal("trailing-14d-mean"),
  }),
  forecast: z.record(
    z.string(),  // game_id
    z.object({
      points: z.array(z.object({
        day: z.number().int().positive(),  // days from generated_at
        dauP50: z.number().nonnegative(),
        revenueP10: z.number().nonnegative(),
        revenueP50: z.number().nonnegative(),
        revenueP90: z.number().nonnegative(),
      })).min(30).max(365),
    }),
  ),
})
```

---

## 6. 실행 / 배포

### 6.1 Vercel cron handler
경로: `src/app/api/lstm/cron/route.ts`
스케줄: `vercel.json` `crons` 추가 — `{ path: "/api/lstm/cron", schedule: "30 18 * * *" }` (UTC 18:30 = KST 03:30, AppsFlyer cron `0 18 * * *` 30분 후)

플로우:
1. `listApps()` → 등록된 appId 목록
2. 각 appId 별로:
   a. `getCohortSummary(appId)` 로딩
   b. `gameKey → genre` 매핑
   c. `priorByGenre[genre]` lookup
   d. Beta-Binomial shrinkage → 11+ point retention curve
   e. ARPDAU 추정
   f. Revenue forecast 합성
3. 결과 통합 → `retention-snapshot.json` + `revenue-snapshot.json` Blob put

### 6.2 보안
- AF cron과 동일한 `CRON_SECRET` 헤더 검증
- 권한: production env에 `BLOB_READ_WRITE_TOKEN` 자동 주입 (Vercel)

---

## 7. 의존성 / 통합 단계

| Phase | 작업 | 의존 |
|---|---|---|
| 0 | 본 spec 합의 (이 문서) | — |
| 1 | `RevenueSnapshotSchema` 추가 + `lstm/` Blob path 정의 | — |
| 2 | Beta-Binomial shrinkage util (`src/shared/lib/bayesian-stats/retention.ts`) | PR #2 머지 |
| 3 | `/api/lstm/cron` handler 구현 + 14d backfill 시 즉시 1회 실행 | Phase 1, 2 |
| 4 | VC simulation의 mock retention-snapshot.json 제거 → real Blob 소비 | Phase 3 |
| 5 | `RevenueForecast` chart wiring (mock revenue → revenue-snapshot.json) | Phase 3 |
| 6 | KPI cards (ROAS/payback) — CPI snapshot + revenue snapshot 결합 | Phase 5 |

---

## 8. Fallback / Staleness

| 상황 | 동작 |
|---|---|
| AppsFlyer cohort summary 없음 (W1 첫 backfill 미완료) | snapshot 미생성, UI는 mock fallback flag 표시 |
| `retention-snapshot.json` 7일 이상 stale | UI 상단 stale 배지, 모든 차트는 캐시값 |
| `revenue-snapshot.json` 7일 이상 stale | KPI cards 회색 처리 + "데이터 새로고침 필요" |
| Sensor Tower prior 14일 이상 stale (기존 `isPriorStale`) | shrinkage 강도 0.5배로 감쇠 (prior 신뢰도 하향) |
| ARPDAU = 0 (매출 events 0건) | revenue snapshot 미생성, retention만 발행 |

---

## 9. 향후 확장

- ARPDAU 시간 변동 모델 (AR(1) 또는 random-walk Gaussian state-space)
- UA budget 시나리오 simulator → installs(t) 가변
- 게임 cross-correlation (포트폴리오 단위 forecast)
- 실 LSTM 도입 — 60+ days backfill 가능해지고 GPU 인프라 확보된 후

---

## 10. 검증 기준

- [ ] tsc clean
- [ ] vitest: shrinkage util + cron handler 단위 테스트
- [ ] cron handler local invoke로 Blob put 1회 성공
- [ ] VC simulation page에서 dataSourceBadge `real`로 표시
- [ ] `RevenueForecast` chart가 mock 색상 → 실데이터 색상으로 전환
- [ ] 7일 stale staleness 배지 정상 발현
