# AppsFlyer API Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** AppsFlyer Master + Cohort API를 호출해 `snapshot.json`을 생성하고, Connections 페이지의 AppsFlyer 카드만 라이브 반영하는 포트폴리오 데모 파이프라인을 완성한다.

**Architecture:** 공유 코어 `src/shared/api/appsflyer/` (순수 fetcher + snapshot reader/writer) 위에 CLI 스크립트(`scripts/fetch-appsflyer.ts`)와 Next.js API 라우트(`/api/appsflyer/sync`) 두 진입점을 배치한다. 스냅샷은 JSON 파일로 저장하여 SensorTower 크롤러와 동일한 파일 기반 패턴을 유지한다.

**Tech Stack:** Next.js 16 App Router, TypeScript 5, Zod (신규), Node 22 내장 test runner via `tsx`, 기존 Tailwind v4 / Radix UI / Zustand.

**Spec Reference:** `docs/superpowers/specs/2026-04-20-appsflyer-api-pipeline-design.md`

---

## File Structure

**Create:**
- `src/shared/api/appsflyer/index.ts` — 배럴 export + `runAppsFlyerSync`
- `src/shared/api/appsflyer/types.ts` — Zod 스키마 + 파생 TS 타입
- `src/shared/api/appsflyer/errors.ts` — 5종 에러 클래스
- `src/shared/api/appsflyer/client.ts` — fetch + 재시도 + 타임아웃
- `src/shared/api/appsflyer/fetcher.ts` — `fetchMasterAggregate`, `fetchCohortRetention`
- `src/shared/api/appsflyer/snapshot-derive.ts` — 순수 derivation (client-safe)
- `src/shared/api/appsflyer/snapshot.ts` — fs write/read + `getAppsFlyerCardData` (server-only)
- `src/shared/api/appsflyer/__fixtures__/master.json` — 샘플 응답
- `src/shared/api/appsflyer/__fixtures__/cohort.json` — 샘플 응답
- `src/shared/api/appsflyer/__tests__/snapshot.test.ts`
- `src/shared/api/appsflyer/__tests__/client.test.ts`
- `src/shared/api/appsflyer/__tests__/fetcher.test.ts`
- `src/shared/api/appsflyer/__tests__/card-data.test.ts`
- `src/shared/api/data/appsflyer/snapshot.json` — 초기 빈 스냅샷
- `src/shared/api/data/appsflyer/.gitkeep` — 디렉토리 유지
- `src/app/api/appsflyer/sync/route.ts` — POST handler
- `scripts/fetch-appsflyer.ts` — CLI 진입점
- `.env.example` — 키 템플릿

**Modify:**
- `package.json` — `zod` dep, `fetch:af` 스크립트
- `.gitignore` — `.env.local` 추가
- `src/shared/api/mock-connections.ts` — AppsFlyer 하드코드 제거
- `src/widgets/connections/ui/connection-card.tsx` — 런타임 머지 분기
- `src/widgets/connections/ui/connection-dialog.tsx` — 실 API 호출로 교체

---

## Stage 1 — Foundation (타입 + 에러 + 픽스처)

### Task 1.1: Zod 설치 + 디렉토리 구조 생성

**Files:**
- Modify: `/Users/mike/Downloads/Project Compass/package.json`

- [ ] **Step 1: Zod 설치**

```bash
cd "/Users/mike/Downloads/Project Compass"
npm install zod --legacy-peer-deps
```

Expected: `zod` added to `dependencies` in package.json, no peer conflict errors.

- [ ] **Step 2: 디렉토리 생성**

```bash
mkdir -p "src/shared/api/appsflyer/__fixtures__"
mkdir -p "src/shared/api/appsflyer/__tests__"
mkdir -p "src/shared/api/data/appsflyer"
mkdir -p "src/app/api/appsflyer/sync"
mkdir -p "scripts"
```

- [ ] **Step 3: 빈 디렉토리 git 추적용 .gitkeep**

Create `src/shared/api/data/appsflyer/.gitkeep` (empty file).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/shared/api/data/appsflyer/.gitkeep
git commit -m "feat(appsflyer): add zod dep and directory skeleton"
```

---

### Task 1.2: 에러 클래스 정의

**Files:**
- Create: `src/shared/api/appsflyer/errors.ts`

- [ ] **Step 1: 에러 클래스 작성**

Create `src/shared/api/appsflyer/errors.ts`:

```ts
/**
 * AppsFlyer 파이프라인 에러 계층.
 * 호출자(CLI / API route)가 종류별로 분기 처리할 수 있도록 구체 클래스로 분리.
 */

export class AppsFlyerError extends Error {
  readonly code: string
  constructor(code: string, message: string) {
    super(message)
    this.name = "AppsFlyerError"
    this.code = code
  }
}

export class AuthError extends AppsFlyerError {
  constructor(message = "AppsFlyer authentication failed") {
    super("invalid_token", message)
    this.name = "AuthError"
  }
}

export class RateLimitError extends AppsFlyerError {
  readonly retryAfterSec: number
  constructor(retryAfterSec: number, message = "AppsFlyer rate limit exceeded") {
    super("rate_limited", message)
    this.name = "RateLimitError"
    this.retryAfterSec = retryAfterSec
  }
}

export class TimeoutError extends AppsFlyerError {
  constructor(message = "AppsFlyer request timed out") {
    super("timeout", message)
    this.name = "TimeoutError"
  }
}

export class ValidationError extends AppsFlyerError {
  readonly path: string
  constructor(path: string, message: string) {
    super("schema_mismatch", message)
    this.name = "ValidationError"
    this.path = path
  }
}

export class NetworkError extends AppsFlyerError {
  constructor(message = "AppsFlyer network error") {
    super("network", message)
    this.name = "NetworkError"
  }
}
```

- [ ] **Step 2: 타입 체크**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/shared/api/appsflyer/errors.ts
git commit -m "feat(appsflyer): add error classes"
```

---

### Task 1.3: Zod 스키마 + 타입 정의

**Files:**
- Create: `src/shared/api/appsflyer/types.ts`

- [ ] **Step 1: 스키마 작성**

Create `src/shared/api/appsflyer/types.ts`:

