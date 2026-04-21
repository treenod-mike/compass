# AppsFlyer API 연동 파이프라인 설계

- **Date**: 2026-04-20
- **Status**: Approved — ready for implementation plan
- **Scope**: Portfolio demo. 백엔드 파이프라인 완성 + Connections 카드 1곳 라이브 반영.
- **Out of scope**: 차트 실데이터 연결, 스냅샷 히스토리, Vercel Cron, Adjust/Singular, 토큰 KMS.

## 0. 배경

`/dashboard/connections` 페이지에 AppsFlyer 카드 UI는 이미 구현되어 있으나, "저장" 버튼은 `setTimeout(900ms)` mock이다. 실제 데이터는 아직 부족(리텐션 D3까지만, 매출 0) — **파이프라인 자체를 프로덕션 수준으로 완성**하고, UI는 "진짜 동작하는 증거 최소 1곳"만 심는다. 차트 실데이터 연결은 값이 쌓인 뒤 별도 PR.

## 1. 범위 요약

| 축 | 결정 |
|---|---|
| 성격 | 포트폴리오 데모 ("동작하는 프로토타입") |
| API 레이어 | Master API (집계) + Cohort API (리텐션) |
| 토큰 | 실 dev token 보유 → 라이브 호출 |
| 저장소 | 파일 스냅샷 JSON (SensorTower 크롤러 패턴과 동일) |
| 트리거 | CLI (`npm run fetch:af`) + UI Server Action 둘 다, fetcher 공유 |
| UI 노출 | Connections 페이지 AppsFlyer 카드만 라이브 (나머지 mock 유지) |
| 차트 연결 | **하지 않음** (데이터 부족, 후속 PR) |

## 2. 아키텍처

### 2-1. 선택 이유 (Hybrid, 접근법 C)
Next.js 내부 인라인(A)은 CLI 코드가 번들에 섞일 위험, 별도 워크스페이스(B)는 fetcher 중복 유혹. **공유 코어 1개 + 얇은 진입점 2개**가 FSD 2.1 `shared/api` 규약과도 정합한다.

### 2-2. 디렉토리 구조
```
src/shared/api/appsflyer/
  ├─ index.ts                  # 배럴 export, runAppsFlyerSync
  ├─ types.ts                  # Zod 스키마 + 파생 TS 타입
  ├─ client.ts                 # HTTP 클라이언트 (fetch + 재시도 + 타임아웃)
  ├─ fetcher.ts                # fetchMasterAggregate, fetchCohortRetention
  ├─ snapshot.ts               # writeSnapshot, readSnapshot, getAppsFlyerCardData
  ├─ errors.ts                 # AppsFlyerError, AuthError, RateLimitError, TimeoutError, ValidationError
  └─ __fixtures__/
      ├─ master.json
      └─ cohort.json

src/shared/api/data/appsflyer/
  └─ snapshot.json             # git 추적 (초기 빈 스냅샷)

scripts/
  └─ fetch-appsflyer.ts        # CLI 진입점

src/app/api/appsflyer/sync/
  └─ route.ts                  # POST handler

.env.local                     # APPSFLYER_DEV_TOKEN (git ignored)
.env.example                   # 키 이름만 (git 추적)
```

### 2-3. 공유 코어 계약
```ts
export async function runAppsFlyerSync(opts: {
  devToken: string
  appIds: string[]
  homeCurrency: "KRW" | "USD" | "JPY" | "EUR"
  master: MasterParams | null
  cohort: CohortParams | null
}): Promise<{
  snapshot: AppsFlyerSnapshot
  warnings: string[]
  summary: { masterRows: number; cohortRows: number; durationMs: number }
}>
```
- **순수 함수**: fs / env 안 건드림. caller가 모든 입력 주입, 저장 여부도 caller 결정.

## 3. 외부 API 계약

### 3-1. 엔드포인트
- **Master Aggregate**: `GET https://hq1.appsflyer.com/api/master-agg-data/v4/app/{app_id}/{report_type}`
- **Cohort**: `POST https://hq1.appsflyer.com/api/cohorts/v1/data/app/{app_id}`
- **인증**: 두 엔드포인트 공통 `Authorization: Bearer {dev_token}`
- **응답**: JSON only (`format=json`, `Accept: application/json`)

