# Sensor Tower Crawler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Project Compass의 Bayesian Prior 데이터(Merge × JP × Top 20)를 mock에서 실제 Sensor Tower 데이터로 교체하는 로컬 CLI 크롤러 MVP 구축

**Architecture:** 별도 `crawler/` 패키지(Node 24 + Playwright)가 ST 웹 대시보드에 사람이 로그인한 세션을 재사용해 패널별 XHR을 가로채 raw JSON을 수집 → transformer가 P10/P50/P90 분포로 가공 → atomic write로 `src/shared/api/data/sensor-tower/merge-jp-snapshot.json`에 스냅샷 저장 → Compass 빌드 타임에 `prior-data.ts`로 import

**Tech Stack:** Node 24 LTS, TypeScript, Playwright, Zod, dotenv, commander, tsx, Vitest

**Spec 참조:** `docs/superpowers/specs/2026-04-20-sensortower-crawler-design.md`

---

## File Structure (계획 잠금)

신규 생성:

```
crawler/
├── package.json                           # 독립 deps
├── tsconfig.json                          # ESM, Node 24
├── .env.example                           # 커밋
├── .gitignore                             # storageState, .env, etc.
├── README.md                              # 첫 실행 가이드
├── vitest.config.ts                       # transformer 테스트
├── src/
│   ├── index.ts                           # CLI entrypoint (commander)
│   ├── config/
│   │   ├── env.ts                         # process.env 파싱 + Zod 검증
│   │   └── targets.ts                     # 수집 대상 상수
│   ├── auth/
│   │   ├── login.ts                       # --login 플로우
│   │   └── session.ts                     # storageState 로드/검증
│   ├── fetchers/
│   │   ├── top-charts.ts                  # Top 20 게임 ID
│   │   ├── game-intelligence.ts           # DL/매출
│   │   └── usage-intelligence.ts          # 리텐션
│   ├── transformers/
│   │   ├── to-prior.ts                    # raw → P10/P50/P90
│   │   └── to-prior.test.ts               # 단위 테스트 (픽스처 기반)
│   ├── storage/
│   │   ├── snapshot-writer.ts             # atomic write + 백업
│   │   └── snapshot-writer.test.ts
│   ├── lib/
│   │   ├── humanlike-delay.ts             # 1.5–4초 랜덤
│   │   ├── xhr-intercept.ts               # page.on('response') 헬퍼
│   │   ├── lockfile.ts                    # 재진입 차단
│   │   └── logger.ts                      # silent/info/debug
│   └── schemas/
│       ├── snapshot.ts                    # Zod: 출력 JSON 스키마
│       └── snapshot.test.ts
├── fixtures/
│   ├── top-charts-merge-jp.raw.json       # Phase 2에서 캡처
│   ├── game-intelligence-sample.raw.json  # Phase 3에서 캡처
│   └── usage-intelligence-sample.raw.json # Phase 4에서 캡처
└── docs/
    └── st-xhr-endpoints.md                # 발견한 ST 내부 API 메모

src/shared/api/
├── data/sensor-tower/
│   └── .gitkeep                           # 빈 폴더 보존
└── prior-data.ts                          # Compass 측 import 진입점

루트 수정:
├── package.json                           # crawl:st 스크립트 추가
├── .gitignore                             # crawler 비밀 파일 제외
└── CLAUDE.md                              # "9. 외부 데이터 갱신" 섹션
```

수정 대상 위젯 (Phase 7):
- `src/widgets/charts/ui/prior-posterior-chart.tsx`
- `src/widgets/charts/ui/market-benchmark.tsx`
- `src/widgets/charts/ui/retention-curve.tsx`
- `src/widgets/dashboard/ui/market-context-card.tsx`
- `src/widgets/app-shell/ui/runway-status-bar.tsx`

---

## Phase 0 — 스캐폴딩

### Task 0.1: crawler 패키지 초기화

**Files:**
- Create: `crawler/package.json`
- Create: `crawler/tsconfig.json`
- Create: `crawler/.gitignore`

- [ ] **Step 1: 폴더 생성**

```bash
cd "/Users/mike/Downloads/Project Compass"
mkdir -p crawler/src/{config,auth,fetchers,transformers,storage,lib,schemas}
mkdir -p crawler/fixtures crawler/docs
```

- [ ] **Step 2: `crawler/package.json` 작성**

```json
{
  "name": "compass-crawler",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=24.0.0" },
  "scripts": {
    "start": "tsx src/index.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "playwright": "^1.49.0",
    "zod": "^3.23.8",
    "dotenv": "^16.4.5",
    "commander": "^12.1.0"
  },
  "devDependencies": {
    "tsx": "^4.19.2",
    "typescript": "^5.6.3",
    "vitest": "^2.1.8",
    "@types/node": "^22.10.0"
  }
}
```

- [ ] **Step 3: `crawler/tsconfig.json` 작성**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "outDir": "dist",
    "rootDir": "src",
    "lib": ["ES2022"],
    "types": ["node"],
    "forceConsistentCasingInFileNames": true,
    "noUncheckedIndexedAccess": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

- [ ] **Step 4: `crawler/.gitignore` 작성**

```
node_modules/
dist/
storageState.json
.env
.playwright/
debug-screenshots/
last-good-snapshot.json
.crawler.lock
*.har
.vitest-cache/
```

- [ ] **Step 5: 의존성 설치**

```bash
cd "/Users/mike/Downloads/Project Compass/crawler"
npm install
npx playwright install chromium
```

Expected: `node_modules/` 생성, Chromium 다운로드 완료

- [ ] **Step 6: typecheck 통과 확인 (빈 entrypoint 임시)**

```bash
echo "console.log('crawler bootstrap ok');" > src/index.ts
npm run typecheck
```

Expected: 에러 없음

- [ ] **Step 7: 커밋**

```bash
cd "/Users/mike/Downloads/Project Compass"
git add crawler/package.json crawler/tsconfig.json crawler/.gitignore crawler/src/index.ts
git commit -m "Phase 0.1: scaffold crawler package (Node 24 + Playwright + Vitest)"
```

---

### Task 0.2: 루트 .gitignore + scripts + .env.example

**Files:**
- Modify: `/Users/mike/Downloads/Project Compass/.gitignore`
- Modify: `/Users/mike/Downloads/Project Compass/package.json`
- Create: `crawler/.env.example`
- Create: `src/shared/api/data/sensor-tower/.gitkeep`

- [ ] **Step 1: 루트 `.gitignore`에 crawler 비밀 파일 추가**

루트 `.gitignore` 끝에 다음 블록 추가:

```
# Sensor Tower crawler
/crawler/storageState.json
/crawler/.env
/crawler/.playwright/
/crawler/debug-screenshots/
/crawler/last-good-snapshot.json
/crawler/.crawler.lock
/crawler/*.har
/crawler/node_modules/
/crawler/dist/
/crawler/.vitest-cache/
```

- [ ] **Step 2: 루트 `package.json`에 scripts 추가**

`scripts` 객체에 다음 항목 추가 (기존 항목은 보존):

```json
"crawl:st": "cd crawler && tsx src/index.ts",
"crawl:st:login": "cd crawler && tsx src/index.ts --login",
"crawl:st:dry": "cd crawler && tsx src/index.ts --dry-run --limit 1"
```

- [ ] **Step 3: `crawler/.env.example` 작성**

```bash
# ─────────────────────────────────────────────
# Sensor Tower Crawler — 환경 변수
# 비밀번호/이메일은 의도적으로 받지 않음.
# 첫 실행 시 `npm run crawl:st:login`으로 직접 로그인.
# ─────────────────────────────────────────────

ST_DATA_OUT=../src/shared/api/data/sensor-tower

ST_HEADLESS=false
ST_USER_DATA_DIR=./.playwright
ST_STORAGE_STATE=./storageState.json
ST_STORAGE_TTL_DAYS=30

ST_MIN_DELAY_MS=1500
ST_MAX_DELAY_MS=4000
ST_PAGE_SCROLL_SIM=true
ST_MAX_GAMES_PER_RUN=25

ST_TARGET_GENRE=Merge
ST_TARGET_REGION=JP
ST_TARGET_CHART=iphone-grossing
ST_TARGET_TOP_N=20

ST_DEBUG_SCREENSHOTS=true
ST_LOG_LEVEL=info
```

- [ ] **Step 4: 데이터 출력 폴더 보존용 `.gitkeep` 생성**

```bash
mkdir -p "src/shared/api/data/sensor-tower"
touch "src/shared/api/data/sensor-tower/.gitkeep"
```

- [ ] **Step 5: 커밋**

```bash
git add .gitignore package.json crawler/.env.example src/shared/api/data/sensor-tower/.gitkeep
git commit -m "Phase 0.2: root scripts + crawler env template + data folder"
```

---

### Task 0.3: 환경 파싱 (env.ts)

**Files:**
- Create: `crawler/src/config/env.ts`
- Create: `crawler/src/config/targets.ts`

- [ ] **Step 1: `crawler/src/config/env.ts` 작성**