```ts
import { z } from "zod"

/* ─────────── 호출 파라미터 ─────────── */

export const MasterParamsSchema = z.object({
  appId: z.string().min(1),
  reportType: z.string().min(1),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  groupings: z.array(z.string()),
  kpis: z.array(z.string()),
  extraQuery: z.record(z.string(), z.string()).optional(),
})
export type MasterParams = z.infer<typeof MasterParamsSchema>

export const CohortParamsSchema = z.object({
  appId: z.string().min(1),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  cohortType: z.enum(["user_acquisition", "event"]),
  groupings: z.array(z.string()),
  kpis: z.array(z.string()),
  perUser: z.boolean().optional(),
})
export type CohortParams = z.infer<typeof CohortParamsSchema>

/* ─────────── 응답 Row (느슨) ─────────── */

export const MasterRowSchema = z.record(z.string(), z.union([z.string(), z.number()]))
export type MasterRow = z.infer<typeof MasterRowSchema>

export const CohortRowSchema = z.record(z.string(), z.union([z.string(), z.number()]))
export type CohortRow = z.infer<typeof CohortRowSchema>

/* ─────────── 스냅샷 ─────────── */

export const SnapshotSchema = z.object({
  version: z.literal(1),
  fetchedAt: z.string().datetime(),
  request: z.object({
    master: MasterParamsSchema.nullable(),
    cohort: CohortParamsSchema.nullable(),
  }),
  master: z.object({ rows: z.array(MasterRowSchema) }).nullable(),
  cohort: z.object({ rows: z.array(CohortRowSchema) }).nullable(),
  meta: z.object({ warnings: z.array(z.string()) }),
})
export type AppsFlyerSnapshot = z.infer<typeof SnapshotSchema>

/* ─────────── API Route 요청 body ─────────── */

export const SyncRequestSchema = z.object({
  dev_token: z.string().min(1),
  home_currency: z.enum(["KRW", "USD", "JPY", "EUR"]),
  app_ids: z.string().min(1),
  sync_frequency: z.string(),
  dry_run: z.boolean().optional(),
})
export type SyncRequest = z.infer<typeof SyncRequestSchema>

export type HomeCurrency = z.infer<typeof SyncRequestSchema>["home_currency"]

/* ─────────── runAppsFlyerSync 인자/반환 ─────────── */

export type RunSyncOptions = {
  devToken: string
  appIds: string[]
  homeCurrency: HomeCurrency
  master: MasterParams | null
  cohort: CohortParams | null
}

export type RunSyncResult = {
  snapshot: AppsFlyerSnapshot
  warnings: string[]
  summary: {
    masterRows: number
    cohortRows: number
    durationMs: number
  }
}

/* ─────────── UI 카드 파생 ─────────── */

export type ConnectionStatusLive =
  | "connected" | "warn" | "error" | "disconnected"

export type AppsFlyerCardData = {
  status: ConnectionStatusLive
  lastSync: string
  metrics: Array<{ label: string; value: string }>
  retentionDepth: string | null
}

export const EMPTY_CARD: AppsFlyerCardData = {
  status: "disconnected",
  lastSync: "아직 sync 없음",
  metrics: [],
  retentionDepth: null,
}
```

- [ ] **Step 2: 타입 체크**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/shared/api/appsflyer/types.ts
git commit -m "feat(appsflyer): add zod schemas and types"
```

---

### Task 1.4: 픽스처 JSON 작성

**Files:**
- Create: `src/shared/api/appsflyer/__fixtures__/master.json`
- Create: `src/shared/api/appsflyer/__fixtures__/cohort.json`

- [ ] **Step 1: Master 픽스처**

Create `src/shared/api/appsflyer/__fixtures__/master.json`:

```json
{
  "data": [
    {
      "date": "2026-04-18",
      "pid": "google_int",
      "installs": 42,
      "non_organic_installs": 38,
      "cost": 0,
      "impressions": 12400,
      "clicks": 510
    },
    {
      "date": "2026-04-19",
      "pid": "facebook",
      "installs": 15,
      "non_organic_installs": 12,
      "cost": 0,
      "impressions": 8800,
      "clicks": 211
    }
  ]
}
```

- [ ] **Step 2: Cohort 픽스처**

Create `src/shared/api/appsflyer/__fixtures__/cohort.json`:

```json
{
  "data": [
    {
      "cohort_date": "2026-04-15",
      "pid": "google_int",
      "size": 38,
      "retention_day_0": 1.0,
      "retention_day_1": 0.42,
      "retention_day_3": 0.18
    },
    {
      "cohort_date": "2026-04-16",
      "pid": "facebook",
      "size": 12,
      "retention_day_0": 1.0,
      "retention_day_1": 0.33,
      "retention_day_3": 0.17
    }
  ]
}
```

- [ ] **Step 3: Commit**

```bash
git add src/shared/api/appsflyer/__fixtures__/
git commit -m "feat(appsflyer): add api response fixtures"
```

---

## Stage 2 — HTTP Client + Fetcher

### Task 2.1: HTTP Client (타임아웃 + 재시도)

**Files:**
- Create: `src/shared/api/appsflyer/client.ts`
- Create: `src/shared/api/appsflyer/__tests__/client.test.ts`

- [ ] **Step 1: 테스트 작성 — 타임아웃**

Create `src/shared/api/appsflyer/__tests__/client.test.ts`:

```ts
import { test } from "node:test"
import assert from "node:assert/strict"
import { createServer } from "node:http"
import type { AddressInfo } from "node:net"
import { afHttp } from "../client"
import { TimeoutError, RateLimitError, AuthError } from "../errors"

function startServer(handler: (req: import("http").IncomingMessage, res: import("http").ServerResponse) => void) {
  const server = createServer(handler)
  return new Promise<{ url: string; close: () => Promise<void> }>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const port = (server.address() as AddressInfo).port
      resolve({
        url: `http://127.0.0.1:${port}`,
        close: () => new Promise((r) => server.close(() => r())),
      })
    })
  })
}

test("afHttp: throws TimeoutError when server never responds", async () => {
  const { url, close } = await startServer(() => {
    /* never respond */
  })
  try {
    await assert.rejects(
      () => afHttp({ url, method: "GET", token: "t", timeoutMs: 100, maxRetries: 0 }),
      (err: unknown) => err instanceof TimeoutError,
    )
  } finally {
    await close()
  }
})
```

- [ ] **Step 2: Run test — expect FAIL (client not implemented)**

```bash
cd "/Users/mike/Downloads/Project Compass"
npx tsx --test src/shared/api/appsflyer/__tests__/client.test.ts
```

Expected: FAIL with "Cannot find module '../client'".

- [ ] **Step 3: Client 구현**

Create `src/shared/api/appsflyer/client.ts`:

```ts
import {
  AuthError,
  NetworkError,
  RateLimitError,
  TimeoutError,
} from "./errors"

export type AfHttpOptions = {
  url: string
  method: "GET" | "POST"
  token: string
  body?: unknown
  query?: Record<string, string>
  timeoutMs?: number
  maxRetries?: number
}

const DEFAULT_TIMEOUT_MS = 30_000
const DEFAULT_MAX_RETRIES = 3