### 3-2. 호출 파라미터 타입 (하드코딩 금지, caller 주입)
```ts
type MasterParams = {
  appId: string
  reportType: string           // "daily_report" 등
  from: string; to: string     // YYYY-MM-DD
  groupings: string[]
  kpis: string[]
  extraQuery?: Record<string, string>
}

type CohortParams = {
  appId: string
  from: string; to: string
  cohortType: "user_acquisition" | "event"
  groupings: string[]
  kpis: string[]
  perUser?: boolean
}
```

### 3-3. 공통 운영 규칙
| 항목 | 규칙 |
|---|---|
| Rate limit | 초당 1 req 간격 (client side throttle) |
| 재시도 | 429/5xx — 지수 백오프 1s → 2s → 4s, 3회 후 실패 |
| 재시도 금지 | 401 / 403 / 404 |
| 타임아웃 | per-request 30s |
| 로깅 | `[AF] {endpoint} rows={N} in {ms}ms` (stdout) |

### 3-4. 스냅샷 스키마 (outer shape 고정)
```ts
type AppsFlyerSnapshot = {
  version: 1
  fetchedAt: string            // ISO 8601
  request: {
    master: MasterParams | null
    cohort: CohortParams | null
  }
  master: { rows: MasterRow[] } | null
  cohort: { rows: CohortRow[] } | null
  meta: { warnings: string[] }
}

type MasterRow = Record<string, string | number>
type CohortRow = Record<string, string | number>
```
- `rows` shape은 호출 시점의 `kpis`/`groupings`가 결정. `request` 필드에 원본 파라미터 저장 → 재현성 확보.

## 4. 스냅샷 → Connections 카드 매핑 (sparse 정책)

변경 surface는 Connections 페이지 AppsFlyer 카드 **1개**. 차트/다른 페이지 건드리지 않음.

### 4-1. 읽기 함수
```ts
// src/shared/api/appsflyer/snapshot.ts
export function getAppsFlyerCardData(): AppsFlyerCardData {
  const snap = readSnapshot()
  if (!snap) return EMPTY_CARD
  return {
    status: deriveStatus(snap.fetchedAt),
    lastSync: formatRelative(snap.fetchedAt),
    metrics: deriveMetrics(snap),
    retentionDepth: deriveRetentionDepth(snap),
  }
}
```

### 4-2. 값 표시 규칙
| 필드 | 값 있을 때 | 값 0 / null / 누락 |
|---|---|---|
| `lastSync` | `"12분 전"` | `"아직 sync 없음"` |
| `metrics.installs` | `"1,284"` | `"—"` (em dash) |
| `metrics.apps` | `"3"` | `"—"` |
| `metrics.retentionDepth` | `"D3"` | `"—"` |
| `metrics.cpi` | `"₩820"` | metric 배열에서 아예 제외 |

`"—"` 는 "0"이 아니라 "아직 측정 안 됨"을 의미 (Uncertainty-honest).

**CPI 계산 엣지케이스**: `cpi = sumCost / sumNonOrganicInstalls`. 다음 조건 중 하나라도 해당하면 metric 배열에서 제외 (표시 안 함):
- `sumCost === 0` (광고비 데이터 없음)
- `sumNonOrganicInstalls === 0` (0으로 나누기 방지)
- `master` 레코드가 `cost`/`non_organic_installs` 칼럼을 포함하지 않음 (호출 파라미터에 kpi 미포함)

### 4-3. 상태 자동 판정
```ts
function deriveStatus(fetchedAt: string): ConnectionStatus {
  const hours = (Date.now() - Date.parse(fetchedAt)) / 3_600_000
  if (hours < 24)  return "connected"
  if (hours < 168) return "warn"
  return "error"
}
// 스냅샷 자체가 없으면 "disconnected"
```

### 4-4. `mock-connections.ts` 처리
AppsFlyer 항목은 **정적 메타만 남김** — 브랜드/컬러/`apiFields` 등. `status / lastSync / metrics` 는 런타임에 `getAppsFlyerCardData()` 결과로 덮어쓴다. 다른 카드(Adjust, GA4, Supabase, Slack…)는 현재 mock 그대로 유지.

## 5. 두 진입점 동작

### 5-1. CLI: `scripts/fetch-appsflyer.ts`
```
npm run fetch:af                  # master + cohort
npm run fetch:af -- --master-only
npm run fetch:af -- --cohort-only
npm run fetch:af -- --dry-run     # fetch만, snapshot.json 안 씀
```
- `dotenv/config` 로 `.env.local` 에서 `APPSFLYER_DEV_TOKEN` 로드
- 기본 파라미터(appIds, window, kpis)는 스크립트 상단 상수 — 후속 PR에서 플래그화
- 종료 시 `summary` + warnings 출력, git status 변화 안내
- 커밋은 사람이

