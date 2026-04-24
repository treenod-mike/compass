# AppsFlyer 등록 이후 워크플로우 설계

**작성일:** 2026-04-23
**상태:** Draft · 리뷰 대기
**선행 문서:** [2026-04-20-appsflyer-api-pipeline-design.md](./2026-04-20-appsflyer-api-pipeline-design.md)
**관련 브랜치:** main (AppsFlyer Pull API v5 파이프라인 merged)

---

## 1. 배경 & 문제 정의

### 1.1 기존 상태 (main 브랜치)

Project Compass 는 AppsFlyer Pull API v5 기반 데이터 파이프라인을 갖춘 상태. 수집 가능한 데이터는 `installs_report` 와 `organic_installs_report` 두 엔드포인트의 CSV 출력이며, 이를 8-column `CompactInstall` 로 투영해서 단일 `snapshot.json` 에 저장한다. CLI (`npm run fetch:af`) 와 API 라우트 (`POST /api/appsflyer/sync`) 가 이미 동작하고, `/dashboard/connections` 페이지에는 `lastSync` 와 설치 수를 표시하는 카드 한 개가 있다.

제한 사항:
- **Master / Cohort / Retention API 미구독** → Pull API raw CSV 만 사용 가능.
- Pull API 할당량: **20 calls/day per dev_token**, **14-day max per request**.
- 현재 snapshot 은 **단일 파일**이라 multi-app / 누적 / 버저닝 불가.
- 사용자가 UI 에서 토큰을 **등록**하는 플로우가 **없음** (`.env.local` 하드코딩).

### 1.2 설계 대상 — "등록 이후 워크플로우"

사용자가 `/dashboard/connections` 페이지에서 AppsFlyer `dev_token` 과 `app_id` 를 **등록한 이후** 시점부터의 전체 운영 레이어:

1. 언제/어떻게 sync 가 발생하는가 (수동 / 스케줄 / 이벤트)
2. 데이터가 어느 화면 · 차트에 어떻게 소비되는가
3. 다중 앱 · 다중 계정 지원 여부
4. 실패 / 재시도 / 알림 정책
5. 데이터 누적 · 버전 관리

### 1.3 제약 & 전제

- **Vercel Hobby 플랜** 에서 구동 (Cron 하루 1회 제한, Fluid Compute 300s timeout).
- **서버리스 제약**: 런타임 파일 쓰기 비영속 → 영속 저장소 필수.
- **비파괴 원칙**: 어떤 실패도 기존 데이터를 망가뜨리지 않음 (additive write).
- **Bayesian Stats Engine 연결**: `feat/bayesian-stats-core` 에서 진행 중인 `BetaBinomial` (retention) · `LogNormal` (revenue) 모델의 실 입력 데이터로 사용.
- **`feat/bayesian-stats-core` 브랜치 off-limits**: PR #2 머지 대기 중인 별도 세션 작업, 본 spec 은 건드리지 않음. 본 spec implementation 은 PR #2 머지 후 시작 가능.

### 1.4 선행 작업 (MMP Adapter spec) 와의 관계

2026-04-22 자 [MMP Adapter Pull API v5 spec](./2026-04-22-mmp-adapter-pull-api-v5-design.md) 은 본 spec 이 다루는 영역 중 **계산 레이어**(cohort aggregation + Bayesian wrapper) 만 부분적으로 다뤘다. 본 spec 이 운영/저장/UI/등록 레이어까지 포함하는 **superset** 으로 그 spec 을 사실상 대체한다.

| 항목 | MMP Adapter spec (Apr-22) | 본 spec (Apr-23) | 처리 |
|---|---|---|---|
| 저장소 | git commit `cohorts.json` | Vercel Blob (월 샤딩 JSONL + summary JSON) | 본 spec 우세 |
| Tenancy | 1 게임 (Poco Merge) hardcoded | account → app 2-레벨, multi-app | 본 spec 우세 |
| Sync | GitHub Actions cron + git commit-back | Vercel Cron + Blob write + register-time backfill | 본 spec 우세 |
| Cohort aggregation 알고리즘 | install/event distinct user join, D1/D7/D30 | 동일 알고리즘 (`aggregation.ts`) | 본 spec 으로 흡수 |
| 디렉토리 구조 | `src/shared/api/mmp/` 신규 | 기존 `src/shared/api/appsflyer/` 확장 | 본 spec 우세 |