export async function afHttp(opts: AfHttpOptions): Promise<unknown> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const maxRetries = opts.maxRetries ?? DEFAULT_MAX_RETRIES

  const url = new URL(opts.url)
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) url.searchParams.set(k, v)
  }

  const doRequest = async (): Promise<unknown> => {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeoutMs)
    try {
      const res = await fetch(url, {
        method: opts.method,
        headers: {
          Authorization: `Bearer ${opts.token}`,
          Accept: "application/json",
          ...(opts.method === "POST" ? { "Content-Type": "application/json" } : {}),
        },
        body: opts.method === "POST" && opts.body !== undefined
          ? JSON.stringify(opts.body)
          : undefined,
        signal: ctrl.signal,
      })

      if (res.status === 401 || res.status === 403) {
        throw new AuthError(`HTTP ${res.status}`)
      }
      if (res.status === 429) {
        const retryAfter = Number(res.headers.get("retry-after") ?? "1")
        throw new RateLimitError(Number.isFinite(retryAfter) ? retryAfter : 1)
      }
      if (!res.ok) {
        throw new NetworkError(`HTTP ${res.status}`)
      }
      return (await res.json()) as unknown
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        throw new TimeoutError()
      }
      throw err
    } finally {
      clearTimeout(timer)
    }
  }

  let lastErr: unknown
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await doRequest()
    } catch (err) {
      lastErr = err
      if (err instanceof AuthError) throw err
      if (attempt === maxRetries) break
      const backoffMs =
        err instanceof RateLimitError
          ? err.retryAfterSec * 1000
          : Math.min(4000, 1000 * 2 ** attempt)
      await new Promise((r) => setTimeout(r, backoffMs))
    }
  }
  throw lastErr
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
npx tsx --test src/shared/api/appsflyer/__tests__/client.test.ts
```

Expected: 1 test passed.

- [ ] **Step 5: 테스트 추가 — 401 → AuthError 즉시 (재시도 없음)**

Append to `src/shared/api/appsflyer/__tests__/client.test.ts`:

```ts
test("afHttp: throws AuthError on 401 without retry", async () => {
  let calls = 0
  const { url, close } = await startServer((_req, res) => {
    calls++
    res.statusCode = 401
    res.end()
  })
  try {
    await assert.rejects(
      () => afHttp({ url, method: "GET", token: "t", maxRetries: 3 }),
      (err: unknown) => err instanceof AuthError,
    )
    assert.equal(calls, 1, "401 should not be retried")
  } finally {
    await close()
  }
})
```

- [ ] **Step 6: 테스트 추가 — 429 후 성공 (재시도 검증)**

Append:

```ts
test("afHttp: retries on 429 and succeeds", async () => {
  let calls = 0
  const { url, close } = await startServer((_req, res) => {
    calls++
    if (calls < 3) {
      res.statusCode = 429
      res.setHeader("retry-after", "0")
      res.end()
      return
    }
    res.statusCode = 200
    res.setHeader("content-type", "application/json")
    res.end(JSON.stringify({ ok: true }))
  })
  try {
    const result = await afHttp({ url, method: "GET", token: "t", maxRetries: 3 })
    assert.deepEqual(result, { ok: true })
    assert.equal(calls, 3)
  } finally {
    await close()
  }
})
```

- [ ] **Step 7: Run all client tests — expect PASS**

```bash
npx tsx --test src/shared/api/appsflyer/__tests__/client.test.ts
```

Expected: 3 tests passed.

- [ ] **Step 8: Commit**

```bash
git add src/shared/api/appsflyer/client.ts src/shared/api/appsflyer/__tests__/client.test.ts
git commit -m "feat(appsflyer): http client with timeout + retry"
```

---

### Task 2.2: Fetcher (Master + Cohort) + 픽스처 Contract 테스트

**Files:**
- Create: `src/shared/api/appsflyer/fetcher.ts`
- Create: `src/shared/api/appsflyer/__tests__/fetcher.test.ts`

- [ ] **Step 1: Contract 테스트 작성**

Create `src/shared/api/appsflyer/__tests__/fetcher.test.ts`:

```ts
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"
import { parseMasterRows, parseCohortRows } from "../fetcher"

const __dirname = dirname(fileURLToPath(import.meta.url))

test("parseMasterRows: accepts fixture shape", () => {
  const raw = JSON.parse(
    readFileSync(resolve(__dirname, "../__fixtures__/master.json"), "utf-8"),
  )
  const rows = parseMasterRows(raw)
  assert.equal(rows.length, 2)
  assert.equal(rows[0].date, "2026-04-18")
  assert.equal(rows[0].installs, 42)
})

