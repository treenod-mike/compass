# Sensor Tower Crawling Engine — 설계 스펙

- **작성일**: 2026-04-20
- **작성자**: Mike + Claude (brainstorming session)
- **상태**: Draft (사용자 리뷰 대기)
- **목적**: Project Compass의 Bayesian Prior(장르 기대치) 데이터를 mock에서 실제 Sensor Tower 데이터로 교체하기 위한 사내 크롤링 엔진 MVP 설계

---

## 1. 배경 & 목표

### 1.1 문제

Project Compass는 모바일 게임 산업의 실험→투자 의사결정 OS로, 차트 위젯들이 "장르 기대치(prior) vs 우리 실적(posterior)" 형태의 Bayesian 비교를 핵심으로 한다. 현재 prior는 `mock-data.ts`에 하드코딩되어 있어 실제 시장 변화를 반영하지 못한다.

### 1.2 목표 (MVP)

- Sensor Tower 사내 구독 데이터를 자동 수집해 prior로 공급
- 수집 대상: **Merge 장르 × 일본(JP) × Top 20 grossing**
- 수집 항목:
  - Top 20 게임 메타데이터 (이름, 퍼블리셔, app IDs)
  - 다운로드 + 매출 추정 (90일 + 월별)
  - 리텐션 D1 / D7 / D30
  - 장르 분포 통계 (P10 / P50 / P90)
- 실행 방식: 로컬 CLI 수동 실행 (주 1회)
- 출력 형태: JSON 스냅샷 → git 커밋 → Compass 빌드 타임 import

### 1.3 비-목표 (YAGNI)

- ❌ 다중 장르/지역 동시 수집
- ❌ 실시간 / 시간 단위 폴링
- ❌ 자동 로그인 (이메일/비번 매크로)
- ❌ 다중 계정 / 프록시 회피
- ❌ DB / 백엔드 서비스
- ❌ Cloud CI / GitHub Actions 자동화 (향후 확장 가능)
- ❌ User-level 데이터 수집 (게임 단위 집계만)

### 1.4 결정 근거

- **Sensor Tower 접근 경로**: 회사 구독은 웹 대시보드 시트만 보유 (공식 API 키 없음) → Playwright 기반 세션 스크래핑
- **수집 티어**: Game Intelligence + Usage Intelligence(리텐션) 모두 포함된 구독
- **법적**: 회사 내부 사용 한정, 외부 배포·재판매 금지

---

## 2. 아키텍처

### 2.1 폴더 구조

```
project-compass/
├── crawler/                              ← 신규 (Node-only CLI)
│   ├── package.json                      독립 deps
│   ├── tsconfig.json
│   ├── .env.example                      커밋
│   ├── .gitignore
│   ├── README.md
│   └── src/
│       ├── index.ts                      CLI entrypoint
│       ├── config/
│       │   └── targets.ts                {genre:'Merge', region:'JP', topN:20}
│       ├── auth/
│       │   ├── login.ts                  --login 플래그, headed 로그인
│       │   └── session.ts                storageState 로드/검증
│       ├── fetchers/
│       │   ├── top-charts.ts             Top20 게임 ID
│       │   ├── game-intelligence.ts      DL/매출 시계열
│       │   └── usage-intelligence.ts     리텐션 D1/D7/D30
│       │   # store-intelligence.ts (신규 출시 빈도)는 MVP 범위 밖, 향후 추가
│       ├── transformers/
│       │   └── to-prior.ts               raw → P10/P50/P90 분포
│       ├── storage/
│       │   └── snapshot-writer.ts        atomic write
│       └── lib/
│           ├── humanlike-delay.ts        반-봇탐지 페이싱
│           └── xhr-intercept.ts          page.on('response') 헬퍼
│
└── src/shared/api/
    ├── data/sensor-tower/                ← 신규 (커밋됨)
    │   ├── merge-jp-snapshot.json
    │   └── last-updated.json
    ├── prior-data.ts                     ← 신규
    └── mock-data.ts                      유지 — 우리 게임 데이터
```

### 2.2 핵심 결정

1. **Crawler는 별도 `package.json`** — Playwright(~300MB Chromium 바이너리)가 Compass 빌드 의존성에 안 들어감. Vercel 정적 빌드 영향 없음
2. **Fetcher 1패널 = 1파일** — ST UI가 패널별로 깨질 수 있으므로 격리해 한 군데 수정으로 끝나게
3. **출력 JSON은 git 커밋** — Vercel 정적 빌드가 그대로 import, 주마다 git diff로 시장 변화가 자연스럽게 보임