`feat/mmp-adapter-pull-api-v5` 브랜치는 보존하되 머지하지 않는다. 그곳의 작업 commits (`6eaa252`, `b09814e`, `f5a8550`, `2ad392f`) 는 본 spec 구현 시 reference 로만 활용한다. 단 `2ad392f` (cohort-aggregator) 에 cohort-anchor 버그 (사용자 별 install epoch 가 아닌 cohort-latest epoch 를 anchor 로 사용해 D1 retention overcount) 가 발견되었으므로 **그대로 차용 금지** — 본 spec 의 `aggregation.ts` 는 사용자 별 install epoch 기준으로 재작성.

---

## 2. 전제 & 확정 결정 (Q1–Q7)

브레인스토밍 세션 (2026-04-23) 에서 확정된 7개 결정. 설계 전반의 프레임.

| # | 주제 | 결정 | 근거 |
|---|------|------|------|
| Q1 | Tenancy 모델 | **B + C-ready** — 내부 운영 툴 + 파트너사 공유 확장 버퍼. 내부 데이터 모델은 `account(credential) → app` 2-레벨, 초기엔 Treenod 1 계정만. | 대시보드의 `useSelectedGame` 이 이미 4개 게임을 전제. 파트너 확장 시 account 단위 공유가 자연스러움. |
| Q2 | 데이터 활용 범위 | **C** — `installs` + `organic_installs` + `in_app_events` (revenue + retention cohort). Bayesian engine 직접 연결. | Pull API 만으로도 cohort aggregation 자체 계산 가능. Bayesian × AF 결합이 기술해자의 가치. |
| Q3 | 영속 저장소 | **Vercel Blob** — 월 샤딩 JSONL (raw) + `cohort/summary.json` (파생) + `state/{appId}.json`. 런타임 sync. | Vercel-native, `writeSnapshot/readSnapshot` 인터페이스 유지 가능. Neon 이행 경로 열어둠. |
| Q4 | Sync 트리거 | **수동 + 일일 Cron (KST 03:00) + 등록 즉시 14-day backfill**. | 쿼터(20/day) 내에서 자연 누적. 등록 직후 UX 즉시성 확보. |
| Q5 | 등록 UX | **프로그레시브 UI (1모달, 내부 2-레벨) + validation ping**. | B+C-ready 충족 최소 UX 복잡도. 잘못된 자격증명의 사전 차단. |
| Q6 | UI 소비 지점 | **6개 위젯 live + ML1/ML2/ML3 fallback**: connections 카드, KPICards, DataFreshnessStrip, PriorPosteriorChart, RetentionCurve, RevenueForecast. | Scope C 가치 가시화. uncertainty-honest 디자인 원칙과 합치. |
| Q7 | 실패 정책 | **UI only** (최근 10건 failureHistory + 상태 배지). Slack/이메일은 Future work. | 현 운영 규모엔 UI 가시화로 충분. 외부 알림은 필요 시 확장. |

### 2.1 등록 흐름 UX 접근: **Async + polling**

수동 대기(동기) 대신 backfill 을 백그라운드에서 돌리고 UI 가 2초 간격으로 상태를 polling 한다. 사용자는 등록 직후 `/dashboard/connections` 로 즉시 이동, 카드가 진행률 바를 보여주며 완료 시 자동으로 live 데이터 상태로 전환된다.

---

## 3. 아키텍처

### 3.1 레이어 구조 (단방향 의존)

```
┌──────────────────────────────────────────────────────────────────┐
│  ① UI Layer  (React, Next.js App Router)                         │
│  /dashboard/connections · /dashboard · /dashboard/market-gap     │
└──────────────┬───────────────────────────────────────────────────┘
               │ HTTP
               ▼
┌──────────────────────────────────────────────────────────────────┐
│  ② API Route Layer  (Vercel Functions, Node.js 24)               │
│  register · state · sync · cron                                  │
└──────────────┬───────────────────────────────────────────────────┘
               │ import
               ▼
┌──────────────────────────────────────────────────────────────────┐
│  ③ Domain Layer  (src/shared/api/appsflyer/)                     │
│  orchestrator · fetcher · aggregation · crypto · blob-store …    │
└──────────────┬───────────────────────────────────────────────────┘
               │ @vercel/blob SDK
               ▼
┌──────────────────────────────────────────────────────────────────┐
│  ④ Storage Layer  (Vercel Blob, 월 샤딩 JSONL + JSON)            │
└──────────────────────────────────────────────────────────────────┘
```