### 5-2. Server Action: `POST /api/appsflyer/sync`

**요청 body**:
```ts
{
  dev_token: string
  home_currency: string    // route 진입부에서 "KRW"|"USD"|"JPY"|"EUR" 로 Zod narrow
  app_ids: string          // CSV, 공백/쉼표 분리 → 배열 파싱
  sync_frequency: string
  dry_run?: boolean        // 연결 테스트 버튼 → true
}
```
Zod 검증 실패 → 400 `{ code: "bad_request", path }` 응답.

**환경 분기**:
```
isVercelProd === true  → fetch만 실행, snapshot.json 쓰지 않음
                         응답: { ok, preview: summary, persisted: false, reason: "prod-readonly-fs" }
isVercelProd === false → fetch + writeSnapshot
                         응답: { ok, summary, persisted: true }
```
Vercel 프로덕션은 fs read-only이므로 persist 불가. 파이프라인 동작 자체는 검증 가능.

**UI 훅업**:
- ConnectionDialog "연결 테스트" 버튼 → `POST /api/appsflyer/sync` with `dry_run: true` → Master API 최근 1일 1건만 시도 → 토큰 유효성 검증
- "저장 · 연동 시작" 버튼 → `POST /api/appsflyer/sync` (dry_run false)
- 현재 `setTimeout(900)` mock 제거

### 5-3. 토큰 정책
- UI 입력 토큰: 요청 처리 끝나면 메모리에서 소멸. **서버에 영속 저장 안 함.**
- CLI 토큰: `.env.local` (개발자 로컬), git 추적 안 됨.
- 프로덕션 Vercel env에 토큰 두지 않음 (현재 범위엔 불필요).
- 결과: 이 프로젝트 어디에도 dev_token이 git에 남지 않음.

### 5-4. 에러 처리 표
| 에러 | 조건 | CLI | API Route |
|---|---|---|---|
| `AuthError` | 401/403 | exit 1 | 401 `{ code: "invalid_token" }` |
| `RateLimitError` | 429, 재시도 소진 | exit 2 | 429 `{ code: "rate_limited", retryAfter }` |
| `TimeoutError` | per-request 30s 초과 | exit 3 | 504 `{ code: "timeout" }` |
| `ValidationError` | Zod schema mismatch | exit 4 | 502 `{ code: "schema_mismatch", path }` |
| Network 일반 | fetch throw | exit 5 | 502 `{ code: "network" }` |

## 6. 테스트 & 검증

### 6-1. 단위 테스트 (`node:test` 내장, 신규 러너 없음)
1. `client.ts` 재시도: 429 mock → 지수 백오프 후 성공
2. `snapshot.ts`: write → read round-trip, 버전 가드
3. `getAppsFlyerCardData()` sparse 매핑: 빈 스냅샷 / 값 있는 스냅샷
4. `deriveStatus()` 경계값: 23h / 25h / 6d / 8d
5. Contract 테스트: `__fixtures__/*.json` → 파서 → `AppsFlyerSnapshot` 정합

### 6-2. 수동 E2E 체크리스트 (최종)
1. `.env.local`에 실 토큰 설정
2. `npm run fetch:af -- --dry-run --master-only` → 200 확인
3. `npm run fetch:af` → `snapshot.json` diff 확인
4. `npm run dev` → AppsFlyer 카드 `lastSync` 라이브 반영
5. 다이얼로그 "연결 테스트" → 성공 토스트
6. 다이얼로그 "저장 · 연동 시작" → `snapshot.json` 재갱신

### 6-3. 빌드
- `npm run build` 통과 (Next.js가 API route + snapshot.json import 경로 해결)
- `tsc --noEmit` 통과

## 7. 구현 순서 (8 Stage)