### 2.3 런타임 흐름

```
[user] $ npm run crawl:st
   ↓
session.ts: storageState.json 로드, 만료/유효성 체크
   ↓ (만료) → 친절한 에러: "npm run crawl:st -- --login 실행 필요"
   ↓ (유효)
.crawler.lock 획득 (재진입 차단)
   ↓
Playwright launch (headed, ST_HEADLESS=false 기본)
   ↓
top-charts.ts → Top 20 게임 ID 수집
   ↓
for each game (동시성 1, 1.5–4초 랜덤 딜레이):
  game-intelligence.ts → DL/매출
  usage-intelligence.ts → 리텐션
   ↓
to-prior.ts → P10/P50/P90 분포 계산
   ↓
Zod 스키마 검증
   ↓
last-good-snapshot.json 백업
   ↓
atomic write: tmp 파일 → rename → merge-jp-snapshot.json
   ↓
last-updated.json 갱신 (fetchedAt, gitSha)
   ↓
.crawler.lock 해제
```

---

## 3. 데이터 스키마

### 3.1 출력 JSON (`merge-jp-snapshot.json`)

```jsonc
{
  "$schemaVersion": 1,
  "metadata": {
    "fetchedAt": "2026-04-20T11:36:00+09:00",
    "fetchedBy": "crawler@local",
    "genre": "Merge",
    "region": "JP",
    "topN": 20,
    "tier": "iphone-grossing",
    "crawlerVersion": "0.1.0",
    "warnings": []
  },
  "topGames": [
    {
      "rank": 1,
      "name": "Royal Match",
      "publisher": "Dream Games",
      "appIds": { "ios": "1632298254", "android": "com.dreamgames.royalmatch" },
      "downloads": {
        "last90dTotal": 4500000,
        "monthly": [{ "month": "2026-01", "value": 1800000 }]
      },
      "revenue": {
        "last90dTotalUsd": 28400000,
        "monthly": [{ "month": "2026-01", "value": 9500000 }]
      },
      "retention": {
        "d1": 0.42, "d7": 0.18, "d30": 0.08,
        "sampleSize": "ST estimate",
        "fetchedAt": "2026-04-20T11:36:00+09:00"
      }
    }
    // ... 19 more
  ],
  "genrePrior": {
    "retention": {
      "d1":  { "p10": 0.28, "p50": 0.38, "p90": 0.50 },
      "d7":  { "p10": 0.10, "p50": 0.16, "p90": 0.24 },
      "d30": { "p10": 0.04, "p50": 0.07, "p90": 0.12 }
    },
    "monthlyRevenueUsd":  { "p10": 200000,  "p50": 1500000, "p90": 12000000 },
    "monthlyDownloads":   { "p10": 50000,   "p50": 350000,  "p90": 2500000 }
  }
}
```

### 3.2 검증 (Zod)

- 크롤러 측: `transformers/to-prior.ts`가 작성 직전 검증
- Compass 측: `prior-data.ts`가 import 시 재검증
- 두 번 검증으로 손상된 JSON이 빌드 깨뜨리는 사고 방지

### 3.3 메타데이터 파일 (`last-updated.json`)

```json
{
  "fetchedAt": "2026-04-20T11:36:00+09:00",
  "gitSha": "abc1234",
  "snapshotPath": "merge-jp-snapshot.json",
  "ageWarningDays": 14
}
```

---

## 4. 안전 가드

| 위협 | 방어 |
|------|------|
| **자격증명 유출** | `.env`에 비밀번호 받지 않음. 첫 실행 시 headed 브라우저로 사람이 직접 로그인 → `storageState.json`에 세션 저장. 파일은 `.gitignore` + `chmod 600` 권장 |
| **storageState 탈취** | 만료 시각 메타 함께 저장, 30일 지나면 자동 무효화 → 재로그인 강제 |
| **봇 탐지 / 계정 락** | (1) headed 모드 기본값 (2) 요청 사이 1.5–4초 랜덤 딜레이 (3) 페이지 동시성 1 (한 번에 한 게임만, 병렬 호출 금지) (4) 페이지 스크롤 시뮬레이션 (5) 한 세션 ≤25 게임 |
| **ST UI 변경 사일런트 실패** | XHR URL 패턴 매칭 실패 시 즉시 throw. 빈 결과로 prior 0이 되는 사고 차단. 디버그 스크린샷 자동 저장 |
| **부분 실패가 좋은 데이터 덮어씀** | 모든 fetcher 통과 시에만 atomic rename. 실패 시 `last-good-snapshot.json` 백업 유지 |
| **ToS 위반 (외부 노출)** | README 명시: "회사 내부 구독 데이터, 외부 배포·재판매 금지". JSON에 `internal-use-only` 플래그 |
| **민감 정보 잘못 커밋** | `.gitignore`에 `storageState.json`, `.env`, `debug-screenshots/`, `*.har`, `.crawler.lock` |
| **장기간 미실행 → stale 데이터로 의사결정** | `last-updated.json`의 `fetchedAt`이 14일 초과 시 Compass UI 상단에 "Prior 데이터 오래됨" 배지 |
| **개인정보 수집** | 게임 단위 집계만, user-level 패널 방문 금지 |
| **재진입 안전성** | `.crawler.lock` 파일로 동시 실행 차단 |