test("parseCohortRows: accepts fixture shape", () => {
  const raw = JSON.parse(
    readFileSync(resolve(__dirname, "../__fixtures__/cohort.json"), "utf-8"),
  )
  const rows = parseCohortRows(raw)
  assert.equal(rows.length, 2)
  assert.equal(rows[0].retention_day_1, 0.42)
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npx tsx --test src/shared/api/appsflyer/__tests__/fetcher.test.ts
```

Expected: FAIL with "Cannot find module '../fetcher'".

- [ ] **Step 3: Fetcher 구현**

Create `src/shared/api/appsflyer/fetcher.ts`:

```ts
import { afHttp } from "./client"
import { ValidationError } from "./errors"
import {
  CohortRowSchema,
  MasterRowSchema,
  type CohortParams,
  type CohortRow,
  type MasterParams,
  type MasterRow,
} from "./types"
import { z } from "zod"

const MASTER_BASE = "https://hq1.appsflyer.com/api/master-agg-data/v4/app"
const COHORT_BASE = "https://hq1.appsflyer.com/api/cohorts/v1/data/app"

const MasterResponseSchema = z.object({ data: z.array(z.record(z.string(), z.any())) })
const CohortResponseSchema = z.object({ data: z.array(z.record(z.string(), z.any())) })

export function parseMasterRows(raw: unknown): MasterRow[] {
  const parsed = MasterResponseSchema.safeParse(raw)
  if (!parsed.success) {
    throw new ValidationError("master.response", parsed.error.message)
  }
  return parsed.data.data.map((row) => {
    const r = MasterRowSchema.safeParse(row)
    if (!r.success) throw new ValidationError("master.row", r.error.message)
    return r.data
  })
}

export function parseCohortRows(raw: unknown): CohortRow[] {
  const parsed = CohortResponseSchema.safeParse(raw)
  if (!parsed.success) {
    throw new ValidationError("cohort.response", parsed.error.message)
  }
  return parsed.data.data.map((row) => {
    const r = CohortRowSchema.safeParse(row)
    if (!r.success) throw new ValidationError("cohort.row", r.error.message)
    return r.data
  })
}

export async function fetchMasterAggregate(
  devToken: string,
  params: MasterParams,
): Promise<MasterRow[]> {
  const url = `${MASTER_BASE}/${encodeURIComponent(params.appId)}/${encodeURIComponent(params.reportType)}`
  const query: Record<string, string> = {
    from: params.from,
    to: params.to,
    groupings: params.groupings.join(","),
    kpis: params.kpis.join(","),
    format: "json",
    ...(params.extraQuery ?? {}),
  }
  const raw = await afHttp({ url, method: "GET", token: devToken, query })
  return parseMasterRows(raw)
}

export async function fetchCohortRetention(
  devToken: string,
  params: CohortParams,
): Promise<CohortRow[]> {
  const url = `${COHORT_BASE}/${encodeURIComponent(params.appId)}`
  const body = {
    cohort_type: params.cohortType,
    from: params.from,
    to: params.to,
    groupings: params.groupings,
    kpis: params.kpis,
    per_user: params.perUser ?? false,
  }
  const raw = await afHttp({ url, method: "POST", token: devToken, body })
  return parseCohortRows(raw)
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
npx tsx --test src/shared/api/appsflyer/__tests__/fetcher.test.ts
```

Expected: 2 tests passed.

- [ ] **Step 5: Commit**

```bash
git add src/shared/api/appsflyer/fetcher.ts src/shared/api/appsflyer/__tests__/fetcher.test.ts
git commit -m "feat(appsflyer): master + cohort fetchers with zod validation"
```

---

### Task 2.3: `runAppsFlyerSync` 공유 코어 + `index.ts`

**Files:**
- Create: `src/shared/api/appsflyer/index.ts`

- [ ] **Step 1: 공유 코어 + 배럴 작성**

Create `src/shared/api/appsflyer/index.ts`:

```ts
import { fetchCohortRetention, fetchMasterAggregate } from "./fetcher"
import type {
  AppsFlyerSnapshot,
  CohortRow,
  MasterRow,
  RunSyncOptions,
  RunSyncResult,
} from "./types"

export * from "./types"
export * from "./errors"
export { afHttp } from "./client"
export { fetchMasterAggregate, fetchCohortRetention } from "./fetcher"
export {
  readSnapshot,
  writeSnapshot,
  getAppsFlyerCardData,
  deriveStatus,
} from "./snapshot"

export async function runAppsFlyerSync(
  opts: RunSyncOptions,
): Promise<RunSyncResult> {
  const started = Date.now()
  const warnings: string[] = []

  let masterRows: MasterRow[] = []
  let cohortRows: CohortRow[] = []

  if (opts.master) {
    try {
      masterRows = await fetchMasterAggregate(opts.devToken, opts.master)
    } catch (err) {
      warnings.push(`master fetch failed: ${(err as Error).message}`)
      throw err
    }
  }

  if (opts.cohort) {
    try {
      cohortRows = await fetchCohortRetention(opts.devToken, opts.cohort)
    } catch (err) {
      warnings.push(`cohort fetch failed: ${(err as Error).message}`)
      throw err
    }
  }

  const snapshot: AppsFlyerSnapshot = {
    version: 1,
    fetchedAt: new Date().toISOString(),
    request: { master: opts.master, cohort: opts.cohort },
    master: opts.master ? { rows: masterRows } : null,
    cohort: opts.cohort ? { rows: cohortRows } : null,
    meta: { warnings },
  }

  return {
    snapshot,
    warnings,
    summary: {
      masterRows: masterRows.length,
      cohortRows: cohortRows.length,
      durationMs: Date.now() - started,
    },
  }
}
```

- [ ] **Step 2: 타입 체크 (snapshot.ts는 아직 없으므로 일시 오류 — Stage 3에서 해결)**

```bash
npx tsc --noEmit 2>&1 | head
```

Expected: "Cannot find module './snapshot'" — next task이 해결.

- [ ] **Step 3: Commit (빌드 가능 상태 도달 후 한꺼번에)**

계속 Stage 3 Task 3.1로 진행.

---

## Stage 3 — Snapshot Persistence

### Task 3.1: Snapshot 읽기/쓰기 + 카드 파생 + 초기 빈 파일

**Files:**
- Create: `src/shared/api/appsflyer/snapshot-derive.ts` — 순수 함수 (client-safe, node:fs 미사용)
- Create: `src/shared/api/appsflyer/snapshot.ts` — fs 접근 (server-only, snapshot-derive 재export)
- Create: `src/shared/api/data/appsflyer/snapshot.json`
- Create: `src/shared/api/appsflyer/__tests__/snapshot.test.ts`
- Create: `src/shared/api/appsflyer/__tests__/card-data.test.ts`

**분리 이유**: Connections 카드는 `"use client"` 컴포넌트 → `node:fs`를 번들하면 빌드 실패. 파생 로직(`deriveCardFromSnapshot`, `deriveStatus`, `formatRelative`)은 순수 함수로 분리하여 클라이언트에서 정적 JSON import와 함께 사용.

- [ ] **Step 1: 초기 빈 스냅샷 파일**

Create `src/shared/api/data/appsflyer/snapshot.json`:

```json
{
  "version": 1,
  "fetchedAt": "1970-01-01T00:00:00.000Z",
  "request": { "master": null, "cohort": null },
  "master": null,
  "cohort": null,
  "meta": { "warnings": ["initial empty snapshot — pipeline not yet run"] }
}
```

- [ ] **Step 2: Snapshot 테스트 작성**

Create `src/shared/api/appsflyer/__tests__/snapshot.test.ts`:

```ts
import { test } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { readSnapshotFrom, writeSnapshotTo } from "../snapshot"
import { deriveStatus } from "../snapshot-derive"
import type { AppsFlyerSnapshot } from "../types"

function tmp(): string {
  return join(mkdtempSync(join(tmpdir(), "af-")), "snap.json")
}

const makeSnap = (fetchedAt: string): AppsFlyerSnapshot => ({
  version: 1,
  fetchedAt,
  request: { master: null, cohort: null },
  master: null,
  cohort: null,
  meta: { warnings: [] },
})

test("writeSnapshotTo + readSnapshotFrom: round-trip", () => {
  const path = tmp()
  const snap = makeSnap(new Date("2026-04-20T00:00:00Z").toISOString())
  writeSnapshotTo(path, snap)
  const read = readSnapshotFrom(path)
  assert.deepEqual(read, snap)
})

test("readSnapshotFrom: returns null on missing file", () => {
  const path = join(mkdtempSync(join(tmpdir(), "af-")), "missing.json")
  assert.equal(readSnapshotFrom(path), null)
})

test("readSnapshotFrom: throws on version mismatch", () => {
  const path = tmp()
  writeFileSync(path, JSON.stringify({ version: 99, fetchedAt: "x" }))
  assert.throws(() => readSnapshotFrom(path))
})

test("deriveStatus: thresholds", () => {
  const now = Date.now()
  assert.equal(
    deriveStatus(new Date(now - 23 * 3_600_000).toISOString()),
    "connected",
  )
  assert.equal(
    deriveStatus(new Date(now - 25 * 3_600_000).toISOString()),
    "warn",
  )
  assert.equal(
    deriveStatus(new Date(now - 6 * 24 * 3_600_000).toISOString()),
    "warn",
  )
  assert.equal(
    deriveStatus(new Date(now - 8 * 24 * 3_600_000).toISOString()),
    "error",
  )
})
```

- [ ] **Step 3: Card-data 테스트 작성**

Create `src/shared/api/appsflyer/__tests__/card-data.test.ts`:

```ts
import { test } from "node:test"
import assert from "node:assert/strict"
import { deriveCardFromSnapshot } from "../snapshot-derive"
import type { AppsFlyerSnapshot } from "../types"

const base: AppsFlyerSnapshot = {
  version: 1,
  fetchedAt: new Date().toISOString(),
  request: { master: null, cohort: null },
  master: null,
  cohort: null,
  meta: { warnings: [] },
}

test("deriveCardFromSnapshot: empty → only lastSync, no metrics", () => {
  const card = deriveCardFromSnapshot(base)
  assert.equal(card.status, "connected")
  assert.equal(card.metrics.length, 0)
  assert.equal(card.retentionDepth, null)
})

test("deriveCardFromSnapshot: master rows → installs metric", () => {
  const snap: AppsFlyerSnapshot = {
    ...base,
    master: {
      rows: [
        { date: "2026-04-18", installs: 42, non_organic_installs: 38, cost: 0 },
        { date: "2026-04-19", installs: 15, non_organic_installs: 12, cost: 0 },
      ],
    },
  }
  const card = deriveCardFromSnapshot(snap)
  const installs = card.metrics.find((m) => m.label === "설치")
  assert.equal(installs?.value, "57")
  const cpi = card.metrics.find((m) => m.label === "CPI")
  assert.equal(cpi, undefined, "cost=0 → CPI excluded")
})

test("deriveCardFromSnapshot: cohort rows → retentionDepth", () => {
  const snap: AppsFlyerSnapshot = {
    ...base,
    cohort: {
      rows: [
        {
          cohort_date: "2026-04-18",
          size: 38,
          retention_day_0: 1,
          retention_day_1: 0.42,
          retention_day_3: 0.18,
        },
      ],
    },
  }
  const card = deriveCardFromSnapshot(snap)
  assert.equal(card.retentionDepth, "D3")
})
```

- [ ] **Step 4: Run tests — expect FAIL**

```bash
npx tsx --test src/shared/api/appsflyer/__tests__/snapshot.test.ts src/shared/api/appsflyer/__tests__/card-data.test.ts
```

Expected: FAIL (snapshot.ts not implemented).

- [ ] **Step 5a: 순수 derivation 모듈 작성 (client-safe)**

Create `src/shared/api/appsflyer/snapshot-derive.ts`:

```ts
import {
  EMPTY_CARD,
  type AppsFlyerCardData,
  type AppsFlyerSnapshot,
  type ConnectionStatusLive,
  type CohortRow,
  type MasterRow,
} from "./types"

export function deriveStatus(fetchedAt: string): ConnectionStatusLive {
  const t = Date.parse(fetchedAt)
  if (!Number.isFinite(t) || t <= 0) return "disconnected"
  const hours = (Date.now() - t) / 3_600_000
  if (hours < 24) return "connected"
  if (hours < 168) return "warn"
  return "error"
}

export function formatRelative(fetchedAt: string): string {
  const t = Date.parse(fetchedAt)
  if (!Number.isFinite(t) || t <= 0) return "아직 sync 없음"
  const diffSec = Math.max(0, Math.floor((Date.now() - t) / 1000))
  if (diffSec < 60) return `${diffSec}초 전`
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}분 전`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}시간 전`
  return `${Math.floor(diffSec / 86400)}일 전`
}

function sumNumber(
  rows: Array<Record<string, string | number>>,
  key: string,
): number {
  let sum = 0
  for (const row of rows) {
    const v = row[key]
    if (typeof v === "number") sum += v
  }
  return sum
}

function hasKey(
  rows: Array<Record<string, string | number>>,
  key: string,
): boolean {
  return rows.some((row) => key in row)
}

function pickRetentionDepth(rows: CohortRow[]): string | null {
  const candidates: Array<[string, string]> = [
    ["retention_day_30", "D30"],
    ["retention_day_14", "D14"],
    ["retention_day_7", "D7"],
    ["retention_day_3", "D3"],
    ["retention_day_1", "D1"],
  ]
  for (const [key, label] of candidates) {
    if (hasKey(rows, key)) return label
  }
  return null
}

export function deriveCardFromSnapshot(
  snap: AppsFlyerSnapshot,
): AppsFlyerCardData {
  const metrics: AppsFlyerCardData["metrics"] = []

  const masterRows: MasterRow[] = snap.master?.rows ?? []
  if (masterRows.length > 0) {
    const installs = sumNumber(masterRows, "installs")
    if (installs > 0) {
      metrics.push({ label: "설치", value: installs.toLocaleString("ko-KR") })
    }
    const cost = sumNumber(masterRows, "cost")
    const nonOrganic = sumNumber(masterRows, "non_organic_installs")
    const hasCostCol = hasKey(masterRows, "cost")
    const hasNonOrganicCol = hasKey(masterRows, "non_organic_installs")
    if (hasCostCol && hasNonOrganicCol && cost > 0 && nonOrganic > 0) {
      const cpi = Math.round(cost / nonOrganic)
      metrics.push({ label: "CPI", value: `₩${cpi.toLocaleString("ko-KR")}` })
    }
  }

  const cohortRows: CohortRow[] = snap.cohort?.rows ?? []
  const retentionDepth = pickRetentionDepth(cohortRows)
  if (retentionDepth) {
    metrics.push({ label: "리텐션", value: retentionDepth })
  }

  return {
    status: deriveStatus(snap.fetchedAt),
    lastSync: formatRelative(snap.fetchedAt),
    metrics,
    retentionDepth,
  }
}

export { EMPTY_CARD }
```

- [ ] **Step 5b: fs 모듈 작성 (server-only)**

Create `src/shared/api/appsflyer/snapshot.ts`:

```ts
import { readFileSync, writeFileSync, existsSync } from "node:fs"
import { resolve } from "node:path"
import {
  SnapshotSchema,
  type AppsFlyerCardData,
  type AppsFlyerSnapshot,
} from "./types"
import { ValidationError } from "./errors"
import { EMPTY_CARD, deriveCardFromSnapshot } from "./snapshot-derive"

export {
  deriveCardFromSnapshot,
  deriveStatus,
  formatRelative,
} from "./snapshot-derive"

const DEFAULT_PATH = resolve(
  process.cwd(),
  "src/shared/api/data/appsflyer/snapshot.json",
)

export function writeSnapshotTo(path: string, snap: AppsFlyerSnapshot): void {
  const parsed = SnapshotSchema.safeParse(snap)
  if (!parsed.success) {
    throw new ValidationError("write.snapshot", parsed.error.message)
  }
  writeFileSync(path, JSON.stringify(parsed.data, null, 2) + "\n", "utf-8")
}

export function readSnapshotFrom(path: string): AppsFlyerSnapshot | null {
  if (!existsSync(path)) return null
  const raw = JSON.parse(readFileSync(path, "utf-8"))
  const parsed = SnapshotSchema.safeParse(raw)
  if (!parsed.success) {
    throw new ValidationError("read.snapshot", parsed.error.message)
  }
  return parsed.data
}

export function writeSnapshot(snap: AppsFlyerSnapshot): void {
  writeSnapshotTo(DEFAULT_PATH, snap)
}

export function readSnapshot(): AppsFlyerSnapshot | null {
  return readSnapshotFrom(DEFAULT_PATH)
}

export function getAppsFlyerCardData(): AppsFlyerCardData {
  try {
    const snap = readSnapshot()
    if (!snap) return EMPTY_CARD
    if (Date.parse(snap.fetchedAt) <= 0) return EMPTY_CARD
    return deriveCardFromSnapshot(snap)
  } catch {
    return EMPTY_CARD
  }
}
```

- [ ] **Step 6: Run all appsflyer tests — expect PASS**

```bash
npx tsx --test src/shared/api/appsflyer/__tests__/*.test.ts
```

Expected: all tests pass (client 3 + fetcher 2 + snapshot 4 + card-data 3 = 12).

- [ ] **Step 7: tsc 전체 통과 확인**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 8: Commit**

```bash
git add src/shared/api/appsflyer/ src/shared/api/data/appsflyer/snapshot.json
git commit -m "feat(appsflyer): snapshot persistence, card derivation, runSync core"
```

---

## Stage 4 — CLI

### Task 4.1: `.env.example` + `.gitignore` 업데이트

**Files:**
- Create: `.env.example`
- Modify: `.gitignore`

- [ ] **Step 1: .env.example 작성**

Create `.env.example`:

```
# AppsFlyer Dev Token — User Access > Admin Tokens
APPSFLYER_DEV_TOKEN=
```

- [ ] **Step 2: .gitignore 확인 + 업데이트**

Check current `.gitignore` for `.env.local`:

```bash
grep -n "\.env\.local" .gitignore || echo "not found"
```

If not found, append:

```bash
cat >> .gitignore <<'EOF'

# Local environment (contains AppsFlyer dev token)
.env.local
EOF
```

- [ ] **Step 3: Commit**

```bash
git add .env.example .gitignore
git commit -m "chore: add env template and ignore .env.local"
```

---

### Task 4.2: CLI 스크립트

**Files:**
- Create: `scripts/fetch-appsflyer.ts`
- Modify: `package.json`

- [ ] **Step 1: CLI 스크립트 작성**

Create `scripts/fetch-appsflyer.ts`:

```ts
/**
 * AppsFlyer 데이터 스냅샷 갱신 CLI.
 * 사용:
 *   npm run fetch:af
 *   npm run fetch:af -- --master-only
 *   npm run fetch:af -- --cohort-only
 *   npm run fetch:af -- --dry-run
 */
import "dotenv/config"
import {
  runAppsFlyerSync,
  writeSnapshot,
  type CohortParams,
  type HomeCurrency,
  type MasterParams,
} from "../src/shared/api/appsflyer"

const DEFAULT_APP_IDS = ["id0000000000"]  // 실 app id로 대체 필요
const DEFAULT_HOME_CURRENCY: HomeCurrency = "KRW"
const WINDOW_DAYS = 30

const flags = new Set(process.argv.slice(2))
const masterOnly = flags.has("--master-only")
const cohortOnly = flags.has("--cohort-only")
const dryRun = flags.has("--dry-run")

const today = new Date()
const to = today.toISOString().slice(0, 10)
const fromDate = new Date(today)
fromDate.setUTCDate(fromDate.getUTCDate() - WINDOW_DAYS)
const from = fromDate.toISOString().slice(0, 10)

const devToken = process.env.APPSFLYER_DEV_TOKEN
if (!devToken) {
  console.error("[AF] APPSFLYER_DEV_TOKEN is not set in .env.local")
  process.exit(1)
}

const appId = DEFAULT_APP_IDS[0]

const master: MasterParams | null = cohortOnly
  ? null
  : {
      appId,
      reportType: "daily_report",
      from,
      to,
      groupings: ["pid"],
      kpis: ["installs", "non_organic_installs", "cost", "impressions", "clicks"],
    }

const cohort: CohortParams | null = masterOnly
  ? null
  : {
      appId,
      from,
      to,
      cohortType: "user_acquisition",
      groupings: ["pid"],
      kpis: ["retention_day_0", "retention_day_1", "retention_day_3"],
    }

try {
  const result = await runAppsFlyerSync({
    devToken,
    appIds: DEFAULT_APP_IDS,
    homeCurrency: DEFAULT_HOME_CURRENCY,
    master,
    cohort,
  })

  console.log(
    `[AF] master=${result.summary.masterRows} rows, cohort=${result.summary.cohortRows} rows (${result.summary.durationMs}ms)`,
  )
  if (result.warnings.length > 0) {
    console.warn(`[AF] warnings: ${result.warnings.join("; ")}`)
  }

  if (dryRun) {
    console.log("[AF] --dry-run: snapshot not written")
  } else {
    writeSnapshot(result.snapshot)
    console.log("[AF] snapshot.json updated — review with git diff and commit")
  }
} catch (err) {
  const e = err as { code?: string; message?: string }
  console.error(`[AF] failed (${e.code ?? "unknown"}): ${e.message ?? err}`)
  const exitMap: Record<string, number> = {
    invalid_token: 1,
    rate_limited: 2,
    timeout: 3,
    schema_mismatch: 4,
    network: 5,
  }
  process.exit(exitMap[e.code ?? ""] ?? 10)
}
```

- [ ] **Step 2: dotenv 설치**

```bash
npm install dotenv --legacy-peer-deps
```

- [ ] **Step 3: package.json 스크립트 추가**

Modify `package.json` — add to `scripts` object:

```json
"fetch:af": "tsx scripts/fetch-appsflyer.ts",
"fetch:af:dry": "tsx scripts/fetch-appsflyer.ts -- --dry-run",
"test:af": "node --test --import tsx/esm src/shared/api/appsflyer/__tests__/*.test.ts"
```

Note: `tsx` is already a dev dependency (used by `crawl:st`). Verify:

```bash
grep '"tsx"' package.json || npm install tsx --save-dev --legacy-peer-deps
```

- [ ] **Step 4: CLI dry-run 동작 확인 (토큰 없이 exit 1 확인)**

```bash
unset APPSFLYER_DEV_TOKEN
npm run fetch:af:dry
```

Expected: `[AF] APPSFLYER_DEV_TOKEN is not set in .env.local`, exit 1.

- [ ] **Step 5: Commit**

```bash
git add scripts/fetch-appsflyer.ts package.json package-lock.json
git commit -m "feat(appsflyer): cli script with dry-run and master/cohort flags"
```

---

## Stage 5 — Server Action (API Route)

### Task 5.1: `/api/appsflyer/sync` POST handler

**Files:**
- Create: `src/app/api/appsflyer/sync/route.ts`

- [ ] **Step 1: Route 구현**

Create `src/app/api/appsflyer/sync/route.ts`:

```ts
import { NextResponse } from "next/server"
import {
  AuthError,
  RateLimitError,
  TimeoutError,
  ValidationError,
  runAppsFlyerSync,
  writeSnapshot,
  SyncRequestSchema,
  type CohortParams,
  type MasterParams,
} from "@/shared/api/appsflyer"

export const runtime = "nodejs"

function parseAppIds(raw: string): string[] {
  return raw
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function windowFromNow(days: number): { from: string; to: string } {
  const now = new Date()
  const to = now.toISOString().slice(0, 10)
  const fromDate = new Date(now)
  fromDate.setUTCDate(fromDate.getUTCDate() - days)
  return { from: fromDate.toISOString().slice(0, 10), to }
}

export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { ok: false, code: "bad_request", path: "body" },
      { status: 400 },
    )
  }

  const parsed = SyncRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, code: "bad_request", path: parsed.error.issues[0]?.path.join(".") ?? "body" },
      { status: 400 },
    )
  }

  const { dev_token, home_currency, app_ids, dry_run } = parsed.data
  const appIds = parseAppIds(app_ids)
  if (appIds.length === 0) {
    return NextResponse.json(
      { ok: false, code: "bad_request", path: "app_ids" },
      { status: 400 },
    )
  }

  const days = dry_run ? 1 : 30
  const { from, to } = windowFromNow(days)
  const appId = appIds[0]

  const master: MasterParams | null = {
    appId,
    reportType: "daily_report",
    from,
    to,
    groupings: ["pid"],
    kpis: ["installs", "non_organic_installs", "cost", "impressions", "clicks"],
  }
  const cohort: CohortParams | null = dry_run
    ? null
    : {
        appId,
        from,
        to,
        cohortType: "user_acquisition",
        groupings: ["pid"],
        kpis: ["retention_day_0", "retention_day_1", "retention_day_3"],
      }

  try {
    const result = await runAppsFlyerSync({
      devToken: dev_token,
      appIds,
      homeCurrency: home_currency,
      master,
      cohort,
    })

    const isVercelProd = process.env.VERCEL_ENV === "production"
    if (!isVercelProd && !dry_run) {
      writeSnapshot(result.snapshot)
      return NextResponse.json({
        ok: true,
        persisted: true,
        summary: result.summary,
        warnings: result.warnings,
      })
    }

    return NextResponse.json({
      ok: true,
      persisted: false,
      reason: dry_run ? "dry-run" : "prod-readonly-fs",
      summary: result.summary,
      warnings: result.warnings,
    })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { ok: false, code: "invalid_token" },
        { status: 401 },
      )
    }
    if (err instanceof RateLimitError) {
      return NextResponse.json(
        { ok: false, code: "rate_limited", retryAfter: err.retryAfterSec },
        { status: 429 },
      )
    }
    if (err instanceof TimeoutError) {
      return NextResponse.json(
        { ok: false, code: "timeout" },
        { status: 504 },
      )
    }
    if (err instanceof ValidationError) {
      return NextResponse.json(
        { ok: false, code: "schema_mismatch", path: err.path },
        { status: 502 },
      )
    }
    return NextResponse.json(
      { ok: false, code: "network", message: (err as Error).message },
      { status: 502 },
    )
  }
}
```

- [ ] **Step 2: tsc 체크**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Next.js dev server에서 라우트 확인**

```bash
npm run dev &
DEV_PID=$!
sleep 5
curl -i -X POST http://localhost:3000/api/appsflyer/sync \
  -H "Content-Type: application/json" \
  -d '{}'
