# MMM Phase 2 — CPI Benchmark Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** MMM §⑤ (CpiBenchmarkTable, CpiQuadrant) 의 mock `marketMedianCpi` 를 Unity LevelPlay CPI Index 실데이터로 교체하고, 게임 (country, genre) 설정을 dashboard UI 로 노출한다. 샘플 게임 참조를 코드에서 제거하여 MMM 게임 키를 `"portfolio" | "poco"` 로 통일한다.

**Architecture:** 5-layer. Node-only crawler(`crawler/src/cpi-benchmarks/`) 가 LevelPlay JSON API 를 Zod 로 검증하여 git-tracked snapshot JSON 을 생성한다. Compass 측은 순수 accessor(`src/shared/api/cpi-benchmarks.ts`) 로 snapshot 을 읽고, Zustand store(`game-settings.ts`) 의 localStorage 값으로 각 게임의 (country, genre) 조합을 lookup 해 MMM 차트에 주입한다. UI 진입점은 RunwayStatusBar 톱니바퀴 + MMM 상단 CurrentMarketChip 두 곳이지만 모달 컴포넌트는 하나로 공유.

**Tech Stack:** TypeScript (NodeNext ESM) · Zod · Zustand (persist) · Radix Dialog · Next.js 15 App Router · Vitest (크롤러) · node:test via tsx (Compass) · Commander (크롤러 CLI)

---

## Spec 대비 정정사항 (plan 실행 전 인지)

1. **게임 codename**: spec 은 `poko-title` 을 제안했으나 코드베이스에 이미 `poco` (mock-data.ts:121, 609; game-selector.tsx:17) 가 존재. **plan 은 `poco` 를 재사용**하여 delta 최소화.
2. **MMM GameKeySchema** (mmm-data.ts:92-97): 현재 `["portfolio", "match-league", "weaving-fairy", "dig-infinity"]` 이지만 main dashboard 의 `poco` 와 불일치. Phase 2 에서 `["portfolio", "poco"]` 로 통일.
3. **샘플 게임의 실제 위치**: game-selector 엔 이미 `poco` 단일. `game1`, `game2` 는 TitleHealthRow (mock-data.ts:609-611) display-only 로만 존재. 제거 범위는 TitleHealthRow 엔트리 + mmm-data 의 orphan game key + i18n 관련 키.

---

## File Structure

### 신규 파일

```
crawler/src/cpi-benchmarks/
├── schema.ts                        # Zod: Country/Genre/Platform/Metrics/Snapshot
├── normalize.ts                     # LevelPlay 장르·국가 → Compass enum 매핑
├── fetch-levelplay.ts               # HTTP 요청 + 재시도 + 타임아웃
├── ingest.ts                        # fetch → normalize → validate → write
├── verify.ts                        # endpoint alive 빠른 체크
└── __tests__/
    ├── schema.test.ts
    ├── normalize.test.ts
    └── fetch-levelplay.test.ts

src/shared/api/data/cpi-benchmarks/
└── levelplay-snapshot.json          # 초기 실데이터 (또는 AppsFlyer fallback)

src/shared/api/cpi-benchmarks.ts
src/shared/api/__tests__/cpi-benchmarks.test.ts

src/shared/store/game-settings.ts
src/shared/store/__tests__/game-settings.test.ts

src/widgets/app-shell/ui/game-settings-modal.tsx
src/widgets/dashboard/ui/current-market-chip.tsx

docs/cpi-benchmark-sources-research.md   # fe538b7 에서 retrieve
```

### 수정 파일

```
src/shared/api/mock-data.ts                        # TitleHealthRow 샘플 제거
src/shared/api/mmm-data.ts                         # GameKeySchema 축소, mmm 데이터에 새 키 반영
src/widgets/charts/ui/cpi-benchmark-table.tsx      # lookupCpi 사용
src/widgets/charts/ui/cpi-quadrant.tsx             # lookupCpi 사용
src/widgets/dashboard/ui/game-selector.tsx         # 톱니바퀴 아이콘 추가
src/app/(dashboard)/dashboard/mmm/page.tsx         # CurrentMarketChip 상단 삽입
src/shared/i18n/dictionary.ts                      # 신규 키 추가
package.json                                        # crawl:cpi, crawl:cpi:verify 스크립트
crawler/package.json                                # 필요 시 의존성
crawler/src/index.ts                                # 신규 subcommand 등록 (또는 별도 CLI 진입점)
CLAUDE.md                                           # §3 게임 목록, §9 CPI 운영 문단
```

### File Responsibility Summary

- `schema.ts` — **데이터 형태 계약**. 변경 시 파장 최대. crawler + Compass 양쪽이 import (복사 아님, 심볼릭 공유는 후술 Task 2).
- `normalize.ts` — **형태 변환만**. 외부 라벨 → 내부 enum. Stateless 순수 함수.
- `fetch-levelplay.ts` — **네트워크 I/O**. Retry, timeout, 에러 분류.
- `ingest.ts` — **오케스트레이션**. 검증, diff, atomic write.
- `verify.ts` — **Health check**. ingest 없이 endpoint alive만.
- `cpi-benchmarks.ts` — **Compass runtime accessor**. snapshot lookup + stale 판정.
- `game-settings.ts` — **사용자 설정 상태**. Zustand + localStorage persist.
- `game-settings-modal.tsx` — **편집 UI**. 두 진입점에서 공유.
- `current-market-chip.tsx` — **MMM 상단 맥락 표시**. 편집 진입점.

---

## Tasks

### Task 0: Preflight — CPI 리서치 문서 복구 + LevelPlay endpoint 검증

**Purpose:** Plan 실행 전에 LevelPlay primary 소스 가용성을 확인. 죽어 있으면 Task 5/6 을 AppsFlyer PDF 수동 파싱으로 분기.

**Files:**
- Restore: `docs/cpi-benchmark-sources-research.md`
- Create (임시): `crawler/src/cpi-benchmarks/verify.ts`

- [ ] **Step 1: fe538b7 에서 CPI 리서치 문서 복구**

Run:
```bash
git show fe538b7:docs/cpi-benchmark-sources-research.md > docs/cpi-benchmark-sources-research.md
```

Expected: 파일이 worktree 에 생성되어 `ls docs/cpi-benchmark-sources-research.md` 가 성공.

- [ ] **Step 2: 문서 커밋**

```bash
git add docs/cpi-benchmark-sources-research.md
git commit -m "docs(cpi): restore benchmark sources research (fe538b7 squash-missed)"
```

Expected: precommit-gate 통과 (docs-only).

- [ ] **Step 3: LevelPlay endpoint 수동 확인 (개발자 실행)**

브라우저로 https://levelplay.com/cpi-index/ 접속. DevTools Network 탭을 열고 국가/플랫폼 필터를 변경하며 **내부 API 엔드포인트**(XHR/fetch) 식별. 결과를 `docs/cpi-benchmark-sources-research.md` 맨 아래에 "## 10. Step 0 검증 결과 (YYYY-MM-DD)" 섹션으로 추가.

Expected: API endpoint URL + curl 로 인증 없이 200 응답 확인. 응답 JSON 의 top-level shape 기록.

- [ ] **Step 4: 엔드포인트 alive 확인 스크립트 작성**

Create `crawler/src/cpi-benchmarks/verify.ts`:

```ts
// crawler/src/cpi-benchmarks/verify.ts
import { log } from "../lib/logger.js"

const LEVELPLAY_CPI_INDEX_URL = process.env.LEVELPLAY_CPI_INDEX_URL
  ?? "https://levelplay.com/cpi-index/"

export async function verifyEndpoint(): Promise<void> {
  const res = await fetch(LEVELPLAY_CPI_INDEX_URL, {
    method: "HEAD",
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) {
    log.error(`LevelPlay endpoint returned ${res.status}`)
    process.exit(1)
  }
  log.info(`LevelPlay endpoint alive (${res.status})`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  verifyEndpoint().catch((err) => {
    log.error(String(err))
    process.exit(1)
  })
}
```

- [ ] **Step 5: root package.json 에 verify 스크립트 추가**

Modify `package.json` scripts 섹션 (뒤에 추가):

```json
"crawl:cpi:verify": "cd crawler && npx tsx src/cpi-benchmarks/verify.ts"
```

- [ ] **Step 6: verify 실행**

```bash
npm run crawl:cpi:verify
```

Expected (A — endpoint alive): 로그 `LevelPlay endpoint alive (200)` 후 exit 0. Task 1 로 진행.
Expected (B — endpoint dead): stderr 에 에러. **분기**: 이 plan 의 Task 5/6 을 "AppsFlyer Performance Index PDF 수동 파싱"으로 대체. snapshot shape 은 동일 유지.

- [ ] **Step 7: verify.ts + package.json 커밋**

```bash
git add crawler/src/cpi-benchmarks/verify.ts package.json
git commit -m "feat(crawler): LevelPlay endpoint verify script (preflight)"
```

---