**설계 원칙:**
- 각 레이어는 아래 레이어만 참조. 역방향 · 횡방향 금지.
- Domain Layer 는 Next.js 독립 (React / 훅 / Next 타입 미사용) → CLI 와 API Route 에서 동일 코드 재사용.
- Storage Layer 는 "dumb I/O". 비즈니스 로직 없음.

### 3.2 파트너사 이관 경로

파트너가 이 프로젝트를 fork 했을 때:
1. 자기 Vercel 프로젝트 생성, 자기 `APPSFLYER_MASTER_KEY` 와 Blob 토큰 설정.
2. 연결 페이지에서 자기 토큰/appId 등록 → 별도 account 로 격리.
3. Storage Layer 만 갈아끼우면 DB 기반 (Neon) 등 다른 저장소로도 이행 가능 (Domain/UI 수정 없음).

---

## 4. 컴포넌트 상세

### 4.1 UI Layer

| 파일 | 상태 | 책임 |
|------|------|------|
| `src/app/(dashboard)/dashboard/connections/page.tsx` | ✏️ 수정 | 앱 리스트 렌더, "+ 연동 추가" 버튼 |
| `src/widgets/connections/ui/register-modal.tsx` | 🆕 신규 | 등록 폼 (6 필드), Zod 검증, `POST /register` |
| `src/widgets/connections/ui/app-card.tsx` | 🆕 신규 | 단일 앱 상태 카드, 6-status 배지 |
| `src/widgets/connections/ui/sync-progress-card.tsx` | 🆕 신규 | `backfilling` 상태 진행률 UI |
| `src/widgets/connections/ui/failure-history-tab.tsx` | 🆕 신규 | 최근 10건 실패 이력 + 재시도 CTA |
| `src/shared/hooks/use-af-state.ts` | 🆕 신규 | `GET /state/:id` 2s polling, `status === "active"` 에서 stop |
| `src/widgets/dashboard/ui/kpi-cards.tsx` | ✏️ 수정 | AF 데이터 우선, ML1 fallback |
| `src/widgets/dashboard/ui/data-freshness-strip.tsx` | ✏️ 수정 | AF `state.lastSyncAt` 표시 |
| `src/widgets/charts/ui/prior-posterior-chart.tsx` | ✏️ 수정 | SensorTower prior + AF posterior 결합, ML3 배지 |
| `src/widgets/charts/ui/retention-curve.tsx` | ✏️ 수정 | AF cohort → `BetaBinomial` credible interval |
| `src/widgets/charts/ui/revenue-forecast.tsx` | ✏️ 수정 | AF events → `LogNormal` fan |

### 4.2 API Route Layer

| 라우트 | 메서드 | 상태 | 책임 |
|-------|--------|------|------|
| `/api/appsflyer/register` | POST | 🆕 신규 | Zod 검증 → validation ping → 암호화 → Blob 쓰기 → `waitUntil(runBackfill)` → 202 |
| `/api/appsflyer/state/[appId]` | GET | 🆕 신규 | `state.json` 반환, `cache-control: no-store` |
| `/api/appsflyer/sync/[appId]` | POST | ✏️ 수정 | 기존 `/api/appsflyer/sync` 를 파라미터화, lock 체크 후 `runAppsFlyerSync` |
| `/api/appsflyer/cron` | GET | 🆕 신규 | Vercel Cron 대상. `CRON_SECRET` 인증 후 활성 앱 순차 sync |

Vercel Cron 설정: `vercel.json` 에 `{ path: "/api/appsflyer/cron", schedule: "0 18 * * *" }` (UTC 18:00 = KST 03:00).

### 4.3 Domain Layer (`src/shared/api/appsflyer/`)