kill $DEV_PID
```

Expected: `400 Bad Request`, `{ "ok": false, "code": "bad_request", "path": "dev_token" }` (또는 유사 path).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/appsflyer/sync/route.ts
git commit -m "feat(appsflyer): POST /api/appsflyer/sync with prod-readonly branch"
```

---

## Stage 6 — UI 연결

### Task 6.1: `mock-connections.ts` 정리

**Files:**
- Modify: `src/shared/api/mock-connections.ts`

- [ ] **Step 1: AppsFlyer 항목에서 하드코드 status/lastSync/metrics 제거**

Edit `src/shared/api/mock-connections.ts` — AppsFlyer 항목을 찾아 `status`, `lastSync`, `metrics` 를 defaults로 변경:

```ts
// AppsFlyer 항목에서
{
  id: "appsflyer",
  brand: "AppsFlyer",
  // ...
  status: "disconnected",     // 런타임에 getAppsFlyerCardData()가 덮어씀
  // lastSync 프로퍼티 삭제
  // metrics 프로퍼티 삭제
  primaryMethod: "api",
  syncCadence: "1시간마다 자동 sync",
  apiFields: [ ... /* 기존 그대로 */ ],
},
```

- [ ] **Step 2: tsc 체크**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit (UI 변경과 함께 다음 task에서)**