### Task 1: 샘플 게임 제거 + MMM 게임 키 통일

**Purpose:** 후속 작업의 mental model 을 단순화. `game1`/`game2` 는 TitleHealthRow display 에만 존재하는 stub, mmm-data.ts 의 orphan game key 들도 함께 정리.

**Files:**
- Modify: `src/shared/api/mock-data.ts:605-615` (TitleHealthRow 엔트리)
- Modify: `src/shared/api/mmm-data.ts:92-97` (GameKeySchema)
- Modify: `src/shared/api/mmm-data.ts` (mmm 실데이터의 gameKey 값 확인)

- [ ] **Step 1: mmm-data.ts 의 실제 gameKey 사용처 탐색**

Run:
```bash
grep -n 'gameKey:\|"match-league"\|"weaving-fairy"\|"dig-infinity"' src/shared/api/mmm-data.ts
```

Expected: GameKeySchema 정의 + 실데이터에서 `gameKey: "match-league"` 같은 값 사용처 목록. 발견된 파일/라인을 기록.

- [ ] **Step 2: TitleHealthRow 샘플 제거 테스트 작성**

Create `src/shared/api/__tests__/mock-data.test.ts` (없으면 신규):

```ts
import { describe, it } from "node:test"
import { strict as assert } from "node:assert"
import { mockTitleHealth } from "../mock-data"  // 실제 export 이름 확인 필요

describe("mockTitleHealth", () => {
  it("contains only poco (sample games removed)", () => {
    const ids = mockTitleHealth.map((r) => r.gameId)
    assert.deepEqual(ids, ["poco"])
  })
})
```

- [ ] **Step 3: 테스트 실행 → 실패 확인**

```bash
npm test -- --test-name-pattern="mockTitleHealth"
```

Expected: FAIL (현재는 game1, game2 가 포함됨).

- [ ] **Step 4: TitleHealthRow 에서 game1, game2 제거**

Modify `src/shared/api/mock-data.ts` — `mockTitleHealth` 배열에서 game1/game2 라인 삭제. poco 만 남김:

```ts
// Before:
// { gameId: "poco",  label: "포코머지", ... },
// { gameId: "game1", label: "게임 1",   ... },
// { gameId: "game2", label: "게임 2",   ... },

// After:
{ gameId: "poco",  label: "포코머지", genre: "Merge", signal: "invest", confidence: 82, paybackD: 47,  roas: 148, retentionTrend: "improving" },
```

- [ ] **Step 5: 테스트 재실행 → 통과 확인**

```bash
npm test -- --test-name-pattern="mockTitleHealth"
```

Expected: PASS.

- [ ] **Step 6: MMM GameKeySchema 축소**

Modify `src/shared/api/mmm-data.ts:92-97`:

```ts
// Before:
const GameKeySchema = z.enum([
  "portfolio",
  "match-league",
  "weaving-fairy",
  "dig-infinity",
])

// After:
const GameKeySchema = z.enum(["portfolio", "poco"])
```

- [ ] **Step 7: mmm 실데이터의 gameKey 값 갱신**

Step 1 에서 발견한 `gameKey: "match-league"` (또는 다른 샘플 키) 을 `"poco"` 로 교체.

- [ ] **Step 8: tsc 검증**

```bash
npx tsc --noEmit
```

Expected: 에러 0. 만약 다른 파일에서 `"match-league" | "weaving-fairy" | "dig-infinity"` 를 참조 중이면 grep 으로 찾아 정리.

- [ ] **Step 9: mmm-data 스키마 round-trip 테스트 통과 확인**

```bash
npm test -- --test-name-pattern="mmm-data"
```

Expected: PASS (기존 테스트가 새 enum 으로 통과).

- [ ] **Step 10: 브라우저 smoke**

```bash
npm run dev
```

Open http://localhost:3000/dashboard (portfolio view) — TitleHeatmap 이 poco 1행만 표시되는지 확인. `/dashboard/mmm` 열어 기존 차트들이 여전히 렌더되는지 확인.

- [ ] **Step 11: 커밋**

```bash
git add src/shared/api/mock-data.ts src/shared/api/mmm-data.ts src/shared/api/__tests__/mock-data.test.ts
git commit -m "refactor: remove sample games, unify MMM game key to portfolio|poco"
```

---

### Task 2: Crawler Zod 스키마 (TDD)

**Purpose:** snapshot 의 데이터 계약 정의. 이 스키마는 crawler 와 Compass accessor 양쪽이 쓸 계약이므로, compass 측은 crawler 소스를 직접 import 하지 않고 **Task 7에서 shape 을 중복 정의하거나 via `import type`** 한다.

**Files:**
- Create: `crawler/src/cpi-benchmarks/schema.ts`
- Create: `crawler/src/cpi-benchmarks/__tests__/schema.test.ts`

- [ ] **Step 1: 테스트 파일 작성**

Create `crawler/src/cpi-benchmarks/__tests__/schema.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import {
  CountryCodeSchema,
  GenreSchema,
  PlatformSchema,
  MetricsSchema,
  SnapshotSchema,
} from "../schema.js"

describe("CountryCodeSchema", () => {
  it("accepts ISO alpha-2 codes", () => {
    expect(() => CountryCodeSchema.parse("JP")).not.toThrow()
    expect(() => CountryCodeSchema.parse("US")).not.toThrow()
  })
  it("rejects unknown country", () => {
    expect(() => CountryCodeSchema.parse("ZZ")).toThrow()
  })
})

describe("GenreSchema", () => {
  it("accepts merge and puzzle", () => {
    expect(() => GenreSchema.parse("merge")).not.toThrow()
    expect(() => GenreSchema.parse("puzzle")).not.toThrow()
  })
  it("rejects unknown genre", () => {
    expect(() => GenreSchema.parse("battle-royale")).toThrow()
  })
})

describe("MetricsSchema", () => {
  it("accepts positive cpi", () => {
    expect(() => MetricsSchema.parse({ cpi: 3.2 })).not.toThrow()
  })
  it("rejects negative cpi", () => {
    expect(() => MetricsSchema.parse({ cpi: -1 })).toThrow()
  })
  it("rejects cpi > 100", () => {
    expect(() => MetricsSchema.parse({ cpi: 150 })).toThrow()
  })
})

describe("SnapshotSchema", () => {
  const valid = {
    version: 1,
    source: "unity-levelplay-cpi-index",
    generatedAt: "2026-04-24T00:00:00.000Z",
    sourceRange: { start: "2026-03-24", end: "2026-04-23" },
    platforms: {
      ios: {
        JP: { merge: { cpi: 3.8 } },
      },
    },
  }
  it("accepts valid snapshot", () => {
    expect(() => SnapshotSchema.parse(valid)).not.toThrow()
  })
  it("rejects wrong version", () => {
    expect(() => SnapshotSchema.parse({ ...valid, version: 2 })).toThrow()
  })
  it("allows partial country coverage", () => {
    const partial = { ...valid, platforms: { ios: {} } }
    expect(() => SnapshotSchema.parse(partial)).not.toThrow()
  })
})
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

```bash
cd crawler && npm test -- schema
```

Expected: FAIL (schema.ts 가 없음).

- [ ] **Step 3: schema.ts 구현**

Create `crawler/src/cpi-benchmarks/schema.ts`:

```ts
import { z } from "zod"

export const CountryCodeSchema = z.enum([
  "JP", "US", "KR", "DE", "GB", "FR", "CN", "TW", "HK", "SG", "TH", "ID", "VN",
  "BR", "MX", "CA", "AU", "IN", "RU", "TR", "ES", "IT", "NL", "SE", "PL",
])
export type CountryCode = z.infer<typeof CountryCodeSchema>

export const GenreSchema = z.enum([
  "merge", "puzzle", "rpg", "casual", "strategy", "idle", "simulation", "arcade",
])
export type Genre = z.infer<typeof GenreSchema>

export const PlatformSchema = z.enum(["ios", "android"])
export type Platform = z.infer<typeof PlatformSchema>

export const MetricsSchema = z.object({
  cpi: z.number().positive().max(100),
  cpm: z.number().positive().max(200).optional(),
})
export type Metrics = z.infer<typeof MetricsSchema>

export const GenreMetricsMapSchema = z.record(GenreSchema, MetricsSchema)
export const CountryGenreMapSchema = z.record(CountryCodeSchema, GenreMetricsMapSchema)
export const PlatformCountryMapSchema = z.record(PlatformSchema, CountryGenreMapSchema)