| 파일 | 상태 | 책임 |
|------|------|------|
| `types.ts` | ✏️ 수정 | Snapshot v3 + `AccountSchema` + `AppSchema` + `StateSchema` + `CohortSummarySchema` |
| `fetcher.ts` | ✏️ 최소 | `fetchInAppEvents()` wrapper (기존 `fetchPullReport` 재사용) |
| `orchestrator.ts` | 🆕 신규 | `runAppsFlyerSync` 재구성. installs → organic → events → aggregation → state 체인. 300s timeout guard. |
| `aggregation.ts` | 🆕 신규 | cohort (설치일 × d1/d7/d30 재방문 count) + revenue per-day aggregate → `CohortSummary`. Pure function. |
| `crypto.ts` | 🆕 신규 | AES-256-GCM `encryptToken` / `decryptToken` / 마스킹 헬퍼 |
| `blob-store.ts` | 🆕 신규 | `@vercel/blob` 래핑. typed I/O (`putAccount` · `getApp` · `appendInstalls` 등) |
| `rate-limiter.ts` | 🆕 신규 | `state.json.callsUsedToday` ETag CAS 증분, 20-call 제한 |
| `errors.ts` | ✏️ 수정 | `CredentialInvalidError` · `AppMissingError` · `ThrottledError` · `BackfillInProgressError` 추가 |
| `snapshot.ts` | ❌ 삭제 | `blob-store.ts` 로 대체 |
| `snapshot-derive.ts` | ✏️ 수정 | `CohortSummary` → UI-ready 메트릭 변환으로 축소 |
| `index.ts` | ✏️ 수정 | Public barrel 재구성 |
| `__tests__/aggregation.test.ts` | 🆕 신규 | cohort 계산 정확성, timezone edge case, dedup |
| `__tests__/orchestrator.test.ts` | 🆕 신규 | 실패 체인, state 전이, 쿼터 가드 |
| `__tests__/crypto.test.ts` | 🆕 신규 | encrypt/decrypt 라운드트립, tampered cipher 거부 |

### 4.4 Storage Layer — Blob 키 네임스페이스

```
appsflyer/
  accounts/{accountId}.json              # {id, tokenHash, encryptedToken, currency, label}
  apps/{appId}.json                      # {appId, accountId, gameKey, label, createdAt}
  state/{appId}.json                     # {status, lastSyncAt, lastWindow,
                                         #  callsUsedToday, callsResetAt,
                                         #  syncLock, progress, failureHistory[]}
  installs/{appId}/{YYYY-MM}.jsonl       # append-only, 1 row/install, dedup by installId+installTime
  events/{appId}/{YYYY-MM}.jsonl         # append-only, 1 row/event
  cohort/{appId}/summary.json            # {updatedAt, cohorts: {[installDate]:
                                         #   {n, d1_retained, d7_retained, d30_retained}},
                                         #  revenue: {daily: [...], total: ...}}
```

### 4.5 환경 변수

| 변수 | 스코프 | 용도 |
|------|-------|------|
| `APPSFLYER_MASTER_KEY` | Production, Preview | 32-byte hex, AES-256-GCM 대칭키 (token 암복호화) |
| `BLOB_READ_WRITE_TOKEN` | Production, Preview | Vercel Blob 접근 (Vercel 자동 주입) |
| `CRON_SECRET` | Production | Vercel Cron 호출 인증 |

### 4.6 신규 의존성

```
npm i @vercel/blob
```
암호화는 Node.js 24 내장 `node:crypto` 사용 — 추가 의존성 없음. Zod 는 기존.

### 4.7 Zod 스키마 (추가분)