대기 — Task 6.2/6.3와 함께 commit.

---

### Task 6.2: `ConnectionCard`에 AppsFlyer 라이브 데이터 머지 (client-safe)

**Files:**
- Modify: `src/widgets/connections/ui/connection-card.tsx`

`connection-card.tsx` 는 `"use client"` 컴포넌트. `node:fs`를 사용하는 `snapshot.ts` 는 import 불가. 대신:
1. `snapshot.json` 을 정적 JSON import → Next.js/Webpack이 빌드 시점에 인라인
2. `snapshot-derive.ts` (순수) 의 `deriveCardFromSnapshot` + Zod parse 로 클라이언트에서 직접 파생

- [ ] **Step 1: tsconfig에 `resolveJsonModule` 확인**

```bash
grep resolveJsonModule tsconfig.json
```

Expected: `"resolveJsonModule": true` 존재. 없으면:

```bash
# tsconfig.json compilerOptions에 추가
# "resolveJsonModule": true,
# "esModuleInterop": true,
```

- [ ] **Step 2: `connection-card.tsx` 상단 import + 파생 추가**

Edit `src/widgets/connections/ui/connection-card.tsx`:

기존 import 블럭 아래에 추가:

```ts
import snapshotJson from "@/shared/api/data/appsflyer/snapshot.json"
import {
  deriveCardFromSnapshot,
  EMPTY_CARD,
} from "@/shared/api/appsflyer/snapshot-derive"
import { SnapshotSchema } from "@/shared/api/appsflyer/types"

function getAppsFlyerLiveCard() {
  const parsed = SnapshotSchema.safeParse(snapshotJson)
  if (!parsed.success) return EMPTY_CARD
  if (Date.parse(parsed.data.fetchedAt) <= 0) return EMPTY_CARD
  return deriveCardFromSnapshot(parsed.data)
}
```

