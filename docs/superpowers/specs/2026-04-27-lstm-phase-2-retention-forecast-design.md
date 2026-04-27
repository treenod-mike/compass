# LSTM Phase 2 — Retention & Revenue Forecast Pipeline (Compute Layer)

**Status**: Design spec, awaiting implementation plan
**Depends on**: W1 AppsFlyer post-registration workflow (PR #4, merged), W9 Phase 1 RevenueSnapshot schema (PR #14, merged), Bayesian stats primitives (`retentionForecast`, `fitPowerLaw`, `extrapolatePowerLawCurve` — already on this branch)
**Replaces**: mock data in `src/shared/api/data/lstm/revenue-snapshot.json` and existing `lstm/retention-snapshot.json`
**Out of scope (Phase 3)**: VC simulation / RevenueForecast chart / KPI 카드 wiring, UI stale 배지, CPI 결합 ROAS payback

---

## 1. 배경

W9 디자인 스펙(2026-04-26)이 정의한 LSTM 파이프라인의 **compute layer**를 구현한다. Phase 1에서는 `RevenueSnapshot` zod 스키마와 mock JSON만 만들었고 dashboard widget은 mock으로 작동 중이다. Phase 2는 매일 한 번 실행되는 cron이 AppsFlyer cohort summary와 Sensor Tower 장르 prior를 결합해 retention/revenue forecast를 산출하고 두 Vercel Blob snapshot으로 publish하는 파이프라인을 만든다.

원래 7개 모듈로 계획했으나, 본 브랜치에 이미 `bayesianRetentionPosterior` + `fitPowerLaw` + `extrapolatePowerLawCurve` + 통합 `retentionForecast` 가 추가되어 있어 shrinkage/power-law 모듈은 별도 신설 없이 호출만 한다. **새로 추가되는 LSTM 도메인 코드는 5개 모듈 + cron route + dry-run script 총 7개 파일**.

---

## 2. Architecture

```
[Vercel Cron 18:00 UTC]
  AppsFlyer sync → appsflyer/cohort/{appId}/summary.json (Blob)
                 → appsflyer/apps/{appId}.json (genre/region 메타 포함)

         ↓ 30분 간격

[Vercel Cron 18:30 UTC] ← Phase 2 신규
  GET /api/lstm/cron
    1. CRON_SECRET 검증
    2. Blob 병렬 fetch (cohort summary + apps meta)
    3. 게임별 sufficiency check
    4. 충족 게임 → forecast-builder
       - retentionForecast(observations, priors, ...) → 1095d 곡선
       - estimateArpdau(revenue, cohorts, 14d) → arpdauUsd
       - revenue forecast = DAU(t) × ARPDAU + bands
    5. 미충족 게임 → skipped[]
    6. dual snapshot publish:
       - lstm/retention-snapshot.json (LstmSnapshot, 기존 schema)
       - lstm/revenue-snapshot.json (RevenueSnapshot, Phase 1 schema)
    7. JSON response: { ok, processed, skipped, snapshots }

         ↓ 다음 cron tick까지 dashboard widget이 Phase 1 accessor로 읽음
```

### 핵심 설계 원칙
1. **Pure function 격리** — sufficiency/arpdau/forecast-builder는 외부 의존 0. cron route + blob-writer만 부수효과
2. **Backward compat** — 출력 schema는 Phase 1 그대로. consumer 코드 수정 0
3. **Partial publish** — 한 게임 fail이 전체 cron 실패로 전파되지 않음 (W1 AppsFlyer "warnings" 패턴)
4. **CPI 미포함** — ROAS/payback은 별도 LevelPlay benchmark 파이프라인. Phase 2는 retention + revenue까지만

### 의존성 (이미 존재)
- `retentionForecast`, `bayesianRetentionPosterior` (`src/shared/lib/bayesian-stats/retention.ts`)
- `fitPowerLaw`, `extrapolatePowerLawCurve` (`src/shared/lib/bayesian-stats/power-law.ts`)
- `priorByGenre` (`src/shared/api/prior-data.ts`)
- `RevenueSnapshotSchema`, `loadRevenueSnapshot` 등 (`src/shared/api/lstm/revenue-snapshot.ts`)
- AppsFlyer Blob types: `CohortSummary`, `AppState` (`src/shared/api/appsflyer/types.ts`)
- Vercel Blob client + `CRON_SECRET` env

### 신규 의존성
- AppsFlyer apps Blob에 `genre`(예: `"Merge"`)와 `region`(예: `"JP"`) 필드 추가. connections 등록 dialog의 form에 select 두 개 추가하는 단순 변경. `appsflyer/types.ts`의 `AppMetaSchema` 확장.
- 기존 등록 게임 1개(poko_merge)는 backward-compat: `AppMetaSchema`의 genre/region을 `optional`로 두되 sufficiency check에서 누락 시 `missing_genre_meta`로 skip. Mike가 1회성 manual patch(connections dialog의 edit mode 또는 직접 Blob put)로 채워 넣음. Phase 2 첫 cron 직전 1회.

---

## 3. Components

### 3.1 `src/shared/api/lstm/arpdau.ts`
```ts
export function estimateArpdau(args: {
  revenueDaily: { date: string; sumUsd: number }[]
  cohorts: { date: string; installs: number; retainedByDay: { d1: number; d7: number; d30: number } }[]
  windowDays?: number   // default 14
}): { arpdauUsd: number; effectiveDays: number }
```
**책임**: trailing windowDays 윈도우에서 `Σrevenue / Σ DAU(t)`. DAU(t) = Σ cohort_size(t-a) × observed_retention(a).
- DAU 합이 0이면 `arpdauUsd = 0` 반환 (throw 안 함, 정책: silent zero)
- 윈도우 미만 데이터면 `effectiveDays`에 실측값 노출 (consumer가 신뢰성 판단)

### 3.2 `src/shared/api/lstm/sufficiency.ts`
```ts
export type SufficiencyReason =
  | "insufficient_cohort_history"   // < 30d
  | "insufficient_revenue_history"  // < 14d
  | "dead_d30_retention"            // D30 = 0
  | "missing_genre_meta"            // genre 또는 region 누락
  | "unknown_genre_prior"           // priorByGenre[key] 없음

export type SufficiencyResult =
  | { ok: true; gameId: string; genreKey: string }
  | { ok: false; gameId: string; reason: SufficiencyReason }

export function checkSufficiency(
  cohortSummary: CohortSummary,
  appsMeta: { appId: string; genre?: string; region?: string },
): SufficiencyResult
```
**책임**: forecast-builder 진입 전 5-게이트 검증. genre/region 결합 키(`"Merge:JP"`)가 priorByGenre에 존재하는지까지 확인해야 forecast-builder에서 throw 안 남.

### 3.3 `src/shared/api/lstm/forecast-builder.ts`
```ts
export function buildGameForecast(args: {
  cohortSummary: CohortSummary
  appsMeta: { appId: string; genre: string; region: string }
  prior: { d1: EmpiricalDist; d7: EmpiricalDist; d30: EmpiricalDist }
  priorEffectiveN: number
  horizonDays?: number   // default 365 (revenue forecast horizon)
  retentionMaxDay?: number  // default 1095
}): {
  retentionCurve: RetentionForecastPoint[]      // 1~1095, [{day, p10, p50, p90}]
  revenueForecast: RevenueForecastPoint[]        // 0~horizonDays, [{day, revenueP10, revenueP50, revenueP90, dauP50}]
  arpdauUsd: number
  installsAssumption: number
  effectiveDays: number
}
```
**책임**: 게임 1개에 대한 full forecast 조립.
1. cohorts 합산 → `observations: { d1, d7, d30 }: BinomialObs`
2. `retentionForecast(...)` 호출 → 1095d 곡선
3. `estimateArpdau(...)` 호출
4. `installsAssumption` = trailing 14d cohort install mean
5. revenue convolution: `DAU(t) = Σ_{a=0..t} installsAssumption × P50_retention(a)`, `revenueP50(t) = DAU(t) × arpdauUsd`. P10/P90 동일 방식.
6. 모든 point에서 `P10 ≤ P50 ≤ P90` monotonic clamp (수치오차 보호)
7. arpdau=0인 경우에도 throw 안 함 — revenueForecast 전부 0인 채로 정상 반환. cron route가 결과를 보고 revenue snapshot에서 게임을 제외.

`prior` 입력은 cron route가 `priorByGenre[genreKey]`에서 가져와 주입(`genreKey`는 sufficiency가 산출). `priorEffectiveN`은 cron route가 `prior-data.ts`의 `computeEffectiveN(priorTopGames)` 로 계산해 주입.

### 3.4 `src/shared/api/lstm/blob-writer.ts`
```ts
export async function writeLstmSnapshots(args: {
  retentionSnapshot: LstmSnapshot
  revenueSnapshot: RevenueSnapshot | null   // ARPDAU=0이면 null
}): Promise<{ retentionUrl: string; revenueUrl: string | null }>
```
**책임**: 두 snapshot zod 검증 후 Vercel Blob put. 검증 실패 시 throw. revenueSnapshot이 null이면 retention만 publish (W9 spec: ARPDAU=0이면 retention만 emit). Blob put 3회 재시도 (500ms/1s/2s backoff).

### 3.5 `src/app/api/lstm/cron/route.ts`
```ts
export async function GET(req: Request): Promise<Response>
```
**책임 (thin orchestrator)**:
- `Authorization: Bearer ${CRON_SECRET}` 검증, 미일치 시 401
- 등록된 모든 app meta + cohort summary 병렬 fetch (Blob list + 각 fetch)
- 게임별로 `checkSufficiency` → 충족 게임은 `priorByGenre[genreKey]` lookup 후 `buildGameForecast` 호출
- 빌더 결과의 `arpdauUsd === 0`이면 revenue snapshot의 forecast/arpdau/installsAssumption 3-맵에서 해당 게임 제외 + skipped[] reason: `"zero_arpdau"` 기록 (retention snapshot에는 그대로 포함)
- 두 snapshot 조립 → `writeLstmSnapshots`
- 충족 게임 0개면 retentionSnapshot은 빈 forecast[], revenueSnapshot은 null (publish skip)
- response: `{ ok, processed: string[], skipped: { gameId, reason }[], snapshots: { retentionUrl: string | null, revenueUrl: string | null } | null, elapsedMs }`

**스케줄**: `vercel.json` `crons`에 `{ path: "/api/lstm/cron", schedule: "30 18 * * *" }` 추가 (UTC 18:30 = KST 03:30).

### 3.6 `scripts/lstm-dry-run.ts`
```bash
npm run lstm:dry                            # 모든 등록 앱
npm run lstm:dry -- --gameId=<id>           # 1 게임만
```
**책임**: 같은 fetch + builder 경로를 타되 Blob put 대신 stdout JSON 출력. Mike가 운영 전/배포 전 1회 수동 검증, 실제 dashboard 값과 비교.

### 3.7 의존성 그래프
```
cron/route.ts ──► forecast-builder ──► retentionForecast (existing)
                                   ──► estimateArpdau
              ──► sufficiency
              ──► blob-writer ──► @vercel/blob
                              ──► RevenueSnapshotSchema (zod)
scripts/lstm-dry-run.ts ──► forecast-builder + sufficiency + (Blob fetch helper 공유)
```

---

## 4. Data Flow

cron 트리거 시 1게임(예: poko_merge) 기준 데이터 흐름:

### Step 0 — 트리거
Vercel Cron이 `GET /api/lstm/cron` 호출, `Authorization: Bearer ${CRON_SECRET}` 첨부.

### Step 1 — Input fetch (병렬)
```
appsflyer/apps/{appId}.json  →  { appId, genre: "Merge", region: "JP", currency, ... }
appsflyer/cohort/{appId}/summary.json  →  CohortSummary {
  cohorts: [{ date, installs, retainedByDay: { d1, d7, d30 } }, ...30~60d],
  revenue: { daily: [{ date, sumUsd }, ...], total: { sumUsd } },
}
priorByGenre["Merge:JP"]  →  { d1: {p10,p50,p90}, d7: {...}, d30: {...} }
```

### Step 2 — Sufficiency check
5-게이트 통과 여부. 미통과 시 즉시 skipped[]에 기록 후 다음 게임으로.

### Step 3 — Retention forecast (existing primitive)
모든 cohort 합산:
```
observations.d1 = { n: Σ installs (D1 도달한 cohort), k: Σ retainedByDay.d1 }
observations.d7 = { n: Σ installs (D7 도달한 cohort), k: Σ retainedByDay.d7 }
observations.d30 = { n: Σ installs (D30 도달한 cohort), k: Σ retainedByDay.d30 }
```
`retentionForecast({ observations, priors, priorEffectiveN, maxDay: 1095 })`
→ `RetentionForecastPoint[1095]` (each `{day, p10, p50, p90}`)

### Step 4 — ARPDAU
```
estimateArpdau({ revenueDaily: revenue.daily.last14, cohorts, windowDays: 14 })
→ { arpdauUsd: 0.55, effectiveDays: 14 }   // 예시
```

### Step 5 — Revenue forecast (0~365d)
```
installsAssumption = trailing-14d cohort install mean = 800   // 예시
for t in 0..365:
  DAU_p50(t) = Σ_{a=0..min(t,1095)} installsAssumption × retentionCurve[a].p50
  revenueP50(t) = DAU_p50(t) × arpdauUsd
  // P10/P90 동일 방식, 다른 quantile retention curve 사용
  // monotonic clamp
```

### Step 6 — Snapshot 조립 + Blob publish
```
retentionSnapshot = LstmSnapshot { ..., forecast: [{ game_id, curve: retentionCurve }] }
revenueSnapshot = RevenueSnapshot {
  ...,
  arpdau: { perGame: { [appId]: arpdauUsd }, currency: "USD", windowDays: 14 },
  installsAssumption: { perGame: { [appId]: installsAssumption }, basis: "trailing-14d-mean" },
  forecast: [{ game_id, points: revenueForecast }],
}
writeLstmSnapshots({ retentionSnapshot, revenueSnapshot })
```

### Step 7 — Response
```json
{
  "ok": true,
  "processed": ["poko_merge"],
  "skipped": [],
  "snapshots": {
    "retentionUrl": "https://blob.vercel-storage.com/lstm/retention-snapshot.json",
    "revenueUrl":  "https://blob.vercel-storage.com/lstm/revenue-snapshot.json"
  },
  "elapsedMs": 2340
}
```

---

## 5. Error Handling

| 실패 지점 | 정책 | Cron exit |
|---|---|---|
| CRON_SECRET 미일치 | 401 응답, abort | 401 |
| 등록 앱 0개 | `{ ok: true, processed: [], skipped: [], snapshots: null }` | 200 |
| Blob fetch 네트워크 fail | 3회 backoff(500/1000/2000ms) 후 abort | 502 |
| CohortSummary zod parse fail | 해당 게임 skipped[reason: "input_schema_invalid"], 계속 | 200 |
| Sufficiency fail | skipped[reason], 계속 | 200 |
| `retentionForecast` throw (degenerate prior, NaN, NonDecreasingCurve 등) | 게임 skip, reason: "retention_forecast_failed" | 200 |
| ARPDAU = 0 | retention snapshot은 emit, revenue snapshot에서 게임 skip + skipped[reason: "zero_arpdau"] | 200 |
| 출력 RevenueSnapshotSchema validation fail | 게임 skip, reason: "output_schema_invalid", warning log | 200 |
| Vercel Blob put fail | 3회 재시도, 그래도 실패 시 cron exit 502 (atomic 보장) | 502 |

### 핵심 원칙
1. **One game's failure ≠ entire cron failure** — 게임 단위 격리
2. **Best-effort atomic publish** — Vercel Blob에 트랜잭션 없음. retention put과 revenue put이 순차로 호출되며, retention 성공 후 revenue 실패 시 cron은 502 반환하고 다음 tick(24h 후)에 두 파일 다시 publish. 잠시 retention만 신규/revenue는 구버전인 inconsistency window 허용 (>24h stale 게이트가 자연 보호).
3. **Cron-level retry는 Vercel에 위임** — handler 안에서 무한 재시도 안 함. Blob put만 짧은 backoff 3회. 일시 오류는 다음 cron tick에 자연 회복
4. **Logging** — 모든 skipped reason은 console.log (Vercel observability에 자동 수집). Sentry/PagerDuty 미연동
5. **Ordering 보호** — output zod 통과 전 monotonic clamp으로 P10/P50/P90 순서 보장 (수치오차 1e-9 수준)

### Validation 보호망 (defense-in-depth)
1. **Input zod**: `CohortSummarySchema.parse()` (existing)
2. **Domain invariant**: sufficiency check
3. **Algorithmic safety**: retentionForecast의 기존 throw paths
4. **Output zod**: `RevenueSnapshotSchema.parse()` 직전 monotonic clamp
5. **Cron contract**: response JSON에 항상 `{ processed, skipped, snapshots }` 3-key 구조

### Out of scope
- Sentry/PagerDuty 알림 — 새벽 cron, next-day 인지로 충분
- 데이터 backfill 모드 — 별도 CLI 추가 시 (지금은 yagni)
- Human-in-the-loop 승인 — 자동 publish + UI stale 배지(Phase 3)로 충분

---

## 6. Testing

Unit tests (vitest) + CLI dry-run 2층. Golden snapshot regression 없음 (Mike 피드백: 실측 비교로 충분).

### 6.1 Unit tests

각 모듈 `__tests__/` 디렉토리.

**`arpdau.test.ts`**
- 표준 케이스: revenue=[100×14], DAU=[200×14] → arpdauUsd=0.5, effectiveDays=14
- 짧은 데이터: 7d만 있을 때 effectiveDays=7
- revenue all-zero → arpdauUsd=0
- DAU all-zero → arpdauUsd=0 (silent zero, 정책)

**`sufficiency.test.ts`**
- 정상: 32d cohort + 14d revenue + D30=0.05 + meta + known prior → ok:true
- 25d cohort → "insufficient_cohort_history"
- 10d revenue → "insufficient_revenue_history"
- D30=0 → "dead_d30_retention"
- genre 누락 → "missing_genre_meta"
- genre="Unknown:XX" → "unknown_genre_prior"

**`forecast-builder.test.ts`**
- realistic poko_merge fixture → output schema valid
- output retentionCurve.length === 1095, revenueForecast.length === 366
- 모든 point에서 P10 ≤ P50 ≤ P90 (속성 테스트)
- arpdau=0 → throw 안 함, revenueForecast[*].revenueP50 = 0, arpdauUsd 필드 0으로 반환 (cron route가 publish 단계에서 제외)

**`cron/route.test.ts`** (Blob client mocked)
- CRON_SECRET 미일치 → 401
- 1 게임 ok + 1 게임 미충족 → response.processed.length=1, skipped.length=1
- blob-writer mock throw → cron return 502
- 등록 앱 0개 → 200 + processed=[] + snapshots=null

총 ~25 테스트, 실행시간 1초 미만.

### 6.2 CLI dry-run

`scripts/lstm-dry-run.ts`:
```bash
npm run lstm:dry                            # 모든 등록 앱
npm run lstm:dry -- --gameId=<id>           # 1 게임
npm run lstm:dry -- --gameId=<id> --inspect=arpdau    # 중간값 dump
```
**출력**: forecast-builder 결과 stdout JSON. Blob put 안 함.

### 6.3 Mike의 실측 비교 (배포 전 sanity check)

| 항목 | dry-run 키 | dashboard 비교 대상 | 허용 |
|---|---|---|---|
| ARPDAU | `revenueSnapshot.arpdau.perGame.<id>` | KPI 카드 ARPDAU | ±5% |
| trailing 14d installs | `installsAssumption.perGame.<id>` | connections 카드 14d 합/14 | ±10% |
| Day 30 retention P50 | retentionCurve[29].p50 | MarketBenchmark/RetentionCurve 차트 day-30 | ±5%p |
| Day 90 revenue P50 | revenueForecast[89].revenueP50 | RevenueForecast 차트 day-90 P50 | ±10% |

5분짜리 manual sanity check. 차이가 허용범위 밖이면 알고리즘 회귀 의심 → unit test 추가.

### 6.4 안 다루는 것
- Vercel Blob 통합테스트 (staging Blob 분리 없음)
- End-to-end Vercel cron 트리거 (배포 후 첫 tick으로 자연 검증)
- Sensor Tower prior 회귀 (PR #2 영역)
- Golden snapshot regression file (Mike 피드백: dry-run vs 실측으로 충분)

---

## 7. Delivery

Phase 2를 단일 PR로. 예상 diff:
- 신규: 5 LSTM 모듈 + cron route + dry-run script + 4 test 파일 + vercel.json crons 항목 + AppsFlyer types/dialog 확장
- 수정: `package.json` (`lstm:dry` script), `src/shared/api/appsflyer/types.ts` (genre/region 필드)

리뷰 부담 ~15 파일, ~700 lines. CodeRabbit + Vercel preview 자동 발동(harness).

배포 후 다음 cron tick(UTC 18:30)에 Vercel Blob에 두 snapshot이 publish되는지 확인. **Phase 2 종료 시점에는 dashboard에 즉각적인 시각 변화가 없다** — Phase 1 accessor가 여전히 static mock JSON을 import하므로 widget은 mock 데이터를 그대로 본다. Phase 2의 가시 효과는 (a) Vercel Blob bucket에 새 파일이 생기는 것, (b) Mike가 `npm run lstm:dry`로 실측과 비교 가능해진 것뿐. Phase 3에서 accessor를 Blob fetch로 전환하는 순간 dashboard가 실데이터로 갱신된다.

**Phase 3** (별도 PR): `loadRevenueSnapshot` 등을 mock import에서 Blob fetch로 전환 + VC simulation / RevenueForecast chart / KPI 카드 wiring + UI stale 배지(>7일).