| Stage | 작업 | 검증 완료 기준 |
|---|---|---|
| 1 | 폴더 + types/errors/index 배럴 + Zod 설치 + fixtures | `tsc --noEmit` 통과, fixture parse 테스트 |
| 2 | `client.ts` + `fetcher.ts` + `runAppsFlyerSync` | 재시도 테스트, fixture → snapshot 테스트 |
| 3 | `snapshot.ts` + 초기 빈 `snapshot.json` | round-trip + sparse 매핑 테스트 |
| 4 | `scripts/fetch-appsflyer.ts` + `package.json` + `.env.example` + `.gitignore` | `--dry-run` 모드로 fixture 경로 동작 |
| 5 | `src/app/api/appsflyer/sync/route.ts` (prod 분기 포함) | `npm run dev` + curl 로컬 확인 |
| 6 | `connection-card.tsx` id 분기 + `connection-dialog.tsx` 실 API 호출 + `mock-connections.ts` 정리 | 수동 E2E 1~6 전 항목 |
| 7 | 실 토큰 E2E | 프로덕션 빌드 + 실 fetch 성공 |
| 8 | `main` 푸시 → Vercel 배포 → prod UI 저장 시 `persisted: false` 분기 응답 확인 | — |

## 8. 변경 파일 범위

**신규 (10)**
- `src/shared/api/appsflyer/{index,types,client,fetcher,snapshot,errors}.ts`
- `src/shared/api/appsflyer/__fixtures__/{master,cohort}.json`
- `src/shared/api/data/appsflyer/snapshot.json`
- `src/app/api/appsflyer/sync/route.ts`
- `scripts/fetch-appsflyer.ts`
- `.env.example`
- `docs/superpowers/specs/2026-04-20-appsflyer-api-pipeline-design.md` (이 문서)

**수정 (5)**
- `src/widgets/connections/ui/connection-card.tsx` — AppsFlyer id 분기 1곳
- `src/widgets/connections/ui/connection-dialog.tsx` — 실 API 호출로 교체
- `src/shared/api/mock-connections.ts` — AppsFlyer 하드코드 metrics/lastSync 제거
- `package.json` — `fetch:af` 스크립트 + `zod` dep
- `.gitignore` — `.env.local` 추가

**건드리지 않음**: 24개 차트, `/dashboard` / `/dashboard/market-gap` 페이지, 다른 Connection 카드, 디자인 토큰, i18n.

## 9. 신규 의존성

- `zod` (런타임 스키마 검증) — `npm install zod --legacy-peer-deps`

## 10. 리스크 & 완화

| 리스크 | 확률 | 완화 |
|---|---|---|
| AppsFlyer API 스키마가 문서와 다름 | 중 | Zod로 런타임 검증, `ValidationError` 경로 분기 |
| Rate limit 초과 | 저 (초당 1req) | 클라이언트 throttle + 429 백오프 |
| Vercel prod 빌드에서 `snapshot.json` fs 쓰기 시도 | 중 | `isVercelProd` 분기, `persisted: false` 응답 |
| dev_token 실수로 git commit | 저 | `.env.local` gitignore, 토큰을 mock-connections에 하드코드 금지 |
| 현재 데이터가 거의 비어서 UI가 어색함 | 확실 | sparse 정책 (dash / hide CPI) + status 자동 판정 |

## 11. Post-MVP 로드맵

현재 스펙은 **MVP 1단계** — "백엔드 파이프라인 완성 + Connections 카드 1곳 라이브". 이후 단계는 데이터가 실제로 쌓이는 시점에 맞춰 순차 진행한다.

### Phase 2 — 차트 실데이터 연결 (데이터 축적 후 2~4주 내)
- **트리거 조건**: D7 리텐션까지 집계 가능, 30일 이상 일별 데이터 확보
- **스코프**:
  - `RetentionCurve`: D0/D1/D3/D7 실측점 + 남은 지점은 Bayesian imputation band
  - `CohortHeatmap`: 주차별 cohort × day 매트릭스 실값
  - `KPICards`: "블렌디드 설치 수 7D", "리텐션 depth 진행도" 추가
- **코드 변경 지점**: 각 차트 컴포넌트의 `useGameData()` 대신 `useAppsFlyerData()` 훅 신설, mock/real 하이브리드 제공
- **디자인 원칙 준수**: 실측 구간과 추정 구간을 시각적으로 구분 (실선 vs 점선, 신뢰 밴드)