---

## 5. 환경변수

### 5.1 `crawler/.env.example`

```bash
# 출력 경로 (crawler/ 기준 상대경로)
ST_DATA_OUT=../src/shared/api/data/sensor-tower

# Playwright 동작
ST_HEADLESS=false
ST_USER_DATA_DIR=./.playwright
ST_STORAGE_STATE=./storageState.json
ST_STORAGE_TTL_DAYS=30

# 안티-봇 페이싱
ST_MIN_DELAY_MS=1500
ST_MAX_DELAY_MS=4000
ST_PAGE_SCROLL_SIM=true
ST_MAX_GAMES_PER_RUN=25

# 수집 대상 (MVP 고정)
ST_TARGET_GENRE=Merge
ST_TARGET_REGION=JP
ST_TARGET_CHART=iphone-grossing
ST_TARGET_TOP_N=20

# 디버깅
ST_DEBUG_SCREENSHOTS=true
ST_LOG_LEVEL=info
```

### 5.2 의도적 비-환경변수 (보안 결정)

- ❌ `SENSORTOWER_EMAIL` — 자동 로그인 안 함
- ❌ `SENSORTOWER_PASSWORD` — 자동 로그인 안 함
- ❌ `ST_PROXY_URL` — 프록시 회피 안 함

---

## 6. Compass 통합 지점

### 6.1 신규: `src/shared/api/prior-data.ts`

```typescript
import { z } from "zod";
import snapshot from "./data/sensor-tower/merge-jp-snapshot.json";

const PercentileSchema = z.object({
  p10: z.number(), p50: z.number(), p90: z.number(),
});

const SnapshotSchema = z.object({
  $schemaVersion: z.literal(1),
  metadata: z.object({
    fetchedAt: z.string(),
    genre: z.string(),
    region: z.string(),
    topN: z.number(),
    crawlerVersion: z.string(),
    warnings: z.array(z.string()),
  }),
  topGames: z.array(z.object({
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
  })),
  genrePrior: z.object({
    retention: z.object({
      d1: PercentileSchema, d7: PercentileSchema, d30: PercentileSchema,
    }),
    monthlyRevenueUsd: PercentileSchema,
    monthlyDownloads: PercentileSchema,
  }),
});

const validated = SnapshotSchema.parse(snapshot);

export const priorByGenre = {
  Merge: { JP: validated.genrePrior },
};

export const priorMetadata = validated.metadata;
export const priorTopGames = validated.topGames;

export function isPriorStale(maxDays = 14): boolean {
  const ageMs = Date.now() - new Date(priorMetadata.fetchedAt).getTime();
  return ageMs > maxDays * 24 * 60 * 60 * 1000;
}
```

### 6.2 수정 대상 위젯 (Phase 7)

| 파일 | 변경 |
|------|------|
| `src/widgets/charts/ui/prior-posterior-chart.tsx` | mock prior → `priorByGenre.Merge.JP.retention.d7` |
| `src/widgets/charts/ui/market-benchmark.tsx` | `priorTopGames`로 벤치마크 게임 리스트 |
| `src/widgets/charts/ui/retention-curve.tsx` | P10/P50/P90 밴드를 실제 prior로 |
| `src/widgets/dashboard/ui/market-context-card.tsx` | "Source: Sensor Tower (수집일: ...)" 푸터 |
| `src/widgets/app-shell/ui/runway-status-bar.tsx` | `isPriorStale()` true면 "Prior 14일+" 배지 |

### 6.3 루트 `package.json` 신규 스크립트