```typescript
export const AccountSchema = z.object({
  id: z.string().regex(/^acc_[a-f0-9]{8}$/),
  tokenHash: z.string().length(64),              // SHA-256 hex
  encryptedToken: z.string(),                     // AES-256-GCM (iv:ciphertext:tag hex)
  currency: z.enum(["KRW", "USD", "JPY", "EUR"]),
  label: z.string().max(80),
  createdAt: z.string().datetime(),
})

export const AppSchema = z.object({
  appId: z.string().regex(/^[a-zA-Z0-9._-]{3,64}$/),
  accountId: z.string(),
  gameKey: z.enum(["portfolio", "sample-match-3", "sample-puzzle", "sample-idle"]),
  label: z.string().max(80),
  createdAt: z.string().datetime(),
})

export const StateSchema = z.object({
  appId: z.string(),
  status: z.enum([
    "backfilling",
    "active",
    "stale",
    "failed",
    "credential_invalid",
    "app_missing",
  ]),
  progress: z.object({
    step: z.number().int().min(0).max(5),
    total: z.literal(5),
    currentReport: z.string().optional(),
    rowsFetched: z.number().int().nonnegative(),
  }),
  lastSyncAt: z.string().datetime().optional(),
  lastWindow: z.object({ from: z.string(), to: z.string() }).optional(),
  callsUsedToday: z.number().int().min(0).max(20),
  callsResetAt: z.string().datetime(),
  syncLock: z.object({
    heldBy: z.string(),         // execution id
    heldAt: z.string().datetime(),
    ttlMs: z.literal(300000),   // 5분
  }).nullable(),
  failureHistory: z.array(z.object({
    at: z.string().datetime(),
    type: z.enum(["retryable", "throttled", "auth_invalid", "not_found", "partial", "full_failure"]),
    message: z.string(),
    report: z.string().optional(),
  })).max(10),
})

// Bayesian engine input contract (MMPCohortObservation) 와 동일한 필드 이름·구조를
// 사용해 `aggregation.ts` 출력을 그대로 engine 호출에 넘길 수 있게 한다.
// (이전 초안의 `n`/`d1_retained`/...` 변형 키는 폐기 — adapter layer 0개로 직결.)
export const CohortObservationSchema = z.object({
  cohortDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),  // YYYY-MM-DD UTC
  installs: z.number().int().nonnegative(),
  retainedByDay: z.object({
    d1: z.number().int().nonnegative().nullable(),
    d7: z.number().int().nonnegative().nullable(),
    d30: z.number().int().nonnegative().nullable(),
  }),
})

export const CohortSummarySchema = z.object({
  updatedAt: z.string().datetime(),
  cohorts: z.array(CohortObservationSchema),
  revenue: z.object({
    daily: z.array(z.object({
      date: z.string(),
      sumUsd: z.number().nonnegative(),
      purchasers: z.number().int().nonnegative(),
    })),
    total: z.object({
      sumUsd: z.number().nonnegative(),
      purchasers: z.number().int().nonnegative(),
    }),
  }),
})

export const RegisterRequestSchema = z.object({
  dev_token: z.string().min(20),
  app_id: z.string().regex(/^[a-zA-Z0-9._-]{3,64}$/),
  app_label: z.string().max(80),
  game_key: z.enum(["portfolio", "sample-match-3", "sample-puzzle", "sample-idle"]),
  home_currency: z.enum(["KRW", "USD", "JPY", "EUR"]).default("KRW"),
})
```

---

## 5. 데이터 흐름

### 5.1 앱 상태 머신

```
                    ┌─────────────────┐
                    │     (없음)       │   ← 등록 전
                    └────────┬────────┘
                             │ POST /register 성공
                             ▼
                    ┌─────────────────┐
           ┌───────►│   backfilling   │   ← UI: 진행률 바 + ML1 배지
           │        └────────┬────────┘
           │                 │ runBackfill 완료
           │                 ▼
           │        ┌─────────────────┐     > 7일 sync 없음   ┌──────────┐
           │        │     active      │ ────────────────────► │  stale   │
           │        └────────┬────────┘                       └────┬─────┘
  manual   │                 │                                     │  다음 sync 성공
  retry    │                 │ sync 실패 (retryable 소진)           │
           │                 ▼                                     ▼
           │        ┌─────────────────┐                           active
           │        │     failed      │
           │        └────────┬────────┘
           │                 │
           │                 │ 401/403 응답
           │                 ▼
           │        ┌─────────────────┐   ← UI: 빨강 + "토큰 재등록" CTA
           └────────│credential_invalid│
                    └─────────────────┘
                             │ 404 응답
                             ▼
                    ┌─────────────────┐   ← UI: 빨강 + "App ID 확인" CTA
                    │   app_missing   │
                    └─────────────────┘
```

**상태 × UI 매핑:**

| status | connections 카드 | 대시보드 위젯 배지 |
|--------|-----------------|------------------|
| `backfilling` | `⟳ 초기 데이터 수집 중 N/5` + 진행바 | **ML1** "Live data unavailable" + mock |
| `active` | `● Active · 14일간 설치 N` (초록) | full live |
| `stale` (≥7일) | `⚠ Last sync N days ago` (노랑) | **ML2** "Data from <date>" + live 유지 |
| `failed` | `✕ Last sync failed` (빨강) + 재시도 | 직전 live 유지 + ML2 |
| `credential_invalid` | `✕ Token invalid` + 재등록 CTA | 직전 live 유지 + ML2 |
| `app_missing` | `✕ App not found` + appId 수정 CTA | 직전 live 유지 + ML2 |

**ML3 (per-widget)** — Bayesian validity gate 미통과 (n 부족) 시 해당 위젯만 `Sample too small` 배지 + prior 곡선만 표시. Status 와 독립적.

### 5.2 Day 0 — 등록 직후 타임라인

```
t=0s       [저장] 클릭 → POST /api/appsflyer/register
t=0.2s     Zod 검증 통과
t=0.7s     validation ping (1 call) → 200 OK
t=0.9s     AES-256 암호화 + Blob 쓰기 (accounts, apps, state)
           state.status = "backfilling", progress.step = 0