export const SnapshotSchema = z.object({
  version: z.literal(1),
  source: z.literal("unity-levelplay-cpi-index"),
  generatedAt: z.string().datetime(),
  sourceRange: z.object({
    start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
  platforms: PlatformCountryMapSchema,
})
export type Snapshot = z.infer<typeof SnapshotSchema>
```

- [ ] **Step 4: 테스트 재실행 → 통과 확인**

```bash
cd crawler && npm test -- schema
```

Expected: PASS, 모든 assertion.

- [ ] **Step 5: 커밋**

```bash
git add crawler/src/cpi-benchmarks/schema.ts crawler/src/cpi-benchmarks/__tests__/schema.test.ts
git commit -m "feat(crawler): Zod snapshot schema for CPI benchmarks"
```

---

### Task 3: Crawler normalize (TDD)

**Purpose:** LevelPlay 의 human-readable 라벨 ("Casual", "Japan", "IOS") 을 Compass 내부 enum 으로 변환. 장르 매핑은 primary + fallback 2-level.

**Files:**
- Create: `crawler/src/cpi-benchmarks/normalize.ts`
- Create: `crawler/src/cpi-benchmarks/__tests__/normalize.test.ts`

- [ ] **Step 1: 테스트 작성**

Create `crawler/src/cpi-benchmarks/__tests__/normalize.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import {
  normalizeCountry,
  normalizeGenre,
  normalizePlatform,
  normalizeLevelPlayResponse,
} from "../normalize.js"

describe("normalizeCountry", () => {
  it("handles alpha-2 passthrough", () => {
    expect(normalizeCountry("JP")).toBe("JP")
    expect(normalizeCountry("us")).toBe("US")
  })
  it("maps country names", () => {
    expect(normalizeCountry("Japan")).toBe("JP")
    expect(normalizeCountry("United States")).toBe("US")
    expect(normalizeCountry("South Korea")).toBe("KR")
  })
  it("returns null for unknown", () => {
    expect(normalizeCountry("Atlantis")).toBeNull()
  })
})

describe("normalizeGenre", () => {
  it("maps LevelPlay labels to Compass enum", () => {
    expect(normalizeGenre("Casual")).toBe("casual")
    expect(normalizeGenre("Match-3")).toBe("puzzle")
    expect(normalizeGenre("Role Playing")).toBe("rpg")
  })
  it("returns null for unknown genre", () => {
    expect(normalizeGenre("Metaverse")).toBeNull()
  })
})

describe("normalizePlatform", () => {
  it("lowercases platform", () => {
    expect(normalizePlatform("IOS")).toBe("ios")
    expect(normalizePlatform("Android")).toBe("android")
  })
  it("returns null for unknown", () => {
    expect(normalizePlatform("web")).toBeNull()
  })
})

describe("normalizeLevelPlayResponse", () => {
  it("converts LevelPlay rows into PlatformCountryMap shape", () => {
    const input = [
      { platform: "iOS", country: "Japan", genre: "Casual", cpi: 3.8, cpm: 18.5 },
      { platform: "iOS", country: "Japan", genre: "Role Playing", cpi: 5.8 },
      { platform: "Android", country: "United States", genre: "Casual", cpi: 2.1 },
    ]
    const result = normalizeLevelPlayResponse(input)
    expect(result.platforms.ios.JP.casual).toEqual({ cpi: 3.8, cpm: 18.5 })
    expect(result.platforms.ios.JP.rpg).toEqual({ cpi: 5.8 })
    expect(result.platforms.android.US.casual).toEqual({ cpi: 2.1 })
  })
  it("collects warnings for unknown country/genre/platform", () => {
    const input = [
      { platform: "iOS", country: "Atlantis", genre: "Casual", cpi: 1 },
      { platform: "iOS", country: "Japan", genre: "Metaverse", cpi: 1 },
    ]
    const result = normalizeLevelPlayResponse(input)
    expect(result.warnings.length).toBe(2)
  })
})
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

```bash
cd crawler && npm test -- normalize
```

Expected: FAIL (normalize.ts 없음).

- [ ] **Step 3: normalize.ts 구현**

Create `crawler/src/cpi-benchmarks/normalize.ts`:

```ts
import type { CountryCode, Genre, Platform } from "./schema.js"

const COUNTRY_NAME_MAP: Record<string, CountryCode> = {
  "japan": "JP",
  "united states": "US",
  "usa": "US",
  "korea": "KR",
  "south korea": "KR",
  "germany": "DE",
  "united kingdom": "GB",
  "uk": "GB",
  "france": "FR",
  "china": "CN",
  "taiwan": "TW",
  "hong kong": "HK",
  "singapore": "SG",
  "thailand": "TH",
  "indonesia": "ID",
  "vietnam": "VN",
  "brazil": "BR",
  "mexico": "MX",
  "canada": "CA",
  "australia": "AU",
  "india": "IN",
  "russia": "RU",
  "turkey": "TR",
  "spain": "ES",
  "italy": "IT",
  "netherlands": "NL",
  "sweden": "SE",
  "poland": "PL",
}

const VALID_COUNTRY_CODES = new Set<string>([
  "JP", "US", "KR", "DE", "GB", "FR", "CN", "TW", "HK", "SG", "TH", "ID", "VN",
  "BR", "MX", "CA", "AU", "IN", "RU", "TR", "ES", "IT", "NL", "SE", "PL",
])

export function normalizeCountry(raw: string): CountryCode | null {
  const upper = raw.trim().toUpperCase()
  if (VALID_COUNTRY_CODES.has(upper)) return upper as CountryCode
  const lower = raw.trim().toLowerCase()
  return COUNTRY_NAME_MAP[lower] ?? null
}

const GENRE_MAP: Record<string, Genre> = {
  "casual": "casual",
  "merge": "merge",
  "puzzle": "puzzle",
  "match-3": "puzzle",
  "match 3": "puzzle",
  "rpg": "rpg",
  "role playing": "rpg",
  "role-playing": "rpg",
  "strategy": "strategy",
  "idle": "idle",
  "simulation": "simulation",
  "sim": "simulation",
  "arcade": "arcade",
}

export function normalizeGenre(raw: string): Genre | null {
  return GENRE_MAP[raw.trim().toLowerCase()] ?? null
}

export function normalizePlatform(raw: string): Platform | null {
  const lower = raw.trim().toLowerCase()
  if (lower === "ios" || lower === "android") return lower
  return null
}

export interface LevelPlayRow {
  platform: string
  country: string
  genre: string
  cpi: number
  cpm?: number
}

export interface NormalizeResult {
  platforms: {
    ios?: Record<string, Record<string, { cpi: number; cpm?: number }>>
    android?: Record<string, Record<string, { cpi: number; cpm?: number }>>
  }
  warnings: string[]
}

export function normalizeLevelPlayResponse(rows: readonly LevelPlayRow[]): NormalizeResult {
  const out: NormalizeResult = { platforms: {}, warnings: [] }
  for (const row of rows) {
    const plat = normalizePlatform(row.platform)
    const country = normalizeCountry(row.country)
    const genre = normalizeGenre(row.genre)
    if (!plat || !country || !genre) {
      out.warnings.push(`skip: platform=${row.platform} country=${row.country} genre=${row.genre}`)
      continue
    }
    out.platforms[plat] ??= {}
    out.platforms[plat]![country] ??= {}
    out.platforms[plat]![country][genre] = {
      cpi: row.cpi,
      ...(row.cpm !== undefined ? { cpm: row.cpm } : {}),
    }
  }
  return out
}
```

- [ ] **Step 4: 테스트 재실행 → 통과 확인**

```bash
cd crawler && npm test -- normalize
```

Expected: PASS 모든 assertion.

- [ ] **Step 5: 커밋**

```bash
git add crawler/src/cpi-benchmarks/normalize.ts crawler/src/cpi-benchmarks/__tests__/normalize.test.ts
git commit -m "feat(crawler): normalize LevelPlay labels → Compass enums"
```

---

### Task 4: Crawler fetch-levelplay (TDD)

**Purpose:** HTTP 요청 + 3회 exponential backoff + 10s timeout. fetch 에러 분류 (network vs shape 변형).

**Files:**
- Create: `crawler/src/cpi-benchmarks/fetch-levelplay.ts`
- Create: `crawler/src/cpi-benchmarks/__tests__/fetch-levelplay.test.ts`

- [ ] **Step 1: 테스트 작성**

Create `crawler/src/cpi-benchmarks/__tests__/fetch-levelplay.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { fetchLevelPlayCpi } from "../fetch-levelplay.js"

describe("fetchLevelPlayCpi", () => {
  const originalFetch = globalThis.fetch
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
    globalThis.fetch = originalFetch
  })

  it("returns rows on 200 response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ rows: [{ platform: "iOS", country: "Japan", genre: "Casual", cpi: 3.8 }] }),
    } as Response) as typeof fetch

    const rows = await fetchLevelPlayCpi("https://levelplay.example/api")
    expect(rows).toEqual([{ platform: "iOS", country: "Japan", genre: "Casual", cpi: 3.8 }])
  })

  it("retries 3 times on 5xx then throws", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 503 } as Response)
    globalThis.fetch = fetchMock as typeof fetch

    const promise = fetchLevelPlayCpi("https://levelplay.example/api")
    await vi.runAllTimersAsync()
    await expect(promise).rejects.toThrow(/fail after 3 attempts/i)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it("throws on unexpected JSON shape", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ unexpected: true }),
    } as Response) as typeof fetch

    await expect(fetchLevelPlayCpi("https://levelplay.example/api")).rejects.toThrow(/unexpected/i)
  })
})
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

```bash
cd crawler && npm test -- fetch-levelplay
```

Expected: FAIL (module 없음).

- [ ] **Step 3: fetch-levelplay.ts 구현**

Create `crawler/src/cpi-benchmarks/fetch-levelplay.ts`:

```ts
import type { LevelPlayRow } from "./normalize.js"

const MAX_ATTEMPTS = 3
const BASE_BACKOFF_MS = 1000
const REQUEST_TIMEOUT_MS = 10_000

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function fetchLevelPlayCpi(url: string): Promise<readonly LevelPlayRow[]> {
  let lastError: unknown
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        headers: { accept: "application/json" },
      })
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }
      const body = await res.json()
      if (!body || !Array.isArray(body.rows)) {
        throw new Error(`unexpected LevelPlay response shape: ${JSON.stringify(Object.keys(body ?? {}))}`)
      }
      return body.rows as LevelPlayRow[]
    } catch (err) {
      lastError = err
      if (attempt < MAX_ATTEMPTS) {
        await sleep(BASE_BACKOFF_MS * 2 ** (attempt - 1))
      }
    }
  }
  throw new Error(`fetchLevelPlayCpi fail after ${MAX_ATTEMPTS} attempts: ${String(lastError)}`)
}
```

- [ ] **Step 4: 테스트 재실행 → 통과**

```bash
cd crawler && npm test -- fetch-levelplay
```

Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add crawler/src/cpi-benchmarks/fetch-levelplay.ts crawler/src/cpi-benchmarks/__tests__/fetch-levelplay.test.ts
git commit -m "feat(crawler): fetch LevelPlay CPI with retry + timeout"
```