### Phase 3 — 쓰기 가능 저장소로 이전 (파일 → KV/Blob)
- **트리거 조건**: Vercel Cron 도입, 혹은 snapshot이 git 추적하기엔 커짐 (≥ 10MB)
- **선택지**:
  - **A. Vercel Blob** — 비정형 스냅샷 저장, presigned URL로 클라이언트 직접 읽기 가능
  - **B. Vercel KV (Upstash Redis)** — key `appsflyer:snapshot:latest` + 히스토리 `appsflyer:snapshot:YYYY-MM-DD`
  - **C. Marketplace Postgres (Neon)** — 정규화된 테이블, SQL 집계 가능. 가장 확장성 ↑
- **CLI/Server Action 영향**: `snapshot.ts` 의 `write/read` 구현만 교체, 호출부 시그니처는 유지 (`AppsFlyerSnapshot` 타입 그대로)

### Phase 4 — 주기 동기화 (Vercel Cron)
- **전제**: Phase 3 완료 (파일 fs 쓰기 불가능한 환경 대응)
- `vercel.ts` crons: `[{ path: "/api/appsflyer/sync", schedule: "0 * * * *" }]` 시간당 1회
- API route는 Vercel Cron 헤더 (`x-vercel-cron`) 검증 후 실행, 외부 호출 차단
- `.env` 에 `APPSFLYER_DEV_TOKEN` Vercel env var로 추가 (암호화 저장)
- Slack 연결 카드 활성화 — 실패/데이터 drift 시 채널 알림

### Phase 5 — 추가 커넥터 수평 확장
동일 패턴으로 증식: Adjust / Singular / GA4 / Amplitude. 아래 § 12의 일원화 추상화가 선행되어야 중복 코드 방지.

### Phase 6 — CLI 플래그 승격
`scripts/fetch-appsflyer.ts` 하드코드 상수를 CLI 플래그로:
```
npm run fetch:af -- --from 2026-01-01 --to 2026-04-30 \
  --app-ids id123,id456 \
  --kpis installs,non_organic_installs,cost \
  --cohort-kpis retention_day_0,retention_day_1,retention_day_3,retention_day_7
```

## 12. 데이터 파이프라인 일원화

Project Compass는 **다수의 외부 데이터 소스**를 동일 관심사로 다뤄야 한다: SensorTower(장르 리텐션 prior), AppsFlyer(attribution/retention), GA4/Amplitude(analytics), 재무(CSV). 현재는 **각 소스가 독립 파이프라인**으로 자라고 있고(SensorTower `crawler/`, AppsFlyer `src/shared/api/appsflyer/`, 재무 CSV 수동 업로드) — 이대로 두면 **패턴이 분화**되어 5번째 소스 추가 시점에 기술 부채가 된다.

### 12-1. 일원화 목표

모든 외부 데이터 소스가 **동일한 생애주기 · 동일한 파일 규약 · 동일한 타입 계약**을 따르도록 통합한다:

```
src/shared/api/connectors/
  ├─ core/                         # 공통 추상화
  │   ├─ types.ts                  # Snapshot<T>, ConnectorConfig, ConnectorResult
  │   ├─ client.ts                 # HTTP fetch + 재시도 + 타임아웃 (소스 공통)
  │   ├─ snapshot.ts               # write/read 공통 로직 (스토리지 adapter 주입)
  │   ├─ errors.ts                 # AuthError, RateLimitError, …
  │   └─ storage/                  # fs, blob, kv 어댑터
  ├─ appsflyer/
  │   ├─ config.ts                 # ConnectorConfig<"appsflyer">
  │   ├─ fetcher.ts                # AppsFlyer 고유 로직
  │   └─ types.ts                  # AppsFlyerSnapshotData
  ├─ sensortower/
  │   ├─ config.ts
  │   ├─ fetcher.ts                # 기존 crawler/ 로직 이관
  │   └─ types.ts
  └─ ga4/, adjust/, …              # 동일 구조
```

### 12-2. 공통 추상화 계약
```ts
type ConnectorConfig<TId extends string> = {
  id: TId                          // "appsflyer" | "sensortower" | …
  displayName: string
  authKind: "bearer" | "oauth" | "none"
  storagePath: string              // "appsflyer/snapshot.json"
  storageKind: "file" | "blob" | "kv"
}

type Snapshot<TData> = {
  version: number
  connectorId: string
  fetchedAt: string
  request: unknown                 // 커넥터별 파라미터 기록
  data: TData
  meta: { warnings: string[] }
}

interface Connector<TParams, TData> {
  config: ConnectorConfig<string>
  fetch(params: TParams, auth: AuthPayload): Promise<ConnectorResult<TData>>
}
```