t=1.0s     API: waitUntil(runBackfill) → 202 응답
           Frontend: /dashboard/connections 로 router.push
           useAfState(appId) 훅 시작 (2s polling)
t=1.5s     UI: SyncProgressCard 렌더, "초기 14일 데이터 수집 중 0/5"
t=2~8s     fetchInstalls → 135 rows → Blob append + state.progress=1/5
t=8~14s    fetchOrganic → 42 rows → state.progress=2/5
t=14~22s   fetchInAppEvents → 89 rows → state.progress=3/5
t=22~25s   aggregation → cohort/summary.json → state.progress=4/5
t=25~26s   state 최종: {status: "active", progress: 5/5, lastSyncAt}
t=26s      UI polling 중단, 카드 live 데이터 전환
           대시보드 위젯 ML1 배지 해제
```

### 5.3 Day 1~14 — 자동 누적 (Cron)

매일 KST 03:00 에 Vercel Cron 이 `/api/appsflyer/cron` 을 호출.

```
cron route:
  ├─ CRON_SECRET 헤더 검증
  ├─ blob.list(apps/*) → 활성 앱 N개
  ├─ for each app (순차):
  │    ├─ rate-limiter: callsUsedToday < 20?
  │    ├─ runAppsFlyerSync(app, 14-day window)
  │    │    ← 윈도우: 어제 기준 -14 ~ 어제
  │    │    ← installs/organic/events 재fetch
  │    │    ← dedup (installId+installTime)
  │    │    ← Blob append (새 행만)
  │    │    ← aggregation 재실행 (전체 누적에 대해)
  │    │    ← state 업데이트
  │    └─ 실패시 failureHistory append, 다음 앱 진행
```

**시간 경과에 따른 누적 (1 앱 기준):**

```
Day 0:  installs/2026-04.jsonl  135 rows
Day 7:  installs/2026-04.jsonl  ~210 rows (신규 +75)
Day 14: installs/2026-04.jsonl  ~55 KB, 2026-05.jsonl 시작
Day 22: cohort/summary.json 에 d30 6 cohort 유효 → ML3 해제
```

### 5.4 Dedup 및 멱등성

- **Dedup key:** `installId + installTime` (installs) / `installId + eventName + eventTime` (events).
- AppsFlyer Pull API 는 같은 윈도우를 다시 호출 시 겹치는 행을 포함 → client 쪽 멱등성 필수.
- Blob append 시 기존 JSONL 을 전체 읽어 `Set<dedupKey>` 로 중복 행 제거 후 재쓰기 (월 샤딩 덕에 50KB 수준).

---

## 6. 에러 처리

### 6.1 실패 유형별 처리

| 실패 유형 | 감지 레이어 | 재시도 | 상태 전이 | UI 반응 |
|---------|-------------|--------|----------|---------|
| 입력 검증 | UI (Zod) | — | — | 폼 inline 에러 |
| validation ping 401/403 | API Route | 없음 | Blob 쓰기 skip | 모달 "토큰 유효하지 않음" |
| validation ping 404 | API Route | 없음 | Blob 쓰기 skip | 모달 "App ID 확인" |
| validation ping 5xx / network | API Route | 없음 (사용자 재시도) | Blob 쓰기 skip | 모달 "일시 장애" |
| backfill: installs 실패 | Domain | 즉시 1 + 30s 1 | `failed` | 카드 빨강 + 재시도 CTA |
| backfill: organic/events 실패 | Domain | 즉시 1 | `partial` (warning 누적) | 카드 노랑 `partial` |
| 401/403 (backfill 중) | Domain | 없음 | `credential_invalid` | 빨강 + 토큰 재등록 CTA |
| 404 (backfill 중) | Domain | 없음 | `app_missing` | 빨강 + App ID 수정 CTA |
| 429 throttled | Domain | exp backoff 1m→5m→15m, 최대 3회 | `failed` (소진 시) | "재시도 예정 HH:MM" |
| Blob put 실패 | Storage | 3회 재시도 | sync abort | 이전 상태 유지 + warning |
| ETag 충돌 | Storage | `BackfillInProgressError` | syncLock 지키고 skip | "이미 동기화 중" 토스트 |
| 300s timeout | Orchestrator | — | partial 상태 저장 | 다음 Cron 에서 이어서 |

### 6.2 "쓰기 전 검증" 원칙

자격증명 관련 Blob 쓰기는 `validation ping` 성공 **후** 에만 발생. 실패 시 Blob 은 전혀 건드리지 않음 → 잘못된 자격증명이 영속화되지 않음.

### 6.3 `failureHistory` 관리

- `state.json` 안에 임베드 (별도 파일 X).
- Circular buffer, 최근 10건 유지.
- 연결 페이지 "최근 이력" 탭에서 노출.

### 6.4 Cron 의 "오류 격리"

Cron 이 앱 A → B → C 순으로 sync 할 때, A 가 `credential_invalid` 여도 B, C 는 정상 진행. 앱 간 오류가 전파되지 않음.

### 6.5 `credential_invalid` 의 의미

재시도 해도 성공할 수 없는 상태 → Cron 이 다음 실행부터 해당 앱을 **자동 skip**. UI 는 "인간 개입 필요" 배지를 노출하고 사용자가 토큰을 재등록할 때까지 대기. Silent fail 방지의 핵심.

---

## 7. 테스트 전략

### 7.1 Unit Tests (Vitest, Domain 레이어 집중)

**커버리지 목표: 90%.**

| 대상 | 케이스 |
|------|-------|
| `aggregation.ts` | cohort 계산 정확성, timezone edge (UTC↔KST 자정), dedup, empty data, d30 부족 시 undefined |
| `crypto.ts` | encrypt/decrypt 라운드트립, tampered cipher 거부, 잘못된 key length 거부 |
| `orchestrator.ts` (mock fetcher + mock blob-store) | happy path, installs 성공 + organic 실패 = partial, 401 → credential_invalid, timeout → skip, 쿼터 소진 |
| `rate-limiter.ts` | ETag CAS 성공/충돌, 자정 리셋 |

### 7.2 Integration Tests (API Routes)

MSW (Mock Service Worker) + in-memory Blob mock. **커버리지 목표: 80%.**

| 라우트 | 케이스 |
|--------|-------|
| `POST /register` | happy path, 401 validation ping → Blob 변경 없음, 중복 appId → 409 또는 기존 account 에 추가 |
| `GET /state/:id` | 등록된 앱 → 200, 미등록 → 404 |
| `GET /cron` | 다중 앱 순차, CRON_SECRET 없음 → 401, 쿼터 임박 시 일부 skip |

### 7.3 Manual Smoke Tests

CI 에서 자동화하지 않음 (실 AppsFlyer API 호출 비용/불안정성). 개발자 로컬 or staging 에서 1회성.

- [ ] 연결 페이지에서 실 토큰 등록 → 14일 데이터 표시
- [ ] Overview 진입 → KPI + PriorPosteriorChart live 확인
- [ ] Vercel Cron 수동 트리거 → Blob 에 +1일치 확인
- [ ] 잘못된 토큰 등록 → `credential_invalid` CTA 동작

### 7.4 Visual Regression / E2E

**하지 않음.** 비용 대비 효용 낮음. UI 는 스모크로 커버.

---

## 8. 마이그레이션 & 롤백

### 8.1 v2 (단일 snapshot.json) → v3 (Blob) 마이그레이션

1회성 스크립트: `scripts/migrate-snapshot-to-blob.ts`

```
Step 1. src/shared/api/data/appsflyer/snapshot.json 읽기 (v2)
Step 2. v3 변환:
        - snapshot.request.appId → apps/{appId}.json (gameKey 는 수동 입력)
        - installs.nonOrganic[] → installs/{appId}/YYYY-MM.jsonl (월 split)
        - installs.organic[] → 동일
        - (events 는 v2 에 없음, 빈 상태로 시작)
Step 3. aggregation.ts 실행 → cohort/{appId}/summary.json 생성
Step 4. state/{appId}.json 생성 (status="active", lastSyncAt = snapshot.fetchedAt)
Step 5. git 에서 snapshot.json 삭제, .gitignore 추가
```

### 8.2 자격증명 마이그레이션

`.env.local` 의 `APPSFLYER_DEV_TOKEN` 은 **연결 UI 로 재등록** (register flow 경유해야 암호화 과정이 일관됨). 스크립트로 자동 이관하지 않음.

### 8.3 롤백 전략

- **Additive write 원칙:** 모든 쓰기가 append 또는 versioned state 교체. 읽기 실패 시 이전 상태 유지.
- **Git 기반 코드 롤백:** v3 Blob 과 v2 파일 병행 읽기 기간 없이 **big-bang migration**. 기존 main 의 snapshot.json 은 git history 에 남아 있어 revert 가능.
- **Blob 버전 히스토리:** Vercel Blob 은 paid 에서 30일 버전 보존. Hobby 는 선택적 `data-backup/` 로 주기 git 스냅샷 (Future work).

---

## 9. Future Work

현 spec 에 포함하지 않지만 후속 작업으로 남겨둠:

1. **Slack webhook 알림** — `SLACK_WEBHOOK_URL` env 설정 시 `auth_invalid`/`app_missing`/`full_failure` 이벤트 push. 메시지 포맷: `":warning: AppsFlyer sync failed for {app_label} — {reason} at {time}. Re-register in /dashboard/connections."`
2. **Resend 이메일 알림** — Slack 을 쓰지 않는 파트너 대응.
3. **계정 관리 페이지** — 현재 프로그레시브 UI 는 계정 단위 관리 안 보여줌. 파트너 등록이 다계정화되면 `/dashboard/connections/accounts` 추가.
4. **CohortHeatmap / BudgetDonut live 연결** — 현재 Overview 에 미포함. Overview 재구성 시 추가.
5. **Neon Postgres 이행** — Blob 의 cohort 집계 비용이 커지면 `storage-layer` 만 교체. Migration path: Blob dump → SQL load.
6. **in_app_events 커스텀 이벤트 확장** — 튜토리얼 완료, 결제 퍼널 등. `additionalFields` 로 컬럼 추가.
7. **Blob 데이터 백업** — Hobby 플랜용 주기 git `data-backup/` 스냅샷.
8. **Rolling Release 연동** — Vercel Rolling Releases 로 신규 버전 점진 배포.

---

## 10. Open Questions

### 10.1 디자인 확정 사항
Q1–Q7 에서 모두 결정. 본 spec 수준에서는 미해결 이슈 없음.

### 10.2 구현 중 재검증 필요 사항
- **Dedup key 컬럼 조합** — `installs` 는 `installId + installTime`, `events` 는 `installId + eventName + eventTime` 으로 잠정 결정. AppsFlyer Pull API 문서 재확인 후 구현 시 확정.
- **Timezone 처리** — cohort 의 설치일 bucket 기준. 초기 구현은 **UTC 고정**. 필요 시 `accounts/{id}.json` 에 `timezone` 필드 추가하고 per-account 로 local tz 변환.
- **Rate-limiter 리셋 기준** — `callsResetAt` 의 "자정" 이 UTC 자정인지 AppsFlyer 서버 tz 인지. AppsFlyer 측 문서 확인 필요. 잠정 UTC 00:00.

---

## 11. 참조

- [선행 spec — AppsFlyer Pull API 파이프라인](./2026-04-20-appsflyer-api-pipeline-design.md)
- [Sensor Tower 크롤러 spec](./2026-04-20-sensortower-crawler-design.md) (Prior 데이터 소스, 유사 파이프라인 패턴)
- [Bayesian Stats Engine spec](./2026-04-21-bayesian-stats-engine-design.md) (본 데이터의 소비처)
- [MMP Adapter Pull API v5 spec](./2026-04-22-mmp-adapter-pull-api-v5-design.md)
- AppsFlyer Pull API v5 공식 문서: https://support.appsflyer.com/hc/en-us/articles/207034346
- Vercel Blob SDK: https://vercel.com/docs/storage/vercel-blob
- Vercel Cron: https://vercel.com/docs/cron-jobs

---

**변경 이력**
| 날짜 | 작성자 | 내용 |
|------|--------|------|
| 2026-04-23 | Claude (Opus 4.7) + Mike | 초안 작성 (브레인스토밍 Q1–Q7 기반) |
