# MMM Phase 2 — CPI 벤치마크 실데이터 연결 설계 스펙

**브랜치**: `feat/mmm-phase-2`
**Supersedes(부분)**: `2026-04-24-mmm-dashboard-v2-decision-focused.md` §6 "Phase 2 (AppsFlyer Benchmarks 크롤러)" — 소스를 AppsFlyer → Unity LevelPlay로 피벗
**의존**: `docs/cpi-benchmark-sources-research.md` (커밋 `fe538b7`, 별도 브랜치 retrieve 필요)
**작성**: 2026-04-24

---

## 0. 왜 Phase 2인가

MMM v2 대시보드(commit `768c09a`, PR #5)는 6-section 구조로 merge됐고, 그중 §⑤ CPI Benchmark Analysis (`CpiBenchmarkTable` + `CpiQuadrant`)는 **mock `marketMedianCpi` 값**으로 작동 중이다. 포트폴리오 감상자에게 "실제 시장 대비 우리 CPI가 적절한지"를 설득하려면 이 두 차트가 **실제 시장 데이터**를 읽어야 한다.

추가로 v2 merge 이후 제품 방향이 바뀌어:
- 실제 게임은 **1개뿐**, 나머지는 anonymized 샘플 (기존 샘플 제거 흐름의 연장선)
- 샘플 게임이 대시보드에 남아있으면 포트폴리오 감상자에게 노이즈 → 완전 제거 필요
- 게임의 주력 국가·장르는 하드코딩이 아닌 **dashboard 내부 설정**으로 관리

이 스펙은 세 문제를 하나의 PR에서 묶어 해결한다. 묶는 이유는 동일한 파일들(`mock-data.ts`, `selected-game.ts`, i18n)을 양쪽 작업이 건드리므로 분리 시 2회 수정 + conflict 리스크가 발생.

---

## 1. 성공 기준

### 기능
1. `/dashboard/mmm` 의 `CpiBenchmarkTable` 과 `CpiQuadrant` 가 `cpi-benchmarks.ts::lookupCpi()` 를 통해 snapshot JSON에서 읽어온 값으로 렌더된다.
2. RunwayStatusBar 의 게임 셀렉터 옆 톱니바퀴 아이콘 클릭 시 `GameSettingsModal` 이 열리고, 국가 + 장르 드롭다운을 저장하면 MMM 차트가 즉시 재계산된다.
3. MMM 페이지 상단에 `CurrentMarketChip` ("Current Market: JP × Merge [편집]") 이 표시되며, 편집 버튼은 `GameSettingsModal` 을 동일 진입점으로 재사용한다.
4. snapshot 의 `generatedAt` 이 35일을 초과하면 `CurrentMarketChip` 에 ⚠ stale 배지가 붙고 툴팁에 경과일이 표시된다.
5. `npm run crawl:cpi` 명령으로 snapshot 이 갱신되고 git 커밋까지 안내된다.
6. 기존 샘플 게임 2개가 `mock-data.ts`, `selected-game.ts`, i18n 사전, 관련 타입·테스트에서 완전히 제거된다. 남은 게임 union은 `"portfolio" | "poko-title"` 2개.

### 비-기능
- `npm run tsc` clean, `npm test` pass, `next build` success, `/dashboard/mmm` 이 Static prerendered 로 유지
- 기존 MMM v2 의 나머지 섹션(①~④, ⑥) 은 동작 변경 없음
- Market Gap 페이지도 `game-settings` 의 장르 값을 읽어 `MarketBenchmark` 차트와 정합 유지

---

## 2. 스코프 경계

### 포함
- Unity LevelPlay CPI Index 를 primary 소스로 하는 크롤러 모듈 (`crawler/src/cpi-benchmarks/`)
- Snapshot JSON (`src/shared/api/data/cpi-benchmarks/levelplay-snapshot.json`) 과 Runtime accessor (`src/shared/api/cpi-benchmarks.ts`)
- Game settings Zustand store + localStorage persist
- `GameSettingsModal` + `CurrentMarketChip` 신규 UI
- `CpiBenchmarkTable` / `CpiQuadrant` mock → accessor 전환
- 샘플 게임 제거 + 게임 ID 추상화
- 관련 i18n 키 추가/삭제

### 제외 (Phase 3+)
- Python MMM 패키지 (saturation posterior, contribution baseline, recommendation optimizer)
- ChannelStatusCard 의 MMP/MMM bias 라벨 실데이터화 — CPI와 무관한 독립 과제
- 다국가 비교 UI — 게임당 단일 (국가, 장르) 만 처리
- 크리에이티브/광고소재 레벨 분해
- 크롤 자동화 (cron, webhook) — 주 1회 수동으로 충분
- ChannelStatusCard, ContributionDonut 등 나머지 위젯의 mock 필드

---

## 3. 아키텍처 (5 레이어)

```
┌─────────────────────────────────────────────────────────────┐
│ [1] Crawler (Node-only, crawler/)                           │
│     fetch-levelplay → normalize → Zod → snapshot 쓰기       │
└─────────────────────────┬───────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ [2] Snapshot JSON (git-tracked)                             │
│     src/shared/api/data/cpi-benchmarks/levelplay-snapshot.json │
│     중첩 구조: platforms → country → genre → metrics         │
└─────────────────────────┬───────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ [3] Runtime accessor                                        │
│     src/shared/api/cpi-benchmarks.ts                        │
│     lookupCpi(country, genre, platform): number | null      │
│     isBenchmarkStale(): boolean                             │
└─────────────────────────┬───────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ [4] Game settings store (Zustand + persist)                 │
│     src/shared/store/game-settings.ts                       │
│     Record<gameId, { country, genre }>                      │
└─────────────────────────┬───────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ [5] UI wiring                                               │
│     GameSettingsModal + CurrentMarketChip                   │
│     CpiBenchmarkTable / CpiQuadrant 에 값 주입              │
└─────────────────────────────────────────────────────────────┘
```

**각 레이어 격리의 목적**:
- [1] 은 Node-only. Playwright 처럼 Next.js 번들에 들어가선 안 되는 코드.
- [2] 는 **소스 무관한 계약**. LevelPlay 가 죽고 AppsFlyer 로 피벗해도 shape 만 유지하면 [3]~[5] 변경 없음.
- [3] 은 파일 I/O 를 숨긴 순수 함수. 테스트 쉬움.
- [4] 는 UI 독립. MMM 뿐 아니라 Market Gap 도 읽음.
- [5] 는 교체 가능한 진입점. 모달은 두 곳(톱니바퀴, 칩) 에서 호출되지만 구현 1개.

---

## 4. 파일 구조

### 신규

```
crawler/src/cpi-benchmarks/
├── fetch-levelplay.ts        # HTTPS 요청 + 재시도 + 타임아웃
├── normalize.ts              # LevelPlay 장르/국가 → Compass enum
├── schema.ts                 # Zod: country/genre/platform enum + metric bounds
├── ingest.ts                 # fetch → normalize → validate → write
├── verify.ts                 # Step 0: endpoint alive 빠른 체크
└── __tests__/
    ├── normalize.test.ts
    ├── schema.test.ts
    └── fetch-levelplay.test.ts

src/shared/api/data/cpi-benchmarks/
└── levelplay-snapshot.json   # 초기 실제 데이터 커밋

src/shared/api/cpi-benchmarks.ts
src/shared/api/__tests__/cpi-benchmarks.test.ts

src/shared/store/game-settings.ts
src/shared/store/__tests__/game-settings.test.ts

src/widgets/app-shell/ui/game-settings-modal.tsx
src/widgets/dashboard/ui/current-market-chip.tsx
```

### 수정

```
src/shared/api/mock-data.ts
  - 샘플 게임 2개 엔트리 제거
  - 게임 union 타입 축소
  - poko-title 기본 설정 추가 (country: "JP", genre: "merge")

src/shared/api/mmm-data.ts
  - cpiBenchmark.items[].marketMedianCpi 필드 제거
  - UI 레이어에서 lookupCpi 로 주입하도록 타입 변경
  - source 필드 enum 추가: "mock-v2" | "levelplay-v1"

src/shared/store/selected-game.ts
  - 게임 ID union: "portfolio" | "poko-title"

src/shared/api/use-game-data.ts
  - 샘플 게임 분기 제거

src/shared/i18n/dictionary.ts
  - 샘플 게임 관련 키 삭제
  - 신규 키 추가 (약 10개)

src/widgets/charts/ui/cpi-benchmark-table.tsx
  - mock marketMedianCpi 제거, lookupCpi + game-settings 훅 사용
  - "데이터 없음" placeholder 경계 케이스 처리

src/widgets/charts/ui/cpi-quadrant.tsx
  - y축 deviation 계산 시 lookupCpi 결과 사용

src/widgets/app-shell/ui/runway-status-bar.tsx
  - 게임 셀렉터 옆에 톱니바퀴 아이콘 + 모달 트리거

src/app/(dashboard)/dashboard/mmm/page.tsx
  - 상단에 <CurrentMarketChip /> 삽입

package.json (root)
  - scripts 추가: "crawl:cpi", "crawl:cpi:verify"

CLAUDE.md
  - §3 의 게임 목록 업데이트: "Portfolio, Poko Title"
  - §9 에 CPI benchmark 운영 문단 추가 (Sensor Tower 문단과 병렬)
```

### 제거

```
# 샘플 게임 관련 mock 데이터 (mock-data.ts 내 엔트리만 제거, 파일은 유지)
# 관련 i18n 키 (샘플 게임 이름)
```

---

## 5. 데이터 흐름

### 5.1 런타임 (유저가 페이지 여는 순간)

```
/dashboard/mmm 열림
  ↓
useSelectedGame() → gameId = "poko-title"
  ↓
useGameSettings(gameId) → { country: "JP", genre: "merge" }
  ↓
CpiBenchmarkTable / CpiQuadrant 렌더
  ↓
채널마다 lookupCpi("JP", "merge", channel.platform) 호출
  ↓
snapshot.platforms.ios.JP.merge.cpi → 3.2
  ↓
차트에 주입, "우리 CPI vs 시장 3.2" 비교 표시
  ↓
(병렬) isBenchmarkStale() 체크 → 35일 초과면 칩에 ⚠ 배지
```

### 5.2 크롤 주기 (주 1회, 사람이 수동 실행)

```
npm run crawl:cpi
  ↓
verify.ts: LevelPlay endpoint alive 체크 (HEAD 요청)
  ↓
fetch-levelplay.ts: JSON API 호출 (3회 재시도, 10s timeout)
  ↓
normalize.ts: "Casual" → "casual", "Japan" → "JP", platform 정규화
  ↓
schema.ts: Zod 검증 (CPI > 0 && < 100, enum 유효성)
  ↓
ingest.ts: snapshot JSON 쓰기 + 이전 버전과 diff 요약 콘솔 출력
  ↓
(사람) git add + commit "data(cpi): LevelPlay snapshot YYYY-MM-DD"
```

### 5.3 유저 설정 변경 플로우

```
유저가 톱니바퀴 클릭 OR CurrentMarketChip 편집 버튼 클릭
  ↓
GameSettingsModal 열림 (동일 컴포넌트, 동일 state)
  ↓
국가 드롭다운 (JP, US, KR, DE, GB, Global) + 장르 드롭다운 (merge, puzzle, rpg, casual, strategy, idle) 선택
  ↓
"저장" 클릭
  ↓
useGameSettings().updateSettings("poko-title", { country, genre })
  ↓
Zustand persist → localStorage 에 "compass:game-settings" 키로 저장
  ↓
구독 중인 모든 컴포넌트 리렌더 (CurrentMarketChip, CpiBenchmarkTable, CpiQuadrant, MarketBenchmark in Market Gap)
```

---

## 6. Snapshot 스키마

```ts
// crawler/src/cpi-benchmarks/schema.ts 와 src/shared/api/cpi-benchmarks.ts 에서 공유

export const CountryCodeSchema = z.enum([
  "JP", "US", "KR", "DE", "GB", "FR", "CN", "TW", "HK", "SG", "TH", "ID", "VN",
  "BR", "MX", "CA", "AU", "IN", "RU", "TR", "ES", "IT", "NL", "SE", "PL"
])

export const GenreSchema = z.enum([
  "merge", "puzzle", "rpg", "casual", "strategy", "idle", "simulation", "arcade"
])

export const PlatformSchema = z.enum(["ios", "android"])

export const MetricsSchema = z.object({
  cpi: z.number().positive().max(100),
  cpm: z.number().positive().optional()
})

// platform → country → genre → metrics. 모든 레벨에서 partial 허용 (부분 snapshot 정상 동작).
export const GenreMetricsMapSchema = z.record(GenreSchema, MetricsSchema)
export const CountryGenreMapSchema = z.record(CountryCodeSchema, GenreMetricsMapSchema)
export const PlatformCountryMapSchema = z.record(PlatformSchema, CountryGenreMapSchema)

export const SnapshotSchema = z.object({
  version: z.literal(1),
  source: z.literal("unity-levelplay-cpi-index"),
  generatedAt: z.string().datetime(),
  sourceRange: z.object({ start: z.string(), end: z.string() }),
  platforms: PlatformCountryMapSchema
})
```

### 스냅샷 JSON 예시 (축약)

```jsonc
{
  "version": 1,
  "source": "unity-levelplay-cpi-index",
  "generatedAt": "2026-04-24T03:00:00Z",
  "sourceRange": { "start": "2026-03-24", "end": "2026-04-23" },
  "platforms": {
    "ios": {
      "JP": {
        "merge":  { "cpi": 3.8, "cpm": 18.5 },
        "puzzle": { "cpi": 3.2, "cpm": 16.2 },
        "rpg":    { "cpi": 5.8, "cpm": 22.1 }
      },
      "US": { "merge": { "cpi": 4.9 } }
    },
    "android": {
      "JP": { "merge": { "cpi": 2.1 } }
    }
  }
}
```

### 스키마 설계 원칙
- **O(1) 조회**: `snapshot.platforms.ios.JP.merge.cpi` 가 바로 값
- **Git diff 친화**: 일본 merge CPI 만 바뀌면 1 줄 수정
- **Partial 허용**: 모든 국가×장르가 항상 있진 않음. 일부 null 은 정상
- **크기**: 2 × 25 × 8 × 2 ≈ 800 값, gzip 후 ~5KB → 번들 부담 0

### 장르 매핑 전략 (LevelPlay → Compass)

```ts
// crawler/src/cpi-benchmarks/normalize.ts
const GENRE_MAPPING: Record<string, Genre> = {
  "Casual":      "casual",
  "Merge":       "merge",          // 있으면 직접
  "Puzzle":      "puzzle",
  "Match-3":     "puzzle",         // 통합
  "RPG":         "rpg",
  "Role Playing":"rpg",
  "Strategy":    "strategy",
  "Idle":        "idle",
  "Simulation":  "simulation",
  "Arcade":      "arcade"
}

// Fallback: LevelPlay 에 "merge" 가 없으면 "casual" 사용
const GENRE_FALLBACK: Partial<Record<Genre, Genre>> = {
  "merge": "casual"
}
```

`lookupCpi` 는 primary 조회 실패 시 fallback 을 한 번만 시도, 그것도 없으면 null 반환.

---

## 7. Game Settings Store

```ts
// src/shared/store/game-settings.ts
export type Country = z.infer<typeof CountryCodeSchema>
export type Genre = z.infer<typeof GenreSchema>

export interface GameSettings {
  country: Country
  genre: Genre
}

interface GameSettingsStore {
  settings: Record<string, GameSettings>  // gameId → settings
  updateSettings: (gameId: string, partial: Partial<GameSettings>) => void
}

const DEFAULTS: Record<string, GameSettings> = {
  "poko-title": { country: "JP", genre: "merge" }
}

export const useGameSettings = create<GameSettingsStore>()(
  persist(
    (set) => ({
      settings: DEFAULTS,
      updateSettings: (gameId, partial) =>
        set((state) => ({
          settings: {
            ...state.settings,
            [gameId]: { ...state.settings[gameId], ...partial }
          }
        }))
    }),
    { name: "compass:game-settings" }
  )
)
```

**Portfolio 처리**: `gameId === "portfolio"` 는 설정이 필요 없음. UI 가 portfolio 선택 시 톱니바퀴를 숨김.

---

## 8. UI 컴포넌트

### 8.1 `GameSettingsModal`

- **파일**: `src/widgets/app-shell/ui/game-settings-modal.tsx`
- **기반**: Radix Dialog (기존 `ConnectionDialog` 패턴 재사용)
- **상태**: 열림/닫힘은 컴포넌트 내부 state + `open`/`onOpenChange` prop 으로 제어 가능
- **진입점 2개**:
  1. RunwayStatusBar 의 톱니바퀴 아이콘
  2. CurrentMarketChip 의 "편집" 버튼
- **레이아웃**:
  - 헤더: "게임 설정 — [게임명]"
  - 본문: 2개 필드 (국가 드롭다운, 장르 드롭다운)
  - 푸터: 취소 / 저장

### 8.2 `CurrentMarketChip`

- **파일**: `src/widgets/dashboard/ui/current-market-chip.tsx`
- **표시**: `"Current Market: JP × Merge"` (ko: `"시장 기준: 일본 × 머지"`)
- **배지**: stale 시 ⚠ + "36일 경과" 툴팁
- **편집 버튼**: 클릭 시 `GameSettingsModal` 열기
- **위치**: MMM 페이지 최상단, Hero Verdict 위 또는 같은 라인
- **Portfolio 뷰에서는 숨김**: portfolio 는 게임별 설정 없음

### 8.3 RunwayStatusBar 수정

- 게임 셀렉터 컴포넌트 바로 오른쪽에 `<IconButton icon="solar:settings-bold" onClick={...} />`
- 클릭 시 현재 선택된 게임의 `GameSettingsModal` 열림
- **Portfolio 선택 시 버튼 숨김** (disabled 아닌 DOM 에서 제거). 단일게임 뷰 전환 시 자연스럽게 다시 나타남.

---

## 9. 샘플 게임 제거

### 영향 범위

| 파일 | 변경 |
|------|------|
| `src/shared/api/mock-data.ts` | 2개 게임 엔트리 + 관련 mock 데이터 블록 삭제 |
| `src/shared/store/selected-game.ts` | union 축소 `"portfolio" \| "poko-title"` |
| `src/shared/api/use-game-data.ts` | switch 분기 제거 |
| `src/shared/i18n/dictionary.ts` | 샘플 게임 이름 i18n 키 제거 |
| `src/shared/api/mmm-data.ts` | 게임별 mock MMM 데이터 정리 (poko-title 만 유지) |
| `src/widgets/app-shell/ui/*` 게임 셀렉터 | 드롭다운에 Portfolio + Poko Title 2개만 표시 |
| `src/widgets/dashboard/ui/title-heatmap.tsx` | Portfolio 뷰에서 1행만 표시되도록 데이터 흐름 확인 |
| `src/widgets/dashboard/ui/portfolio-verdict.tsx` | 단일 게임 상태에서도 자연스럽게 렌더되도록 문구 검토 |
| `CLAUDE.md` §3 | 게임 목록 업데이트 |

### 샘플 게임 제거로 변경되는 사용자 경험

- Portfolio 뷰: 여전히 존재. 단, 집계 대상이 1개 게임이므로 일부 위젯(TitleHeatmap) 이 1행만 표시. 향후 게임 추가 시 자연스럽게 복수로 확장됨.
- PortfolioVerdict: 단일 게임 상태에서 판정 로직이 여전히 유효해야 함 (리스크 체크: 통계적 가중 평균이 N=1 에서 의미 있게 동작하는지).
- KPICards: 6-card vs 4-card 분기가 여전히 작동.

---

## 10. 에러 처리

### 크롤러

| 상황 | 처리 |
|------|------|
| LevelPlay 5xx | 3회 재시도 (exp backoff: 1s/2s/4s) → 최종 실패 시 exit 1 + stderr 에 액션 아이템 |
| Network timeout (10s) | 재시도 카운터에 포함 |
| JSON shape 변형 | Zod 검증 실패 → "schema.ts 업데이트 필요" 에러 |
| 일부 국가/장르 누락 | 경고 로그 후 계속 진행 (partial snapshot 허용) |
| CPI 범위 초과 (>100) | Zod 검증 실패 |

### Compass 빌드 타임

| 상황 | 처리 |
|------|------|
| snapshot JSON 부재 | TypeScript import 실패 → build 중단 |
| snapshot shape 깨짐 | `cpi-benchmarks.ts` 내 Zod 검증 throw → build 중단 |

### Compass 런타임

| 상황 | 처리 |
|------|------|
| `lookupCpi` 조합 없음 | null 반환 → 차트에 "데이터 없음" placeholder |
| fallback 장르 사용됨 | null 아닌 값 반환, 단 내부 플래그로 "from fallback" 표시 (향후 UI 에 "근접 장르 사용 중" 알림 가능) |
| 게임 설정 hydration 전 | DEFAULTS 사용 |
| snapshot stale | 여전히 데이터 사용. 칩에 ⚠ 배지 |

---

## 11. 테스트 전략

### [1] 크롤러 (Vitest)

```
crawler/src/cpi-benchmarks/__tests__/
├── normalize.test.ts
│   - 실제 LevelPlay 응답 fixture → Compass shape 변환
│   - 장르 매핑 (Casual → casual, Match-3 → puzzle)
│   - 장르 fallback (Merge 없으면 casual)
│   - 국가 코드 대소문자 / 이름 정규화
│
├── schema.test.ts
│   - 정상 snapshot 통과
│   - 음수 CPI → throw
│   - 비정상 country code → throw
│   - 누락된 platform → throw
│
└── fetch-levelplay.test.ts
    - HTTP 모킹 (nock 또는 MSW)
    - 3회 재시도 동작
    - 10s timeout → retry
    - 200 응답 후 JSON 파싱
```

### [2] Compass accessor (node:test)

```
src/shared/api/__tests__/cpi-benchmarks.test.ts
├── lookupCpi 정상 경로: JP × merge × ios → 3.8
├── lookupCpi null: 없는 조합 (예: KR × merge × ios, JP 만 있음)
├── lookupCpi fallback: merge 없음 → casual 반환
├── isBenchmarkStale: 34일/35일/36일 경계 (Date 모킹)
└── getSourceMeta: 필드 타입
```

### [3] Game settings store (node:test)

```
src/shared/store/__tests__/game-settings.test.ts
├── 초기 hydration: DEFAULTS
├── updateSettings 반영
├── 부분 업데이트 (country 만)
└── persist 직렬화/역직렬화 round-trip
```

### [4] Integration

기존 precommit-gate 통과 조건:
- `npm run tsc` clean
- `npm test` pass
- `next build` success
- `/dashboard/mmm` Static prerendered 유지

### [5] 수동 브라우저 검증 (PR description checklist)

- [ ] MMM 페이지 열기 → `CurrentMarketChip` 상단 표시
- [ ] 톱니바퀴 클릭 → `GameSettingsModal` 열림
- [ ] 국가 JP→US 변경 → 저장 → `CpiBenchmarkTable` 값 즉시 변경
- [ ] 장르 merge→puzzle 변경 → 차트 값 변경
- [ ] snapshot `generatedAt` 을 40일 전으로 조작 → stale 배지 출현
- [ ] 존재하지 않는 조합 (예: KR × simulation) → "데이터 없음" placeholder
- [ ] Portfolio 뷰 선택 → 톱니바퀴 숨김, `CurrentMarketChip` 숨김
- [ ] Market Gap 페이지로 이동 → `MarketBenchmark` 도 동일 genre 기준
- [ ] ko ↔ en 토글 → 신규 키 누락 없음

---

## 12. 구현 순서

각 단계는 별도 커밋, precommit-gate 통과 후 진행.

1. **Step 0 — LevelPlay endpoint 검증**
   - `crawler/src/cpi-benchmarks/verify.ts` 작성
   - `npm run crawl:cpi:verify` 실행 → 페이지 alive, 내부 API endpoint 식별, 인증 유무 확인
   - 결과를 `docs/cpi-benchmark-sources-research.md` 에 기록 (main 에 retrieve 먼저)
   - **실패 시 분기**: AppsFlyer Performance Index PDF 파싱으로 피벗. 단, snapshot shape 은 그대로 유지.

2. **샘플 게임 제거** (선행, 후속 변경의 충돌 방지)
   - `mock-data.ts`, `selected-game.ts`, `use-game-data.ts`, i18n, 관련 테스트 정리
   - 게임 ID union 을 `"portfolio" | "poko-title"` 로 확정
   - Portfolio 뷰가 단일 게임 상태에서 정상 렌더되는지 브라우저 확인

3. **Crawler 모듈** (TDD)
   - `schema.ts` → 테스트 → 구현
   - `normalize.ts` → 테스트 → 구현
   - `fetch-levelplay.ts` → 테스트 (HTTP 모킹) → 구현
   - `ingest.ts` → 실 네트워크 통합 (수동)

4. **Snapshot 초기 생성**
   - `npm run crawl:cpi` 실행 → `levelplay-snapshot.json` 생성
   - Zod 검증 통과 확인, 커밋

5. **Runtime accessor** (`cpi-benchmarks.ts`)
   - TDD: 테스트 먼저, lookupCpi / isBenchmarkStale / getSourceMeta 순서

6. **Game settings store**
   - Zustand + persist 미들웨어
   - 테스트 (hydration, updateSettings, persist round-trip)

7. **UI 컴포넌트**
   - `GameSettingsModal` (Radix Dialog)
   - `CurrentMarketChip`
   - RunwayStatusBar 에 톱니바퀴 추가 + 모달 트리거

8. **차트 연결**
   - `CpiBenchmarkTable` mock → lookupCpi
   - `CpiQuadrant` mock → lookupCpi
   - 데이터 없음 placeholder 경계 처리

9. **i18n + 최종 검증**
   - ko/en 키 추가 (약 10개)
   - tsc / test / next build
   - 브라우저 수동 체크리스트 전부 확인

---

## 13. 리스크 & 완화

| 리스크 | 영향 | 완화 |
|--------|------|------|
| LevelPlay endpoint 종료/유료화 | 크롤러 소스 없음 | Step 0 에서 먼저 확인. AppsFlyer Performance Index PDF 파싱으로 피벗. snapshot shape 은 동일하므로 [2]~[5] 레이어 재사용. |
| LevelPlay 에 "merge" 장르 없음 | 핵심 데이터 누락 | `GENRE_FALLBACK` 매핑 ("merge" → "casual") 로 근접값 사용. 내부 플래그로 표기. |
| PR 사이즈 15-20 파일 | 리뷰 부담 | step-by-step 커밋 구조 (구현 순서 그대로), CodeRabbit 활용. |
| 샘플 게임 제거 후 Portfolio 위젯 regression | 단일 게임 시각적 어색함 | TitleHeatmap 1-row 상태 미리 확인. 향후 게임 추가 시 자연스럽게 해결. 이는 의도된 상태이며 버그 아님. |
| Zustand persist migration | 구 스키마 충돌 | 신규 key (`compass:game-settings`) 사용, 기존 key와 별개. |
| snapshot Zod 검증 실패로 build 중단 | deploy 사고 | CI 에서 tsc 와 함께 snapshot 유효성 확인. 크롤 직후 로컬에서 검증 필수. |

---

## 14. Phase 3 의존성

Phase 3 (Python MMM) 이 시작되면 다음이 가능:

- `ChannelStatusCard.recommendation` + `mmpComparison.mmmInstalls` → PyMC-Marketing posterior 로 교체
- `saturationWeighted` → MMM posterior
- `contribution.organic / paid` → MMM baseline trend
- `ReallocationSummary.moves` → Bayesian optimizer 결과

이 스펙의 변경 사항은 Phase 3 과 **충돌 없음**. Phase 3 은 다른 mock 필드만 건드리고 `cpiBenchmark` 영역은 건드리지 않음.

---

## 15. i18n 키 변경

### 추가 (약 10개)

```
settings.country
settings.genre
settings.save
settings.cancel
settings.modalTitle
mmm.currentMarket
mmm.benchmarkStale
mmm.benchmarkNoData
mmm.genreFallbackNotice
country.{JP,US,KR,...}   (국가명)
genre.{merge,puzzle,...} (장르명)
```

### 삭제

샘플 게임 이름과 description 의 i18n 키 전체 (해당 게임 ID 로 검색하여 정리).

---

## 16. 운영 (Sensor Tower 와 동일 패턴)

### 주 1회 수동 실행

```
npm run crawl:cpi
```

### Endpoint 검증

```
npm run crawl:cpi:verify
```

### 디버그 (단일 국가)

```
npm run crawl:cpi -- --country=JP --dry-run
```

### 35일 경과 시 staleness

Compass UI 상단 칩에 ⚠ 배지 자동 표시. 35일 기준 (월간 갱신 + 5일 버퍼). 기준일 경과 시 즉시 크롤 재실행 권고.

---

## 17. 관련 파일 / 참고

- MMM v2 스펙: `2026-04-24-mmm-dashboard-v2-decision-focused.md`
- Sensor Tower 크롤러: `crawler/src/` (패턴 참고)
- Sensor Tower 스펙: `2026-04-20-sensortower-crawler-design.md`
- CPI 리서치: `docs/cpi-benchmark-sources-research.md`
  - **구현 시 복구 명령**: `git show fe538b7:docs/cpi-benchmark-sources-research.md > docs/cpi-benchmark-sources-research.md`
  - Harness PR #7 squash merge 에서 누락됨. Step 0 착수 전 worktree 에 retrieve 필요.
- prior-data: `src/shared/api/prior-data.ts` (genre enum 정합 대상)

---

## Appendix A: 용어

- **Snapshot**: LevelPlay 에서 크롤링한 1회 갱신분의 CPI 데이터 JSON 파일
- **Accessor**: snapshot JSON 을 읽어 값을 반환하는 순수 함수 모듈 (`cpi-benchmarks.ts`)
- **Game settings**: 각 게임의 (country, genre) 유저 설정. localStorage 에 persist
- **Stale**: snapshot `generatedAt` 이 35일 초과 경과
- **Fallback genre**: Compass 장르가 LevelPlay 에 없을 때 사용하는 근접 장르 (예: merge → casual)
- **Poko Title**: 실제 운영 중인 단일 게임의 내부 코드네임. UI 표시용 이름은 i18n 키로 노출.