```json
{
  "scripts": {
    "crawl:st": "cd crawler && tsx src/index.ts",
    "crawl:st:login": "cd crawler && tsx src/index.ts --login",
    "crawl:st:dry": "cd crawler && tsx src/index.ts --dry-run --limit 1"
  }
}
```

### 6.4 루트 `.gitignore` 추가

```
# Sensor Tower crawler
/crawler/storageState.json
/crawler/.env
/crawler/.playwright/
/crawler/debug-screenshots/
/crawler/last-good-snapshot.json
/crawler/.crawler.lock
/crawler/*.har
```

---

## 7. 개발 단계 (Phase별 검증 가능)

| Phase | 작업 | 예상 시간 | 검증 |
|-------|------|----------|------|
| **0** | 스캐폴딩: 폴더, deps, tsconfig, .gitignore, .env.example | 30분 | `npm run crawl:st -- --help` 성공 |
| **1** | 인증: `--login` 플래그, headed 로그인, storageState 저장/만료 검증 | 1–2시간 | storageState.json 생성, 재실행 시 세션 유지 |
| **2** | Top Charts fetcher: Merge × JP × Top 20 ID 수집 | 2시간 | dry-run 결과 게임명이 ST 웹과 일치 |
| **3** | Game Intelligence fetcher: DL + 매출 (90일 + 월별) | 2–3시간 | `--limit 1`로 1개 게임, ST 웹과 ±5% 일치 |
| **4** | Usage Intelligence fetcher: D1/D7/D30 리텐션 | 2–3시간 | 1개 게임 ST 리텐션 차트와 ±0.01 일치 |
| **5** | Transformer: P10/P50/P90 분포 계산, Zod 검증 | 1시간 | 픽스처 단위 테스트 통과 |
| **6** | Storage + 오케스트레이션: lockfile, atomic write, last-good 백업 | 1시간 | 풀 런 1회, JSON 스키마 통과 |
| **7** | Compass 통합: `prior-data.ts`, 5개 위젯 수정, stale 배지 | 1–2시간 | `npm run build` 통과, 차트 실제 데이터 렌더링 |
| **8** | 문서화: crawler/README.md, CLAUDE.md 보강 | 30분 | 신규 개발자가 README만 보고 첫 크롤 성공 |

**총 예상**: 11–15시간 (ST UI 분석 시간 포함)

**위험 큰 단계**: Phase 2–4 — 사전에 브라우저 DevTools로 ST 패널의 실제 XHR URL/응답 구조 한 번 들여다본 뒤 시작 권장

---

## 8. 미해결 / 향후 결정 사항

다음 항목은 MVP 범위 밖이지만, 향후 확장 시 고려:

- 다중 장르/지역으로 확장 시 출력 JSON 분할 전략 (`merge-jp.json`, `merge-us.json`, ...)
- GitHub Actions 자동화 (회사 정책 확인 후) — 안 1 → 안 2 점진 확장
- ST API 공식 키 도입 시 마이그레이션 경로 (fetcher 인터페이스 추상화 검토)
- 리텐션 외 추가 prior(ARPDAU, session length 등) 필요성 평가

---

## 9. 부록 — 참고 컨벤션

- **언어**: 모든 코드 주석·로그·README 한국어 (Compass 컨벤션)
- **포맷**: ESLint + Prettier (Compass 루트 설정 상속, crawler/는 자체 설정 가능)
- **테스트**: transformer만 단위 테스트(Vitest 또는 node:test). E2E 자동 테스트는 ST 봇 탐지 위험으로 작성하지 않음
- **로깅**: `console.log` 금지, `lib/logger.ts`로 통일 (silent/info/debug 3단계)

---

## 10. 2026-04-20 12:13 브레인스토밍 보강 노트

본 spec은 2026-04-20 11:56 최초 커밋(c74c19d) 이후 "데이터 구조 확보" 주제로 재검토되어 아래 결정이 **재확정 또는 보강**되었다.

### 10.1 저장 방식 확정 — 동기 import 유지 (Q4 재검토 결과)

브레인스토밍 Q4에서 "`public/data/*.json` + fetch" 옵션이 일시 제안되었으나, 최종적으로 **기존 spec의 동기 import 방식(`src/shared/api/data/sensor-tower/merge-jp-snapshot.json` 직접 import)을 유지**하기로 확정.