```typescript
import "dotenv/config";
import { z } from "zod";

const EnvSchema = z.object({
  ST_DATA_OUT: z.string().default("../src/shared/api/data/sensor-tower"),
  ST_HEADLESS: z.enum(["true", "false"]).default("false").transform((v) => v === "true"),
  ST_USER_DATA_DIR: z.string().default("./.playwright"),
  ST_STORAGE_STATE: z.string().default("./storageState.json"),
  ST_STORAGE_TTL_DAYS: z.coerce.number().int().positive().default(30),
  ST_MIN_DELAY_MS: z.coerce.number().int().nonnegative().default(1500),
  ST_MAX_DELAY_MS: z.coerce.number().int().nonnegative().default(4000),
  ST_PAGE_SCROLL_SIM: z.enum(["true", "false"]).default("true").transform((v) => v === "true"),
  ST_MAX_GAMES_PER_RUN: z.coerce.number().int().positive().default(25),
  ST_TARGET_GENRE: z.string().default("Merge"),
  ST_TARGET_REGION: z.string().default("JP"),
  ST_TARGET_CHART: z.string().default("iphone-grossing"),
  ST_TARGET_TOP_N: z.coerce.number().int().positive().default(20),
  ST_DEBUG_SCREENSHOTS: z.enum(["true", "false"]).default("true").transform((v) => v === "true"),
  ST_LOG_LEVEL: z.enum(["silent", "info", "debug"]).default("info"),
});

export const env = EnvSchema.parse(process.env);
export type Env = typeof env;
```

- [ ] **Step 2: `crawler/src/config/targets.ts` 작성**

```typescript
import { env } from "./env.js";

export const targets = {
  genre: env.ST_TARGET_GENRE,
  region: env.ST_TARGET_REGION,
  chart: env.ST_TARGET_CHART,
  topN: env.ST_TARGET_TOP_N,
  maxGamesPerRun: env.ST_MAX_GAMES_PER_RUN,
} as const;

export type Targets = typeof targets;
```

- [ ] **Step 3: typecheck**

```bash
cd crawler && npm run typecheck
```

Expected: 에러 없음

- [ ] **Step 4: 커밋**

```bash
git add crawler/src/config/
git commit -m "Phase 0.3: env parsing with Zod + targets config"
```

---

## Phase 1 — 인증

### Task 1.1: logger + humanlike-delay 유틸

**Files:**
- Create: `crawler/src/lib/logger.ts`
- Create: `crawler/src/lib/humanlike-delay.ts`
- Create: `crawler/src/lib/humanlike-delay.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성 (`crawler/src/lib/humanlike-delay.test.ts`)**

```typescript
import { describe, it, expect, vi } from "vitest";
import { randomDelayMs, sleep } from "./humanlike-delay.js";

describe("randomDelayMs", () => {
  it("returns value within [min, max]", () => {
    for (let i = 0; i < 100; i++) {
      const v = randomDelayMs(1500, 4000);
      expect(v).toBeGreaterThanOrEqual(1500);
      expect(v).toBeLessThanOrEqual(4000);
    }
  });

  it("throws when min > max", () => {
    expect(() => randomDelayMs(5000, 1000)).toThrow();
  });
});