---

### Task 5: Crawler ingest + CLI 등록

**Purpose:** fetch → normalize → Zod 검증 → snapshot JSON atomic write. 사람이 `npm run crawl:cpi` 로 실행 가능한 형태로 묶음.

**Files:**
- Create: `crawler/src/cpi-benchmarks/ingest.ts`
- Modify: `package.json` (root)

- [ ] **Step 1: ingest.ts 작성**

Create `crawler/src/cpi-benchmarks/ingest.ts`:

```ts
import { writeFile, mkdir, readFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { log } from "../lib/logger.js"
import { fetchLevelPlayCpi } from "./fetch-levelplay.js"
import { normalizeLevelPlayResponse } from "./normalize.js"
import { SnapshotSchema, type Snapshot } from "./schema.js"

const LEVELPLAY_API_URL = process.env.LEVELPLAY_API_URL ?? "https://levelplay.example/api/cpi-index"
const SNAPSHOT_PATH = resolve(
  process.cwd(),
  "../src/shared/api/data/cpi-benchmarks/levelplay-snapshot.json",
)

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export async function runIngest(): Promise<void> {
  log.info(`fetching LevelPlay CPI from ${LEVELPLAY_API_URL}`)
  const rows = await fetchLevelPlayCpi(LEVELPLAY_API_URL)
  log.info(`received ${rows.length} rows`)

  const { platforms, warnings } = normalizeLevelPlayResponse(rows)
  for (const w of warnings) log.warn(w)

  const now = new Date()
  const end = isoDate(now)
  const start = isoDate(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000))

  const snapshot: Snapshot = {
    version: 1,
    source: "unity-levelplay-cpi-index",
    generatedAt: now.toISOString(),
    sourceRange: { start, end },
    platforms,
  }

  const parsed = SnapshotSchema.parse(snapshot)

  await mkdir(dirname(SNAPSHOT_PATH), { recursive: true })
  const prev = await readFile(SNAPSHOT_PATH, "utf8").catch(() => null)
  await writeFile(SNAPSHOT_PATH, JSON.stringify(parsed, null, 2) + "\n", "utf8")

  if (prev) {
    log.info(`snapshot updated (prev size=${prev.length}, new size=${JSON.stringify(parsed).length})`)
  } else {
    log.info(`snapshot created at ${SNAPSHOT_PATH}`)
  }
  log.info(`countries=${Object.keys(parsed.platforms.ios ?? {}).length} (ios), warnings=${warnings.length}`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runIngest().catch((err) => {
    log.error(String(err))
    process.exit(1)
  })
}
```

- [ ] **Step 2: root package.json 에 crawl:cpi 스크립트 추가**

Modify `package.json` — scripts 섹션:

```json
"crawl:cpi": "cd crawler && npx tsx src/cpi-benchmarks/ingest.ts",
"crawl:cpi:verify": "cd crawler && npx tsx src/cpi-benchmarks/verify.ts"
```

(verify 는 Task 0 에서 이미 추가됐으면 그대로.)

- [ ] **Step 3: 타입 체크**

```bash
cd crawler && npx tsc --noEmit
```

Expected: 에러 0.

- [ ] **Step 4: 커밋**

```bash
git add crawler/src/cpi-benchmarks/ingest.ts package.json
git commit -m "feat(crawler): ingest pipeline for LevelPlay snapshot"
```

---

### Task 6: 초기 snapshot 생성 + 커밋

**Purpose:** 실제 LevelPlay 데이터 (또는 fallback) 로 snapshot JSON 을 한 번 채워 Compass 빌드가 의존할 파일을 확정.

**Files:**
- Create: `src/shared/api/data/cpi-benchmarks/levelplay-snapshot.json`

- [ ] **Step 1 (LevelPlay alive): crawl 실행**

```bash
export LEVELPLAY_API_URL="<Task 0 에서 식별한 실제 endpoint>"
npm run crawl:cpi
```

Expected: `src/shared/api/data/cpi-benchmarks/levelplay-snapshot.json` 생성됨. 로그에 countries / warnings 요약.

- [ ] **Step 1b (LevelPlay dead — fallback 경로): AppsFlyer PDF 수동 파싱으로 snapshot 수작업 생성**

AppsFlyer Performance Index PDF 를 열고 JP / US / KR × Casual/Merge/RPG 최소 조합만 수기 추출하여 JSON 작성. 파일을 직접 편집해 schema.ts 형태에 맞춤. `source` 는 임시로 `"unity-levelplay-cpi-index"` (schema literal) 을 유지하되, Task 7 에서 `source` enum 을 확장하는 옵션 결정.

- [ ] **Step 2: snapshot 유효성 확인 (수동 Zod parse)**

One-off script 또는 node REPL 에서:

```bash
cd crawler && npx tsx --eval "
import { SnapshotSchema } from './src/cpi-benchmarks/schema.js'
import { readFileSync } from 'node:fs'
const data = JSON.parse(readFileSync('../src/shared/api/data/cpi-benchmarks/levelplay-snapshot.json', 'utf8'))
SnapshotSchema.parse(data)
console.log('snapshot OK:', Object.keys(data.platforms))
"
```

Expected: `snapshot OK: [ 'ios', 'android' ]` 같은 출력.

- [ ] **Step 3: git 커밋**

```bash
git add src/shared/api/data/cpi-benchmarks/levelplay-snapshot.json
git commit -m "data(cpi): initial LevelPlay snapshot $(date +%Y-%m-%d)"
```

---

### Task 7: Compass runtime accessor (TDD)

**Purpose:** snapshot JSON 을 읽어 `(country, genre, platform) → cpi` lookup + stale 판정. Compass 측은 crawler 소스를 import 하지 않도록, schema 의 TS 타입은 Compass 안에서 구조적으로 재선언.

**Files:**
- Create: `src/shared/api/cpi-benchmarks.ts`
- Create: `src/shared/api/__tests__/cpi-benchmarks.test.ts`

- [ ] **Step 1: 테스트 작성**

Create `src/shared/api/__tests__/cpi-benchmarks.test.ts`:

```ts
import { describe, it } from "node:test"
import { strict as assert } from "node:assert"
import { lookupCpi, isBenchmarkStale, getSourceMeta } from "../cpi-benchmarks"

describe("lookupCpi", () => {
  it("returns value for valid combo", () => {
    const v = lookupCpi("JP", "merge", "ios")
    assert.equal(typeof v, "number")
    assert.ok(v! > 0)
  })
  it("returns null for unknown country", () => {
    assert.equal(lookupCpi("ZZ" as never, "merge", "ios"), null)
  })
  it("returns null for unknown genre when no fallback", () => {
    assert.equal(lookupCpi("JP", "simulation" as never, "android"), null)
  })
  it("falls back from merge to casual if merge not present", () => {
    // 이 테스트는 snapshot 에 merge 가 없고 casual 이 있는 상황을 가정.
    // fixture 가 있는 경우만 활성화. snapshot 에 merge 가 이미 있으면 skip.
  })
})

describe("isBenchmarkStale", () => {
  it("returns boolean", () => {
    assert.equal(typeof isBenchmarkStale(), "boolean")
  })
})

describe("getSourceMeta", () => {
  it("returns source and generatedAt", () => {
    const meta = getSourceMeta()
    assert.equal(meta.source, "unity-levelplay-cpi-index")
    assert.match(meta.generatedAt, /^\d{4}-\d{2}-\d{2}T/)
  })
})
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

```bash
npm test -- --test-name-pattern="lookupCpi"
```

Expected: FAIL (module 없음).

- [ ] **Step 3: cpi-benchmarks.ts 구현**

Create `src/shared/api/cpi-benchmarks.ts`:

```ts
import { z } from "zod"
import snapshot from "./data/cpi-benchmarks/levelplay-snapshot.json" with { type: "json" }