### 12-3. 스토리지 어댑터 (Phase 3 + 일원화)
```ts
interface SnapshotStorage {
  write<T>(path: string, snap: Snapshot<T>): Promise<void>
  read<T>(path: string): Promise<Snapshot<T> | null>
  getAge(path: string): Promise<number | null>
}
// 구현체: FsStorage (로컬 dev), BlobStorage (Vercel), KvStorage (Upstash)
// env flag로 런타임 선택: process.env.CONNECTOR_STORAGE = "fs" | "blob" | "kv"
```
→ 코드 1곳만 교체하면 모든 커넥터가 저장소 전환됨.

### 12-4. 마이그레이션 순서 (일원화 작업 자체가 후속 PR)
1. 현재 스펙(AppsFlyer MVP) 완료 — `src/shared/api/appsflyer/` 독립 모듈로 착지
2. 일원화 PR 착수 시점: 두 번째 라이브 커넥터(예: GA4) 추가 직전
3. `src/shared/api/connectors/core/` 신설 → AppsFlyer + SensorTower를 그 아래로 이관
4. 기존 `crawler/` 워크스페이스는 "Playwright 기반 scraping runner"로만 축소, 스키마/저장 로직은 `connectors/sensortower/`에 이관
5. 이후 신규 커넥터는 `connectors/{id}/` 템플릿 복제 → `config.ts` + `fetcher.ts`만 구현

### 12-5. 이 스펙(AppsFlyer MVP)이 일원화를 염두해야 할 이유

아래 4가지는 MVP 구현 시점부터 **일원화를 역행하지 않도록** 지킨다:

| 원칙 | 현재 스펙 반영 |
|---|---|
| 스냅샷 outer shape이 커넥터 이름에 의존하지 않음 | § 3-4 `AppsFlyerSnapshot` 은 `version / fetchedAt / request / meta` 를 공통 프레임으로 사용 — 나중에 `Snapshot<TData>` 로 일반화 용이 |
| Fetcher는 순수 함수 | § 2-3 `runAppsFlyerSync` 는 fs/env 접근 없음 — `Connector<TParams, TData>` 인터페이스로 감싸기 쉬움 |
| 저장/읽기를 `snapshot.ts` 한 파일에 캡슐화 | § 2-2 `snapshot.ts` 존재 — 추후 `SnapshotStorage` 어댑터로 교체 1곳 |
| 에러 타입이 커넥터 중립 | § 5-4 `AuthError / RateLimitError / TimeoutError / ValidationError` — 소스 불문 공통, `connectors/core/errors.ts` 로 승격 가능 |

**결론**: MVP를 독립 모듈로 짜되, **파일 레이아웃과 타입 명명을 일원화된 미래 구조와 1:1 매칭되도록 선제 설계**. 일원화 PR은 파일 이동 + import 경로 수정 위주의 기계적 리팩터로 축소된다.

### 12-6. SensorTower 크롤러와의 과도기

- **현 상태**: `crawler/` 별도 Node 워크스페이스, Playwright 기반, 저장 파일명 `merge-jp-snapshot.json`
- **MVP 기간**: AppsFlyer는 `src/shared/api/appsflyer/snapshot.json`, SensorTower는 `src/shared/api/data/sensor-tower/merge-jp-snapshot.json` — **경로는 유사하지만 독립**
- **일원화 PR 이후**: 둘 다 `connectors/{id}/` + `data/{id}/snapshot.json` 통일

이 과도기에는 **두 커넥터의 파일 경로 규약이 부분 일치** 상태이지만, `src/shared/api/data/{source}/` 공통 접두사를 지금부터 지켜 마이그레이션 비용을 선제 최소화한다.

## 13. 후속 PR 후보 (요약 체크리스트)

- [ ] Phase 2: 차트 실데이터 매핑 (RetentionCurve, CohortHeatmap, KPICards)
- [ ] Phase 3: Blob/KV 스토리지 전환 (`SnapshotStorage` 어댑터)
- [ ] Phase 4: Vercel Cron + Slack 알림
- [ ] Phase 5: 2번째 커넥터(예: GA4) 추가 시점에 § 12 일원화 PR 동시 착수
- [ ] Phase 6: CLI 파라미터 플래그화
- [ ] 스냅샷 시계열 히스토리 (`snapshots/YYYY-MM-DD.json`)
- [ ] 토큰 KMS / Vault 연동 (프로덕션 멀티유저 시나리오 시)