**근거:**
- MVP 스냅샷 1개는 수십~수백 KB 수준 (Top 20 × 90일 매출 + 30일 리텐션 추정) → 번들 영향 무시 가능
- 동기 import로 Suspense·loading UI·에러 바운더리 불필요 → 컴포넌트 단순화
- `git diff`로 데이터 변화 추적 가능 (원래 fetch 옵션이 노렸던 장점도 포함)
- `useGameData` 훅 내부 철학("동기 mock → 나중에 async API로 교체")과 일관
- 라이브 전환 시에는 import → fetch로 훅 내부만 교체하면 됨 (UI 영향 0)

### 10.2 타겟 게임 상태 — **포코머지는 Pre-Launch**

포코머지는 **2026-04-20 기준 출시 전(개발 중) 상태**임을 본 spec에 명시.

**데이터 구조에 미치는 영향:**
- SensorTower 크롤러는 **prior(시장 기대치)만** 다루므로 직접 영향 없음
- Posterior(우리 게임 실적) 데이터는 `mock-data.ts`의 기존 값을 **"pre-launch forecast (팀 예측치)"** 로 재라벨링해 운용
- Bayesian 차트의 내러티브가 "운영 진단"이 아닌 **"출시 전 투자 의사결정"** 으로 포지셔닝됨
- Phase 7 통합 시 `market-context-card`에 "prior=SensorTower 실시장 / posterior=팀 사전 예측" 주석 추가 권장

**비목표 확인:**
- 사내 매출 시스템 연동은 MVP 범위 외 (연동된 시스템이 아직 존재하지 않음)
- "My Sales Metrics" (SensorTower 내부 매출 탭)도 MVP 범위 외 (현재 연결된 데이터 없음 확인)

### 10.3 범위 확정 — Top 20 그대로

브레인스토밍 Q2에서 "장르 상위 10개"로 더 좁히자는 의견이 나왔으나, 기존 spec의 **Top 20**을 유지.

**근거:**
- ST Top Chart 페이지 1 렌더링으로 20개까지 한 번에 획득 가능 → 크롤 페이지 수 증가 없음
- 백분위 계산(P10/P50/P90)의 통계적 신뢰도는 n=20이 n=10보다 명확히 우수
- Transformer 로직(percentile-calculator)이 Top 20 기준으로 이미 설계됨

### 10.4 확정된 데이터 구조 체계

"데이터 구조 확보" 주제의 최종 결론:

```
[SensorTower Enterprise 구독]
         │ (Playwright headed + XHR intercept)
         ▼
[crawler/ 로컬 CLI]
  ├─ auth: storageState.json (로컬, gitignore)
  ├─ fetchers: top-charts + game-intel + usage-intel
  ├─ transformer: P10/P50/P90 + prior shape 산출
  └─ writer: atomic + last-good backup
         │ (commit)
         ▼
[src/shared/api/data/sensor-tower/merge-jp-snapshot.json]  ← SSOT for prior
         │ (static import)
         ▼
[src/shared/api/prior-data.ts]  ← Zod 검증 + 타입 노출
         │
         ▼
[위젯] prior-posterior-chart / market-benchmark / market-context-card
         │
         ▼
[Compass Dashboard UI]
         ▲
         │
[src/shared/api/mock-data.ts]  ← posterior (pre-launch forecast, mock 유지)
```

SSOT(Single Source of Truth) 2개:
1. **prior** = `merge-jp-snapshot.json` (SensorTower 실 데이터, 크롤러가 갱신)
2. **posterior** = `mock-data.ts` (팀 예측치, 수동 편집)

둘은 **완전히 독립된 파일**로 교차 의존 없음. 크롤러 실패가 posterior에 영향을 주지 않고, posterior 변경이 크롤러에 영향을 주지 않음.

### 10.5 즉시 실행 블로커 — Phase 1.5 수동 탐사

`plans/2026-04-20-sensortower-crawler.md` Phase 1.5는 사용자가 SensorTower에 로그인해 DevTools Network 탭으로 **XHR 엔드포인트를 직접 탐사**해야 하는 수동 작업임. 이 데이터 없이는 Phase 2~4 fetcher 자동 구현이 불가.

**필요한 캡처 항목 (최소):**
- Top Charts (Merge × JP × Grossing) 페이지의 XHR request URL + 응답 JSON shape 1건
- 임의 게임의 Downloads/Revenue 상세 페이지 XHR + 응답 JSON shape 1건
- 임의 게임의 Retention 페이지 XHR + 응답 JSON shape 1건

이 세 건이 확보되어야 executing-plans 단계로 넘어갈 수 있음.