**주의**: 정적 import된 JSON은 **빌드 타임에 고정**. CLI로 `snapshot.json` 을 갱신하면 `npm run build` / `next dev` HMR로 새 값이 반영됨. 런타임 sync(다이얼로그 저장)는 Next.js 빌드 외부에서 파일을 바꾸므로 브라우저 새로고침만으로는 반영되지 않고, 실제로는 dev에서 HMR, 프로덕션에서는 다음 배포에 반영.

- [ ] **Step 3: 컴포넌트 본문에 머지 로직**

`ConnectionCard` 함수 본문 최상단 (JSX 반환 전):

```tsx
const live = connection.id === "appsflyer" ? getAppsFlyerLiveCard() : null

const effective = live
  ? {
      ...connection,
      status: live.status,
      lastSync: live.lastSync,
      metrics: live.metrics.length > 0 ? live.metrics : connection.metrics,
    }
  : connection
```

이후 JSX에서 `connection.status` → `effective.status`, `connection.lastSync` → `effective.lastSync`, `connection.metrics` → `effective.metrics` 치환. (다른 프로퍼티 — brand, initials, description, apiFields 등 — 은 `connection` 그대로 사용.)

- [ ] **Step 4: tsc 통과**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 5: build 통과**

```bash
npm run build
```

Expected: 빌드 성공. snapshot.json이 번들에 포함됨.

- [ ] **Step 6: dev 실행하여 Connections 페이지 HTML 확인**

```bash
npm run dev &
DEV_PID=$!
sleep 5
curl -s http://localhost:3000/dashboard/connections | grep -Ei "appsflyer|disconnected|연결" | head -5
kill $DEV_PID
```

Expected: AppsFlyer 카드가 `"disconnected"` 상태로 렌더링 (초기 빈 스냅샷의 `fetchedAt: 1970-01-01` 때문에 `EMPTY_CARD` 반환).

- [ ] **Step 7: Commit**

```bash
git add src/shared/api/mock-connections.ts src/widgets/connections/ui/connection-card.tsx
git commit -m "feat(appsflyer): client-safe live card merge via static json import"
```

---

### Task 6.3: `ConnectionDialog`에서 실 API 호출

**Files:**
- Modify: `src/widgets/connections/ui/connection-dialog.tsx`

- [ ] **Step 1: 연결 테스트 / 저장 버튼 핸들러 교체**

`src/widgets/connections/ui/connection-dialog.tsx` 의 `ApiConnectionForm` 컴포넌트에서:

```tsx
const postSync = async (dryRun: boolean) => {
  const res = await fetch("/api/appsflyer/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      dev_token: values.dev_token ?? "",
      home_currency: values.home_currency ?? "KRW",
      app_ids: values.app_ids ?? "",
      sync_frequency: values.sync_frequency ?? "1h",
      dry_run: dryRun,
    }),
  })
  const data = (await res.json()) as { ok: boolean; code?: string }
  return { ok: res.ok && data.ok, data }
}

const runTest = async () => {
  setTesting(true)
  setTestResult(null)
  const { ok } = await postSync(true)
  setTesting(false)
  setTestResult(ok ? "ok" : "fail")
}

const handleSave = async () => {
  const { ok } = await postSync(false)
  if (ok) onDone()
}
```

저장 버튼 `onClick={onDone}` 을 `onClick={handleSave}` 로 교체.

테스트 성공 메시지 hardcoded `"3개 앱, 1.2M 이벤트 감지"` → 일반화:

```tsx
{testResult === "ok" && (
  <div className="flex items-start gap-2 rounded-xl bg-success/10 border border-success/25 p-3">
    <Iconify icon={checkCircleBold} width={18} height={18} className="text-success mt-0.5 flex-shrink-0" />
    <div>
      <div className="text-sm font-bold text-success">연결 테스트 성공</div>
      <div className="text-xs text-muted-foreground mt-0.5">
        AppsFlyer 토큰 유효 · 저장 시 스냅샷 업데이트
      </div>
    </div>
  </div>
)}
{testResult === "fail" && (
  <div className="flex items-start gap-2 rounded-xl bg-destructive/10 border border-destructive/25 p-3">
    <div>
      <div className="text-sm font-bold text-destructive">연결 실패</div>
      <div className="text-xs text-muted-foreground mt-0.5">
        토큰 또는 app_id를 다시 확인하세요
      </div>
    </div>
  </div>
)}
```

MVP disclaimer 줄 제거:

```tsx
// 삭제:
// <p className="text-[11px] text-muted-foreground italic text-right">
//   * 1차 MVP — 저장 시 데모 목적 mock 동작, 실제 API 호출 없음
// </p>
```

- [ ] **Step 2: tsc 통과**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: dev에서 다이얼로그 열어 "연결 테스트" 버튼 수동 확인**

```bash
npm run dev
# 브라우저에서 http://localhost:3000/dashboard/connections 이동
# AppsFlyer 카드 클릭 → 다이얼로그 열림
# 임의 토큰 입력 + "연결 테스트" 클릭
# Expected: 401 응답 → "연결 실패" 배너 노출
```

- [ ] **Step 4: Commit**

```bash
git add src/widgets/connections/ui/connection-dialog.tsx
git commit -m "feat(appsflyer): wire dialog save/test buttons to real api route"
```

---

## Stage 7 — 실 토큰 E2E

### Task 7.1: 실 dev_token으로 CLI 실행

**Files:**
- Create: `.env.local` (로컬만, git 추적 안 됨)

- [ ] **Step 1: `.env.local` 설정**

```bash
cp .env.example .env.local
# .env.local 을 에디터로 열어 실 토큰 붙여넣기
```

확인:

```bash
grep APPSFLYER_DEV_TOKEN .env.local | grep -v "^APPSFLYER_DEV_TOKEN=$"
```

Expected: 토큰 값이 설정된 라인 출력.

- [ ] **Step 2: `scripts/fetch-appsflyer.ts` 의 `DEFAULT_APP_IDS`를 실 app id로 교체**

```ts
const DEFAULT_APP_IDS = ["id실제값"]   // ex: ["id1234567890"]
```

- [ ] **Step 3: dry-run**

```bash
npm run fetch:af -- --dry-run --master-only
```

Expected: `[AF] master=N rows, cohort=0 rows (XXXms)` 성공 로그, snapshot 미변경.

- [ ] **Step 4: 실 sync**

```bash
npm run fetch:af
```

Expected: `[AF] snapshot.json updated`.

- [ ] **Step 5: snapshot.json 변경 검사**

```bash
git diff src/shared/api/data/appsflyer/snapshot.json | head -40
```

Expected: `fetchedAt`, `request`, `master.rows`, `cohort.rows` 실 값으로 채워짐.

- [ ] **Step 6: Connections 페이지 라이브 확인**

```bash
npm run dev
# 브라우저에서 /dashboard/connections
# AppsFlyer 카드의 lastSync "방금 전"/"0분 전", 설치/리텐션 metric 실 값
```

- [ ] **Step 7: snapshot.json Commit**

```bash
git add src/shared/api/data/appsflyer/snapshot.json scripts/fetch-appsflyer.ts
git commit -m "chore(appsflyer): initial real snapshot + app id"
```

---

## Stage 8 — Deploy

### Task 8.1: 빌드 + 배포

- [ ] **Step 1: 풀 빌드**

```bash
npm run build
```

Expected: Next.js build 성공, 경고 없음.

- [ ] **Step 2: 전체 테스트**

```bash
npm run test:af
```

Expected: 12 tests passed.

- [ ] **Step 3: main 푸시**

```bash
git push origin main
```

- [ ] **Step 4: Vercel 배포 확인**

```bash
# Vercel CLI가 설치되어 있다면
vercel --prod
# 또는 Vercel 대시보드에서 자동 배포 확인
```

- [ ] **Step 5: 프로덕션 엔드포인트 검증 (prod-readonly-fs 분기)**

```bash
curl -i -X POST https://<your-vercel-domain>/api/appsflyer/sync \
  -H "Content-Type: application/json" \
  -d '{
    "dev_token": "<실토큰>",
    "home_currency": "KRW",
    "app_ids": "id실제값",
    "sync_frequency": "1h",
    "dry_run": true
  }'
```

Expected: `200 OK` with `{ "ok": true, "persisted": false, "reason": "dry-run", "summary": {...} }`.

---

## Spec Coverage Matrix

| Spec 섹션 | 구현 Task |
|---|---|
| §1 범위 요약 | 전체 |
| §2-1 접근법 C 선택 | Task 2.3 (공유 코어 + 얇은 진입점) |
| §2-2 디렉토리 구조 | Task 1.1 |
| §2-3 `runAppsFlyerSync` 순수 함수 | Task 2.3 |
| §3-1 엔드포인트/인증 | Task 2.2 |
| §3-2 호출 파라미터 타입 | Task 1.3 |
| §3-3 rate limit/재시도/타임아웃 | Task 2.1 |
| §3-4 스냅샷 스키마 | Task 1.3 (types) + Task 3.1 (파일) |
| §4-1 `getAppsFlyerCardData` | Task 3.1 |
| §4-2 sparse 표시 규칙 + CPI 엣지케이스 | Task 3.1 (deriveCardFromSnapshot 테스트) |
| §4-3 `deriveStatus` 임계 | Task 3.1 |
| §4-4 `mock-connections.ts` 하드코드 제거 | Task 6.1 |
| §5-1 CLI 플래그 (`--master-only`, `--cohort-only`, `--dry-run`) | Task 4.2 |
| §5-2 API route + prod 분기 | Task 5.1 |
| §5-3 토큰 정책 (메모리 소멸, .env.local, git 미추적) | Task 4.1 + Task 5.1 |
| §5-4 에러 처리 표 | Task 1.2 + Task 5.1 |
| §6-1 단위 테스트 5종 | Task 2.1 (client x3) + Task 2.2 (fetcher contract x2) + Task 3.1 (snapshot x4, card x3) |
| §6-2 수동 E2E 체크리스트 | Task 7.1 |
| §6-3 빌드 | Task 8.1 |
| §7 8 Stage 구현 순서 | Stage 1~8 매핑 |
| §8 변경 파일 범위 | 각 Task Files 헤더에 명시 |
| §9 Zod 의존성 | Task 1.1 |
| §10 리스크 완화 (Vercel prod 분기, sparse 정책) | Task 5.1, Task 3.1 |
| §11~13 Post-MVP | 본 플랜 범위 밖 (체크리스트만) |

---

## Notes

- **Commit granularity**: Task 단위 commit이 기본. Task 내부 step에서 commit 지시가 있으면 그 지점에서 commit.
- **실 토큰 취급**: Task 7에 진입하기 전까지 모든 테스트/개발은 토큰 없이 가능. fixture 기반 검증.
- **Client/Server 경계**: Task 6.2에서 `connection-card.tsx`의 `"use client"` 유무 확인 필수 — server 파일이면 직접 import, client 파일이면 server wrapper 분리.
- **`primaryMethod` 유지**: `mock-connections.ts`에서 AppsFlyer 항목의 `primaryMethod: "api"` 및 `apiFields` 배열은 유지 — 런타임 머지는 status/lastSync/metrics만.