describe("sleep", () => {
  it("resolves after approximately the given ms", async () => {
    vi.useFakeTimers();
    const promise = sleep(100);
    vi.advanceTimersByTime(100);
    await promise;
    vi.useRealTimers();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd crawler && npx vitest run src/lib/humanlike-delay.test.ts
```

Expected: FAIL (모듈 없음)

- [ ] **Step 3: `crawler/src/lib/humanlike-delay.ts` 구현**

```typescript
export function randomDelayMs(min: number, max: number): number {
  if (min > max) throw new Error(`min(${min}) > max(${max})`);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
```

- [ ] **Step 4: `crawler/src/lib/logger.ts` 구현**

```typescript
import { env } from "../config/env.js";

type Level = "info" | "debug" | "warn" | "error";

const LEVEL_RANK: Record<Level, number> = { error: 0, warn: 1, info: 2, debug: 3 };

function shouldLog(level: Level): boolean {
  if (env.ST_LOG_LEVEL === "silent") return level === "error" || level === "warn";
  if (env.ST_LOG_LEVEL === "info") return LEVEL_RANK[level] <= LEVEL_RANK.info;
  return true;
}

function fmt(level: Level, msg: string): string {
  const ts = new Date().toISOString();
  return `[${ts}] [${level.toUpperCase()}] ${msg}`;
}

export const log = {
  info: (msg: string) => shouldLog("info") && console.log(fmt("info", msg)),
  debug: (msg: string) => shouldLog("debug") && console.log(fmt("debug", msg)),
  warn: (msg: string) => shouldLog("warn") && console.warn(fmt("warn", msg)),
  error: (msg: string) => shouldLog("error") && console.error(fmt("error", msg)),
};
```

- [ ] **Step 5: 테스트 통과 확인**

```bash
cd crawler && npx vitest run src/lib/humanlike-delay.test.ts
```

Expected: PASS (3 tests)

- [ ] **Step 6: 커밋**

```bash
git add crawler/src/lib/
git commit -m "Phase 1.1: logger + humanlike-delay (TDD)"
```

---

### Task 1.2: lockfile (재진입 차단)

**Files:**
- Create: `crawler/src/lib/lockfile.ts`
- Create: `crawler/src/lib/lockfile.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { acquireLock, releaseLock } from "./lockfile.js";
import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const TEST_LOCK = join(tmpdir(), "test-crawler.lock");

describe("lockfile", () => {
  beforeEach(() => { if (existsSync(TEST_LOCK)) rmSync(TEST_LOCK); });
  afterEach(() => { if (existsSync(TEST_LOCK)) rmSync(TEST_LOCK); });

  it("acquires lock when file does not exist", () => {
    expect(acquireLock(TEST_LOCK)).toBe(true);
    expect(existsSync(TEST_LOCK)).toBe(true);
  });

  it("fails to acquire when lock exists", () => {
    acquireLock(TEST_LOCK);
    expect(acquireLock(TEST_LOCK)).toBe(false);
  });

  it("releases lock", () => {
    acquireLock(TEST_LOCK);
    releaseLock(TEST_LOCK);
    expect(existsSync(TEST_LOCK)).toBe(false);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd crawler && npx vitest run src/lib/lockfile.test.ts
```

Expected: FAIL

- [ ] **Step 3: `crawler/src/lib/lockfile.ts` 구현**

```typescript
import { writeFileSync, existsSync, rmSync } from "node:fs";

export function acquireLock(path: string): boolean {
  if (existsSync(path)) return false;
  writeFileSync(path, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }), { flag: "wx" });
  return true;
}

export function releaseLock(path: string): void {
  if (existsSync(path)) rmSync(path);
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd crawler && npx vitest run src/lib/lockfile.test.ts
```

Expected: PASS (3 tests)

- [ ] **Step 5: 커밋**

```bash
git add crawler/src/lib/lockfile*
git commit -m "Phase 1.2: lockfile for reentrancy guard (TDD)"
```

---

### Task 1.3: 세션 관리 (session.ts)

**Files:**
- Create: `crawler/src/auth/session.ts`
- Create: `crawler/src/auth/session.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isStorageStateValid, readStorageStateMeta } from "./session.js";

const TEST_PATH = join(tmpdir(), "test-storage-state.json");

describe("session", () => {
  afterEach(() => { if (existsSync(TEST_PATH)) rmSync(TEST_PATH); });

  it("returns invalid when file is missing", () => {
    expect(isStorageStateValid(TEST_PATH, 30)).toEqual({ valid: false, reason: "missing" });
  });

  it("returns invalid when file is older than TTL", () => {
    const old = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
    writeFileSync(TEST_PATH, JSON.stringify({ cookies: [], origins: [], _meta: { savedAt: old } }));
    expect(isStorageStateValid(TEST_PATH, 30)).toMatchObject({ valid: false, reason: "expired" });
  });

  it("returns valid when fresh", () => {
    const now = new Date().toISOString();
    writeFileSync(TEST_PATH, JSON.stringify({ cookies: [], origins: [], _meta: { savedAt: now } }));
    expect(isStorageStateValid(TEST_PATH, 30)).toEqual({ valid: true });
  });

  it("returns invalid when _meta missing", () => {
    writeFileSync(TEST_PATH, JSON.stringify({ cookies: [], origins: [] }));
    expect(isStorageStateValid(TEST_PATH, 30)).toMatchObject({ valid: false, reason: "no-meta" });
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd crawler && npx vitest run src/auth/session.test.ts
```

Expected: FAIL

- [ ] **Step 3: `crawler/src/auth/session.ts` 구현**

```typescript
import { existsSync, readFileSync } from "node:fs";

export type ValidityResult =
  | { valid: true }
  | { valid: false; reason: "missing" | "expired" | "no-meta" | "parse-error" };

export interface StorageMeta {
  savedAt: string;
}

export function readStorageStateMeta(path: string): StorageMeta | null {
  if (!existsSync(path)) return null;
  try {
    const raw = JSON.parse(readFileSync(path, "utf8"));
    return raw._meta ?? null;
  } catch {
    return null;
  }
}

export function isStorageStateValid(path: string, ttlDays: number): ValidityResult {
  if (!existsSync(path)) return { valid: false, reason: "missing" };
  let raw: any;
  try {
    raw = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return { valid: false, reason: "parse-error" };
  }
  if (!raw._meta?.savedAt) return { valid: false, reason: "no-meta" };
  const ageMs = Date.now() - new Date(raw._meta.savedAt).getTime();
  const ttlMs = ttlDays * 24 * 60 * 60 * 1000;
  if (ageMs > ttlMs) return { valid: false, reason: "expired" };
  return { valid: true };
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd crawler && npx vitest run src/auth/session.test.ts
```

Expected: PASS (4 tests)

- [ ] **Step 5: 커밋**

```bash
git add crawler/src/auth/session*
git commit -m "Phase 1.3: storageState validity check (TDD)"
```

---

### Task 1.4: 로그인 플로우 (login.ts) + CLI 진입점

**Files:**
- Create: `crawler/src/auth/login.ts`
- Modify: `crawler/src/index.ts`

- [ ] **Step 1: `crawler/src/auth/login.ts` 작성**

```typescript
import { chromium } from "playwright";
import { writeFileSync, chmodSync } from "node:fs";
import { env } from "../config/env.js";
import { log } from "../lib/logger.js";
import * as readline from "node:readline/promises";
import { stdin, stdout } from "node:process";

const ST_DASHBOARD_URL = "https://app.sensortower.com/";

export async function runLogin(): Promise<void> {
  log.info("Headed Chromium 실행 — Sensor Tower 로그인 페이지로 이동합니다.");
  log.info("브라우저에서 직접 로그인하세요. 2FA가 있다면 완료까지 끝낸 뒤 콘솔로 돌아오세요.");

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(ST_DASHBOARD_URL);

  const rl = readline.createInterface({ input: stdin, output: stdout });
  await rl.question("\n로그인이 완료되어 ST 대시보드가 보이면 Enter를 누르세요... ");
  rl.close();

  const state = await context.storageState();
  const stateWithMeta = { ...state, _meta: { savedAt: new Date().toISOString() } };
  writeFileSync(env.ST_STORAGE_STATE, JSON.stringify(stateWithMeta, null, 2));
  try {
    chmodSync(env.ST_STORAGE_STATE, 0o600);
  } catch (e) {
    log.warn(`chmod 600 실패 (무시 가능, OS 따라 다름): ${(e as Error).message}`);
  }

  log.info(`세션 저장 완료: ${env.ST_STORAGE_STATE}`);
  await browser.close();
}
```

- [ ] **Step 2: `crawler/src/index.ts` 작성 (CLI 진입점)**

```typescript
import { Command } from "commander";
import { runLogin } from "./auth/login.js";
import { isStorageStateValid } from "./auth/session.js";
import { env } from "./config/env.js";
import { log } from "./lib/logger.js";

const program = new Command();

program
  .name("compass-crawler")
  .description("Project Compass — Sensor Tower 크롤러 (Merge × JP × Top 20)")
  .version("0.1.0");

program
  .option("--login", "헤드 브라우저로 ST에 직접 로그인하고 세션 저장")
  .option("--dry-run", "수집한 결과를 stdout에만 출력 (파일 저장 안 함)")
  .option("--limit <n>", "처리할 게임 수 제한 (디버깅용)", parseInt)
  .action(async (opts: { login?: boolean; dryRun?: boolean; limit?: number }) => {
    if (opts.login) {
      await runLogin();
      return;
    }

    const validity = isStorageStateValid(env.ST_STORAGE_STATE, env.ST_STORAGE_TTL_DAYS);
    if (!validity.valid) {
      log.error(`세션이 유효하지 않습니다 (이유: ${validity.reason}).`);
      log.error("재로그인이 필요합니다: npm run crawl:st:login");
      process.exit(1);
    }
    log.info("세션 유효 — 크롤 시작 (Phase 2부터 구현 예정)");
  });

program.parse();
```

- [ ] **Step 3: typecheck**

```bash
cd crawler && npm run typecheck
```

Expected: 에러 없음

- [ ] **Step 4: --help 동작 확인**

```bash
cd "/Users/mike/Downloads/Project Compass" && npm run crawl:st -- --help
```

Expected: commander usage 출력 (--login, --dry-run, --limit 옵션 표시)

- [ ] **Step 5: 세션 없을 때 에러 메시지 확인**

```bash
cd "/Users/mike/Downloads/Project Compass" && npm run crawl:st
```

Expected: "세션이 유효하지 않습니다 (이유: missing)" 출력 후 exit 1

- [ ] **Step 6: 실제 로그인 (사람이 직접 수행)**

```bash
cd "/Users/mike/Downloads/Project Compass" && npm run crawl:st:login
```

브라우저가 열림 → ST 로그인 → 대시보드 보일 때까지 기다림 → 콘솔로 돌아와 Enter

Expected: `crawler/storageState.json` 생성, "세션 저장 완료" 출력

- [ ] **Step 7: 세션 검증 확인**

```bash
npm run crawl:st
```

Expected: "세션 유효 — 크롤 시작" 출력

- [ ] **Step 8: 커밋**

```bash
git add crawler/src/auth/login.ts crawler/src/index.ts
git commit -m "Phase 1.4: --login flow + CLI entrypoint with session check"
```

---

### Task 1.5: ST UI 사전 탐사 (수동, 코드 변경 없음)

이 태스크는 Phase 2-4의 fetcher를 작성하기 전에 **사람이 직접** Chrome DevTools로 ST 패널의 XHR을 확인해 메모하는 단계입니다. 자동화 불가.

**Files:**
- Create: `crawler/docs/st-xhr-endpoints.md`

- [ ] **Step 1: 헤드 브라우저로 ST 진입 (저장된 세션 사용)**

수동: Chrome 직접 열고 https://app.sensortower.com/ 접속, DevTools Network 탭 열고 XHR 필터.

- [ ] **Step 2: Top Charts 페이지 방문 — Merge × JP × iPhone Grossing 선택**

URL 패턴 메모, 응답 JSON 구조에서 다음 키 확인:
- 게임 리스트 (rank, name, app_id, publisher)

- [ ] **Step 3: 임의 게임 1개 클릭 → Game Intelligence 패널**

기록할 것:
- Downloads 차트 XHR URL 패턴
- Revenue 차트 XHR URL 패턴
- 응답 JSON에서 90일 합계 / 월별 시계열 키 위치

- [ ] **Step 4: Usage Intelligence 패널 진입**

기록할 것:
- Retention curve XHR URL 패턴
- D1/D7/D30 값이 들어있는 키 경로

- [ ] **Step 5: `crawler/docs/st-xhr-endpoints.md` 작성**

```markdown
# Sensor Tower 내부 API 엔드포인트 메모

> 사내 사용 한정. 외부 공유 금지.
> 마지막 확인: YYYY-MM-DD by <name>

## Top Charts (Merge × JP × iPhone Grossing)

- URL pattern: `https://app.sensortower.com/api/...`  (실제로 본 URL 기록)
- 응답 키 매핑:
  - rank: `data[].rank`
  - name: `data[].app.name`
  - publisher: `data[].app.publisher`
  - ios id: `data[].app.app_id`

## Game Intelligence — Downloads / Revenue

- URL pattern: ...
- 응답 키 매핑:
  - 월별 다운로드: ...
  - 90일 매출 합계: ...

## Usage Intelligence — Retention

- URL pattern: ...
- 응답 키 매핑:
  - D1: ...
  - D7: ...
  - D30: ...

## 기타 발견 사항

- 페이지 로딩 후 차트 XHR이 lazy하게 발사됨 (스크롤 트리거)
- 일부 응답이 압축된 base64로 옴 (해당 시 처리 방법 메모)
```

- [ ] **Step 6: 커밋**

```bash
git add crawler/docs/st-xhr-endpoints.md
git commit -m "Phase 1.5: ST internal XHR endpoint reconnaissance memo"
```

---

## Phase 2 — Top Charts Fetcher

### Task 2.1: XHR 인터셉트 헬퍼

**Files:**
- Create: `crawler/src/lib/xhr-intercept.ts`
- Create: `crawler/src/lib/xhr-intercept.test.ts`

- [ ] **Step 1: 실패하는 테스트 (URL 매처만 단위 테스트, page는 통합)**

```typescript
import { describe, it, expect } from "vitest";
import { matchesUrlPattern } from "./xhr-intercept.js";

describe("matchesUrlPattern", () => {
  it("matches simple substring", () => {
    expect(matchesUrlPattern("https://app.sensortower.com/api/top_charts/x", "/api/top_charts/")).toBe(true);
  });

  it("matches RegExp", () => {
    expect(matchesUrlPattern("https://app.sensortower.com/api/games/123/downloads", /\/api\/games\/\d+\/downloads/)).toBe(true);
  });

  it("does not match non-matching", () => {
    expect(matchesUrlPattern("https://example.com/foo", "/api/")).toBe(false);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd crawler && npx vitest run src/lib/xhr-intercept.test.ts
```

Expected: FAIL

- [ ] **Step 3: `crawler/src/lib/xhr-intercept.ts` 구현**

```typescript
import type { Page, Response } from "playwright";
import { log } from "./logger.js";

export type UrlPattern = string | RegExp;

export function matchesUrlPattern(url: string, pattern: UrlPattern): boolean {
  if (typeof pattern === "string") return url.includes(pattern);
  return pattern.test(url);
}

export function captureFirstMatchingResponse<T = unknown>(
  page: Page,
  pattern: UrlPattern,
  timeoutMs = 30_000,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      page.off("response", handler);
      reject(new Error(`XHR timeout (${timeoutMs}ms) for pattern: ${pattern}`));
    }, timeoutMs);

    const handler = async (resp: Response) => {
      if (!matchesUrlPattern(resp.url(), pattern)) return;
      if (resp.status() !== 200) {
        log.warn(`Matched URL but status ${resp.status()}: ${resp.url()}`);
        return;
      }
      try {
        const body = (await resp.json()) as T;
        clearTimeout(timer);
        page.off("response", handler);
        resolve(body);
      } catch (e) {
        log.warn(`JSON parse failed for ${resp.url()}: ${(e as Error).message}`);
      }
    };

    page.on("response", handler);
  });
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd crawler && npx vitest run src/lib/xhr-intercept.test.ts
```

Expected: PASS (3 tests)

- [ ] **Step 5: 커밋**

```bash
git add crawler/src/lib/xhr-intercept*
git commit -m "Phase 2.1: XHR intercept helper with URL pattern matching"
```

---

### Task 2.2: Top Charts fetcher

**Files:**
- Create: `crawler/src/fetchers/top-charts.ts`

> ⚠️ 이 fetcher의 URL 패턴/JSON 키는 Task 1.5에서 메모한 실제 ST 엔드포인트로 채워야 합니다. 아래 코드는 실제 패턴이 `/api/top_charts/`이고 응답이 `{ data: [{rank, app: {name, publisher, app_id}}] }` 라고 가정한 예시. 실제와 다르면 그에 맞게 수정.

- [ ] **Step 1: `crawler/src/fetchers/top-charts.ts` 작성 (메모에 맞게 수정)**

```typescript
import type { BrowserContext } from "playwright";
import { captureFirstMatchingResponse } from "../lib/xhr-intercept.js";
import { sleep, randomDelayMs } from "../lib/humanlike-delay.js";
import { env } from "../config/env.js";
import { log } from "../lib/logger.js";

export interface TopChartGame {
  rank: number;
  name: string;
  publisher: string;
  appIds: { ios: string | null; android: string | null };
}

// Task 1.5 메모대로 수정할 것
const TOP_CHARTS_URL = "https://app.sensortower.com/top-charts?os=ios&country=JP&category=Merge&chart_type=topgrossing";
const XHR_PATTERN = "/api/top_charts/";

interface RawTopChartsResponse {
  data: Array<{
    rank: number;
    app: {
      name: string;
      publisher: string;
      app_id: string;
      android_app_id?: string;
    };
  }>;
}

export async function fetchTopCharts(context: BrowserContext, topN: number): Promise<TopChartGame[]> {
  const page = await context.newPage();
  log.info(`Top Charts 페이지 진입: ${TOP_CHARTS_URL}`);

  const responsePromise = captureFirstMatchingResponse<RawTopChartsResponse>(page, XHR_PATTERN, 30_000);
  await page.goto(TOP_CHARTS_URL, { waitUntil: "networkidle" });

  const raw = await responsePromise;
  if (!raw?.data?.length) {
    throw new Error("Top Charts 응답이 비어있음 — UI 변경 가능성");
  }

  const games: TopChartGame[] = raw.data.slice(0, topN).map((item) => ({
    rank: item.rank,
    name: item.app.name,
    publisher: item.app.publisher,
    appIds: { ios: item.app.app_id, android: item.app.android_app_id ?? null },
  }));

  log.info(`Top ${games.length}개 게임 수집 완료`);
  await sleep(randomDelayMs(env.ST_MIN_DELAY_MS, env.ST_MAX_DELAY_MS));
  await page.close();
  return games;
}
```

- [ ] **Step 2: index.ts에 임시 호출 추가 (--dry-run 일 때만)**

기존 action 콜백 끝부분(`log.info("세션 유효 — ...")` 뒤)에 추가:

```typescript
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ headless: env.ST_HEADLESS });
    const context = await browser.newContext({ storageState: env.ST_STORAGE_STATE });
    try {
      const { fetchTopCharts } = await import("./fetchers/top-charts.js");
      const games = await fetchTopCharts(context, opts.limit ?? env.ST_TARGET_TOP_N);
      if (opts.dryRun) {
        console.log(JSON.stringify(games, null, 2));
      }
    } finally {
      await context.close();
      await browser.close();
    }
```

- [ ] **Step 3: dry-run 실행 (실제 ST 호출)**

```bash
cd "/Users/mike/Downloads/Project Compass" && npm run crawl:st -- --dry-run
```

Expected: Top 20 게임이 stdout에 JSON으로 출력. 1위 게임 이름이 ST 웹 화면 1위와 일치.

- [ ] **Step 4: 응답 픽스처 저장 (재현 가능하게)**

수집된 raw response를 파일로 떨어뜨리는 임시 코드 추가하거나, 결과 게임 리스트만 저장:

```bash
npm run crawl:st -- --dry-run > crawler/fixtures/top-charts-merge-jp.dryrun.json
```

(dryrun.json은 디버그 용도, fixtures/ 밑에 두되 raw API 응답이 아닌 처리된 결과)

진짜 raw 응답 픽스처는 인터셉트 헬퍼에 디버그 모드 추가해서 별도 저장 — 이건 Phase 5에서 testing할 때 필요.

- [ ] **Step 5: 커밋**

```bash
git add crawler/src/fetchers/top-charts.ts crawler/src/index.ts crawler/fixtures/top-charts-merge-jp.dryrun.json
git commit -m "Phase 2.2: top-charts fetcher (Merge × JP × Top 20)"
```

---

## Phase 3 — Game Intelligence Fetcher

### Task 3.1: GI fetcher 구현

**Files:**
- Create: `crawler/src/fetchers/game-intelligence.ts`

> ⚠️ Task 1.5 메모의 실제 URL/키로 수정.

- [ ] **Step 1: `crawler/src/fetchers/game-intelligence.ts` 작성**

```typescript
import type { BrowserContext } from "playwright";
import { captureFirstMatchingResponse } from "../lib/xhr-intercept.js";
import { sleep, randomDelayMs } from "../lib/humanlike-delay.js";
import { env } from "../config/env.js";
import { log } from "../lib/logger.js";
import type { TopChartGame } from "./top-charts.js";

export interface GameIntelligenceData {
  iosAppId: string;
  downloads: { last90dTotal: number | null; monthly: Array<{ month: string; value: number }> };
  revenue: { last90dTotalUsd: number | null; monthly: Array<{ month: string; value: number }> };
}

// Task 1.5 메모대로 수정
const PANEL_URL = (iosId: string) =>
  `https://app.sensortower.com/overview/${iosId}?country=JP`;
const DOWNLOADS_PATTERN = /\/api\/.*\/downloads/;
const REVENUE_PATTERN = /\/api\/.*\/revenue/;

interface RawSeriesResponse {
  total_90d?: number;
  monthly?: Array<{ date: string; value: number }>;
}

export async function fetchGameIntelligence(
  context: BrowserContext,
  game: TopChartGame,
): Promise<GameIntelligenceData> {
  if (!game.appIds.ios) {
    throw new Error(`${game.name}: iOS app ID 없음, GI 수집 불가`);
  }
  const page = await context.newPage();
  log.info(`GI 진입: ${game.name} (${game.appIds.ios})`);

  const downloadsPromise = captureFirstMatchingResponse<RawSeriesResponse>(page, DOWNLOADS_PATTERN, 30_000);
  const revenuePromise = captureFirstMatchingResponse<RawSeriesResponse>(page, REVENUE_PATTERN, 30_000);

  await page.goto(PANEL_URL(game.appIds.ios), { waitUntil: "networkidle" });

  if (env.ST_PAGE_SCROLL_SIM) {
    await page.evaluate(() => window.scrollBy(0, 800));
    await sleep(500);
  }

  const [downloadsRaw, revenueRaw] = await Promise.all([downloadsPromise, revenuePromise]);

  const data: GameIntelligenceData = {
    iosAppId: game.appIds.ios,
    downloads: {
      last90dTotal: downloadsRaw.total_90d ?? null,
      monthly: (downloadsRaw.monthly ?? []).map((m) => ({ month: m.date.slice(0, 7), value: m.value })),
    },
    revenue: {
      last90dTotalUsd: revenueRaw.total_90d ?? null,
      monthly: (revenueRaw.monthly ?? []).map((m) => ({ month: m.date.slice(0, 7), value: m.value })),
    },
  };

  await sleep(randomDelayMs(env.ST_MIN_DELAY_MS, env.ST_MAX_DELAY_MS));
  await page.close();
  return data;
}
```

- [ ] **Step 2: index.ts에서 1개 게임만 호출 (--limit 1)**

기존 dry-run 블록 안에서 첫 게임에 GI 호출 추가:

```typescript
      const { fetchGameIntelligence } = await import("./fetchers/game-intelligence.js");
      if (games[0]) {
        const gi = await fetchGameIntelligence(context, games[0]);
        if (opts.dryRun) console.log("GI:", JSON.stringify(gi, null, 2));
      }
```

- [ ] **Step 3: dry-run 실행**

```bash
npm run crawl:st -- --dry-run --limit 1
```

Expected: 1위 게임의 90일 다운로드/매출 출력. ST 웹 화면 같은 게임 GI 패널과 ±5% 일치.

- [ ] **Step 4: 커밋**

```bash
git add crawler/src/fetchers/game-intelligence.ts crawler/src/index.ts
git commit -m "Phase 3.1: game-intelligence fetcher (downloads + revenue)"
```

---

## Phase 4 — Usage Intelligence Fetcher

### Task 4.1: UI fetcher 구현

**Files:**
- Create: `crawler/src/fetchers/usage-intelligence.ts`

> ⚠️ Task 1.5 메모의 실제 URL/키로 수정.

- [ ] **Step 1: `crawler/src/fetchers/usage-intelligence.ts` 작성**

```typescript
import type { BrowserContext } from "playwright";
import { captureFirstMatchingResponse } from "../lib/xhr-intercept.js";
import { sleep, randomDelayMs } from "../lib/humanlike-delay.js";
import { env } from "../config/env.js";
import { log } from "../lib/logger.js";
import type { TopChartGame } from "./top-charts.js";

export interface RetentionData {
  iosAppId: string;
  d1: number | null;
  d7: number | null;
  d30: number | null;
  fetchedAt: string;
}

// Task 1.5 메모대로 수정
const PANEL_URL = (iosId: string) =>
  `https://app.sensortower.com/usage/${iosId}/retention?country=JP`;
const RETENTION_PATTERN = /\/api\/.*\/retention/;

interface RawRetentionResponse {
  curve?: Array<{ day: number; value: number }>;
}

function pickDay(curve: Array<{ day: number; value: number }> | undefined, day: number): number | null {
  return curve?.find((p) => p.day === day)?.value ?? null;
}

export async function fetchUsageIntelligence(
  context: BrowserContext,
  game: TopChartGame,
): Promise<RetentionData> {
  if (!game.appIds.ios) {
    throw new Error(`${game.name}: iOS app ID 없음, UI 수집 불가`);
  }
  const page = await context.newPage();
  log.info(`UI 진입: ${game.name}`);

  const retentionPromise = captureFirstMatchingResponse<RawRetentionResponse>(page, RETENTION_PATTERN, 30_000);
  await page.goto(PANEL_URL(game.appIds.ios), { waitUntil: "networkidle" });

  if (env.ST_PAGE_SCROLL_SIM) {
    await page.evaluate(() => window.scrollBy(0, 800));
    await sleep(500);
  }

  const raw = await retentionPromise;

  const data: RetentionData = {
    iosAppId: game.appIds.ios,
    d1: pickDay(raw.curve, 1),
    d7: pickDay(raw.curve, 7),
    d30: pickDay(raw.curve, 30),
    fetchedAt: new Date().toISOString(),
  };

  await sleep(randomDelayMs(env.ST_MIN_DELAY_MS, env.ST_MAX_DELAY_MS));
  await page.close();
  return data;
}
```

- [ ] **Step 2: index.ts dry-run에 호출 추가**

```typescript
      const { fetchUsageIntelligence } = await import("./fetchers/usage-intelligence.js");
      if (games[0]) {
        const ui = await fetchUsageIntelligence(context, games[0]);
        if (opts.dryRun) console.log("UI:", JSON.stringify(ui, null, 2));
      }
```

- [ ] **Step 3: dry-run 실행**

```bash
npm run crawl:st -- --dry-run --limit 1
```

Expected: 1위 게임 D1/D7/D30 출력. ST 웹 리텐션 차트와 ±0.01 일치.

- [ ] **Step 4: 커밋**

```bash
git add crawler/src/fetchers/usage-intelligence.ts crawler/src/index.ts
git commit -m "Phase 4.1: usage-intelligence fetcher (D1/D7/D30 retention)"
```

---

## Phase 5 — Transformer (분포 계산)

### Task 5.1: 출력 스키마 정의 (Zod)

**Files:**
- Create: `crawler/src/schemas/snapshot.ts`
- Create: `crawler/src/schemas/snapshot.test.ts`

- [ ] **Step 1: 실패하는 테스트**

```typescript
import { describe, it, expect } from "vitest";
import { SnapshotSchema } from "./snapshot.js";

describe("SnapshotSchema", () => {
  it("validates a minimal valid snapshot", () => {
    const minimal = {
      $schemaVersion: 1,
      metadata: {
        fetchedAt: "2026-04-20T11:36:00+09:00",
        fetchedBy: "crawler@local",
        genre: "Merge", region: "JP", topN: 1, tier: "iphone-grossing",
        crawlerVersion: "0.1.0", warnings: [],
      },
      topGames: [{
        rank: 1, name: "Royal Match", publisher: "Dream Games",
        appIds: { ios: "1632298254", android: null },
        downloads: { last90dTotal: 4500000, monthly: [{ month: "2026-01", value: 1800000 }] },
        revenue: { last90dTotalUsd: 28400000, monthly: [{ month: "2026-01", value: 9500000 }] },
        retention: { d1: 0.42, d7: 0.18, d30: 0.08, sampleSize: "ST estimate", fetchedAt: "2026-04-20T11:36:00+09:00" },
      }],
      genrePrior: {
        retention: {
          d1: { p10: 0.28, p50: 0.38, p90: 0.50 },
          d7: { p10: 0.10, p50: 0.16, p90: 0.24 },
          d30: { p10: 0.04, p50: 0.07, p90: 0.12 },
        },
        monthlyRevenueUsd: { p10: 200000, p50: 1500000, p90: 12000000 },
        monthlyDownloads: { p10: 50000, p50: 350000, p90: 2500000 },
      },
    };
    expect(() => SnapshotSchema.parse(minimal)).not.toThrow();
  });

  it("rejects wrong $schemaVersion", () => {
    expect(() => SnapshotSchema.parse({ $schemaVersion: 2 })).toThrow();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd crawler && npx vitest run src/schemas/snapshot.test.ts
```

Expected: FAIL

- [ ] **Step 3: `crawler/src/schemas/snapshot.ts` 구현**

```typescript
import { z } from "zod";

const PercentileSchema = z.object({
  p10: z.number(),
  p50: z.number(),
  p90: z.number(),
});

const MonthlyPointSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  value: z.number(),
});

const TopGameSchema = z.object({
  rank: z.number().int().positive(),
  name: z.string(),
  publisher: z.string(),
  appIds: z.object({ ios: z.string().nullable(), android: z.string().nullable() }),
  downloads: z.object({
    last90dTotal: z.number().nullable(),
    monthly: z.array(MonthlyPointSchema),
  }),
  revenue: z.object({
    last90dTotalUsd: z.number().nullable(),
    monthly: z.array(MonthlyPointSchema),
  }),
  retention: z.object({
    d1: z.number().nullable(),
    d7: z.number().nullable(),
    d30: z.number().nullable(),
    sampleSize: z.string(),
    fetchedAt: z.string(),
  }),
});

export const SnapshotSchema = z.object({
  $schemaVersion: z.literal(1),
  metadata: z.object({
    fetchedAt: z.string(),
    fetchedBy: z.string(),
    genre: z.string(),
    region: z.string(),
    topN: z.number().int().positive(),
    tier: z.string(),
    crawlerVersion: z.string(),
    warnings: z.array(z.string()),
  }),
  topGames: z.array(TopGameSchema),
  genrePrior: z.object({
    retention: z.object({ d1: PercentileSchema, d7: PercentileSchema, d30: PercentileSchema }),
    monthlyRevenueUsd: PercentileSchema,
    monthlyDownloads: PercentileSchema,
  }),
});

export type Snapshot = z.infer<typeof SnapshotSchema>;
export type TopGame = z.infer<typeof TopGameSchema>;
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd crawler && npx vitest run src/schemas/snapshot.test.ts
```

Expected: PASS (2 tests)

- [ ] **Step 5: 커밋**

```bash
git add crawler/src/schemas/
git commit -m "Phase 5.1: Zod snapshot schema (TDD)"
```

---

### Task 5.2: 백분위 계산 (transformer)

**Files:**
- Create: `crawler/src/transformers/to-prior.ts`
- Create: `crawler/src/transformers/to-prior.test.ts`

- [ ] **Step 1: 실패하는 테스트**

```typescript
import { describe, it, expect } from "vitest";
import { percentile, computeGenrePrior } from "./to-prior.js";
import type { TopGame } from "../schemas/snapshot.js";

describe("percentile", () => {
  it("returns p50 of [1..10] as 5.5", () => {
    expect(percentile([1,2,3,4,5,6,7,8,9,10], 0.5)).toBe(5.5);
  });

  it("returns p10/p50/p90 of [1..100]", () => {
    const arr = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(percentile(arr, 0.1)).toBeCloseTo(10.9, 1);
    expect(percentile(arr, 0.5)).toBeCloseTo(50.5, 1);
    expect(percentile(arr, 0.9)).toBeCloseTo(90.1, 1);
  });

  it("ignores null/NaN values", () => {
    expect(percentile([1, null as any, 2, NaN, 3], 0.5)).toBe(2);
  });

  it("throws on empty array after filtering", () => {
    expect(() => percentile([null as any, NaN], 0.5)).toThrow();
  });
});

describe("computeGenrePrior", () => {
  function fakeGame(d1: number, monthlyRev: number, monthlyDl: number): TopGame {
    return {
      rank: 1, name: "x", publisher: "y",
      appIds: { ios: "1", android: null },
      downloads: { last90dTotal: monthlyDl * 3, monthly: [{ month: "2026-01", value: monthlyDl }] },
      revenue: { last90dTotalUsd: monthlyRev * 3, monthly: [{ month: "2026-01", value: monthlyRev }] },
      retention: { d1, d7: d1 / 2, d30: d1 / 4, sampleSize: "ST", fetchedAt: "2026-01-01" },
    };
  }

  it("computes p10/p50/p90 across games", () => {
    const games = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0].map((d1) =>
      fakeGame(d1, d1 * 1_000_000, d1 * 100_000),
    );
    const prior = computeGenrePrior(games);
    expect(prior.retention.d1.p50).toBeCloseTo(0.55, 2);
    expect(prior.retention.d1.p10).toBeCloseTo(0.19, 1);
    expect(prior.retention.d1.p90).toBeCloseTo(0.91, 1);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd crawler && npx vitest run src/transformers/to-prior.test.ts
```

Expected: FAIL

- [ ] **Step 3: `crawler/src/transformers/to-prior.ts` 구현**

```typescript
import type { TopGame, Snapshot } from "../schemas/snapshot.js";

export function percentile(values: Array<number | null>, p: number): number {
  const clean = values.filter((v): v is number => typeof v === "number" && !Number.isNaN(v));
  if (clean.length === 0) throw new Error("percentile: empty array after filtering");
  if (p < 0 || p > 1) throw new Error(`percentile: p must be in [0,1], got ${p}`);
  const sorted = [...clean].sort((a, b) => a - b);
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo]!;
  const frac = idx - lo;
  return sorted[lo]! * (1 - frac) + sorted[hi]! * frac;
}

function dist(values: Array<number | null>) {
  return {
    p10: percentile(values, 0.1),
    p50: percentile(values, 0.5),
    p90: percentile(values, 0.9),
  };
}

function avgMonthly(monthly: Array<{ month: string; value: number }>): number | null {
  if (monthly.length === 0) return null;
  return monthly.reduce((s, m) => s + m.value, 0) / monthly.length;
}

export function computeGenrePrior(games: TopGame[]): Snapshot["genrePrior"] {
  const d1 = games.map((g) => g.retention.d1);
  const d7 = games.map((g) => g.retention.d7);
  const d30 = games.map((g) => g.retention.d30);
  const monthlyRevs = games.map((g) => avgMonthly(g.revenue.monthly));
  const monthlyDls = games.map((g) => avgMonthly(g.downloads.monthly));

  return {
    retention: { d1: dist(d1), d7: dist(d7), d30: dist(d30) },
    monthlyRevenueUsd: dist(monthlyRevs),
    monthlyDownloads: dist(monthlyDls),
  };
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd crawler && npx vitest run src/transformers/to-prior.test.ts
```

Expected: PASS (5 tests)

- [ ] **Step 5: 커밋**

```bash
git add crawler/src/transformers/
git commit -m "Phase 5.2: percentile + computeGenrePrior (TDD)"
```

---

## Phase 6 — Storage + 오케스트레이션

### Task 6.1: snapshot-writer (atomic + 백업)

**Files:**
- Create: `crawler/src/storage/snapshot-writer.ts`
- Create: `crawler/src/storage/snapshot-writer.test.ts`

- [ ] **Step 1: 실패하는 테스트**

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeSnapshotAtomic } from "./snapshot-writer.js";

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "snap-")); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

describe("writeSnapshotAtomic", () => {
  it("writes new snapshot with no prior file", () => {
    writeSnapshotAtomic(dir, "merge-jp-snapshot.json", { x: 1 });
    expect(JSON.parse(readFileSync(join(dir, "merge-jp-snapshot.json"), "utf8"))).toEqual({ x: 1 });
  });

  it("backs up previous snapshot before overwrite", () => {
    writeFileSync(join(dir, "merge-jp-snapshot.json"), JSON.stringify({ old: true }));
    writeSnapshotAtomic(dir, "merge-jp-snapshot.json", { new: true });
    expect(JSON.parse(readFileSync(join(dir, "merge-jp-snapshot.json"), "utf8"))).toEqual({ new: true });
    expect(existsSync(join(dir, "last-good-snapshot.json"))).toBe(true);
    expect(JSON.parse(readFileSync(join(dir, "last-good-snapshot.json"), "utf8"))).toEqual({ old: true });
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd crawler && npx vitest run src/storage/snapshot-writer.test.ts
```

Expected: FAIL

- [ ] **Step 3: `crawler/src/storage/snapshot-writer.ts` 구현**

```typescript
import { writeFileSync, copyFileSync, renameSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

export function writeSnapshotAtomic(outDir: string, fileName: string, data: unknown): void {
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const finalPath = join(outDir, fileName);
  const tmpPath = join(outDir, `.${fileName}.tmp.${process.pid}`);
  const backupPath = join(outDir, "last-good-snapshot.json");

  if (existsSync(finalPath)) {
    copyFileSync(finalPath, backupPath);
  }
  writeFileSync(tmpPath, JSON.stringify(data, null, 2));
  renameSync(tmpPath, finalPath);
}

export function writeLastUpdated(outDir: string, snapshotName: string): void {
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const meta = {
    fetchedAt: new Date().toISOString(),
    snapshotPath: snapshotName,
    ageWarningDays: 14,
  };
  writeFileSync(join(outDir, "last-updated.json"), JSON.stringify(meta, null, 2));
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd crawler && npx vitest run src/storage/snapshot-writer.test.ts
```

Expected: PASS (2 tests)

- [ ] **Step 5: 커밋**

```bash
git add crawler/src/storage/
git commit -m "Phase 6.1: atomic snapshot writer with backup (TDD)"
```

---

### Task 6.2: 오케스트레이션 (전체 플로우 통합)

**Files:**
- Modify: `crawler/src/index.ts` (전면 재작성)

- [ ] **Step 1: `crawler/src/index.ts` 재작성**

```typescript
import { Command } from "commander";
import { chromium } from "playwright";
import { resolve } from "node:path";
import { runLogin } from "./auth/login.js";
import { isStorageStateValid } from "./auth/session.js";
import { acquireLock, releaseLock } from "./lib/lockfile.js";
import { fetchTopCharts, type TopChartGame } from "./fetchers/top-charts.js";
import { fetchGameIntelligence } from "./fetchers/game-intelligence.js";
import { fetchUsageIntelligence } from "./fetchers/usage-intelligence.js";
import { computeGenrePrior } from "./transformers/to-prior.js";
import { writeSnapshotAtomic, writeLastUpdated } from "./storage/snapshot-writer.js";
import { SnapshotSchema, type TopGame } from "./schemas/snapshot.js";
import { env } from "./config/env.js";
import { targets } from "./config/targets.js";
import { log } from "./lib/logger.js";

const LOCK_PATH = "./.crawler.lock";
const SNAPSHOT_NAME = `${targets.genre.toLowerCase()}-${targets.region.toLowerCase()}-snapshot.json`;
const CRAWLER_VERSION = "0.1.0";

async function runCrawl(opts: { dryRun?: boolean; limit?: number }): Promise<void> {
  const validity = isStorageStateValid(env.ST_STORAGE_STATE, env.ST_STORAGE_TTL_DAYS);
  if (!validity.valid) {
    log.error(`세션 무효 (${validity.reason}). 재로그인: npm run crawl:st:login`);
    process.exit(1);
  }
  if (!acquireLock(LOCK_PATH)) {
    log.error("다른 크롤 인스턴스가 실행 중입니다. 종료 후 재시도하거나 .crawler.lock 수동 삭제.");
    process.exit(1);
  }

  const warnings: string[] = [];
  const browser = await chromium.launch({ headless: env.ST_HEADLESS });
  const context = await browser.newContext({ storageState: env.ST_STORAGE_STATE });

  try {
    log.info(`수집 시작: ${targets.genre} × ${targets.region} × Top ${targets.topN}`);

    const topGames = await fetchTopCharts(context, opts.limit ?? targets.topN);
    if (topGames.length > targets.maxGamesPerRun) {
      throw new Error(`수집 게임 수(${topGames.length})가 안전 한도(${targets.maxGamesPerRun}) 초과`);
    }

    const enriched: TopGame[] = [];
    for (const game of topGames) {
      try {
        const gi = await fetchGameIntelligence(context, game);
        const ui = await fetchUsageIntelligence(context, game);
        enriched.push({
          rank: game.rank,
          name: game.name,
          publisher: game.publisher,
          appIds: game.appIds,
          downloads: gi.downloads,
          revenue: gi.revenue,
          retention: {
            d1: ui.d1, d7: ui.d7, d30: ui.d30,
            sampleSize: "ST estimate",
            fetchedAt: ui.fetchedAt,
          },
        });
      } catch (e) {
        const msg = `${game.name} 수집 실패: ${(e as Error).message}`;
        log.warn(msg);
        warnings.push(msg);
      }
    }

    if (enriched.length === 0) throw new Error("수집된 게임이 0개 — 부분 실패도 허용 안 함");

    const genrePrior = computeGenrePrior(enriched);

    const snapshot = {
      $schemaVersion: 1 as const,
      metadata: {
        fetchedAt: new Date().toISOString(),
        fetchedBy: "crawler@local",
        genre: targets.genre,
        region: targets.region,
        topN: enriched.length,
        tier: targets.chart,
        crawlerVersion: CRAWLER_VERSION,
        warnings,
      },
      topGames: enriched,
      genrePrior,
    };

    SnapshotSchema.parse(snapshot);

    if (opts.dryRun) {
      console.log(JSON.stringify(snapshot, null, 2));
      log.info("[DRY RUN] 파일 저장 생략");
    } else {
      const outDir = resolve(env.ST_DATA_OUT);
      writeSnapshotAtomic(outDir, SNAPSHOT_NAME, snapshot);
      writeLastUpdated(outDir, SNAPSHOT_NAME);
      log.info(`스냅샷 저장 완료: ${outDir}/${SNAPSHOT_NAME}`);
    }
  } finally {
    await context.close();
    await browser.close();
    releaseLock(LOCK_PATH);
  }
}

const program = new Command();
program
  .name("compass-crawler")
  .description("Project Compass — Sensor Tower 크롤러 (Merge × JP × Top 20)")
  .version(CRAWLER_VERSION);

program
  .option("--login", "헤드 브라우저로 ST에 직접 로그인하고 세션 저장")
  .option("--dry-run", "수집 결과를 stdout에만 출력 (파일 저장 안 함)")
  .option("--limit <n>", "처리할 게임 수 제한", parseInt)
  .action(async (opts: { login?: boolean; dryRun?: boolean; limit?: number }) => {
    if (opts.login) {
      await runLogin();
      return;
    }
    await runCrawl(opts);
  });

program.parse();
```

- [ ] **Step 2: typecheck**

```bash
cd crawler && npm run typecheck
```

Expected: 에러 없음

- [ ] **Step 3: dry-run 풀 플로우 (3개만 limit)**

```bash
cd "/Users/mike/Downloads/Project Compass" && npm run crawl:st -- --dry-run --limit 3
```

Expected: 3개 게임 + genrePrior가 들어간 완전한 snapshot JSON 출력. SnapshotSchema 검증 통과.

- [ ] **Step 4: 실제 풀 런 (Top 20)**

```bash
npm run crawl:st
```

Expected: `src/shared/api/data/sensor-tower/merge-jp-snapshot.json` 생성, `last-updated.json` 생성. 약 3-5분 소요.

- [ ] **Step 5: 결과 JSON 검증 (수동)**

```bash
cat "src/shared/api/data/sensor-tower/merge-jp-snapshot.json" | head -50
```

Expected: 메타데이터 + topGames 20개 + genrePrior 분포 모두 존재.

- [ ] **Step 6: 커밋**

```bash
git add crawler/src/index.ts "src/shared/api/data/sensor-tower/merge-jp-snapshot.json" "src/shared/api/data/sensor-tower/last-updated.json"
git commit -m "Phase 6.2: full crawl orchestration + first snapshot"
```

---

## Phase 7 — Compass 통합

### Task 7.1: prior-data.ts (Compass 측 진입점)

**Files:**
- Create: `src/shared/api/prior-data.ts`

- [ ] **Step 1: `src/shared/api/prior-data.ts` 작성**

```typescript
import { z } from "zod";
import snapshotJson from "./data/sensor-tower/merge-jp-snapshot.json";

const PercentileSchema = z.object({
  p10: z.number(), p50: z.number(), p90: z.number(),
});

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

const validated = SnapshotSchema.parse(snapshotJson);

export const priorByGenre = {
  Merge: { JP: validated.genrePrior },
} as const;

export const priorMetadata = validated.metadata;
export const priorTopGames = validated.topGames;

export function isPriorStale(maxDays = 14): boolean {
  const fetchedAt = new Date(priorMetadata.fetchedAt).getTime();
  const ageMs = Date.now() - fetchedAt;
  return ageMs > maxDays * 24 * 60 * 60 * 1000;
}

export function priorAgeDays(): number {
  const fetchedAt = new Date(priorMetadata.fetchedAt).getTime();
  return Math.floor((Date.now() - fetchedAt) / (24 * 60 * 60 * 1000));
}
```

- [ ] **Step 2: typecheck (Compass 루트)**

```bash
cd "/Users/mike/Downloads/Project Compass" && npx tsc --noEmit
```

Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add src/shared/api/prior-data.ts
git commit -m "Phase 7.1: prior-data.ts — Compass-side prior import with Zod validation"
```

---

### Task 7.2: prior-posterior-chart 위젯 갱신

**Files:**
- Modify: `src/widgets/charts/ui/prior-posterior-chart.tsx`

- [ ] **Step 1: 현재 prior 값을 어떻게 받고 있는지 확인**

```bash
grep -n "prior" "src/widgets/charts/ui/prior-posterior-chart.tsx"
```

(현재 mock-data에서 prior를 받는 변수명/형식 확인)

- [ ] **Step 2: 컴포넌트 수정 — mock prior를 priorByGenre.Merge.JP.retention.d7로 교체**

기존 mock prior import 라인을 다음으로 교체:

```typescript
import { priorByGenre } from "@/shared/api/prior-data";

// 컴포넌트 내부:
const mergeJpPrior = priorByGenre.Merge.JP.retention.d7;
// p10, p50, p90 사용
```

(실제 컴포넌트 코드의 형태에 맞게 prior 값 위치 매핑)

- [ ] **Step 3: 빌드 확인**

```bash
cd "/Users/mike/Downloads/Project Compass" && npm run build
```

Expected: 빌드 성공

- [ ] **Step 4: 시각 확인 (개발 서버)**

```bash
npm run dev
```

브라우저로 `/dashboard/market-gap` 접속 → PriorPosteriorChart가 렌더링되고 mock 대비 다른 값(실제 ST 데이터) 표시 확인.

- [ ] **Step 5: 커밋**

```bash
git add src/widgets/charts/ui/prior-posterior-chart.tsx
git commit -m "Phase 7.2: prior-posterior-chart uses real ST prior"
```

---

### Task 7.3: market-benchmark + retention-curve 갱신

**Files:**
- Modify: `src/widgets/charts/ui/market-benchmark.tsx`
- Modify: `src/widgets/charts/ui/retention-curve.tsx`

- [ ] **Step 1: market-benchmark.tsx — priorTopGames로 벤치마크 게임 리스트 표시**

기존 mock 데이터 import를 prior-data로 교체:

```typescript
import { priorTopGames } from "@/shared/api/prior-data";

// 기존 mock 게임 배열 → priorTopGames.slice(0, 5).map((g) => ({ name: g.name, value: g.retention.d7 }))
```

- [ ] **Step 2: retention-curve.tsx — P10/P50/P90 밴드를 prior로**

```typescript
import { priorByGenre } from "@/shared/api/prior-data";

const band = priorByGenre.Merge.JP.retention;
// d1, d7, d30 각각 p10/p50/p90 라인 그리기
```

- [ ] **Step 3: 빌드 + 시각 확인**

```bash
npm run build && npm run dev
```

`/dashboard`와 `/dashboard/market-gap`에서 두 차트 모두 실제 데이터로 렌더링.

- [ ] **Step 4: 커밋**

```bash
git add src/widgets/charts/ui/market-benchmark.tsx src/widgets/charts/ui/retention-curve.tsx
git commit -m "Phase 7.3: market-benchmark + retention-curve use real ST prior"
```

---

### Task 7.4: market-context-card 출처 표시 + status-bar stale 배지

**Files:**
- Modify: `src/widgets/dashboard/ui/market-context-card.tsx`
- Modify: `src/widgets/app-shell/ui/runway-status-bar.tsx`

- [ ] **Step 1: market-context-card.tsx 푸터에 출처 표시 추가**

컴포넌트 하단에 추가:

```tsx
import { priorMetadata } from "@/shared/api/prior-data";

// JSX 내부 (카드 하단):
<div className="text-fg-3 text-xs mt-2">
  Source: Sensor Tower · 수집일 {priorMetadata.fetchedAt.slice(0, 10)} · {priorMetadata.genre} {priorMetadata.region} Top {priorMetadata.topN}
</div>
```

- [ ] **Step 2: runway-status-bar.tsx에 stale 배지 조건부 표시**

```tsx
import { isPriorStale, priorAgeDays } from "@/shared/api/prior-data";

// 기존 metric 영역 옆에:
{isPriorStale() && (
  <div className="bg-signal-caution/10 text-signal-caution rounded-inline px-2 py-1 text-xs">
    Prior 데이터 {priorAgeDays()}일 경과 — npm run crawl:st 권장
  </div>
)}
```

- [ ] **Step 3: 빌드 + 시각 확인**

```bash
npm run build && npm run dev
```

`/dashboard`에서 market-context-card 푸터에 출처 표시. status bar는 데이터가 fresh하면 배지 숨김.

- [ ] **Step 4: stale 시뮬레이션 (수동)**

`prior-data.ts`의 `isPriorStale()` 호출을 임시로 `true` 리턴하게 바꿔 배지 노출 확인 후 원복.

- [ ] **Step 5: 커밋**

```bash
git add src/widgets/dashboard/ui/market-context-card.tsx src/widgets/app-shell/ui/runway-status-bar.tsx
git commit -m "Phase 7.4: ST source footer + stale prior badge in status bar"
```

---

## Phase 8 — 문서화

### Task 8.1: crawler/README.md

**Files:**
- Create: `crawler/README.md`

- [ ] **Step 1: README 작성**

```markdown
# Compass Crawler — Sensor Tower

Project Compass의 Bayesian Prior 데이터(장르 기대치)를 Sensor Tower에서 수집하는 로컬 CLI.

> **회사 내부 사용 한정.** ST 사내 구독 데이터를 가공한 결과물. 외부 배포·재판매 금지.

## 첫 실행 가이드

### 1. 의존성 설치

```bash
cd crawler
npm install
npx playwright install chromium
```

### 2. 환경 파일 준비

```bash
cp .env.example .env
# 필요시 .env 편집 (기본값으로 시작 권장)
```

> **주의**: 이메일/비밀번호는 의도적으로 받지 않습니다. 수동 로그인이 가장 안전합니다.

### 3. 로그인

```bash
npm run crawl:st:login
```

- 헤드 Chromium이 열림
- ST 로그인 페이지에서 직접 로그인 (2FA 포함 완료)
- 대시보드가 보이면 콘솔로 돌아와 Enter
- `crawler/storageState.json`에 세션 저장 (gitignore됨, chmod 600)

### 4. dry-run 검증

```bash
npm run crawl:st:dry
```

1개 게임만 수집해 stdout으로 출력. ST 웹 화면과 값 비교.

### 5. 풀 크롤

```bash
npm run crawl:st
```

Top 20 게임 수집 후 `src/shared/api/data/sensor-tower/merge-jp-snapshot.json` 갱신. 약 3-5분 소요.

## 트러블슈팅

| 증상 | 원인 / 해결 |
|------|-------------|
| `세션이 유효하지 않습니다 (이유: missing)` | 첫 실행 — `npm run crawl:st:login` |
| `세션이 유효하지 않습니다 (이유: expired)` | 30일 경과 — 재로그인 |
| `XHR timeout for pattern: ...` | ST UI 변경 가능성. `crawler/docs/st-xhr-endpoints.md` 갱신 후 fetcher 패턴 수정 |
| `다른 크롤 인스턴스가 실행 중` | `crawler/.crawler.lock` 파일 수동 삭제 |
| `수집된 게임이 0개` | 모든 fetcher 실패. `crawler/debug-screenshots/` 확인 |

## 권장 운영

- 주 1회 (월요일 아침) 실행
- 결과 JSON git 커밋 → diff로 시장 변화 추적
- 14일 초과 시 Compass UI에 stale 배지 자동 노출

## ToS 및 보안 메모

- 이 도구는 **사내 ST 구독자**가 본인 계정으로 직접 로그인한 세션에서 동작
- 수집 결과는 사내 의사결정 용도로만 사용
- `storageState.json`, `.env`, `debug-screenshots/`는 `.gitignore`로 보호 — 절대 커밋 금지
- 비밀번호는 코드/환경변수에 저장하지 않음 (의도적 설계 결정)
```

- [ ] **Step 2: 커밋**

```bash
git add crawler/README.md
git commit -m "Phase 8.1: crawler README with first-run guide"
```

---

### Task 8.2: 루트 CLAUDE.md 보강

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: 새 섹션 "9. 외부 데이터 갱신" 추가**

기존 CLAUDE.md 끝(Section 8 뒤)에 추가:

```markdown
---

## 9. 외부 데이터 갱신 (Sensor Tower 크롤러)

Compass의 Bayesian Prior(장르 기대치) 데이터는 `crawler/` 패키지가 Sensor Tower 웹 대시보드에서 수집해 `src/shared/api/data/sensor-tower/merge-jp-snapshot.json`에 저장합니다.

### 운영
- 주 1회 수동 실행: `npm run crawl:st`
- 30일마다 재로그인: `npm run crawl:st:login`
- 1개 게임 디버그: `npm run crawl:st:dry`

### 코드 진입점
- 크롤러: `crawler/src/index.ts`
- Compass 측 import: `src/shared/api/prior-data.ts` (`priorByGenre`, `priorTopGames`, `isPriorStale()`)
- 설계 스펙: `docs/superpowers/specs/2026-04-20-sensortower-crawler-design.md`

### 안전
- 비밀번호 저장 안 함 — 항상 사람이 직접 로그인
- `crawler/storageState.json`, `crawler/.env`는 절대 커밋 금지 (`.gitignore`로 차단)
- 14일 경과 시 Compass UI에 stale 배지 자동 표시

### 트러블슈팅
`crawler/README.md` 참조.
```

- [ ] **Step 2: 커밋**

```bash
git add CLAUDE.md
git commit -m "Phase 8.2: CLAUDE.md — external data refresh section"
```

---

### Task 8.3: 최종 검증

**Files:** (변경 없음, 검증만)

- [ ] **Step 1: 전체 typecheck (루트 + crawler)**

```bash
cd "/Users/mike/Downloads/Project Compass" && npx tsc --noEmit
cd crawler && npm run typecheck
```

Expected: 양쪽 다 에러 없음

- [ ] **Step 2: 전체 단위 테스트 (crawler)**

```bash
cd crawler && npm test
```

Expected: 모든 테스트 PASS (humanlike-delay, lockfile, session, xhr-intercept, snapshot schema, to-prior, snapshot-writer)

- [ ] **Step 3: Compass 프로덕션 빌드**

```bash
cd "/Users/mike/Downloads/Project Compass" && npm run build
```

Expected: 빌드 성공, 정적 export 6개 페이지

- [ ] **Step 4: 풀 크롤 1회 (실제 ST 호출)**

```bash
npm run crawl:st
```

Expected: 스냅샷 갱신, 변경된 JSON git diff에 표시

- [ ] **Step 5: dev 서버에서 실제 데이터 시각 확인**

```bash
npm run dev
```

브라우저로 `/dashboard`, `/dashboard/market-gap` 접속:
- PriorPosteriorChart: 실제 ST prior 분포
- MarketBenchmark: ST Top 게임 리스트
- RetentionCurve: 실제 P10/P50/P90 밴드
- MarketContextCard: 출처 푸터
- StatusBar: stale 배지 (없거나 fresh 상태)

- [ ] **Step 6: 최종 커밋 (snapshot 갱신분)**

```bash
git add "src/shared/api/data/sensor-tower/merge-jp-snapshot.json" "src/shared/api/data/sensor-tower/last-updated.json"
git commit -m "Phase 8.3: refresh ST snapshot after full integration verification"
```

---

## 완료 체크리스트

- [ ] `crawler/` 패키지 자체 테스트 모두 통과
- [ ] `crawler/storageState.json`이 `.gitignore`에 포함되어 커밋 안 됨
- [ ] `npm run crawl:st`가 에러 없이 끝남
- [ ] Compass `/dashboard`에서 실제 ST 데이터 렌더링
- [ ] Stale 배지 로직 작동 (수동 시뮬레이션 확인)
- [ ] `crawler/README.md` 따라 신규 사용자가 첫 크롤 가능
- [ ] CLAUDE.md "9. 외부 데이터 갱신" 섹션 존재
- [ ] `docs/superpowers/specs/2026-04-20-sensortower-crawler-design.md` 그대로 유지

---

## 향후 확장 (이 plan 범위 밖)

- 다중 장르/지역 (Merge × US, Casual × KR 등) — 출력 JSON 분할
- GitHub Actions 주간 자동화 (회사 정책 확인 필요)
- ST 공식 API 키 도입 시 fetcher 인터페이스 추상화
- 추가 prior 지표: ARPDAU, session length, ad spend