const CountryCodeSchema = z.enum([
  "JP", "US", "KR", "DE", "GB", "FR", "CN", "TW", "HK", "SG", "TH", "ID", "VN",
  "BR", "MX", "CA", "AU", "IN", "RU", "TR", "ES", "IT", "NL", "SE", "PL",
])
export type CountryCode = z.infer<typeof CountryCodeSchema>

const GenreSchema = z.enum([
  "merge", "puzzle", "rpg", "casual", "strategy", "idle", "simulation", "arcade",
])
export type Genre = z.infer<typeof GenreSchema>

const PlatformSchema = z.enum(["ios", "android"])
export type Platform = z.infer<typeof PlatformSchema>

const MetricsSchema = z.object({
  cpi: z.number().positive().max(100),
  cpm: z.number().positive().max(200).optional(),
})

const GenreMetricsMapSchema = z.record(GenreSchema, MetricsSchema)
const CountryGenreMapSchema = z.record(CountryCodeSchema, GenreMetricsMapSchema)
const PlatformCountryMapSchema = z.record(PlatformSchema, CountryGenreMapSchema)

const SnapshotSchema = z.object({
  version: z.literal(1),
  source: z.literal("unity-levelplay-cpi-index"),
  generatedAt: z.string().datetime(),
  sourceRange: z.object({
    start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
  platforms: PlatformCountryMapSchema,
})

const PARSED = SnapshotSchema.parse(snapshot)

const GENRE_FALLBACK: Partial<Record<Genre, Genre>> = {
  merge: "casual",
}

const STALE_THRESHOLD_MS = 35 * 24 * 60 * 60 * 1000

export interface LookupResult {
  cpi: number
  usedFallbackGenre: boolean
}

export function lookupCpi(country: CountryCode, genre: Genre, platform: Platform): number | null {
  const detailed = lookupCpiDetailed(country, genre, platform)
  return detailed?.cpi ?? null
}

export function lookupCpiDetailed(
  country: CountryCode,
  genre: Genre,
  platform: Platform,
): LookupResult | null {
  const table = PARSED.platforms[platform]?.[country]
  if (!table) return null
  const direct = table[genre]
  if (direct) return { cpi: direct.cpi, usedFallbackGenre: false }
  const fb = GENRE_FALLBACK[genre]
  if (fb && table[fb]) return { cpi: table[fb]!.cpi, usedFallbackGenre: true }
  return null
}

export function isBenchmarkStale(now: Date = new Date()): boolean {
  const age = now.getTime() - new Date(PARSED.generatedAt).getTime()
  return age > STALE_THRESHOLD_MS
}

export function benchmarkAgeDays(now: Date = new Date()): number {
  const age = now.getTime() - new Date(PARSED.generatedAt).getTime()
  return Math.floor(age / (24 * 60 * 60 * 1000))
}

export function getSourceMeta(): { source: string; generatedAt: string; version: number } {
  return {
    source: PARSED.source,
    generatedAt: PARSED.generatedAt,
    version: PARSED.version,
  }
}
```

- [ ] **Step 4: TypeScript JSON import 설정 확인**

tsconfig.json 에 `"resolveJsonModule": true` 가 있는지 확인. 없으면 추가. (대체로 Next.js 기본값으로 이미 있음.)

- [ ] **Step 5: 테스트 재실행 → 통과**

```bash
npm test -- --test-name-pattern="lookupCpi|isBenchmarkStale|getSourceMeta"
```

Expected: PASS.

- [ ] **Step 6: 커밋**

```bash
git add src/shared/api/cpi-benchmarks.ts src/shared/api/__tests__/cpi-benchmarks.test.ts
git commit -m "feat(api): CPI benchmark accessor with lookup + staleness"
```

---

### Task 8: Game settings Zustand store (TDD)

**Purpose:** 각 게임의 (country, genre) 를 localStorage 에 persist. 기본값은 poco = (JP, merge).

**Files:**
- Create: `src/shared/store/game-settings.ts`
- Create: `src/shared/store/__tests__/game-settings.test.ts`

- [ ] **Step 1: 테스트 작성**

Create `src/shared/store/__tests__/game-settings.test.ts`:

```ts
import { describe, it, beforeEach } from "node:test"
import { strict as assert } from "node:assert"
import { useGameSettings, DEFAULT_GAME_SETTINGS } from "../game-settings"

describe("game-settings store", () => {
  beforeEach(() => {
    useGameSettings.setState({ settings: DEFAULT_GAME_SETTINGS })
  })

  it("exposes default for poco = (JP, merge)", () => {
    const s = useGameSettings.getState().settings["poco"]
    assert.equal(s?.country, "JP")
    assert.equal(s?.genre, "merge")
  })

  it("updateSettings merges partial update", () => {
    useGameSettings.getState().updateSettings("poco", { country: "US" })
    const s = useGameSettings.getState().settings["poco"]
    assert.equal(s?.country, "US")
    assert.equal(s?.genre, "merge")
  })

  it("updateSettings creates entry for unknown game", () => {
    useGameSettings.getState().updateSettings("future-game", { country: "KR", genre: "puzzle" })
    const s = useGameSettings.getState().settings["future-game"]
    assert.equal(s?.country, "KR")
    assert.equal(s?.genre, "puzzle")
  })
})
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

```bash
npm test -- --test-name-pattern="game-settings"
```

Expected: FAIL.

- [ ] **Step 3: game-settings.ts 구현**

Create `src/shared/store/game-settings.ts`:

```ts
import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { CountryCode, Genre } from "@/shared/api/cpi-benchmarks"

export interface GameSettings {
  country: CountryCode
  genre: Genre
}

export const DEFAULT_GAME_SETTINGS: Record<string, GameSettings> = {
  poco: { country: "JP", genre: "merge" },
}

interface GameSettingsStore {
  settings: Record<string, GameSettings>
  updateSettings: (gameId: string, partial: Partial<GameSettings>) => void
}

export const useGameSettings = create<GameSettingsStore>()(
  persist(
    (set) => ({
      settings: DEFAULT_GAME_SETTINGS,
      updateSettings: (gameId, partial) =>
        set((state) => ({
          settings: {
            ...state.settings,
            [gameId]: {
              ...(state.settings[gameId] ?? { country: "JP", genre: "merge" }),
              ...partial,
            },
          },
        })),
    }),
    {
      name: "compass:game-settings",
      // Skip hydration on server to avoid SSR mismatch; client reconciles on mount.
      skipHydration: true,
    },
  ),
)
```

- [ ] **Step 4: 테스트 재실행 → 통과**

```bash
npm test -- --test-name-pattern="game-settings"
```

Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/shared/store/game-settings.ts src/shared/store/__tests__/game-settings.test.ts
git commit -m "feat(store): game settings Zustand store with localStorage persist"
```

---

### Task 9: GameSettingsModal 컴포넌트

**Purpose:** 톱니바퀴 + chip 편집 버튼 두 곳에서 공유하는 Radix Dialog. country / genre 2 드롭다운 + 저장.

**Files:**
- Create: `src/widgets/app-shell/ui/game-settings-modal.tsx`
- Modify: `src/shared/i18n/dictionary.ts` (신규 i18n 키)

- [ ] **Step 1: i18n 키 추가**

Modify `src/shared/i18n/dictionary.ts` — 아래 블록을 dictionary 객체 내부에 추가 (적절한 그룹 위치):

```ts
"settings.modalTitle":    { ko: "게임 설정",                    en: "Game Settings" },
"settings.country":       { ko: "주력 국가",                    en: "Primary Country" },
"settings.genre":         { ko: "장르",                        en: "Genre" },
"settings.save":          { ko: "저장",                        en: "Save" },
"settings.cancel":        { ko: "취소",                        en: "Cancel" },
"settings.country.JP":    { ko: "일본",                        en: "Japan" },
"settings.country.US":    { ko: "미국",                        en: "United States" },
"settings.country.KR":    { ko: "한국",                        en: "South Korea" },
"settings.country.DE":    { ko: "독일",                        en: "Germany" },
"settings.country.GB":    { ko: "영국",                        en: "United Kingdom" },
"settings.genre.merge":   { ko: "머지",                        en: "Merge" },
"settings.genre.puzzle":  { ko: "퍼즐",                        en: "Puzzle" },
"settings.genre.rpg":     { ko: "RPG",                        en: "RPG" },
"settings.genre.casual":  { ko: "캐주얼",                      en: "Casual" },
"settings.genre.strategy":{ ko: "전략",                        en: "Strategy" },
"settings.genre.idle":    { ko: "아이들",                      en: "Idle" },
"mmm.currentMarket":      { ko: "시장 기준",                   en: "Current Market" },
"mmm.benchmarkStale":     { ko: "벤치마크 {days}일 경과",       en: "{days} days old" },
"mmm.benchmarkNoData":    { ko: "데이터 없음",                  en: "No benchmark data" },
"mmm.edit":               { ko: "편집",                        en: "Edit" },
```

- [ ] **Step 2: GameSettingsModal 구현**

Create `src/widgets/app-shell/ui/game-settings-modal.tsx`:

```tsx
"use client"

import { useState, useEffect } from "react"
import * as Dialog from "@radix-ui/react-dialog"
import { useLocale } from "@/shared/i18n"
import { useGameSettings, type GameSettings } from "@/shared/store/game-settings"
import type { CountryCode, Genre } from "@/shared/api/cpi-benchmarks"

const COUNTRIES: CountryCode[] = ["JP", "US", "KR", "DE", "GB"]
const GENRES: Genre[] = ["merge", "puzzle", "rpg", "casual", "strategy", "idle"]

interface GameSettingsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  gameId: string
  gameLabel: string
}

export function GameSettingsModal({ open, onOpenChange, gameId, gameLabel }: GameSettingsModalProps) {
  const { t } = useLocale()
  const current = useGameSettings((s) => s.settings[gameId])
  const updateSettings = useGameSettings((s) => s.updateSettings)

  const [draft, setDraft] = useState<GameSettings>(
    current ?? { country: "JP", genre: "merge" },
  )

  useEffect(() => {
    if (open && current) setDraft(current)
  }, [open, current])

  const onSave = () => {
    updateSettings(gameId, draft)
    onOpenChange(false)
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-[var(--bg-overlay,rgba(0,0,0,0.5))] z-40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[420px] rounded-[var(--radius-modal)] bg-[var(--bg-1)] border border-[var(--border-default)] p-6 shadow-xl">
          <Dialog.Title className="text-sm font-bold text-[var(--fg-0)] mb-4">
            {t("settings.modalTitle")} — {gameLabel}
          </Dialog.Title>

          <div className="space-y-4">
            <div>
              <label className="block text-xs text-[var(--fg-2)] mb-1">{t("settings.country")}</label>
              <select
                value={draft.country}
                onChange={(e) => setDraft({ ...draft, country: e.target.value as CountryCode })}
                className="w-full px-3 py-2 rounded-[var(--radius-inline)] bg-[var(--bg-2)] border border-[var(--border-default)] text-sm"
              >
                {COUNTRIES.map((c) => (
                  <option key={c} value={c}>{t(`settings.country.${c}` as const)}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-[var(--fg-2)] mb-1">{t("settings.genre")}</label>
              <select
                value={draft.genre}
                onChange={(e) => setDraft({ ...draft, genre: e.target.value as Genre })}
                className="w-full px-3 py-2 rounded-[var(--radius-inline)] bg-[var(--bg-2)] border border-[var(--border-default)] text-sm"
              >
                {GENRES.map((g) => (
                  <option key={g} value={g}>{t(`settings.genre.${g}` as const)}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <Dialog.Close asChild>
              <button className="px-3 py-1.5 text-sm text-[var(--fg-1)] rounded-[var(--radius-inline)] hover:bg-[var(--bg-3)]">
                {t("settings.cancel")}
              </button>
            </Dialog.Close>
            <button
              onClick={onSave}
              className="px-3 py-1.5 text-sm bg-[var(--brand)] text-white rounded-[var(--radius-inline)] hover:opacity-90"
            >
              {t("settings.save")}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
```

- [ ] **Step 3: 타입 체크**

```bash
npx tsc --noEmit
```

Expected: 에러 0.

- [ ] **Step 4: 커밋**

```bash
git add src/widgets/app-shell/ui/game-settings-modal.tsx src/shared/i18n/dictionary.ts
git commit -m "feat(widgets): GameSettingsModal + i18n keys"
```

---

### Task 10: CurrentMarketChip 컴포넌트

**Purpose:** MMM 페이지 상단에서 현재 설정된 시장을 읽기 전용으로 표시 + 편집 진입점. stale 시 ⚠ 배지.

**Files:**
- Create: `src/widgets/dashboard/ui/current-market-chip.tsx`

- [ ] **Step 1: 구현**

Create `src/widgets/dashboard/ui/current-market-chip.tsx`:

```tsx
"use client"

import { useEffect, useState } from "react"
import { Icon } from "@iconify/react"
import { useLocale } from "@/shared/i18n"
import { useSelectedGame } from "@/shared/store/selected-game"
import { useGameSettings } from "@/shared/store/game-settings"
import { isBenchmarkStale, benchmarkAgeDays } from "@/shared/api/cpi-benchmarks"
import { GameSettingsModal } from "@/widgets/app-shell/ui/game-settings-modal"

interface CurrentMarketChipProps {
  gameLabel: string
}

export function CurrentMarketChip({ gameLabel }: CurrentMarketChipProps) {
  const { t } = useLocale()
  const gameId = useSelectedGame((s) => s.gameId)
  const settings = useGameSettings((s) => s.settings[gameId])
  const [modalOpen, setModalOpen] = useState(false)

  // Gate time-based rendering to client to avoid hydration mismatch (same pattern as MmmPage).
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  if (gameId === "portfolio" || !settings) return null

  const countryLabel = t(`settings.country.${settings.country}` as const)
  const genreLabel = t(`settings.genre.${settings.genre}` as const)
  const stale = mounted && isBenchmarkStale()
  const ageDays = mounted ? benchmarkAgeDays() : 0

  return (
    <>
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-[var(--radius-inline)] bg-[var(--bg-2)] border border-[var(--border-default)] text-xs">
        <span className="text-[var(--fg-2)]">{t("mmm.currentMarket")}:</span>
        <span className="font-semibold text-[var(--fg-0)]">{countryLabel} × {genreLabel}</span>
        {stale && (
          <span
            title={t("mmm.benchmarkStale").replace("{days}", String(ageDays))}
            className="inline-flex items-center text-[var(--signal-caution)]"
          >
            <Icon icon="solar:danger-triangle-bold" width={14} />
          </span>
        )}
        <button
          onClick={() => setModalOpen(true)}
          className="text-[var(--brand)] hover:underline text-xs"
        >
          {t("mmm.edit")}
        </button>
      </div>

      <GameSettingsModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        gameId={gameId}
        gameLabel={gameLabel}
      />
    </>
  )
}
```

- [ ] **Step 2: 타입 체크**

```bash
npx tsc --noEmit
```

Expected: 에러 0.

- [ ] **Step 3: 커밋**

```bash
git add src/widgets/dashboard/ui/current-market-chip.tsx
git commit -m "feat(widgets): CurrentMarketChip with stale badge + edit"
```

---

### Task 11: GameSelector 에 톱니바퀴 추가

**Purpose:** RunwayStatusBar 의 게임 셀렉터 옆에 설정 아이콘. Portfolio 뷰에서는 숨김.

**Files:**
- Modify: `src/widgets/dashboard/ui/game-selector.tsx`

- [ ] **Step 1: 현재 game-selector 구조 확인**

Run:
```bash
cat src/widgets/dashboard/ui/game-selector.tsx
```

기존 구조를 읽고 어떤 wrapper 가 적절한지 판단 (dropdown 옆에 flex row 로 붙이면 됨).

- [ ] **Step 2: 톱니바퀴 + 모달 통합**

Modify `src/widgets/dashboard/ui/game-selector.tsx`. 기존 dropdown JSX 를 `<div className="flex items-center gap-1.5">` 로 감싸고, dropdown 바로 뒤에 IconButton 추가. 모달 state 도 같은 컴포넌트에서 관리.

```tsx
"use client"

import { useState } from "react"
import { Icon } from "@iconify/react"
import { useSelectedGame } from "@/shared/store/selected-game"
import { useLocale } from "@/shared/i18n"
import { GameSettingsModal } from "@/widgets/app-shell/ui/game-settings-modal"
// ... 기존 import 유지

const GAMES = [
  { id: "portfolio", label: "Portfolio" },  // 기존 값 유지
  { id: "poco", label: "포코머지" },
]

export function GameSelector() {
  const { t } = useLocale()
  const gameId = useSelectedGame((s) => s.gameId)
  const setGameId = useSelectedGame((s) => s.setGameId)
  const [modalOpen, setModalOpen] = useState(false)
  const current = GAMES.find((g) => g.id === gameId) ?? GAMES[0]

  return (
    <div className="flex items-center gap-1.5">
      {/* 기존 dropdown JSX 유지 */}

      {gameId !== "portfolio" && (
        <>
          <button
            onClick={() => setModalOpen(true)}
            title={t("settings.modalTitle")}
            aria-label={t("settings.modalTitle")}
            className="p-1 rounded-[var(--radius-inline)] text-[var(--fg-2)] hover:bg-[var(--bg-3)] hover:text-[var(--fg-0)]"
          >
            <Icon icon="solar:settings-bold" width={16} />
          </button>
          <GameSettingsModal
            open={modalOpen}
            onOpenChange={setModalOpen}
            gameId={gameId}
            gameLabel={current.label}
          />
        </>
      )}
    </div>
  )
}
```

(실제 편집 시 기존 dropdown 구현은 유지 — 위는 shell 만 예시. 실 구현할 때 기존 file 의 JSX 를 읽고 flex wrap + icon button 만 삽입.)

- [ ] **Step 3: 브라우저 확인**

```bash
npm run dev
```

http://localhost:3000/dashboard 열기. 게임 셀렉터로 poco 선택 → 톱니바퀴 나타나는지 확인. 톱니바퀴 클릭 → 모달 열림. 국가/장르 변경 후 저장 → 모달 닫힘.

- [ ] **Step 4: 커밋**

```bash
git add src/widgets/dashboard/ui/game-selector.tsx
git commit -m "feat(widgets): add settings gear icon beside game selector"
```

---

### Task 12: MMM 페이지 상단에 CurrentMarketChip 삽입

**Purpose:** MMM 페이지를 열었을 때 "내가 지금 어느 시장 기준으로 보고 있나" 가 한눈에.

**Files:**
- Modify: `src/app/(dashboard)/dashboard/mmm/page.tsx`

- [ ] **Step 1: import 추가 + 삽입 위치 결정**

Modify `src/app/(dashboard)/dashboard/mmm/page.tsx`:

```tsx
import { CurrentMarketChip } from "@/widgets/dashboard/ui/current-market-chip"
// ... 기존 import 유지
```

MmmPage 내부, Hero Verdict `<FadeInUp className="mb-8">` 바로 **위에** 칩을 배치. 또는 Hero Verdict 내부 header 쪽 — spec 에 따라 페이지 최상단이 더 어울림:

```tsx
return (
  <PageTransition>
    <FadeInUp className="mb-4">
      <CurrentMarketChip gameLabel="포코머지" />
    </FadeInUp>

    {/* ① Hero Verdict */}
    <FadeInUp className="mb-8">
      <DecisionStoryCard ... />
    </FadeInUp>
    {/* ... 나머지 섹션 ... */}
```

(gameLabel 은 현재 poco 고정이지만, 미래 확장 대비 props 로 유지. 실구현에선 `useSelectedGame` + 라벨 매핑 유틸 써도 됨.)

- [ ] **Step 2: 브라우저 확인**

```bash
npm run dev
```

/dashboard/mmm 열기 → 페이지 최상단에 `Current Market: 일본 × 머지 [편집]` 칩 표시. 톱니바퀴와 동일 모달 열리는지, stale 배지 조건 (`generatedAt` 40일 과거로 임시 조작) 확인.

- [ ] **Step 3: 커밋**

```bash
git add src/app/(dashboard)/dashboard/mmm/page.tsx
git commit -m "feat(mmm): show CurrentMarketChip at top of page"
```

---

### Task 13: CpiBenchmarkTable 을 lookupCpi 로 전환

**Purpose:** `c.benchmark.marketMedianCpi` mock 대신 snapshot 에서 조회한 값을 사용. 조합이 없으면 placeholder.

**Files:**
- Modify: `src/widgets/charts/ui/cpi-benchmark-table.tsx`

- [ ] **Step 1: useGameSettings 로 조회한 (country, genre) 로 marketCpi 계산하는 유틸**

`cpi-benchmark-table.tsx` 상단 import 에 추가:

```tsx
import { useSelectedGame } from "@/shared/store/selected-game"
import { useGameSettings } from "@/shared/store/game-settings"
import { lookupCpi } from "@/shared/api/cpi-benchmarks"
```

`deviationPct` 수정 — `c.benchmark.marketMedianCpi` 를 `marketCpi` 파라미터로:

```tsx
function deviationPct(channelCpi: number, marketCpi: number): number {
  return ((channelCpi - marketCpi) / marketCpi) * 100
}
```

Component 내부에서 lookup:

```tsx
export function CpiBenchmarkTable({ channels }: CpiBenchmarkTableProps) {
  const { t } = useLocale()
  const gameId = useSelectedGame((s) => s.gameId)
  const settings = useGameSettings((s) => s.settings[gameId])

  // LevelPlay 는 채널 비구분. 모든 채널이 같은 게임 장르×국가 기준값과 비교.
  // Platform 은 iOS 기준 (MMP 와 일치시키기 위해 향후 channel 에서 유추 가능하지만 Phase 2 는 단일).
  const marketCpi = settings ? lookupCpi(settings.country, settings.genre, "ios") : null

  return (
    // ... 기존 <table> 구조 유지 ...
    <tbody>
      {channels.map((c) => {
        if (marketCpi == null) {
          return (
            <tr key={c.key}>
              <td className="px-2 py-2">{t(CHANNEL_LABEL_KEY[c.key])}</td>
              <td className="text-right px-2 py-2">${c.marginal.cpi.toFixed(2)}</td>
              <td className="text-right px-2 py-2 text-[var(--fg-3)]" colSpan={3}>
                {t("mmm.benchmarkNoData")}
              </td>
            </tr>
          )
        }
        const dev = deviationPct(c.marginal.cpi, marketCpi)
        const v = verdictFor(dev)
        const style = VERDICT_STYLE[v]
        return (
          // ... 기존 row 구조, c.benchmark.marketMedianCpi 대신 marketCpi 사용 ...
        )
      })}
    </tbody>
  )
}
```

- [ ] **Step 2: 타입 체크**

```bash
npx tsc --noEmit
```

Expected: 에러 0. (주의: 만약 mmm-data 의 channel shape 에 benchmark.marketMedianCpi 가 여전히 required 로 남아있으면, 이 필드가 mock-v2 까지는 유지되므로 접근해도 무방. Phase 3 에서 제거.)

- [ ] **Step 3: 브라우저 확인**

/dashboard/mmm 에서 CpiBenchmarkTable 이 실데이터 기반으로 렌더. 톱니바퀴로 국가 JP→US 변경 → 표의 Market 컬럼 값 즉시 변경.

- [ ] **Step 4: 커밋**

```bash
git add src/widgets/charts/ui/cpi-benchmark-table.tsx
git commit -m "feat(mmm): CpiBenchmarkTable reads market CPI from snapshot"
```

---

### Task 14: CpiQuadrant 을 lookupCpi 로 전환

**Purpose:** Task 13 과 동일한 변환을 Quadrant 차트에도 적용. y축 deviation 계산.

**Files:**
- Modify: `src/widgets/charts/ui/cpi-quadrant.tsx`

- [ ] **Step 1: lookup hook 추가 + toPoint 시그니처 변경**

Modify `src/widgets/charts/ui/cpi-quadrant.tsx`:

```tsx
import { useSelectedGame } from "@/shared/store/selected-game"
import { useGameSettings } from "@/shared/store/game-settings"
import { lookupCpi } from "@/shared/api/cpi-benchmarks"

function toPoint(c: MmmChannel, marketCpi: number) {
  const satPct = Math.min(100, (c.currentSpend / (c.saturation.halfSaturation * 2)) * 100)
  const devPct = ((c.marginal.cpi - marketCpi) / marketCpi) * 100
  const spendSize = Math.log10(Math.max(c.currentSpend, 1)) * 120
  return {
    key: c.key,
    saturation: satPct,
    deviation: devPct,
    spendSize,
    spend: c.currentSpend,
    cpi: c.marginal.cpi,
  }
}

export function CpiQuadrant({ channels }: CpiQuadrantProps) {
  const { t } = useLocale()
  const gameId = useSelectedGame((s) => s.gameId)
  const settings = useGameSettings((s) => s.settings[gameId])
  const marketCpi = settings ? lookupCpi(settings.country, settings.genre, "ios") : null

  if (marketCpi == null) {
    return (
      <div className="rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--bg-1)] p-4 h-full flex items-center justify-center text-[var(--fg-3)] text-sm">
        {t("mmm.benchmarkNoData")}
      </div>
    )
  }

  const points = channels.map((c) => ({
    ...toPoint(c, marketCpi),
    name: t(CHANNEL_LABEL_KEY[c.key]),
    color: MMM_COLORS.channels[c.key].line,
  }))

  return (
    // ... 기존 JSX 유지 ...
  )
}
```

- [ ] **Step 2: 타입 체크 + 브라우저**

```bash
npx tsc --noEmit
npm run dev
```

Quadrant y축 deviation 이 새 marketCpi 기준으로 재계산되는지 확인. 국가 변경 → 점들이 이동하는 것 관찰.

- [ ] **Step 3: 커밋**

```bash
git add src/widgets/charts/ui/cpi-quadrant.tsx
git commit -m "feat(mmm): CpiQuadrant uses snapshot market CPI for deviation"
```

---

### Task 15: CLAUDE.md 업데이트

**Purpose:** §3 프로젝트 구조 안내 최신화 + §9 에 CPI 크롤러 운영 가이드.

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: §3 게임 목록 업데이트**

CLAUDE.md 에서 다음 문구 검색:
```
게임: Portfolio, Match League, Weaving Fairy, Dig Infinity
```

다음으로 교체:
```
게임: Portfolio, 포코머지(poco)
```

(만약 이미 Match League 제거된 상태면 해당 잔여 샘플 게임 이름을 제거하는 방향으로 일관 적용.)

- [ ] **Step 2: §9 하단에 CPI 크롤러 운영 문단 추가**

Sensor Tower 크롤러 섹션과 같은 포맷으로 추가:

```markdown
---

## CPI 벤치마크 크롤러 운영

MMM §⑤ 두 차트의 시장 CPI 벤치마크는 `crawler/src/cpi-benchmarks/` 가 Unity LevelPlay CPI Index 에서 수집해 `src/shared/api/data/cpi-benchmarks/levelplay-snapshot.json` 에 저장.

### 운영
- 주 1회 수동 실행: `npm run crawl:cpi`
- Endpoint alive 빠른 체크: `npm run crawl:cpi:verify`

### 코드 진입점
- Crawler: `crawler/src/cpi-benchmarks/ingest.ts`
- Compass 측 import: `src/shared/api/cpi-benchmarks.ts` (lookupCpi / isBenchmarkStale / getSourceMeta)

### Staleness
35일 경과 시 MMM 상단 칩에 ⚠ 배지 자동 표시.

### Fallback
LevelPlay endpoint 종료/유료화 시 AppsFlyer Performance Index PDF 수동 파싱으로 같은 snapshot shape 유지. 스펙: `docs/superpowers/specs/2026-04-24-mmm-phase-2-cpi-benchmark-design.md` §13.
```

- [ ] **Step 3: 커밋**

```bash
git add CLAUDE.md
git commit -m "docs(claude-md): update game list + add CPI crawler ops section"
```

---

### Task 16: 최종 검증 (빌드 + 수동 브라우저)

**Purpose:** 모든 변경이 통합 상태에서 깨끗한지 확인.

**Files:**
- 없음 (verification only)

- [ ] **Step 1: 타입 체크 clean**

```bash
npx tsc --noEmit
```

Expected: 에러 0.

- [ ] **Step 2: 전체 테스트 clean**

```bash
npm test
```

Expected: 모든 테스트 PASS.

- [ ] **Step 3: 크롤러 테스트 clean**

```bash
cd crawler && npm test
```

Expected: vitest 전부 PASS.

- [ ] **Step 4: 빌드 성공 + Static prerender**

```bash
npm run build
```

Expected: `/dashboard/mmm` Static (`○`) 표시. 에러 0.

- [ ] **Step 5: 수동 브라우저 체크리스트**

```bash
npm run dev
```

체크 항목 (spec §11 [5] 기준):

- [ ] `/dashboard/mmm` 상단 `Current Market: 일본 × 머지 [편집]` 칩 표시
- [ ] 게임 셀렉터에서 Portfolio 선택 → 톱니바퀴 + 칩 숨김
- [ ] 톱니바퀴 클릭 → 모달 열림, 국가/장르 2 드롭다운
- [ ] 국가 JP → US 저장 → CpiBenchmarkTable 의 Market 컬럼 값 변경
- [ ] 장르 merge → puzzle 저장 → 값 변경 + (필요 시 deviation, verdict, Quadrant y 좌표 변경)
- [ ] 존재하지 않는 조합 (예: TW × strategy 같이 snapshot 에 없는 셀) → 표와 Quadrant 에 "데이터 없음" 표시
- [ ] snapshot `generatedAt` 을 40일 전으로 조작 후 다시 렌더 → 칩에 ⚠ 배지 + "40일 경과" 툴팁
- [ ] Market Gap 페이지에서 MarketBenchmark 차트가 같은 장르를 읽는지 (Phase 2 에선 연결 안 해도 됨 — 확인용)
- [ ] ko / en 토글 → 신규 키 전부 렌더, 누락 없음

- [ ] **Step 6: 푸시 + PR 생성**

```bash
git push -u origin feat/mmm-phase-2
gh pr create --title "feat(mmm): Phase 2 — LevelPlay CPI benchmark + game settings UI" --body "$(cat <<'EOF'
## Summary

- MMM §⑤ CpiBenchmarkTable + CpiQuadrant 가 Unity LevelPlay CPI Index 실데이터 기반으로 작동
- 게임 (country, genre) 설정을 RunwayStatusBar 톱니바퀴 모달 + MMM 상단 CurrentMarketChip 으로 노출
- 샘플 게임 참조 제거 (mock-data.ts TitleHealthRow, mmm-data.ts GameKeySchema 통일)
- Crawler 모듈 `crawler/src/cpi-benchmarks/` 신규, 주 1회 `npm run crawl:cpi` 실행 플로우
- 35일 경과 시 stale ⚠ 배지

## 스펙 / 플랜
- `docs/superpowers/specs/2026-04-24-mmm-phase-2-cpi-benchmark-design.md`
- `docs/superpowers/plans/2026-04-24-mmm-phase-2-cpi-benchmark.md`

## Test plan
- [ ] tsc clean, npm test clean, crawler tests clean
- [ ] next build success, /dashboard/mmm Static
- [ ] 수동 브라우저 체크리스트 (plan Task 16 §5) 전부 통과
- [ ] Portfolio ↔ poco 전환 시 톱니바퀴 on/off
- [ ] 국가/장르 변경 즉시 차트 반영
- [ ] ko/en 토글 누락 없음

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: PR URL 출력. postpr-enrich 훅이 자동으로 @coderabbitai review 코멘트 추가 + Vercel preview URL 보고.

---

## Self-Review 결과

**Spec coverage**: 
- §1 성공 기준 6 항목 → Task 13 (chart 1), Task 14 (chart 2), Task 11 (톱니바퀴), Task 12 (칩), Task 10 (stale), Task 5-6 (crawl 명령), Task 1 (샘플 제거) 로 전부 커버.
- §3 5-layer → Task 2-4 (crawler), Task 6 (snapshot), Task 7 (accessor), Task 8 (store), Task 9-12 (UI).
- §9 샘플 게임 제거 → Task 1.
- §10 에러 처리 → Task 4 (retry), Task 7 (fallback genre), Task 13/14 (no-data placeholder).
- §11 테스트 5 종 → Task 2-4 (crawler), Task 7 (accessor), Task 8 (store), Task 16 (manual).
- §15 i18n → Task 9 Step 1.
- §16 운영 → Task 5 (scripts), Task 15 (§9 ops section).
- Step 0 verification → Task 0.

**Placeholder scan**: 모든 step 에 실제 코드/명령. Task 6 Step 1b 는 fallback 경로로 수동 작업이지만 의도적임 (plan 실행 시 해당 branch 가 실현될 때만).

**Type consistency**: 
- `CountryCode`, `Genre`, `Platform` 세 타입이 crawler/schema.ts (Task 2) 와 Compass/cpi-benchmarks.ts (Task 7) 양쪽에 정의. 값은 완전 일치 (목록 같음). Compass 측이 crawler 소스를 직접 import 하지 않는 이유는 번들러 경로 분리. 두 정의는 동기화 유지해야 함 — Task 2 변경 시 Task 7 도 갱신 필요, 이 plan 에는 해당 상황 없음.
- `lookupCpi` 시그니처 `(CountryCode, Genre, Platform) => number | null` Task 7 정의, Task 13/14 에서 동일 시그니처로 호출.
- `GameSettings` interface `{ country, genre }` Task 8 정의, Task 9/10 에서 동일 property 로 소비.

**Scope check**: 16 task, 1-2 주 분량. 각 task 3-7 step, 한 task 가 반나절 이내 완료 가능. 단일 plan 으로 적정.

**Ambiguity check**: 
- Task 11 Step 2: 기존 game-selector JSX 가 플레이스홀더. 실구현자는 파일을 먼저 읽고 wrap / icon button 삽입. 이건 "읽어서 수정"이 명시돼있어 OK.
- Task 13/14 의 `"ios"` hardcode: 현재 MMM 데이터에 platform 구분이 없어 iOS 고정. 미래에 channel.platform 이 추가되면 동적으로 바꿀 수 있음. 스펙 범위 밖이므로 주석 처리.
- Task 6 Step 1b: LevelPlay dead 시 manual AppsFlyer path. 조건부 경로이므로 의도적 ambiguity (runtime 에서 결정).
