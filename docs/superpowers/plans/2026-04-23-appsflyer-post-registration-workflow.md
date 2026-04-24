# AppsFlyer Post-Registration Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** AppsFlyer 토큰/appId 를 UI 로 등록한 직후부터, 14일 backfill + 일일 Cron 누적 + 6개 대시보드 위젯의 Bayesian live 표시까지 전체 운영 레이어 구현.

**Architecture:** 4-layer 단방향 의존 (UI → API Route → Domain → Storage). Vercel Blob 을 영속 저장소로, 월 샤딩 JSONL (raw) + `cohort/summary.json` (derived) 구조. 6-state 머신 (`backfilling` · `active` · `stale` · `failed` · `credential_invalid` · `app_missing`). 등록 직후 비동기 backfill + 클라이언트 2s polling UX. AES-256-GCM 으로 dev_token 대칭 암호화, master key 는 env var.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Zod, Vercel Blob (`@vercel/blob`), Vitest, `node:crypto` (AES-256-GCM), Tailwind v4, Recharts + visx, Framer Motion.

**선행 문서:** [AppsFlyer 등록 이후 워크플로우 설계](../specs/2026-04-23-appsflyer-post-registration-workflow-design.md)

---

## File Structure

### 신규 파일 (🆕 16)
```
src/shared/api/appsflyer/
├── crypto.ts                              # AES-256-GCM 암복호화
├── blob-store.ts                          # @vercel/blob 래핑, typed I/O
├── rate-limiter.ts                        # ETag CAS 기반 call counter
├── orchestrator.ts                        # runAppsFlyerSync 재구성 (chain + state)
├── aggregation.ts                         # cohort + revenue 집계 (pure)
└── __tests__/
    ├── crypto.test.ts
    ├── blob-store.test.ts
    ├── rate-limiter.test.ts
    ├── aggregation.test.ts
    └── orchestrator.test.ts

src/app/api/appsflyer/
├── register/route.ts                      # POST — 등록 + validation ping + backfill 트리거
├── state/[appId]/route.ts                 # GET — polling 타겟
└── cron/route.ts                          # GET — Vercel Cron

src/widgets/connections/ui/
├── register-modal.tsx                     # 등록 폼 6필드
├── app-card.tsx                           # 6-state 배지 카드
├── sync-progress-card.tsx                 # backfilling 진행률
└── failure-history-tab.tsx                # 최근 10건 이력

src/shared/hooks/
├── use-af-state.ts                        # state polling hook
└── use-af-metrics.ts                      # CohortSummary → UI 메트릭 derive

scripts/
└── migrate-snapshot-to-blob.ts            # v2 → v3 1회성 마이그레이션
```

### 수정 파일 (✏️ 12)
```
src/shared/api/appsflyer/
├── types.ts                               # + AccountSchema/AppSchema/StateSchema/CohortSummarySchema
├── fetcher.ts                             # + fetchInAppEvents wrapper
├── errors.ts                              # + CredentialInvalid/AppMissing/Throttled/BackfillInProgress
├── snapshot-derive.ts                     # CohortSummary → UI 메트릭 책임으로 축소
└── index.ts                               # public barrel 재구성

src/app/(dashboard)/dashboard/connections/page.tsx    # 앱 리스트 + 등록 버튼
src/app/api/appsflyer/sync/route.ts                   # /sync/[appId] 파라미터화

src/widgets/dashboard/ui/kpi-cards.tsx                # AF live + ML1 fallback
src/widgets/dashboard/ui/data-freshness-strip.tsx     # AF state.lastSyncAt
src/widgets/charts/ui/prior-posterior-chart.tsx       # AF posterior + ML3
src/widgets/charts/ui/retention-curve.tsx             # AF cohort → BetaBinomial band
src/widgets/charts/ui/revenue-forecast.tsx            # AF events → LogNormal fan

vercel.json                                            # crons 섹션 추가
```

### 삭제 파일 (❌ 1)
```
src/shared/api/appsflyer/snapshot.ts                  # blob-store.ts 로 대체
src/shared/api/data/appsflyer/snapshot.json           # Blob 으로 이관 후 삭제
```

---

## Prerequisites

### 환경변수 추가 (`.env.local` + Vercel dashboard)

```
# 32-byte hex (AES-256 키). 생성: openssl rand -hex 32
APPSFLYER_MASTER_KEY=<생성된 hex>

# Vercel Blob 자동 주입, 로컬 개발은 vercel env pull 로 받음
BLOB_READ_WRITE_TOKEN=<vercel 제공>

# Vercel Cron 호출 인증, 32 char 무작위 문자열
CRON_SECRET=<무작위 문자열>
```

### 신규 의존성

```bash
npm install @vercel/blob
```

### Vercel Blob Store 생성 (1회, 수동)

Vercel 대시보드 → Storage → Create → Blob. `BLOB_READ_WRITE_TOKEN` 이 프로젝트 env 에 자동 추가됨. 로컬은 `vercel env pull .env.local` 로 동기화.

---

# Phase 1 — Foundation (Tasks 1–6)

순수 도메인 유틸리티. 테스트 커버리지 90% 이상, Next.js/React 의존 없음. 이 phase 가 끝나면 domain layer 의 I/O 와 보안 primitive 가 전부 갖춰진다.

---

### Task 1: 의존성 설치 + env scaffolding

**Files:**
- Modify: `package.json`
- Modify: `.env.example` (신규 필드 문서화용)

- [ ] **Step 1: @vercel/blob 설치**

```bash
cd "/Users/mike/Downloads/Project Compass"
npm install @vercel/blob --legacy-peer-deps
```

Expected: `package.json` 에 `"@vercel/blob": "^0.x.x"` 추가, 설치 성공.

- [ ] **Step 2: env 변수 예시 파일에 추가**

Modify `.env.example` (없으면 신규 생성):

```
# === AppsFlyer 연동 ===
# AES-256-GCM 대칭키 (32-byte hex). 생성: openssl rand -hex 32
APPSFLYER_MASTER_KEY=

# Vercel Blob 액세스 토큰 (vercel env pull 로 주입)
BLOB_READ_WRITE_TOKEN=

# Vercel Cron 인증 토큰 (32 char 무작위)
CRON_SECRET=
```

- [ ] **Step 3: 로컬 MASTER_KEY 생성**

```bash
echo "APPSFLYER_MASTER_KEY=$(openssl rand -hex 32)" >> .env.local
echo "CRON_SECRET=$(openssl rand -hex 16)" >> .env.local
```

Expected: `.env.local` 에 두 줄 추가. `.gitignore` 로 이미 차단되어 있는지 확인.

- [ ] **Step 4: typecheck + commit**

```bash
npx tsc --noEmit
git add package.json package-lock.json .env.example
git commit -m "chore(appsflyer): add @vercel/blob and env scaffolding for post-registration workflow"
```

Expected: typecheck 통과, commit 성공.

---

### Task 2: Zod 스키마 (Account, App, State, CohortSummary, Register)

**Files:**
- Modify: `src/shared/api/appsflyer/types.ts`
- Test: `src/shared/api/appsflyer/__tests__/types.test.ts` (신규)

- [ ] **Step 1: 실패 테스트 작성**

Create `src/shared/api/appsflyer/__tests__/types.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import {
  AccountSchema,
  AppSchema,
  StateSchema,
  CohortSummarySchema,
  RegisterRequestSchema,
} from "../types"

describe("AccountSchema", () => {
  it("accepts valid account", () => {
    const ok = AccountSchema.safeParse({
      id: "acc_ab12cdef",
      tokenHash: "a".repeat(64),
      encryptedToken: "iv:ct:tag",
      currency: "KRW",
      label: "Treenod 본계정",
      createdAt: "2026-04-23T00:00:00.000Z",
    })
    expect(ok.success).toBe(true)
  })

  it("rejects bad id prefix", () => {
    const bad = AccountSchema.safeParse({
      id: "wrong_ab12cdef",
      tokenHash: "a".repeat(64),
      encryptedToken: "x",
      currency: "KRW",
      label: "x",
      createdAt: "2026-04-23T00:00:00.000Z",
    })
    expect(bad.success).toBe(false)
  })
})

describe("StateSchema", () => {
  it("accepts backfilling state with null syncLock", () => {
    const ok = StateSchema.safeParse({
      appId: "com.example.app",
      status: "backfilling",
      progress: { step: 1, total: 5, rowsFetched: 135 },
      callsUsedToday: 2,
      callsResetAt: "2026-04-24T00:00:00.000Z",
      syncLock: null,
      failureHistory: [],
    })
    expect(ok.success).toBe(true)
  })

  it("rejects unknown status", () => {
    const bad = StateSchema.safeParse({
      appId: "com.example.app",
      status: "exploding",
      progress: { step: 0, total: 5, rowsFetched: 0 },
      callsUsedToday: 0,
      callsResetAt: "2026-04-24T00:00:00.000Z",
      syncLock: null,
      failureHistory: [],
    })
    expect(bad.success).toBe(false)
  })
})

describe("CohortSummarySchema", () => {
  it("accepts partial retention metrics", () => {
    const ok = CohortSummarySchema.safeParse({
      updatedAt: "2026-04-23T00:00:00.000Z",
      cohorts: {
        "2026-04-10": { n: 12, d1_retained: 5 },   // d7/d30 없음 — OK
      },
      revenue: {
        daily: [{ date: "2026-04-10", sumUsd: 123.45, purchasers: 3 }],
        total: { sumUsd: 123.45, purchasers: 3 },
      },
    })
    expect(ok.success).toBe(true)
  })
})

describe("RegisterRequestSchema", () => {
  it("defaults home_currency to KRW", () => {
    const parsed = RegisterRequestSchema.parse({
      dev_token: "a".repeat(32),
      app_id: "com.example.app",
      app_label: "Example",
      game_key: "sample-match-3",
    })
    expect(parsed.home_currency).toBe("KRW")
  })
})
```

- [ ] **Step 2: 테스트 실행 (실패 확인)**

```bash
npx vitest run src/shared/api/appsflyer/__tests__/types.test.ts
```

Expected: FAIL — 대부분 스키마가 아직 export 되지 않아 import 에러.

- [ ] **Step 3: 스키마 구현**

Modify `src/shared/api/appsflyer/types.ts` — 기존 schemas 아래에 추가:

```typescript
// === NEW: Account / App / State / CohortSummary / Register (v3) ===

export const AccountSchema = z.object({
  id: z.string().regex(/^acc_[a-f0-9]{8}$/),
  tokenHash: z.string().length(64),
  encryptedToken: z.string().min(1),
  currency: z.enum(["KRW", "USD", "JPY", "EUR"]),
  label: z.string().max(80),
  createdAt: z.string().datetime(),
})
export type Account = z.infer<typeof AccountSchema>

const GameKeySchema = z.enum([
  "portfolio",
  "sample-match-3",
  "sample-puzzle",
  "sample-idle",
])
export type GameKey = z.infer<typeof GameKeySchema>

export const AppSchema = z.object({
  appId: z.string().regex(/^[a-zA-Z0-9._-]{3,64}$/),
  accountId: z.string().regex(/^acc_[a-f0-9]{8}$/),
  gameKey: GameKeySchema,
  label: z.string().max(80),
  createdAt: z.string().datetime(),
})
export type App = z.infer<typeof AppSchema>

export const AppStatusSchema = z.enum([
  "backfilling",
  "active",
  "stale",
  "failed",
  "credential_invalid",
  "app_missing",
])
export type AppStatus = z.infer<typeof AppStatusSchema>

export const FailureTypeSchema = z.enum([
  "retryable",
  "throttled",
  "auth_invalid",
  "not_found",
  "partial",
  "full_failure",
])

export const StateSchema = z.object({
  appId: z.string(),
  status: AppStatusSchema,
  progress: z.object({
    step: z.number().int().min(0).max(5),
    total: z.literal(5),
    currentReport: z.string().optional(),
    rowsFetched: z.number().int().nonnegative(),
  }),
  lastSyncAt: z.string().datetime().optional(),
  lastWindow: z
    .object({ from: z.string(), to: z.string() })
    .optional(),
  callsUsedToday: z.number().int().min(0).max(20),
  callsResetAt: z.string().datetime(),
  syncLock: z
    .object({
      heldBy: z.string(),
      heldAt: z.string().datetime(),
      ttlMs: z.literal(300_000),
    })
    .nullable(),
  failureHistory: z
    .array(
      z.object({
        at: z.string().datetime(),
        type: FailureTypeSchema,
        message: z.string(),
        report: z.string().optional(),
      })
    )
    .max(10),
})
export type AppState = z.infer<typeof StateSchema>

export const CohortEntrySchema = z.object({
  n: z.number().int().nonnegative(),
  d1_retained: z.number().int().nonnegative().optional(),
  d7_retained: z.number().int().nonnegative().optional(),
  d30_retained: z.number().int().nonnegative().optional(),
})

export const CohortSummarySchema = z.object({
  updatedAt: z.string().datetime(),
  cohorts: z.record(z.string(), CohortEntrySchema),
  revenue: z.object({
    daily: z.array(
      z.object({
        date: z.string(),
        sumUsd: z.number().nonnegative(),
        purchasers: z.number().int().nonnegative(),
      })
    ),
    total: z.object({
      sumUsd: z.number().nonnegative(),
      purchasers: z.number().int().nonnegative(),
    }),
  }),
})
export type CohortSummary = z.infer<typeof CohortSummarySchema>

export const RegisterRequestSchema = z.object({
  dev_token: z.string().min(20),
  app_id: z.string().regex(/^[a-zA-Z0-9._-]{3,64}$/),
  app_label: z.string().max(80),
  game_key: GameKeySchema,
  home_currency: z.enum(["KRW", "USD", "JPY", "EUR"]).default("KRW"),
})
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npx vitest run src/shared/api/appsflyer/__tests__/types.test.ts
```

Expected: PASS, 5 tests green.

- [ ] **Step 5: typecheck + commit**

```bash
npx tsc --noEmit
git add src/shared/api/appsflyer/types.ts src/shared/api/appsflyer/__tests__/types.test.ts
git commit -m "feat(appsflyer): v3 schemas — Account/App/State/CohortSummary/Register"
```

---

### Task 3: crypto.ts — AES-256-GCM 대칭 암복호화

**Files:**
- Create: `src/shared/api/appsflyer/crypto.ts`
- Test: `src/shared/api/appsflyer/__tests__/crypto.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

Create `src/shared/api/appsflyer/__tests__/crypto.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest"
import { encryptToken, decryptToken, maskToken } from "../crypto"

const VALID_KEY = "a".repeat(64)  // 32 bytes hex

describe("crypto", () => {
  beforeEach(() => {
    process.env.APPSFLYER_MASTER_KEY = VALID_KEY
  })

  it("encrypts then decrypts back to original", () => {
    const plain = "my-dev-token-abc123"
    const cipher = encryptToken(plain)
    expect(cipher).not.toContain(plain)
    expect(cipher.split(":").length).toBe(3)  // iv:ciphertext:tag
    expect(decryptToken(cipher)).toBe(plain)
  })

  it("produces different cipher each time (random iv)", () => {
    const plain = "same-token"
    const c1 = encryptToken(plain)
    const c2 = encryptToken(plain)
    expect(c1).not.toBe(c2)
    expect(decryptToken(c1)).toBe(plain)
    expect(decryptToken(c2)).toBe(plain)
  })

  it("rejects tampered ciphertext", () => {
    const cipher = encryptToken("hello")
    const [iv, ct, tag] = cipher.split(":")
    const tampered = `${iv}:${ct.slice(0, -2)}ff:${tag}`
    expect(() => decryptToken(tampered)).toThrow()
  })

  it("rejects malformed cipher format", () => {
    expect(() => decryptToken("not-a-cipher")).toThrow(/format/)
    expect(() => decryptToken("only:two")).toThrow(/format/)
  })

  it("throws when key is missing", () => {
    delete process.env.APPSFLYER_MASTER_KEY
    expect(() => encryptToken("x")).toThrow(/APPSFLYER_MASTER_KEY/)
  })

  it("throws when key is wrong length", () => {
    process.env.APPSFLYER_MASTER_KEY = "short"
    expect(() => encryptToken("x")).toThrow(/32 bytes/)
  })
})

describe("maskToken", () => {
  it("shows first 4 and last 4 of a long token", () => {
    expect(maskToken("abcd1234efgh5678")).toBe("abcd...5678")
  })

  it("fully masks short tokens", () => {
    expect(maskToken("abc")).toBe("***")
  })
})
```

- [ ] **Step 2: 실패 확인**

```bash
npx vitest run src/shared/api/appsflyer/__tests__/crypto.test.ts
```

Expected: FAIL (crypto.ts 미존재).

- [ ] **Step 3: 구현**

Create `src/shared/api/appsflyer/crypto.ts`:

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto"

const ALGO = "aes-256-gcm"
const IV_BYTES = 12

function getKey(): Buffer {
  const hex = process.env.APPSFLYER_MASTER_KEY
  if (!hex) {
    throw new Error("APPSFLYER_MASTER_KEY env var is required")
  }
  const key = Buffer.from(hex, "hex")
  if (key.length !== 32) {
    throw new Error(
      `APPSFLYER_MASTER_KEY must decode to 32 bytes (got ${key.length})`
    )
  }
  return key
}

export function encryptToken(plain: string): string {
  const key = getKey()
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGO, key, iv)
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString("hex")}:${ct.toString("hex")}:${tag.toString("hex")}`
}

export function decryptToken(packed: string): string {
  const parts = packed.split(":")
  if (parts.length !== 3) {
    throw new Error("invalid cipher format (expected iv:ct:tag)")
  }
  const [ivHex, ctHex, tagHex] = parts
  const key = getKey()
  const decipher = createDecipheriv(ALGO, key, Buffer.from(ivHex, "hex"))
  decipher.setAuthTag(Buffer.from(tagHex, "hex"))
  const plain = Buffer.concat([
    decipher.update(Buffer.from(ctHex, "hex")),
    decipher.final(),
  ])
  return plain.toString("utf8")
}

export function maskToken(token: string): string {
  if (token.length <= 8) return "***"
  return `${token.slice(0, 4)}...${token.slice(-4)}`
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npx vitest run src/shared/api/appsflyer/__tests__/crypto.test.ts
```

Expected: PASS, 8 tests green.

- [ ] **Step 5: commit**

```bash
npx tsc --noEmit
git add src/shared/api/appsflyer/crypto.ts src/shared/api/appsflyer/__tests__/crypto.test.ts
git commit -m "feat(appsflyer): AES-256-GCM token crypto with auth-tag integrity check"
```

---

### Task 4: blob-store.ts — typed Blob I/O

**Files:**
- Create: `src/shared/api/appsflyer/blob-store.ts`
- Test: `src/shared/api/appsflyer/__tests__/blob-store.test.ts`

In-memory mock of `@vercel/blob` 을 테스트에서 사용. 실 Blob 호출은 integration smoke 에서만.

- [ ] **Step 1: 실패 테스트 작성**

Create `src/shared/api/appsflyer/__tests__/blob-store.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest"

// Mock @vercel/blob before import
const store = new Map<string, { body: string; etag: string }>()

vi.mock("@vercel/blob", () => ({
  put: vi.fn(async (key: string, body: string) => {
    const etag = String(Math.random())
    store.set(key, { body, etag })
    return { url: `blob://${key}`, pathname: key, contentType: "application/json" }
  }),
  head: vi.fn(async (url: string) => {
    const key = url.replace("blob://", "")
    const rec = store.get(key)
    if (!rec) throw new Error("not found")
    return { url, pathname: key, size: rec.body.length, uploadedAt: new Date() }
  }),
  list: vi.fn(async (opts: { prefix?: string }) => {
    const keys = [...store.keys()].filter(
      (k) => !opts.prefix || k.startsWith(opts.prefix)
    )
    return { blobs: keys.map((k) => ({ url: `blob://${k}`, pathname: k, size: 0, uploadedAt: new Date() })) }
  }),
  del: vi.fn(async (url: string) => {
    store.delete(url.replace("blob://", ""))
  }),
}))

// Text fetch mock for body retrieval
global.fetch = vi.fn(async (url: string) => {
  const key = url.toString().replace("blob://", "")
  const rec = store.get(key)
  if (!rec) return new Response("not found", { status: 404 })
  return new Response(rec.body, { status: 200 })
}) as any

beforeEach(() => store.clear())

import {
  putAccount,
  getAccount,
  putApp,
  listApps,
  putState,
  getState,
  appendInstalls,
  readInstalls,
} from "../blob-store"

describe("blob-store: account CRUD", () => {
  it("roundtrips an account", async () => {
    const acc = {
      id: "acc_aabbccdd" as const,
      tokenHash: "f".repeat(64),
      encryptedToken: "iv:ct:tag",
      currency: "KRW" as const,
      label: "Treenod",
      createdAt: new Date().toISOString(),
    }
    await putAccount(acc)
    const got = await getAccount("acc_aabbccdd")
    expect(got).toEqual(acc)
  })

  it("returns null when account missing", async () => {
    const got = await getAccount("acc_00000000")
    expect(got).toBeNull()
  })
})

describe("blob-store: app list", () => {
  it("lists apps under the given account", async () => {
    await putApp({
      appId: "com.a.one",
      accountId: "acc_aabbccdd",
      gameKey: "sample-match-3",
      label: "One",
      createdAt: new Date().toISOString(),
    })
    await putApp({
      appId: "com.b.two",
      accountId: "acc_aabbccdd",
      gameKey: "sample-puzzle",
      label: "Two",
      createdAt: new Date().toISOString(),
    })
    const apps = await listApps()
    expect(apps.map((a) => a.appId).sort()).toEqual(["com.a.one", "com.b.two"])
  })
})

describe("blob-store: state", () => {
  it("roundtrips state", async () => {
    const state = {
      appId: "com.a.one",
      status: "backfilling" as const,
      progress: { step: 1, total: 5 as const, rowsFetched: 10 },
      callsUsedToday: 0,
      callsResetAt: new Date().toISOString(),
      syncLock: null,
      failureHistory: [],
    }
    await putState(state)
    const got = await getState("com.a.one")
    expect(got).toEqual(state)
  })
})

describe("blob-store: installs append + read", () => {
  it("dedupes by installId+installTime", async () => {
    const row = {
      installId: "xyz",
      installTime: "2026-04-20 10:00:00",
      partner: null,
      mediaSource: "Organic",
      costValue: null,
      eventRevenueUsd: null,
      eventName: "install",
      countryCode: "KR",
      platform: "ios",
    }
    await appendInstalls("com.a.one", "2026-04", [row])
    await appendInstalls("com.a.one", "2026-04", [row, row])  // dup
    const all = await readInstalls("com.a.one", "2026-04")
    expect(all.length).toBe(1)
  })
})
```

- [ ] **Step 2: 실패 확인**

```bash
npx vitest run src/shared/api/appsflyer/__tests__/blob-store.test.ts
```

Expected: FAIL — blob-store.ts 미존재.

- [ ] **Step 3: 구현**

Create `src/shared/api/appsflyer/blob-store.ts`:

```typescript
import { put, list, del } from "@vercel/blob"
import type { Account, App, AppState } from "./types"
import {
  AccountSchema,
  AppSchema,
  StateSchema,
  CompactInstallSchema,
} from "./types"
import type { z } from "zod"

// === URL helpers ===

const KEY = {
  account: (id: string) => `appsflyer/accounts/${id}.json`,
  app: (appId: string) => `appsflyer/apps/${appId}.json`,
  state: (appId: string) => `appsflyer/state/${appId}.json`,
  installs: (appId: string, month: string) =>
    `appsflyer/installs/${appId}/${month}.jsonl`,
  events: (appId: string, month: string) =>
    `appsflyer/events/${appId}/${month}.jsonl`,
  cohort: (appId: string) => `appsflyer/cohort/${appId}/summary.json`,
}

async function readJsonByKey<T>(
  key: string,
  schema: z.ZodType<T>
): Promise<T | null> {
  const { blobs } = await list({ prefix: key, limit: 1 })
  if (!blobs.length || blobs[0].pathname !== key) return null
  const res = await fetch(blobs[0].url, { cache: "no-store" })
  if (!res.ok) return null
  const body = await res.text()
  return schema.parse(JSON.parse(body))
}

async function writeJson(key: string, value: unknown): Promise<void> {
  await put(key, JSON.stringify(value), {
    access: "public",  // Blob 에서 private 은 tier 필요, 본 spec 에선 암호화 의존
    contentType: "application/json",
    allowOverwrite: true,
  })
}

// === Account ===

export async function putAccount(acc: Account): Promise<void> {
  AccountSchema.parse(acc)
  await writeJson(KEY.account(acc.id), acc)
}

export async function getAccount(id: string): Promise<Account | null> {
  return readJsonByKey(KEY.account(id), AccountSchema)
}

export async function listAccounts(): Promise<Account[]> {
  const { blobs } = await list({ prefix: "appsflyer/accounts/" })
  const results = await Promise.all(
    blobs.map(async (b) => {
      const res = await fetch(b.url, { cache: "no-store" })
      if (!res.ok) return null
      return AccountSchema.parse(await res.json())
    })
  )
  return results.filter((a): a is Account => a !== null)
}

// === App ===

export async function putApp(app: App): Promise<void> {
  AppSchema.parse(app)
  await writeJson(KEY.app(app.appId), app)
}

export async function getApp(appId: string): Promise<App | null> {
  return readJsonByKey(KEY.app(appId), AppSchema)
}

export async function listApps(): Promise<App[]> {
  const { blobs } = await list({ prefix: "appsflyer/apps/" })
  const results = await Promise.all(
    blobs.map(async (b) => {
      const res = await fetch(b.url, { cache: "no-store" })
      if (!res.ok) return null
      return AppSchema.parse(await res.json())
    })
  )
  return results.filter((a): a is App => a !== null)
}

export async function deleteApp(appId: string): Promise<void> {
  await del(KEY.app(appId))
  await del(KEY.state(appId))
  await del(KEY.cohort(appId))
  // installs/events 는 감사 목적상 유지 (사용자가 UI 에서 "전체 삭제" 선택 시만)
}

// === State ===

export async function putState(state: AppState): Promise<void> {
  StateSchema.parse(state)
  await writeJson(KEY.state(state.appId), state)
}

export async function getState(appId: string): Promise<AppState | null> {
  return readJsonByKey(KEY.state(appId), StateSchema)
}

// === Installs / Events (JSONL) ===

type Install = z.infer<typeof CompactInstallSchema>

function dedupKey(row: Install): string {
  // installTime 만으로는 충돌 가능 → partner+mediaSource 도 묶음.
  return `${row.installTime}|${row.mediaSource ?? ""}|${row.partner ?? ""}|${row.countryCode ?? ""}`
}

async function readJsonl<T>(key: string, schema: z.ZodType<T>): Promise<T[]> {
  const { blobs } = await list({ prefix: key, limit: 1 })
  if (!blobs.length || blobs[0].pathname !== key) return []
  const res = await fetch(blobs[0].url, { cache: "no-store" })
  if (!res.ok) return []
  const body = await res.text()
  const rows = body
    .split("\n")
    .filter((l) => l.trim().length > 0)
    .map((l) => schema.parse(JSON.parse(l)))
  return rows
}

async function writeJsonl(key: string, rows: unknown[]): Promise<void> {
  const body = rows.map((r) => JSON.stringify(r)).join("\n") + "\n"
  await put(key, body, {
    access: "public",
    contentType: "application/x-ndjson",
    allowOverwrite: true,
  })
}

export async function readInstalls(
  appId: string,
  month: string
): Promise<Install[]> {
  return readJsonl(KEY.installs(appId, month), CompactInstallSchema)
}

export async function appendInstalls(
  appId: string,
  month: string,
  rows: Install[]
): Promise<{ added: number; skipped: number }> {
  const existing = await readInstalls(appId, month)
  const seen = new Set(existing.map(dedupKey))
  let skipped = 0
  const merged = [...existing]
  for (const r of rows) {
    const k = dedupKey(r)
    if (seen.has(k)) {
      skipped++
      continue
    }
    seen.add(k)
    merged.push(r)
  }
  await writeJsonl(KEY.installs(appId, month), merged)
  return { added: merged.length - existing.length, skipped }
}

export async function readEvents(
  appId: string,
  month: string
): Promise<Install[]> {
  return readJsonl(KEY.events(appId, month), CompactInstallSchema)
}

export async function appendEvents(
  appId: string,
  month: string,
  rows: Install[]
): Promise<{ added: number; skipped: number }> {
  const existing = await readEvents(appId, month)
  const seen = new Set(
    existing.map((r) => `${dedupKey(r)}|${r.eventName}|${r.eventRevenueUsd}`)
  )
  let skipped = 0
  const merged = [...existing]
  for (const r of rows) {
    const k = `${dedupKey(r)}|${r.eventName}|${r.eventRevenueUsd}`
    if (seen.has(k)) {
      skipped++
      continue
    }
    seen.add(k)
    merged.push(r)
  }
  await writeJsonl(KEY.events(appId, month), merged)
  return { added: merged.length - existing.length, skipped }
}

// === Cohort summary ===

export async function putCohortSummary(
  appId: string,
  summary: unknown
): Promise<void> {
  await writeJson(KEY.cohort(appId), summary)
}

export async function getCohortSummaryUrl(appId: string): Promise<string | null> {
  const { blobs } = await list({ prefix: KEY.cohort(appId), limit: 1 })
  if (!blobs.length) return null
  return blobs[0].url
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npx vitest run src/shared/api/appsflyer/__tests__/blob-store.test.ts
```

Expected: PASS (mock-based, 실 Blob 호출 없음).

- [ ] **Step 5: commit**

```bash
npx tsc --noEmit
git add src/shared/api/appsflyer/blob-store.ts src/shared/api/appsflyer/__tests__/blob-store.test.ts
git commit -m "feat(appsflyer): typed Vercel Blob I/O layer with JSONL dedup append"
```

---

### Task 5: rate-limiter.ts — ETag CAS 기반 call counter

Vercel Blob 은 `put` 응답에 ETag 를 반환하지 않으므로, 우회 전략: state.json 안의 `callsUsedToday` 를 직접 편집하되 **낙관적 재시도 + per-request generation counter** 로 관리. 순수 계산 로직만 이 파일에 두고, 실 CAS 는 orchestrator 에서 짧은 critical section 으로 처리.

**Files:**
- Create: `src/shared/api/appsflyer/rate-limiter.ts`
- Test: `src/shared/api/appsflyer/__tests__/rate-limiter.test.ts`

- [ ] **Step 1: 실패 테스트**

Create `src/shared/api/appsflyer/__tests__/rate-limiter.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import {
  DAILY_QUOTA,
  needsReset,
  nextResetAt,
  consume,
} from "../rate-limiter"

describe("rate-limiter", () => {
  it("resets when resetAt has passed", () => {
    const past = new Date(Date.now() - 1000).toISOString()
    expect(needsReset(past)).toBe(true)
  })

  it("does not reset when resetAt in future", () => {
    const future = new Date(Date.now() + 60_000).toISOString()
    expect(needsReset(future)).toBe(false)
  })

  it("nextResetAt is UTC midnight of next day", () => {
    const iso = nextResetAt(new Date("2026-04-23T10:00:00Z"))
    expect(iso).toBe("2026-04-24T00:00:00.000Z")
  })

  it("consume decrements quota", () => {
    const result = consume({ used: 5, needed: 3 })
    expect(result.ok).toBe(true)
    expect(result.nextUsed).toBe(8)
  })

  it("consume rejects when would exceed quota", () => {
    const result = consume({ used: 18, needed: 3 })
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/quota/)
  })

  it("consume allows exactly hitting quota", () => {
    const result = consume({ used: 17, needed: 3 })
    expect(result.ok).toBe(true)
    expect(result.nextUsed).toBe(DAILY_QUOTA)
  })
})
```

- [ ] **Step 2: 실패 확인**

```bash
npx vitest run src/shared/api/appsflyer/__tests__/rate-limiter.test.ts
```

Expected: FAIL (module missing).

- [ ] **Step 3: 구현**

Create `src/shared/api/appsflyer/rate-limiter.ts`:

```typescript
export const DAILY_QUOTA = 20  // AppsFlyer Pull API 한도 (per dev_token)

export function needsReset(resetAtIso: string): boolean {
  return new Date(resetAtIso).getTime() <= Date.now()
}

export function nextResetAt(now: Date = new Date()): string {
  // 다음 UTC 자정
  const next = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0)
  )
  return next.toISOString()
}

export type ConsumeResult =
  | { ok: true; nextUsed: number }
  | { ok: false; reason: string }

export function consume(args: { used: number; needed: number }): ConsumeResult {
  const next = args.used + args.needed
  if (next > DAILY_QUOTA) {
    return {
      ok: false,
      reason: `daily quota ${DAILY_QUOTA} would be exceeded (used=${args.used}, needed=${args.needed})`,
    }
  }
  return { ok: true, nextUsed: next }
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npx vitest run src/shared/api/appsflyer/__tests__/rate-limiter.test.ts
```

Expected: PASS, 6 tests green.

- [ ] **Step 5: commit**

```bash
npx tsc --noEmit
git add src/shared/api/appsflyer/rate-limiter.ts src/shared/api/appsflyer/__tests__/rate-limiter.test.ts
git commit -m "feat(appsflyer): daily quota helpers (consume + UTC-midnight reset)"
```

---

### Task 6: errors.ts — 에러 타입 추가

**Files:**
- Modify: `src/shared/api/appsflyer/errors.ts`

- [ ] **Step 1: 읽고 현재 구조 파악**

```bash
cat src/shared/api/appsflyer/errors.ts
```

Expected: 기존 `AppsFlyerHttpError` 등의 class 정의 확인.

- [ ] **Step 2: 에러 추가**

Modify `src/shared/api/appsflyer/errors.ts` — 파일 끝에 append:

```typescript
export class CredentialInvalidError extends Error {
  readonly status: number
  constructor(status: 401 | 403, message = "AppsFlyer credentials rejected") {
    super(message)
    this.name = "CredentialInvalidError"
    this.status = status
  }
}

export class AppMissingError extends Error {
  constructor(public readonly appId: string) {
    super(`AppsFlyer app not found: ${appId}`)
    this.name = "AppMissingError"
  }
}

export class ThrottledError extends Error {
  constructor(public readonly retryAfterMs: number) {
    super(`AppsFlyer throttled; retry after ${retryAfterMs}ms`)
    this.name = "ThrottledError"
  }
}

export class BackfillInProgressError extends Error {
  constructor(public readonly appId: string) {
    super(`Another sync is in progress for ${appId}`)
    this.name = "BackfillInProgressError"
  }
}

export class QuotaExceededError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "QuotaExceededError"
  }
}
```

- [ ] **Step 3: typecheck + commit**

```bash
npx tsc --noEmit
git add src/shared/api/appsflyer/errors.ts
git commit -m "feat(appsflyer): add credential/missing/throttled/in-progress/quota errors"
```

---

## Phase 1 완료 조건

```bash
npx vitest run src/shared/api/appsflyer/__tests__/
```

Expected: 모든 테스트 PASS (types, crypto, blob-store, rate-limiter).

```bash
npx tsc --noEmit
```

Expected: 타입 에러 0.

---

# Phase 2 — Domain Logic (Tasks 7–12)

Cohort/revenue 집계 + sync orchestrator. 가장 핵심 비즈니스 로직 — aggregation.ts 의 정확성이 Bayesian 결과 전체를 좌우.

---

### Task 7: aggregation.ts — cohort 계산 (설치 + 이벤트 → d1/d7/d30)

**Files:**
- Create: `src/shared/api/appsflyer/aggregation.ts`
- Test: `src/shared/api/appsflyer/__tests__/aggregation.test.ts`

- [ ] **Step 1: 실패 테스트 (cohort 기본 케이스)**

Create `src/shared/api/appsflyer/__tests__/aggregation.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import { computeCohorts, extractInstallDate } from "../aggregation"
import type { CompactInstall } from "../types"

function install(
  installTime: string,
  extras: Partial<CompactInstall> = {}
): CompactInstall {
  return {
    installTime,
    partner: null,
    mediaSource: "Organic",
    costValue: null,
    eventRevenueUsd: null,
    eventName: null,
    countryCode: "KR",
    platform: "ios",
    ...extras,
  }
}

describe("extractInstallDate", () => {
  it("extracts YYYY-MM-DD in UTC", () => {
    expect(extractInstallDate("2026-04-10 23:00:00")).toBe("2026-04-10")
  })
})

describe("computeCohorts", () => {
  it("counts unique installers per install date", () => {
    const installs: CompactInstall[] = [
      install("2026-04-10 00:00:00", { countryCode: "KR" }),
      install("2026-04-10 12:00:00", { countryCode: "US" }),
      install("2026-04-11 00:00:00"),
    ]
    const result = computeCohorts({ installs, events: [], now: new Date("2026-04-25T00:00:00Z") })
    expect(result.cohorts["2026-04-10"].n).toBe(2)
    expect(result.cohorts["2026-04-11"].n).toBe(1)
  })

  it("attributes d1 retention when an event occurs within [24h, 48h) of install", () => {
    const installs: CompactInstall[] = [
      install("2026-04-10 10:00:00", { mediaSource: "Facebook" }),
    ]
    // 동일 user (mediaSource 로 proxy) 의 session 이벤트
    const events: CompactInstall[] = [
      install("2026-04-11 11:00:00", {
        eventName: "af_session",
        mediaSource: "Facebook",
      }),
    ]
    const result = computeCohorts({
      installs,
      events,
      now: new Date("2026-04-25T00:00:00Z"),
    })
    expect(result.cohorts["2026-04-10"].d1_retained).toBe(1)
  })

  it("does not compute d30 for cohorts younger than 30 days", () => {
    const installs: CompactInstall[] = [
      install("2026-04-20 00:00:00"),
    ]
    const result = computeCohorts({
      installs,
      events: [],
      now: new Date("2026-04-25T00:00:00Z"),
    })
    expect(result.cohorts["2026-04-20"].d30_retained).toBeUndefined()
  })

  it("computes empty result for empty inputs", () => {
    const result = computeCohorts({
      installs: [],
      events: [],
      now: new Date(),
    })
    expect(Object.keys(result.cohorts).length).toBe(0)
    expect(result.revenue.total.sumUsd).toBe(0)
  })
})
```

- [ ] **Step 2: 실패 확인**

```bash
npx vitest run src/shared/api/appsflyer/__tests__/aggregation.test.ts
```

Expected: FAIL.

- [ ] **Step 3: 구현 — cohort 부분**

Create `src/shared/api/appsflyer/aggregation.ts`:

```typescript
import type { CompactInstall, CohortSummary } from "./types"

const MS_PER_DAY = 24 * 60 * 60 * 1000

export function extractInstallDate(installTime: string): string {
  // CompactInstall.installTime = "YYYY-MM-DD HH:MM:SS" UTC
  return installTime.slice(0, 10)
}

function parseInstallUtc(installTime: string): number {
  // "YYYY-MM-DD HH:MM:SS" → UTC ms
  const [d, t] = installTime.split(" ")
  const [Y, M, D] = d.split("-").map(Number)
  const [h, m, s] = t.split(":").map(Number)
  return Date.UTC(Y, M - 1, D, h, m, s)
}

function userKey(row: CompactInstall): string {
  // AppsFlyer Pull API 는 installId 컬럼을 주지 않을 수 있음.
  // install 시각 + 파트너/미디어소스 + 국가 조합으로 근사 unique key.
  return [
    row.installTime,
    row.mediaSource ?? "",
    row.partner ?? "",
    row.countryCode ?? "",
  ].join("|")
}

type CohortEntry = {
  n: number
  d1_retained?: number
  d7_retained?: number
  d30_retained?: number
}

type ComputeArgs = {
  installs: CompactInstall[]
  events: CompactInstall[]
  now: Date
}

export function computeCohorts(args: ComputeArgs): CohortSummary {
  const { installs, events, now } = args
  const nowMs = now.getTime()

  // 1) cohort 집계: installDate → Set<userKey>
  const cohortUsers = new Map<string, Map<string, number>>()  // date → key → installMs
  for (const row of installs) {
    const date = extractInstallDate(row.installTime)
    const key = userKey(row)
    const ms = parseInstallUtc(row.installTime)
    if (!cohortUsers.has(date)) cohortUsers.set(date, new Map())
    const m = cohortUsers.get(date)!
    if (!m.has(key)) m.set(key, ms)  // 가장 이른 설치만 유지
  }

  // 2) event window 인덱스: userKey → [eventMs...]
  const eventTimesByUser = new Map<string, number[]>()
  for (const ev of events) {
    if (!ev.eventName) continue
    if (ev.eventName === "install") continue  // install 재기록 제외
    const key = userKey(ev)
    const ms = parseInstallUtc(ev.installTime)
    const list = eventTimesByUser.get(key)
    if (list) list.push(ms)
    else eventTimesByUser.set(key, [ms])
  }

  // 3) d1 / d7 / d30 retention: 각 user 가 해당 window 에 event 있는지
  const cohorts: Record<string, CohortEntry> = {}
  for (const [date, users] of cohortUsers) {
    const entry: CohortEntry = { n: users.size }
    let d1 = 0, d7 = 0, d30 = 0
    let d1Eligible = 0, d7Eligible = 0, d30Eligible = 0
    for (const [key, installMs] of users) {
      const events = eventTimesByUser.get(key) ?? []
      // d1: 설치 후 24~48h 내 event
      const ageMs = nowMs - installMs
      if (ageMs >= 2 * MS_PER_DAY) {
        d1Eligible++
        if (events.some((t) => t >= installMs + MS_PER_DAY && t < installMs + 2 * MS_PER_DAY)) d1++
      }
      if (ageMs >= 8 * MS_PER_DAY) {
        d7Eligible++
        if (events.some((t) => t >= installMs + 7 * MS_PER_DAY && t < installMs + 8 * MS_PER_DAY)) d7++
      }
      if (ageMs >= 31 * MS_PER_DAY) {
        d30Eligible++
        if (events.some((t) => t >= installMs + 30 * MS_PER_DAY && t < installMs + 31 * MS_PER_DAY)) d30++
      }
    }
    if (d1Eligible > 0) entry.d1_retained = d1
    if (d7Eligible > 0) entry.d7_retained = d7
    if (d30Eligible > 0) entry.d30_retained = d30
    cohorts[date] = entry
  }

  // 4) revenue 집계 — Task 8 에서 채움
  const revenue = { daily: [] as Array<{date: string; sumUsd: number; purchasers: number}>, total: { sumUsd: 0, purchasers: 0 } }

  return {
    updatedAt: now.toISOString(),
    cohorts,
    revenue,
  }
}
```

- [ ] **Step 4: 테스트 통과**

```bash
npx vitest run src/shared/api/appsflyer/__tests__/aggregation.test.ts
```

Expected: PASS.

- [ ] **Step 5: commit**

```bash
npx tsc --noEmit
git add src/shared/api/appsflyer/aggregation.ts src/shared/api/appsflyer/__tests__/aggregation.test.ts
git commit -m "feat(appsflyer): cohort d1/d7/d30 retention aggregation with eligibility gate"
```

---

### Task 8: aggregation.ts — revenue 집계

**Files:**
- Modify: `src/shared/api/appsflyer/aggregation.ts`
- Modify: `src/shared/api/appsflyer/__tests__/aggregation.test.ts`

- [ ] **Step 1: 실패 테스트 추가**

Append to `aggregation.test.ts`:

```typescript
describe("computeCohorts: revenue", () => {
  it("sums purchase revenue per day", () => {
    const events: CompactInstall[] = [
      install("2026-04-10 05:00:00", {
        eventName: "af_purchase",
        eventRevenueUsd: 9.99,
        mediaSource: "A",
      }),
      install("2026-04-10 08:00:00", {
        eventName: "af_purchase",
        eventRevenueUsd: 4.99,
        mediaSource: "B",
      }),
      install("2026-04-11 10:00:00", {
        eventName: "af_purchase",
        eventRevenueUsd: 1.99,
        mediaSource: "C",
      }),
    ]
    const result = computeCohorts({
      installs: [],
      events,
      now: new Date("2026-04-25T00:00:00Z"),
    })
    expect(result.revenue.daily).toEqual([
      { date: "2026-04-10", sumUsd: 14.98, purchasers: 2 },
      { date: "2026-04-11", sumUsd: 1.99, purchasers: 1 },
    ])
    expect(result.revenue.total.sumUsd).toBeCloseTo(16.97, 2)
    expect(result.revenue.total.purchasers).toBe(3)
  })

  it("ignores non-purchase events and null revenue", () => {
    const events: CompactInstall[] = [
      install("2026-04-10 05:00:00", {
        eventName: "af_session",
        eventRevenueUsd: null,
      }),
      install("2026-04-10 06:00:00", {
        eventName: "af_purchase",
        eventRevenueUsd: null,  // 명시적 null revenue 는 skip
      }),
    ]
    const result = computeCohorts({
      installs: [],
      events,
      now: new Date(),
    })
    expect(result.revenue.total.sumUsd).toBe(0)
    expect(result.revenue.total.purchasers).toBe(0)
  })
})
```

- [ ] **Step 2: 실패 확인**

```bash
npx vitest run src/shared/api/appsflyer/__tests__/aggregation.test.ts
```

Expected: FAIL (revenue 처리 미구현).

- [ ] **Step 3: aggregation.ts 의 revenue 부분 구현**

Replace revenue 섹션 in `aggregation.ts`:

```typescript
  // 4) revenue 집계
  const PURCHASE_EVENTS = new Set(["af_purchase", "purchase"])
  const daily = new Map<string, { sumUsd: number; purchasers: number }>()
  let totalSum = 0
  let totalPurchasers = 0
  for (const ev of events) {
    if (!ev.eventName) continue
    if (!PURCHASE_EVENTS.has(ev.eventName)) continue
    const rev = ev.eventRevenueUsd
    if (rev == null || rev <= 0) continue
    const date = extractInstallDate(ev.installTime)
    const acc = daily.get(date) ?? { sumUsd: 0, purchasers: 0 }
    acc.sumUsd += rev
    acc.purchasers += 1
    daily.set(date, acc)
    totalSum += rev
    totalPurchasers += 1
  }
  const dailyArr = [...daily.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({
      date,
      sumUsd: Math.round(v.sumUsd * 100) / 100,
      purchasers: v.purchasers,
    }))
  const revenue = {
    daily: dailyArr,
    total: {
      sumUsd: Math.round(totalSum * 100) / 100,
      purchasers: totalPurchasers,
    },
  }
```

- [ ] **Step 4: 테스트 통과**

```bash
npx vitest run src/shared/api/appsflyer/__tests__/aggregation.test.ts
```

Expected: PASS all.

- [ ] **Step 5: commit**

```bash
git add src/shared/api/appsflyer/aggregation.ts src/shared/api/appsflyer/__tests__/aggregation.test.ts
git commit -m "feat(appsflyer): revenue aggregation (daily + total) with purchase event filter"
```

---

### Task 9: fetcher.ts — fetchInAppEvents wrapper

**Files:**
- Modify: `src/shared/api/appsflyer/fetcher.ts`

- [ ] **Step 1: 현재 구조 파악**

```bash
grep -n "export" src/shared/api/appsflyer/fetcher.ts
```

Expected: `fetchPullReport`, `fetchNonOrganicInstalls`, `fetchOrganicInstalls`, `parseCsv` 정도.

- [ ] **Step 2: 신규 함수 추가**

Append in `fetcher.ts`:

```typescript
/**
 * in_app_events_report 전용 wrapper.
 * purchase/session 이벤트 등 non-install 이벤트를 가져옴.
 * 기본 additionalFields 는 revenue 관련 컬럼만.
 */
export async function fetchInAppEvents(params: {
  devToken: string
  appId: string
  from: string   // "YYYY-MM-DD"
  to: string
  additionalFields?: string[]
}) {
  return fetchPullReport({
    devToken: params.devToken,
    appId: params.appId,
    reportType: "in_app_events_report",
    from: params.from,
    to: params.to,
    additionalFields: params.additionalFields ?? [
      "event_name",
      "event_revenue_usd",
    ],
  })
}
```

- [ ] **Step 3: typecheck + commit**

```bash
npx tsc --noEmit
git add src/shared/api/appsflyer/fetcher.ts
git commit -m "feat(appsflyer): fetchInAppEvents wrapper for in_app_events_report"
```

---

### Task 10: orchestrator.ts — runAppsFlyerSync 재구성

**Files:**
- Create: `src/shared/api/appsflyer/orchestrator.ts`
- Test: `src/shared/api/appsflyer/__tests__/orchestrator.test.ts`

이 파일은 전체 sync 체인의 "두뇌". 5-step progress 업데이트, 상태 전이, 쿼터 체크, 에러 분류.

- [ ] **Step 1: 실패 테스트 (happy path)**

Create `src/shared/api/appsflyer/__tests__/orchestrator.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock fetcher, blob-store, crypto modules before importing orchestrator.
vi.mock("../fetcher", () => ({
  fetchNonOrganicInstalls: vi.fn(),
  fetchOrganicInstalls: vi.fn(),
  fetchInAppEvents: vi.fn(),
}))

const blobData = new Map<string, any>()
vi.mock("../blob-store", () => ({
  getApp: vi.fn(async (appId: string) => blobData.get(`app:${appId}`) ?? null),
  getAccount: vi.fn(async (id: string) => blobData.get(`account:${id}`) ?? null),
  getState: vi.fn(async (appId: string) => blobData.get(`state:${appId}`) ?? null),
  putState: vi.fn(async (state: any) => blobData.set(`state:${state.appId}`, state)),
  appendInstalls: vi.fn(async () => ({ added: 0, skipped: 0 })),
  appendEvents: vi.fn(async () => ({ added: 0, skipped: 0 })),
  putCohortSummary: vi.fn(async () => {}),
  readInstalls: vi.fn(async () => []),
  readEvents: vi.fn(async () => []),
  listApps: vi.fn(async () => []),
}))

vi.mock("../crypto", () => ({
  decryptToken: vi.fn(() => "decoded-token"),
}))

import { runAppsFlyerSync } from "../orchestrator"
import * as fetcher from "../fetcher"
import * as blob from "../blob-store"

beforeEach(() => {
  blobData.clear()
  vi.clearAllMocks()

  blobData.set("app:com.test.a", {
    appId: "com.test.a",
    accountId: "acc_12345678",
    gameKey: "sample-match-3",
    label: "Test",
    createdAt: new Date().toISOString(),
  })
  blobData.set("account:acc_12345678", {
    id: "acc_12345678",
    tokenHash: "f".repeat(64),
    encryptedToken: "iv:ct:tag",
    currency: "KRW",
    label: "T",
    createdAt: new Date().toISOString(),
  })
  blobData.set("state:com.test.a", {
    appId: "com.test.a",
    status: "backfilling",
    progress: { step: 0, total: 5, rowsFetched: 0 },
    callsUsedToday: 0,
    callsResetAt: new Date(Date.now() + 86400_000).toISOString(),
    syncLock: null,
    failureHistory: [],
  })
})

describe("runAppsFlyerSync — happy path", () => {
  it("transitions state: backfilling → active", async () => {
    ;(fetcher.fetchNonOrganicInstalls as any).mockResolvedValue([
      { installTime: "2026-04-20 12:00:00", mediaSource: "Facebook", partner: null,
        costValue: null, eventRevenueUsd: null, eventName: null,
        countryCode: "KR", platform: "ios" },
    ])
    ;(fetcher.fetchOrganicInstalls as any).mockResolvedValue([])
    ;(fetcher.fetchInAppEvents as any).mockResolvedValue([])

    await runAppsFlyerSync({
      appId: "com.test.a",
      window: { from: "2026-04-09", to: "2026-04-22" },
    })

    const final = blobData.get("state:com.test.a")
    expect(final.status).toBe("active")
    expect(final.progress.step).toBe(5)
    expect(final.lastSyncAt).toBeDefined()
  })
})

describe("runAppsFlyerSync — error classification", () => {
  it("transitions to credential_invalid on 401", async () => {
    ;(fetcher.fetchNonOrganicInstalls as any).mockRejectedValue(
      Object.assign(new Error("401"), { status: 401 })
    )
    await runAppsFlyerSync({
      appId: "com.test.a",
      window: { from: "2026-04-09", to: "2026-04-22" },
    })
    expect(blobData.get("state:com.test.a").status).toBe("credential_invalid")
  })

  it("transitions to app_missing on 404", async () => {
    ;(fetcher.fetchNonOrganicInstalls as any).mockRejectedValue(
      Object.assign(new Error("404"), { status: 404 })
    )
    await runAppsFlyerSync({
      appId: "com.test.a",
      window: { from: "2026-04-09", to: "2026-04-22" },
    })
    expect(blobData.get("state:com.test.a").status).toBe("app_missing")
  })

  it("marks partial when organic fails but installs succeed", async () => {
    ;(fetcher.fetchNonOrganicInstalls as any).mockResolvedValue([])
    ;(fetcher.fetchOrganicInstalls as any).mockRejectedValue(new Error("boom"))
    ;(fetcher.fetchInAppEvents as any).mockResolvedValue([])

    await runAppsFlyerSync({
      appId: "com.test.a",
      window: { from: "2026-04-09", to: "2026-04-22" },
    })
    const final = blobData.get("state:com.test.a")
    expect(final.status).toBe("active")
    expect(final.failureHistory.some((f: any) => f.type === "partial")).toBe(true)
  })
})

describe("runAppsFlyerSync — quota gate", () => {
  it("skips with warning when quota would be exceeded", async () => {
    blobData.set("state:com.test.a", {
      ...blobData.get("state:com.test.a"),
      callsUsedToday: 18,  // needs 3 → would be 21
    })
    await runAppsFlyerSync({
      appId: "com.test.a",
      window: { from: "2026-04-09", to: "2026-04-22" },
    })
    const final = blobData.get("state:com.test.a")
    expect(final.failureHistory.some((f: any) => f.message.includes("quota"))).toBe(true)
    expect(fetcher.fetchNonOrganicInstalls).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: 실패 확인**

```bash
npx vitest run src/shared/api/appsflyer/__tests__/orchestrator.test.ts
```

Expected: FAIL.

- [ ] **Step 3: 구현**

Create `src/shared/api/appsflyer/orchestrator.ts`:

```typescript
import { fetchNonOrganicInstalls, fetchOrganicInstalls, fetchInAppEvents } from "./fetcher"
import {
  getApp,
  getAccount,
  getState,
  putState,
  appendInstalls,
  appendEvents,
  putCohortSummary,
  readInstalls,
  readEvents,
} from "./blob-store"
import { decryptToken } from "./crypto"
import { consume, needsReset, nextResetAt } from "./rate-limiter"
import { computeCohorts } from "./aggregation"
import type { AppState, CompactInstall } from "./types"

const SYNC_REPORTS = 3  // installs + organic + events
const TIMEOUT_BUDGET_MS = 240_000  // 240s (Vercel 300s limit 내 여유)

type SyncArgs = {
  appId: string
  window: { from: string; to: string }
  organicEnabled?: boolean
}

type FailureLog = {
  type: "retryable" | "throttled" | "auth_invalid" | "not_found" | "partial" | "full_failure"
  message: string
  report?: string
}

function monthKey(date: string): string {
  return date.slice(0, 7)  // "YYYY-MM"
}

function classifyError(e: unknown): "auth_invalid" | "not_found" | "throttled" | "retryable" {
  const status = (e as { status?: number } | undefined)?.status
  if (status === 401 || status === 403) return "auth_invalid"
  if (status === 404) return "not_found"
  if (status === 429) return "throttled"
  return "retryable"
}

function pushFailure(state: AppState, f: FailureLog): void {
  const entry = { at: new Date().toISOString(), ...f }
  state.failureHistory = [entry, ...state.failureHistory].slice(0, 10)
}

export async function runAppsFlyerSync(args: SyncArgs): Promise<AppState> {
  const startMs = Date.now()
  const { appId, window } = args
  const organicEnabled = args.organicEnabled ?? true

  const app = await getApp(appId)
  if (!app) throw new Error(`app not registered: ${appId}`)
  const account = await getAccount(app.accountId)
  if (!account) throw new Error(`account missing: ${app.accountId}`)
  let state = await getState(appId)
  if (!state) throw new Error(`state missing: ${appId}`)

  // 쿼터 리셋
  if (needsReset(state.callsResetAt)) {
    state.callsUsedToday = 0
    state.callsResetAt = nextResetAt()
  }

  // 쿼터 체크 (최대 3 calls 필요)
  const quota = consume({ used: state.callsUsedToday, needed: SYNC_REPORTS })
  if (!quota.ok) {
    pushFailure(state, { type: "retryable", message: quota.reason })
    await putState(state)
    return state
  }

  const devToken = decryptToken(account.encryptedToken)
  const reportFailures: FailureLog[] = []

  // === Step 1/5: installs ===
  state.progress = { step: 1, total: 5, currentReport: "installs", rowsFetched: 0 }
  await putState(state)
  let installRows: CompactInstall[] = []
  try {
    installRows = await fetchNonOrganicInstalls({
      devToken,
      appId,
      from: window.from,
      to: window.to,
    })
    state.callsUsedToday += 1
  } catch (e) {
    const type = classifyError(e)
    if (type === "auth_invalid") {
      state.status = "credential_invalid"
      pushFailure(state, { type: "auth_invalid", message: String(e), report: "installs" })
      await putState(state)
      return state
    }
    if (type === "not_found") {
      state.status = "app_missing"
      pushFailure(state, { type: "not_found", message: String(e), report: "installs" })
      await putState(state)
      return state
    }
    state.status = "failed"
    pushFailure(state, { type: "full_failure", message: String(e), report: "installs" })
    await putState(state)
    return state
  }
  if (installRows.length) {
    await appendInstalls(appId, monthKey(window.from), installRows)
  }

  if (Date.now() - startMs > TIMEOUT_BUDGET_MS) {
    state.status = "active"
    state.progress = { step: 1, total: 5, rowsFetched: installRows.length }
    pushFailure(state, { type: "partial", message: "timeout budget exhausted after installs" })
    await putState(state)
    return state
  }

  // === Step 2/5: organic ===
  state.progress = { step: 2, total: 5, currentReport: "organic", rowsFetched: installRows.length }
  await putState(state)
  let organicRows: CompactInstall[] = []
  if (organicEnabled) {
    try {
      organicRows = await fetchOrganicInstalls({
        devToken,
        appId,
        from: window.from,
        to: window.to,
      })
      state.callsUsedToday += 1
      if (organicRows.length) {
        await appendInstalls(appId, monthKey(window.from), organicRows)
      }
    } catch (e) {
      reportFailures.push({
        type: "partial",
        message: `organic fetch failed: ${e}`,
        report: "organic",
      })
    }
  }

  // === Step 3/5: events ===
  state.progress = {
    step: 3,
    total: 5,
    currentReport: "events",
    rowsFetched: installRows.length + organicRows.length,
  }
  await putState(state)
  let eventRows: CompactInstall[] = []
  try {
    eventRows = await fetchInAppEvents({
      devToken,
      appId,
      from: window.from,
      to: window.to,
    })
    state.callsUsedToday += 1
    if (eventRows.length) {
      await appendEvents(appId, monthKey(window.from), eventRows)
    }
  } catch (e) {
    reportFailures.push({
      type: "partial",
      message: `events fetch failed: ${e}`,
      report: "events",
    })
  }

  // === Step 4/5: aggregation ===
  state.progress = {
    step: 4,
    total: 5,
    currentReport: "aggregation",
    rowsFetched: installRows.length + organicRows.length + eventRows.length,
  }
  await putState(state)

  const allInstalls = await readInstalls(appId, monthKey(window.from))
  const allEvents = await readEvents(appId, monthKey(window.from))
  const summary = computeCohorts({
    installs: allInstalls,
    events: allEvents,
    now: new Date(),
  })
  await putCohortSummary(appId, summary)

  // === Step 5/5: finalize ===
  state.status = "active"
  state.progress = {
    step: 5,
    total: 5,
    rowsFetched: allInstalls.length + allEvents.length,
  }
  state.lastSyncAt = new Date().toISOString()
  state.lastWindow = window
  for (const f of reportFailures) pushFailure(state, f)
  await putState(state)
  return state
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npx vitest run src/shared/api/appsflyer/__tests__/orchestrator.test.ts
```

Expected: PASS.

- [ ] **Step 5: commit**

```bash
npx tsc --noEmit
git add src/shared/api/appsflyer/orchestrator.ts src/shared/api/appsflyer/__tests__/orchestrator.test.ts
git commit -m "feat(appsflyer): orchestrator with 5-step progress + error classification + quota gate"
```

---

### Task 11: snapshot-derive.ts 축소 + snapshot.ts 삭제

**Files:**
- Modify: `src/shared/api/appsflyer/snapshot-derive.ts`
- Delete: `src/shared/api/appsflyer/snapshot.ts`

`snapshot-derive.ts` 는 이제 **CohortSummary → UI-ready 메트릭** 변환만 담당.

- [ ] **Step 1: 읽고 기존 함수 파악**

```bash
cat src/shared/api/appsflyer/snapshot-derive.ts
```

Expected: `deriveCardMetrics(snapshot)` 류 함수가 보임.

- [ ] **Step 2: 재작성**

Replace full content of `src/shared/api/appsflyer/snapshot-derive.ts`:

```typescript
import type { AppState, CohortSummary } from "./types"

export type CardMetrics = {
  status: AppState["status"]
  lastSyncAt?: string
  totalInstalls: number
  arpu: number | null
  cpi: number | null
}

/**
 * CohortSummary 와 state 로부터 connections 카드가 표시할 지표 derive.
 * installsSum 은 별도 인자로 (reader 가 합산).
 */
export function deriveCardMetrics(args: {
  state: AppState
  summary: CohortSummary | null
  installsSum: number
  costSum: number
}): CardMetrics {
  const { state, summary, installsSum, costSum } = args
  const revenueSum = summary?.revenue.total.sumUsd ?? 0
  const purchasers = summary?.revenue.total.purchasers ?? 0
  return {
    status: state.status,
    lastSyncAt: state.lastSyncAt,
    totalInstalls: installsSum,
    arpu: installsSum > 0 ? revenueSum / installsSum : null,
    cpi: installsSum > 0 && costSum > 0 ? costSum / installsSum : null,
  }
}
```

- [ ] **Step 3: snapshot.ts 삭제**

```bash
git rm src/shared/api/appsflyer/snapshot.ts
```

- [ ] **Step 4: snapshot.json 삭제 (v2 데이터)**

Phase 6 의 마이그레이션 스크립트가 실 Blob 으로 옮긴 후 최종 삭제. 지금은 **유지** — 현재 UI 가 이 파일을 직접 읽고 있으면 Phase 5 에서 대체한 후 삭제.

- [ ] **Step 5: typecheck + commit**

```bash
npx tsc --noEmit
# 타입 에러 날 가능성 큼 — index.ts 에서 snapshot.ts export 가 남아있을 수 있음.
# 해당 export 제거.
```

Modify `src/shared/api/appsflyer/index.ts` — `readSnapshot`/`writeSnapshot` export 줄 삭제.

```bash
npx tsc --noEmit
git add src/shared/api/appsflyer/snapshot-derive.ts src/shared/api/appsflyer/snapshot.ts src/shared/api/appsflyer/index.ts
git commit -m "refactor(appsflyer): snapshot.ts 제거, snapshot-derive 는 CohortSummary→UI 메트릭으로 축소"
```

---

### Task 12: index.ts barrel 정리

**Files:**
- Modify: `src/shared/api/appsflyer/index.ts`

- [ ] **Step 1: 정리**

Replace with:

```typescript
export { runAppsFlyerSync } from "./orchestrator"
export {
  fetchPullReport,
  fetchNonOrganicInstalls,
  fetchOrganicInstalls,
  fetchInAppEvents,
  parseCsv,
} from "./fetcher"
export { afHttp } from "./client"
export {
  putAccount,
  getAccount,
  listAccounts,
  putApp,
  getApp,
  listApps,
  putState,
  getState,
  readInstalls,
  appendInstalls,
  readEvents,
  appendEvents,
  putCohortSummary,
} from "./blob-store"
export { encryptToken, decryptToken, maskToken } from "./crypto"
export { DAILY_QUOTA, consume, needsReset, nextResetAt } from "./rate-limiter"
export { computeCohorts } from "./aggregation"
export { deriveCardMetrics } from "./snapshot-derive"
export type {
  Account,
  App,
  AppState,
  AppStatus,
  CohortSummary,
  RegisterRequest,
  GameKey,
} from "./types"
export {
  CredentialInvalidError,
  AppMissingError,
  ThrottledError,
  BackfillInProgressError,
  QuotaExceededError,
} from "./errors"
```

- [ ] **Step 2: typecheck + commit**

```bash
npx tsc --noEmit
git add src/shared/api/appsflyer/index.ts
git commit -m "refactor(appsflyer): public barrel 재구성 (v3 surface)"
```

---

## Phase 2 완료 조건

```bash
npx vitest run src/shared/api/appsflyer/__tests__/
npx tsc --noEmit
```

Expected: 모든 테스트 PASS, 타입 에러 0.

---

# Phase 3 — API Routes (Tasks 13–17)

HTTP endpoint 5개. 모두 Zod 검증 + 명시적 에러 응답.

---

### Task 13: POST /api/appsflyer/register

**Files:**
- Create: `src/app/api/appsflyer/register/route.ts`

- [ ] **Step 1: 구현**

```typescript
import { NextResponse } from "next/server"
import { randomBytes, createHash } from "node:crypto"
import { waitUntil } from "@vercel/functions"
import {
  RegisterRequestSchema,
  runAppsFlyerSync,
  putAccount,
  putApp,
  putState,
  getApp,
  listAccounts,
  encryptToken,
  fetchNonOrganicInstalls,
  nextResetAt,
} from "@/shared/api/appsflyer"

export const runtime = "nodejs"  // crypto 때문에 node runtime 명시

function makeAccountId(): string {
  return `acc_${randomBytes(4).toString("hex")}`
}

function sha256hex(s: string): string {
  return createHash("sha256").update(s).digest("hex")
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const parsed = RegisterRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_request", issues: parsed.error.flatten() },
      { status: 400 }
    )
  }
  const { dev_token, app_id, app_label, game_key, home_currency } = parsed.data

  // 중복 appId 체크
  const existingApp = await getApp(app_id)
  if (existingApp) {
    return NextResponse.json(
      { error: "app_already_registered", appId: app_id },
      { status: 409 }
    )
  }

  // validation ping: 1-day 범위 installs 호출
  try {
    const today = new Date().toISOString().slice(0, 10)
    await fetchNonOrganicInstalls({
      devToken: dev_token,
      appId: app_id,
      from: today,
      to: today,
    })
  } catch (e) {
    const status = (e as { status?: number }).status
    if (status === 401 || status === 403) {
      return NextResponse.json({ error: "invalid_token" }, { status: 400 })
    }
    if (status === 404) {
      return NextResponse.json({ error: "app_not_found" }, { status: 400 })
    }
    return NextResponse.json(
      { error: "validation_failed", detail: String(e) },
      { status: 503 }
    )
  }

  // 동일 token 의 기존 account 찾기 (프로그레시브 2-레벨 모델)
  const tokenHash = sha256hex(dev_token)
  const accounts = await listAccounts()
  let account = accounts.find((a) => a.tokenHash === tokenHash)
  if (!account) {
    account = {
      id: makeAccountId(),
      tokenHash,
      encryptedToken: encryptToken(dev_token),
      currency: home_currency,
      label: `${home_currency} account`,
      createdAt: new Date().toISOString(),
    }
    await putAccount(account)
  }

  // App 등록
  const app = {
    appId: app_id,
    accountId: account.id,
    gameKey: game_key,
    label: app_label,
    createdAt: new Date().toISOString(),
  }
  await putApp(app)

  // 초기 state
  const state = {
    appId: app_id,
    status: "backfilling" as const,
    progress: { step: 0, total: 5 as const, rowsFetched: 0 },
    callsUsedToday: 1,  // validation ping 1 call
    callsResetAt: nextResetAt(),
    syncLock: null,
    failureHistory: [],
  }
  await putState(state)

  // Backfill 14-day 비동기 시작
  const today = new Date()
  const to = today.toISOString().slice(0, 10)
  const fromDate = new Date(today)
  fromDate.setUTCDate(fromDate.getUTCDate() - 14)
  const from = fromDate.toISOString().slice(0, 10)

  waitUntil(
    runAppsFlyerSync({ appId: app_id, window: { from, to } }).catch(
      (e) => console.error("[register] backfill failed", e)
    )
  )

  return NextResponse.json(
    { appId: app_id, accountId: account.id, status: "backfilling" },
    { status: 202 }
  )
}
```

- [ ] **Step 2: typecheck**

```bash
npx tsc --noEmit
```

Expected: 타입 에러 없음. `@vercel/functions` 패키지가 아직 설치되지 않았을 수 있음:

```bash
npm install @vercel/functions --legacy-peer-deps
```

- [ ] **Step 3: manual smoke (선택, 나중에)**

로컬에서 확인은 Phase 6 에서. 지금은 typecheck 통과만.

- [ ] **Step 4: commit**

```bash
git add src/app/api/appsflyer/register/route.ts package.json package-lock.json
git commit -m "feat(api/appsflyer): POST /register with validation ping + async backfill"
```

---

### Task 14: GET /api/appsflyer/state/[appId]

**Files:**
- Create: `src/app/api/appsflyer/state/[appId]/route.ts`

- [ ] **Step 1: 구현**

```typescript
import { NextResponse } from "next/server"
import { getState } from "@/shared/api/appsflyer"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  _req: Request,
  context: { params: Promise<{ appId: string }> }
) {
  const { appId } = await context.params
  const state = await getState(appId)
  if (!state) {
    return NextResponse.json({ error: "not_found" }, { status: 404 })
  }
  return NextResponse.json(state, {
    headers: { "cache-control": "no-store" },
  })
}
```

- [ ] **Step 2: typecheck + commit**

```bash
npx tsc --noEmit
git add src/app/api/appsflyer/state/
git commit -m "feat(api/appsflyer): GET /state/[appId] polling endpoint"
```

---

### Task 15: POST /api/appsflyer/sync/[appId] (기존 route 파라미터화)

**Files:**
- Modify: `src/app/api/appsflyer/sync/route.ts` — 삭제 후 `[appId]/route.ts` 로 이동

- [ ] **Step 1: 기존 route 확인**

```bash
cat src/app/api/appsflyer/sync/route.ts
```

- [ ] **Step 2: `[appId]/route.ts` 생성**

Create `src/app/api/appsflyer/sync/[appId]/route.ts`:

```typescript
import { NextResponse } from "next/server"
import { waitUntil } from "@vercel/functions"
import { runAppsFlyerSync, getApp, getState } from "@/shared/api/appsflyer"
import { BackfillInProgressError } from "@/shared/api/appsflyer/errors"

export const runtime = "nodejs"

export async function POST(
  req: Request,
  context: { params: Promise<{ appId: string }> }
) {
  const { appId } = await context.params
  const app = await getApp(appId)
  if (!app) {
    return NextResponse.json({ error: "not_found" }, { status: 404 })
  }
  const state = await getState(appId)
  if (state?.status === "backfilling") {
    return NextResponse.json(
      { error: "backfill_in_progress" },
      { status: 409 }
    )
  }

  // 14-day default, body 로 override 가능
  const body = await req.json().catch(() => ({}))
  const to = body.to ?? new Date().toISOString().slice(0, 10)
  const fromDate = new Date(to)
  fromDate.setUTCDate(fromDate.getUTCDate() - 14)
  const from = body.from ?? fromDate.toISOString().slice(0, 10)

  waitUntil(
    runAppsFlyerSync({ appId, window: { from, to } }).catch(console.error)
  )
  return NextResponse.json({ status: "syncing", window: { from, to } }, { status: 202 })
}
```

- [ ] **Step 3: 기존 route.ts 삭제**

```bash
rm src/app/api/appsflyer/sync/route.ts
```

- [ ] **Step 4: typecheck + commit**

```bash
npx tsc --noEmit
git add src/app/api/appsflyer/sync/
git commit -m "feat(api/appsflyer): POST /sync/[appId] with lock + default 14-day window"
```

---

### Task 16: GET /api/appsflyer/cron

**Files:**
- Create: `src/app/api/appsflyer/cron/route.ts`

- [ ] **Step 1: 구현**

```typescript
import { NextResponse } from "next/server"
import { listApps, runAppsFlyerSync } from "@/shared/api/appsflyer"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300  // 5분 timeout

export async function GET(req: Request) {
  const auth = req.headers.get("authorization")
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const apps = await listApps()
  const today = new Date().toISOString().slice(0, 10)
  const fromDate = new Date()
  fromDate.setUTCDate(fromDate.getUTCDate() - 14)
  const from = fromDate.toISOString().slice(0, 10)

  const results: Array<{ appId: string; status: string; error?: string }> = []

  for (const app of apps) {
    try {
      const finalState = await runAppsFlyerSync({
        appId: app.appId,
        window: { from, to: today },
      })
      results.push({ appId: app.appId, status: finalState.status })
    } catch (e) {
      results.push({ appId: app.appId, status: "failed", error: String(e) })
    }
  }

  return NextResponse.json({ ran: results.length, results })
}
```

- [ ] **Step 2: typecheck + commit**

```bash
npx tsc --noEmit
git add src/app/api/appsflyer/cron/
git commit -m "feat(api/appsflyer): GET /cron — sequential sync of all registered apps"
```

---

### Task 17: vercel.json 에 cron 등록

**Files:**
- Modify: `vercel.json` (없으면 신규)

- [ ] **Step 1: 기존 확인**

```bash
cat vercel.json 2>/dev/null || echo "no vercel.json"
```

- [ ] **Step 2: crons 섹션 추가**

Create/modify `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/appsflyer/cron",
      "schedule": "0 18 * * *"
    }
  ]
}
```

Schedule `0 18 * * *` = 매일 UTC 18:00 = KST 03:00.

- [ ] **Step 3: commit**

```bash
git add vercel.json
git commit -m "feat(vercel): daily AppsFlyer cron at 18:00 UTC (= KST 03:00)"
```

---

## Phase 3 완료 조건

```bash
npx tsc --noEmit
npm run build
```

Expected: 빌드 성공. API route 4개 노출 (register/state/sync/cron).

---

# Phase 4 — Registration UI (Tasks 18–23)

React 컴포넌트 + polling hook. Framer Motion 애니메이션은 기존 `PageTransition` 에 맡기고, 컴포넌트 자체는 상태 전환만.

---

### Task 18: useAfState polling hook

**Files:**
- Create: `src/shared/hooks/use-af-state.ts`

- [ ] **Step 1: 구현**

```typescript
"use client"

import { useEffect, useState } from "react"
import type { AppState } from "@/shared/api/appsflyer"

type FetchState =
  | { kind: "loading" }
  | { kind: "ok"; state: AppState }
  | { kind: "notfound" }
  | { kind: "error"; message: string }

const POLL_INTERVAL_MS = 2000
const TERMINAL_STATES = new Set([
  "active",
  "stale",
  "failed",
  "credential_invalid",
  "app_missing",
])

export function useAfState(appId: string | null): FetchState {
  const [data, setData] = useState<FetchState>({ kind: "loading" })

  useEffect(() => {
    if (!appId) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    async function tick() {
      try {
        const res = await fetch(`/api/appsflyer/state/${appId}`, {
          cache: "no-store",
        })
        if (cancelled) return
        if (res.status === 404) {
          setData({ kind: "notfound" })
          return
        }
        if (!res.ok) {
          setData({ kind: "error", message: `HTTP ${res.status}` })
          return
        }
        const state = (await res.json()) as AppState
        setData({ kind: "ok", state })
        if (!TERMINAL_STATES.has(state.status)) {
          timer = setTimeout(tick, POLL_INTERVAL_MS)
        }
      } catch (e) {
        if (cancelled) return
        setData({ kind: "error", message: String(e) })
      }
    }

    void tick()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [appId])

  return data
}
```

- [ ] **Step 2: typecheck + commit**

```bash
npx tsc --noEmit
git add src/shared/hooks/use-af-state.ts
git commit -m "feat(hooks): useAfState — 2s polling, auto-stop on terminal state"
```

---

### Task 19: register-modal 컴포넌트

**Files:**
- Create: `src/widgets/connections/ui/register-modal.tsx`

- [ ] **Step 1: 기존 Dialog/Input 컴포넌트 확인**

```bash
ls src/shared/ui/ | grep -iE "dialog|modal|input|button"
```

Expected: Button, Input, Dialog 류 컴포넌트 존재 확인.

- [ ] **Step 2: 구현**

```typescript
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/shared/ui/button"
import { Input } from "@/shared/ui/input"
import { RegisterRequestSchema } from "@/shared/api/appsflyer"

const GAME_OPTIONS = [
  { key: "portfolio", label: "Portfolio" },
  { key: "sample-match-3", label: "Sample Match-3" },
  { key: "sample-puzzle", label: "Weaving Fairy" },
  { key: "sample-idle", label: "Dig Infinity" },
] as const

const CURRENCY_OPTIONS = ["KRW", "USD", "JPY", "EUR"] as const

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function RegisterModal({ open, onOpenChange }: Props) {
  const router = useRouter()
  const [devToken, setDevToken] = useState("")
  const [appId, setAppId] = useState("")
  const [appLabel, setAppLabel] = useState("")
  const [gameKey, setGameKey] = useState<(typeof GAME_OPTIONS)[number]["key"]>(
    "sample-match-3"
  )
  const [currency, setCurrency] = useState<(typeof CURRENCY_OPTIONS)[number]>(
    "KRW"
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const parsed = RegisterRequestSchema.safeParse({
      dev_token: devToken,
      app_id: appId,
      app_label: appLabel,
      game_key: gameKey,
      home_currency: currency,
    })
    if (!parsed.success) {
      setError("입력값이 유효하지 않습니다. 형식을 확인해주세요.")
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch("/api/appsflyer/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed.data),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(
          body.error === "invalid_token"
            ? "AppsFlyer 토큰이 유효하지 않습니다."
            : body.error === "app_not_found"
            ? "App ID 를 찾을 수 없습니다."
            : body.error === "app_already_registered"
            ? "이미 등록된 App ID 입니다."
            : "등록 실패. 잠시 후 다시 시도해주세요."
        )
        setSubmitting(false)
        return
      }
      onOpenChange(false)
      router.refresh()
    } catch (e) {
      setError(`네트워크 오류: ${e}`)
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40">
      <form
        onSubmit={handleSubmit}
        className="w-[420px] rounded-[var(--radius-modal)] border border-[var(--bg-4)] bg-[var(--bg-1)] p-6 space-y-4"
      >
        <h2 className="text-lg font-semibold">AppsFlyer 연동 추가</h2>

        <label className="block space-y-1">
          <span className="text-sm text-[var(--fg-2)]">Dev Token</span>
          <Input
            type="password"
            value={devToken}
            onChange={(e) => setDevToken(e.target.value)}
            placeholder="AppsFlyer dev_token"
            required
            minLength={20}
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm text-[var(--fg-2)]">App ID</span>
          <Input
            value={appId}
            onChange={(e) => setAppId(e.target.value)}
            placeholder="com.example.app"
            required
            pattern="[a-zA-Z0-9._-]{3,64}"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm text-[var(--fg-2)]">앱 별칭</span>
          <Input
            value={appLabel}
            onChange={(e) => setAppLabel(e.target.value)}
            placeholder="Sample Match-3 JP"
            required
            maxLength={80}
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm text-[var(--fg-2)]">연결할 Compass 게임</span>
          <select
            className="w-full rounded-[var(--radius-inline)] border border-[var(--bg-4)] bg-[var(--bg-0)] px-3 py-2"
            value={gameKey}
            onChange={(e) => setGameKey(e.target.value as typeof gameKey)}
          >
            {GAME_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1">
          <span className="text-sm text-[var(--fg-2)]">기본 통화</span>
          <select
            className="w-full rounded-[var(--radius-inline)] border border-[var(--bg-4)] bg-[var(--bg-0)] px-3 py-2"
            value={currency}
            onChange={(e) => setCurrency(e.target.value as typeof currency)}
          >
            {CURRENCY_OPTIONS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>

        {error && (
          <p className="text-sm text-[var(--signal-risk)]">{error}</p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "등록 중..." : "저장"}
          </Button>
        </div>
      </form>
    </div>
  )
}
```

- [ ] **Step 3: typecheck + commit**

```bash
npx tsc --noEmit
git add src/widgets/connections/ui/register-modal.tsx
git commit -m "feat(connections): RegisterModal with 6-field form + Zod validation"
```

---

### Task 20: sync-progress-card 컴포넌트

**Files:**
- Create: `src/widgets/connections/ui/sync-progress-card.tsx`

- [ ] **Step 1: 구현**

```typescript
"use client"

import { useAfState } from "@/shared/hooks/use-af-state"

const STEP_LABELS = ["대기 중", "Installs", "Organic", "Events", "집계", "완료"]

type Props = { appId: string; appLabel: string }

export function SyncProgressCard({ appId, appLabel }: Props) {
  const s = useAfState(appId)

  if (s.kind === "loading") {
    return <Shell label={appLabel}>상태 확인 중…</Shell>
  }
  if (s.kind === "notfound" || s.kind === "error") {
    return <Shell label={appLabel}>상태를 불러올 수 없습니다.</Shell>
  }
  const state = s.state
  if (state.status !== "backfilling") return null

  const step = state.progress.step
  const total = state.progress.total
  const percent = Math.round((step / total) * 100)

  return (
    <Shell label={appLabel}>
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-[var(--fg-2)]">
          <span>⟳ 초기 데이터 수집 중… {step}/{total}</span>
          <span>{STEP_LABELS[step] ?? ""}</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-[var(--radius-inline)] bg-[var(--bg-2)]">
          <div
            className="h-full bg-[var(--brand)] transition-[width]"
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="text-xs text-[var(--fg-3)]">
          {state.progress.rowsFetched.toLocaleString()} rows fetched
        </p>
      </div>
    </Shell>
  )
}

function Shell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--bg-4)] bg-[var(--bg-1)] p-4">
      <h3 className="mb-3 font-medium">{label}</h3>
      {children}
    </div>
  )
}
```

- [ ] **Step 2: typecheck + commit**

```bash
npx tsc --noEmit
git add src/widgets/connections/ui/sync-progress-card.tsx
git commit -m "feat(connections): SyncProgressCard with 5-step progress bar"
```

---

### Task 21: app-card 컴포넌트 (6-state 배지)

**Files:**
- Create: `src/widgets/connections/ui/app-card.tsx`

- [ ] **Step 1: 구현**

```typescript
"use client"

import { useAfState } from "@/shared/hooks/use-af-state"
import { SyncProgressCard } from "./sync-progress-card"
import type { App, AppStatus } from "@/shared/api/appsflyer"

const STATUS_CONFIG: Record<
  AppStatus,
  { label: string; dot: string; signalVar: string }
> = {
  backfilling: { label: "Backfilling", dot: "⟳", signalVar: "--signal-caution" },
  active: { label: "Active", dot: "●", signalVar: "--signal-positive" },
  stale: { label: "Stale", dot: "⚠", signalVar: "--signal-caution" },
  failed: { label: "Failed", dot: "✕", signalVar: "--signal-risk" },
  credential_invalid: {
    label: "Token invalid",
    dot: "✕",
    signalVar: "--signal-risk",
  },
  app_missing: {
    label: "App not found",
    dot: "✕",
    signalVar: "--signal-risk",
  },
}

function daysSince(iso?: string): number | null {
  if (!iso) return null
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
}

export function AppCard({ app }: { app: App }) {
  const s = useAfState(app.appId)

  if (s.kind === "loading") {
    return (
      <Shell app={app}>
        <p className="text-sm text-[var(--fg-3)]">로딩…</p>
      </Shell>
    )
  }
  if (s.kind === "notfound" || s.kind === "error") {
    return (
      <Shell app={app}>
        <p className="text-sm text-[var(--signal-risk)]">
          상태 불러오기 실패
        </p>
      </Shell>
    )
  }
  const state = s.state

  if (state.status === "backfilling") {
    return <SyncProgressCard appId={app.appId} appLabel={app.label} />
  }

  const cfg = STATUS_CONFIG[state.status]
  const since = daysSince(state.lastSyncAt)

  return (
    <Shell app={app}>
      <div className="space-y-2">
        <div
          className="flex items-center gap-2 text-sm font-medium"
          style={{ color: `var(${cfg.signalVar})` }}
        >
          <span>{cfg.dot}</span>
          <span>{cfg.label}</span>
        </div>
        {state.lastSyncAt && (
          <p className="text-xs text-[var(--fg-3)] tabular-nums">
            Last sync: {since === 0 ? "오늘" : `${since}일 전`}
          </p>
        )}
        <p className="text-xs text-[var(--fg-3)] tabular-nums">
          Calls today: {state.callsUsedToday}/20
        </p>
        {state.status === "credential_invalid" && (
          <button className="text-xs text-[var(--brand)] underline">
            토큰 재등록
          </button>
        )}
        {state.status === "app_missing" && (
          <button className="text-xs text-[var(--brand)] underline">
            App ID 수정
          </button>
        )}
        {state.status === "failed" && (
          <RetryButton appId={app.appId} />
        )}
      </div>
    </Shell>
  )
}

function RetryButton({ appId }: { appId: string }) {
  return (
    <button
      onClick={async () => {
        await fetch(`/api/appsflyer/sync/${appId}`, { method: "POST" })
        window.location.reload()
      }}
      className="text-xs text-[var(--brand)] underline"
    >
      재시도
    </button>
  )
}

function Shell({ app, children }: { app: App; children: React.ReactNode }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--bg-4)] bg-[var(--bg-1)] p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="font-medium">{app.label}</h3>
        <span className="text-xs text-[var(--fg-3)] font-mono">{app.appId}</span>
      </div>
      {children}
    </div>
  )
}
```

- [ ] **Step 2: typecheck + commit**

```bash
npx tsc --noEmit
git add src/widgets/connections/ui/app-card.tsx
git commit -m "feat(connections): AppCard with 6-state badges + CTA per error"
```

---

### Task 22: failure-history-tab 컴포넌트

**Files:**
- Create: `src/widgets/connections/ui/failure-history-tab.tsx`

- [ ] **Step 1: 구현**

```typescript
"use client"

import { useAfState } from "@/shared/hooks/use-af-state"

const TYPE_LABELS: Record<string, string> = {
  retryable: "일시적 오류",
  throttled: "요청 한도 초과",
  auth_invalid: "토큰 실패",
  not_found: "App 없음",
  partial: "부분 실패",
  full_failure: "전체 실패",
}

export function FailureHistoryTab({ appId }: { appId: string }) {
  const s = useAfState(appId)
  if (s.kind !== "ok") return null
  const history = s.state.failureHistory
  if (history.length === 0) {
    return <p className="text-sm text-[var(--fg-3)]">최근 이력 없음.</p>
  }
  return (
    <ul className="space-y-2">
      {history.map((h, i) => (
        <li
          key={i}
          className="rounded-[var(--radius-inline)] border border-[var(--bg-4)] bg-[var(--bg-2)] p-3 text-sm"
        >
          <div className="flex justify-between text-xs text-[var(--fg-3)]">
            <span>{TYPE_LABELS[h.type] ?? h.type}</span>
            <time dateTime={h.at} className="tabular-nums">
              {new Date(h.at).toLocaleString("ko-KR")}
            </time>
          </div>
          <p className="mt-1 text-[var(--fg-1)]">{h.message}</p>
          {h.report && (
            <p className="mt-1 text-xs text-[var(--fg-3)]">report: {h.report}</p>
          )}
        </li>
      ))}
    </ul>
  )
}
```

- [ ] **Step 2: typecheck + commit**

```bash
npx tsc --noEmit
git add src/widgets/connections/ui/failure-history-tab.tsx
git commit -m "feat(connections): FailureHistoryTab showing recent 10 failures"
```

---

### Task 23: connections/page.tsx 재구성

**Files:**
- Modify: `src/app/(dashboard)/dashboard/connections/page.tsx`

- [ ] **Step 1: 현재 구조 확인**

```bash
cat src/app/\(dashboard\)/dashboard/connections/page.tsx
```

- [ ] **Step 2: 재작성**

Replace with:

```typescript
import { Suspense } from "react"
import { listApps } from "@/shared/api/appsflyer"
import { RegisterModalTrigger } from "@/widgets/connections/ui/register-modal-trigger"
import { AppCard } from "@/widgets/connections/ui/app-card"

export const dynamic = "force-dynamic"

export default async function ConnectionsPage() {
  const apps = await listApps()

  return (
    <div className="space-y-6">
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold">데이터 연동</h1>
          <p className="mt-1 text-sm text-[var(--fg-2)]">
            AppsFlyer Pull API 로 실 데이터를 수집합니다.
          </p>
        </div>
        <RegisterModalTrigger />
      </header>

      {apps.length === 0 ? (
        <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--bg-4)] p-8 text-center">
          <p className="text-[var(--fg-2)]">등록된 앱이 없습니다.</p>
          <p className="mt-1 text-sm text-[var(--fg-3)]">
            우측 상단 "+ 연동 추가" 버튼으로 시작하세요.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {apps.map((app) => (
            <Suspense key={app.appId} fallback={<div />}>
              <AppCard app={app} />
            </Suspense>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: RegisterModalTrigger 컴포넌트 분리 (client boundary)**

Create `src/widgets/connections/ui/register-modal-trigger.tsx`:

```typescript
"use client"

import { useState } from "react"
import { Button } from "@/shared/ui/button"
import { RegisterModal } from "./register-modal"

export function RegisterModalTrigger() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>+ 연동 추가</Button>
      <RegisterModal open={open} onOpenChange={setOpen} />
    </>
  )
}
```

- [ ] **Step 4: typecheck + build**

```bash
npx tsc --noEmit
npm run build
```

Expected: 빌드 성공.

- [ ] **Step 5: commit**

```bash
git add "src/app/(dashboard)/dashboard/connections/page.tsx" src/widgets/connections/
git commit -m "feat(connections): app list page with registration trigger + per-app cards"
```

---

## Phase 4 완료 조건

로컬에서 페이지 직접 확인 (수동 스모크):

```bash
npm run dev
# 브라우저: http://localhost:3000/dashboard/connections
```

예상:
- 비어 있는 상태 UI → "+ 연동 추가" 버튼 클릭 → 모달 오픈
- 모달 submit → `/api/appsflyer/register` 호출 → 리다이렉트
- 앱 카드가 `backfilling` 으로 표시되고 2초마다 progress 갱신

---

# Phase 5 — Widget Live Integration (Tasks 24–29)

대시보드의 6개 위젯이 AF 데이터를 읽도록 전환. 데이터 없거나 stale 일 때는 mock + ML1/ML2/ML3 배지.

---

### Task 24: useAfMetrics — CohortSummary 로부터 UI 메트릭 derive

**Files:**
- Create: `src/shared/hooks/use-af-metrics.ts`

- [ ] **Step 1: 구현**

```typescript
"use client"

import useSWR from "swr"  // 프로젝트에 이미 있으면 사용, 없으면 대체 가능
import type { CohortSummary, AppState } from "@/shared/api/appsflyer"

// 프로젝트가 SWR 을 쓰지 않으면 아래를 직접 useEffect + useState 로 대체.
// 기존 관행 확인: cat src/shared/hooks/

export type AfMetrics = {
  loaded: boolean
  state: AppState | null
  summary: CohortSummary | null
}

export function useAfMetrics(appId: string | null): AfMetrics {
  const { data: state } = useSWR<AppState | null>(
    appId ? `/api/appsflyer/state/${appId}` : null,
    (url) => fetch(url, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)),
    { refreshInterval: 30_000 }
  )
  const { data: summary } = useSWR<CohortSummary | null>(
    appId ? `/api/appsflyer/cohort/${appId}` : null,
    (url) => fetch(url, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)),
    { refreshInterval: 60_000 }
  )

  return {
    loaded: state != null || summary != null,
    state: state ?? null,
    summary: summary ?? null,
  }
}
```

- [ ] **Step 2: cohort 엔드포인트 추가**

Create `src/app/api/appsflyer/cohort/[appId]/route.ts`:

```typescript
import { NextResponse } from "next/server"
import { getCohortSummaryUrl } from "@/shared/api/appsflyer/blob-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  _req: Request,
  context: { params: Promise<{ appId: string }> }
) {
  const { appId } = await context.params
  const url = await getCohortSummaryUrl(appId)
  if (!url) return NextResponse.json({ error: "not_found" }, { status: 404 })
  const res = await fetch(url, { cache: "no-store" })
  if (!res.ok) return NextResponse.json({ error: "fetch_failed" }, { status: 502 })
  const body = await res.json()
  return NextResponse.json(body, {
    headers: { "cache-control": "no-store" },
  })
}
```

- [ ] **Step 3: SWR 설치 확인 / 대체**

```bash
grep '"swr"' package.json || npm install swr --legacy-peer-deps
```

- [ ] **Step 4: typecheck + commit**

```bash
npx tsc --noEmit
git add src/shared/hooks/use-af-metrics.ts src/app/api/appsflyer/cohort/ package.json package-lock.json
git commit -m "feat(hooks): useAfMetrics + /api/appsflyer/cohort/[appId] endpoint"
```

---

### Task 25: KPICards live + ML1 fallback

**Files:**
- Modify: `src/widgets/dashboard/ui/kpi-cards.tsx`

- [ ] **Step 1: 현재 KPICards 확인**

```bash
grep -n "export\|function" src/widgets/dashboard/ui/kpi-cards.tsx | head -20
```

- [ ] **Step 2: AF 데이터 분기 추가**

Pattern for modification:

```typescript
"use client"

import { useAfMetrics } from "@/shared/hooks/use-af-metrics"
import { useSelectedGame } from "@/shared/store/selected-game"
import { useGameData } from "@/shared/api/use-game-data"

// 기존 import 및 컴포넌트 내부 구조 유지. 다음을 추가:

function MLBadge({ kind, text }: { kind: "ML1" | "ML2" | "ML3"; text: string }) {
  const color =
    kind === "ML1"
      ? "var(--signal-caution)"
      : kind === "ML2"
      ? "var(--signal-caution)"
      : "var(--signal-pending)"
  return (
    <span
      className="ml-2 rounded-[var(--radius-inline)] px-1.5 py-0.5 text-[10px] font-mono tabular-nums"
      style={{ color, border: `1px solid ${color}` }}
    >
      {kind} {text}
    </span>
  )
}

// 기존 컴포넌트 내부:
export function KPICards() {
  const { selected } = useSelectedGame()
  const mock = useGameData(selected)

  // AF appId 를 selected.gameKey 로 매핑 (첫 매칭 앱)
  // 실제 매핑은 별도 fetcher 필요 — 본 task 에선 gameKey → appId 역조회
  const { state, summary } = useAfMetricsForGame(selected?.gameKey ?? null)

  const isLive = state?.status === "active" && summary != null
  const isStale = state?.status === "stale"

  // AF data 있으면 AF 값, 없으면 mock
  const installs = summary
    ? Object.values(summary.cohorts).reduce((s, c) => s + c.n, 0)
    : mock.installs
  const revenue = summary?.revenue.total.sumUsd ?? mock.revenue

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <KPICard
        label="Installs"
        value={installs.toLocaleString()}
        badge={
          !isLive && !isStale ? (
            <MLBadge kind="ML1" text="mock" />
          ) : isStale ? (
            <MLBadge kind="ML2" text={state?.lastSyncAt?.slice(0, 10) ?? ""} />
          ) : null
        }
      />
      <KPICard
        label="Revenue (USD)"
        value={`$${revenue.toLocaleString()}`}
        badge={!isLive && !isStale ? <MLBadge kind="ML1" text="mock" /> : null}
      />
      {/* 나머지 기존 카드 유지 */}
    </div>
  )
}

// helper:
function useAfMetricsForGame(gameKey: string | null) {
  // gameKey → appId 매핑 훅 (apps 리스트에서 찾기)
  // 간단 구현: /api/appsflyer/apps 엔드포인트를 추가해서 client 에서 조회하거나,
  // apps list 를 props 로 전달받기.
  // 본 task 에선 placeholder — 실제 구현은 Phase 5 전체에 걸친 리팩터:
  return { state: null, summary: null } as ReturnType<typeof import("@/shared/hooks/use-af-metrics").useAfMetrics>
}
```

실질적으로는 `gameKey → appId` 역조회가 필요하므로, 먼저 아래 보조 task 추가:

- [ ] **Step 2a: /api/appsflyer/apps 엔드포인트 추가**

Create `src/app/api/appsflyer/apps/route.ts`:

```typescript
import { NextResponse } from "next/server"
import { listApps } from "@/shared/api/appsflyer"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const apps = await listApps()
  return NextResponse.json(apps, {
    headers: { "cache-control": "no-store" },
  })
}
```

- [ ] **Step 2b: useAfAppForGame 훅 추가**

Append to `src/shared/hooks/use-af-metrics.ts`:

```typescript
export function useAfAppForGame(gameKey: string | null) {
  const { data: apps } = useSWR<Array<{ appId: string; gameKey: string }>>(
    "/api/appsflyer/apps",
    (url) => fetch(url, { cache: "no-store" }).then((r) => r.json()),
    { refreshInterval: 60_000 }
  )
  const appId = apps?.find((a) => a.gameKey === gameKey)?.appId ?? null
  return appId
}
```

- [ ] **Step 3: KPICards 최종본으로 교체**

Use `useAfAppForGame` + `useAfMetrics` chain:

```typescript
const appId = useAfAppForGame(selected?.gameKey ?? null)
const { state, summary } = useAfMetrics(appId)
```

나머지는 Step 2 구조 그대로.

- [ ] **Step 4: typecheck + commit**

```bash
npx tsc --noEmit
git add src/widgets/dashboard/ui/kpi-cards.tsx src/shared/hooks/use-af-metrics.ts src/app/api/appsflyer/apps/
git commit -m "feat(dashboard): KPICards live AF data + ML1/ML2 fallback badges"
```

---

### Task 26: DataFreshnessStrip — AF lastSyncAt 표시

**Files:**
- Modify: `src/widgets/dashboard/ui/data-freshness-strip.tsx`

- [ ] **Step 1: 기존 구조 확인 + 수정**

```typescript
"use client"

import { useAfAppForGame, useAfMetrics } from "@/shared/hooks/use-af-metrics"
import { useSelectedGame } from "@/shared/store/selected-game"

export function DataFreshnessStrip() {
  const { selected } = useSelectedGame()
  const appId = useAfAppForGame(selected?.gameKey ?? null)
  const { state } = useAfMetrics(appId)

  const lastSync = state?.lastSyncAt
  const daysAgo = lastSync
    ? Math.floor((Date.now() - new Date(lastSync).getTime()) / 86_400_000)
    : null
  const isStale = daysAgo != null && daysAgo >= 7
  const isMissing = lastSync == null

  return (
    <div className="flex items-center gap-3 rounded-[var(--radius-card)] border border-[var(--bg-4)] bg-[var(--bg-1)] px-4 py-2 text-sm">
      <span className="text-[var(--fg-2)]">Data freshness</span>
      {isMissing ? (
        <span className="text-[var(--signal-pending)]">No AppsFlyer data</span>
      ) : isStale ? (
        <span className="text-[var(--signal-caution)]">
          ⚠ Last sync {daysAgo}d ago
        </span>
      ) : (
        <span className="text-[var(--signal-positive)]">
          ● Last sync {daysAgo === 0 ? "today" : `${daysAgo}d ago`}
        </span>
      )}
      <span className="ml-auto text-xs text-[var(--fg-3)] tabular-nums">
        {lastSync ?? "—"}
      </span>
    </div>
  )
}
```

- [ ] **Step 2: typecheck + commit**

```bash
npx tsc --noEmit
git add src/widgets/dashboard/ui/data-freshness-strip.tsx
git commit -m "feat(dashboard): DataFreshnessStrip live AF lastSyncAt + stale/missing states"
```

---

### Task 27: PriorPosteriorChart — AF posterior + ML3

**Files:**
- Modify: `src/widgets/charts/ui/prior-posterior-chart.tsx`

- [ ] **Step 1: 현재 차트 + Bayesian engine API 확인**

```bash
grep -n "export\|posterior\|prior" src/widgets/charts/ui/prior-posterior-chart.tsx | head
grep -r "updateBetaBinomial\|BetaBinomialModel" src/shared/lib/bayesian-stats/ | head
```

- [ ] **Step 2: posterior 계산 로직 추가**

Modify `prior-posterior-chart.tsx` — mock posterior 계산 부분을 AF 데이터로 교체:

```typescript
// 기존 imports 에 추가
import { useAfAppForGame, useAfMetrics } from "@/shared/hooks/use-af-metrics"
import { useSelectedGame } from "@/shared/store/selected-game"
import { updateBetaBinomial, isValidPosterior } from "@/shared/lib/bayesian-stats"
import { priorByGenre } from "@/shared/api/prior-data"

// 컴포넌트 내부:
const { selected } = useSelectedGame()
const appId = useAfAppForGame(selected?.gameKey ?? null)
const { summary } = useAfMetrics(appId)

// AF cohort → BinomialObs 집계
const d7Obs = summary
  ? Object.values(summary.cohorts).reduce(
      (acc, c) => ({
        n: acc.n + (c.d7_retained != null ? c.n : 0),
        k: acc.k + (c.d7_retained ?? 0),
      }),
      { n: 0, k: 0 }
    )
  : { n: 0, k: 0 }

// Prior (SensorTower) + Posterior update
const prior = priorByGenre(selected?.genre ?? "puzzle")?.retentionD7
const posterior =
  prior && d7Obs.n > 0 ? updateBetaBinomial(prior.beta, d7Obs) : null

const validity = posterior ? isValidPosterior(posterior) : { valid: false }
const showPosterior = posterior != null && validity.valid

// JSX 렌더:
{/* prior 곡선 항상 */}
<PriorCurve params={prior?.beta} />
{showPosterior && <PosteriorCurve params={posterior} />}
{!showPosterior && d7Obs.n > 0 && (
  <MLBadge kind="ML3" text="Sample too small" />
)}
```

(위는 개념 코드. 실제 적용 시 기존 JSX 구조에 맞춰 injection.)

- [ ] **Step 3: typecheck + commit**

```bash
npx tsc --noEmit
git add src/widgets/charts/ui/prior-posterior-chart.tsx
git commit -m "feat(charts): PriorPosteriorChart live AF posterior via BetaBinomial update"
```

---

### Task 28: RetentionCurve — AF cohort → BetaBinomial credible interval

**Files:**
- Modify: `src/widgets/charts/ui/retention-curve.tsx`

- [ ] **Step 1: 수정**

Mock 대신 AF cohort 로부터 d1/d7/d30 각 점의 posterior P10/P50/P90 계산:

```typescript
// 컴포넌트 내부:
const { selected } = useSelectedGame()
const appId = useAfAppForGame(selected?.gameKey ?? null)
const { summary } = useAfMetrics(appId)

function aggregateRetention(summary: CohortSummary | null, day: "d1" | "d7" | "d30") {
  if (!summary) return null
  const rows = Object.values(summary.cohorts)
  const key = `${day}_retained` as "d1_retained" | "d7_retained" | "d30_retained"
  const totalN = rows.reduce((s, c) => s + (c[key] != null ? c.n : 0), 0)
  const totalK = rows.reduce((s, c) => s + (c[key] ?? 0), 0)
  if (totalN === 0) return null
  const prior = priorByGenre(selected?.genre ?? "puzzle")?.[`retentionD${day.slice(1)}`]
  if (!prior) return null
  const posterior = updateBetaBinomial(prior.beta, { n: totalN, k: totalK })
  return {
    p10: betaQuantile(posterior, 0.1),
    p50: betaQuantile(posterior, 0.5),
    p90: betaQuantile(posterior, 0.9),
  }
}

const d1 = aggregateRetention(summary, "d1")
const d7 = aggregateRetention(summary, "d7")
const d30 = aggregateRetention(summary, "d30")

// 각 day 에 대해 P10/P50/P90 밴드 렌더. 데이터 없으면 mock 유지 + ML1 배지.
```

- [ ] **Step 2: typecheck + commit**

```bash
npx tsc --noEmit
git add src/widgets/charts/ui/retention-curve.tsx
git commit -m "feat(charts): RetentionCurve live AF cohort → BetaBinomial P10/P50/P90"
```

---

### Task 29: RevenueForecast — AF events → LogNormal fan

**Files:**
- Modify: `src/widgets/charts/ui/revenue-forecast.tsx`

- [ ] **Step 1: 수정**

LogNormal 모델에 per-purchase revenue 를 feed. Bayesian engine 의 `updateLogNormal` (혹은 유사 API) 사용.

```typescript
const { summary } = useAfMetrics(appId)

// summary.revenue.daily 을 log-transform 해서 관측치 구성
const revenueObs = summary
  ? summary.revenue.daily.flatMap((d) => {
      if (d.purchasers === 0 || d.sumUsd === 0) return []
      const arppu = d.sumUsd / d.purchasers
      return Array(d.purchasers).fill(Math.log(arppu))
    })
  : []

const prior = revenuePriorByGenre(selected?.genre)  // 기존 SensorTower prior
const posterior = revenueObs.length > 0
  ? updateLogNormal(prior, { n: revenueObs.length, logMean: mean(revenueObs), logVar: variance(revenueObs) })
  : null

// fan chart: P10/P50/P90 projection from posterior
```

(실 함수명은 bayesian-stats 엔진의 실제 API 로 교체.)

- [ ] **Step 2: typecheck + commit**

```bash
npx tsc --noEmit
git add src/widgets/charts/ui/revenue-forecast.tsx
git commit -m "feat(charts): RevenueForecast live AF events → LogNormal posterior fan"
```

---

## Phase 5 완료 조건

```bash
npm run build
```

Expected: 빌드 성공. 수동 스모크:

```bash
npm run dev
# /dashboard 진입 → KPI / DataFreshnessStrip 에 live 또는 ML1 표시
# /dashboard/market-gap → PriorPosteriorChart 에 posterior 곡선
```

---

# Phase 6 — Migration + Deployment (Tasks 30–32)

---

### Task 30: scripts/migrate-snapshot-to-blob.ts

**Files:**
- Create: `scripts/migrate-snapshot-to-blob.ts`

- [ ] **Step 1: 구현**

```typescript
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { randomBytes } from "node:crypto"
import {
  putApp,
  putState,
  appendInstalls,
  putCohortSummary,
  nextResetAt,
  computeCohorts,
} from "../src/shared/api/appsflyer"

const V2_PATH = "src/shared/api/data/appsflyer/snapshot.json"

async function main() {
  const gameKey = process.argv[2]
  if (!gameKey) {
    console.error("Usage: tsx scripts/migrate-snapshot-to-blob.ts <gameKey>")
    process.exit(1)
  }

  const raw = await readFile(resolve(V2_PATH), "utf8")
  const v2 = JSON.parse(raw)
  const appId = v2.request.appId

  console.log(`Migrating ${appId} (${gameKey}) …`)

  // App
  await putApp({
    appId,
    accountId: `acc_${randomBytes(4).toString("hex")}`,
    gameKey: gameKey as any,
    label: appId,
    createdAt: v2.fetchedAt,
  })

  // Installs (nonOrganic + organic) — 월 단위 split
  const all = [...(v2.installs.nonOrganic ?? []), ...(v2.installs.organic ?? [])]
  const byMonth = new Map<string, typeof all>()
  for (const row of all) {
    const m = row.installTime.slice(0, 7)
    const arr = byMonth.get(m) ?? []
    arr.push(row)
    byMonth.set(m, arr)
  }
  for (const [m, rows] of byMonth) {
    const { added, skipped } = await appendInstalls(appId, m, rows)
    console.log(`  installs ${m}: +${added} (skipped ${skipped})`)
  }

  // Aggregation
  const summary = computeCohorts({
    installs: all,
    events: [],  // v2 에는 이벤트 데이터 없음
    now: new Date(),
  })
  await putCohortSummary(appId, summary)

  // State (migration 후 active)
  await putState({
    appId,
    status: "active",
    progress: { step: 5, total: 5, rowsFetched: all.length },
    lastSyncAt: v2.fetchedAt,
    lastWindow: { from: v2.request.from, to: v2.request.to },
    callsUsedToday: 0,
    callsResetAt: nextResetAt(),
    syncLock: null,
    failureHistory: [],
  })

  console.log(`✓ Migration complete for ${appId}. Now register credential via UI.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
```

- [ ] **Step 2: 실행 방법 문서화**

Add to `package.json` scripts:

```json
"migrate:af-to-blob": "tsx scripts/migrate-snapshot-to-blob.ts"
```

- [ ] **Step 3: commit**

```bash
git add scripts/migrate-snapshot-to-blob.ts package.json
git commit -m "feat(scripts): v2 snapshot.json → v3 Blob migration"
```

---

### Task 31: 실 마이그레이션 (dry-run 후 실행)

**Files:** (실행만, 커밋 없음)

- [ ] **Step 1: .env.local 확인**

```bash
grep -E "APPSFLYER_MASTER_KEY|BLOB_READ_WRITE_TOKEN" .env.local
```

Expected: 두 줄 존재. `BLOB_READ_WRITE_TOKEN` 이 없으면 `vercel env pull`.

- [ ] **Step 2: dry-run 없음 (파괴적 action 없어서 바로 실행 OK)**

```bash
npm run migrate:af-to-blob sample-match-3
```

Expected: 콘솔에 "installs 2026-02: +X ... ✓ Migration complete" 출력.

- [ ] **Step 3: Blob 확인**

```bash
# Vercel 대시보드 → Storage → Blob → 파일 리스트에 appsflyer/apps/..., installs/... 확인
```

- [ ] **Step 4: snapshot.json 삭제 + commit**

```bash
git rm src/shared/api/data/appsflyer/snapshot.json
git commit -m "chore(appsflyer): remove v2 snapshot.json — data migrated to Blob"
```

- [ ] **Step 5: UI 로 credential 재등록**

로컬 dev 서버 구동 → /dashboard/connections 에서 dev_token + appId 등록 폼으로 마이그레이션된 앱의 credential 을 등록. 이 단계는 사람이 직접.

---

### Task 32: 배포 — Vercel env 등록

**Files:** (Vercel 대시보드 작업, 커밋 없음)

- [ ] **Step 1: Vercel 프로젝트 환경변수 추가**

Vercel dashboard → Project → Settings → Environment Variables:
- `APPSFLYER_MASTER_KEY` (Production + Preview)
- `CRON_SECRET` (Production)
- `BLOB_READ_WRITE_TOKEN` — Blob 생성 시 자동 생성됨

- [ ] **Step 2: PR 생성 → 배포 → Cron 활성 확인**

브랜치 push 후 PR open → Preview 배포 확인 → main merge → Production 배포 → Vercel 대시보드의 Cron 탭에 `/api/appsflyer/cron` 등록 확인.

- [ ] **Step 3: 다음날 첫 Cron 결과 확인**

Vercel Functions Logs 에서 `[cron]` 기록 확인. 모든 앱이 `active` 상태 유지 + `callsUsedToday` 증가.

---

## Phase 6 완료 조건

- ✅ 마이그레이션 스크립트로 기존 v2 데이터 Blob 으로 이관
- ✅ Vercel env 3개 등록
- ✅ Production 배포 후 다음 KST 03:00 Cron 자동 실행 확인
- ✅ `/dashboard/connections` 에 앱 `active` 상태 + 대시보드 위젯 live 표시

---

## Self-Review

### 스펙 커버리지 확인
- ✅ Q1 tenancy (account → app 2-레벨) → Task 2, 13, Blob 키 구조
- ✅ Q2 스코프 C (installs + organic + events) → Task 9, 10
- ✅ Q3 Blob 저장소 → Task 4, Blob 키 구조
- ✅ Q4 Sync 트리거 (수동 + Cron + 등록 즉시) → Task 13, 15, 16
- ✅ Q5 등록 UX (프로그레시브 + validation ping) → Task 13, 19
- ✅ Q6 6개 위젯 live + ML1/2/3 → Task 25, 26, 27, 28, 29
- ✅ Q7 UI only 실패 → Task 22, 10 (failureHistory)
- ✅ 접근 B (async + 2s polling) → Task 18, 20

### 완료 기준
- 신규 16 파일 + 수정 12 파일 + 삭제 1 파일
- 테스트: types / crypto / blob-store / rate-limiter / aggregation / orchestrator 전부 green
- TypeScript 에러 0
- `npm run build` 성공
- Production 배포 후 Cron 1회 성공 확인

### 리스크 / 미해결
- `@vercel/blob` 은 access="public" 만 사용 — token 암호화 전제. 만약 Blob private 티어가 필요해지면 access="private" 로 업그레이드.
- dedupKey (`installTime+mediaSource+partner+countryCode`) 는 근사 unique — AppsFlyer 가 installId 컬럼을 제공하면 교체.
- `useAfMetricsForGame` 의 gameKey → appId 매핑은 첫 매칭만 선택. 여러 앱이 같은 gameKey 에 붙는 시나리오는 Future work.
- Cron 이 timeout 에 걸릴 때 어느 앱까지 처리됐는지 별도 markers 없음. 실패 없이 skip 되면 다음 Cron 이 자연스럽게 처리. 단 timeout 이 잦으면 앱 순서 rotation 필요 (Future work).

---

## 실행 방식 선택

**Plan 완료. 저장 위치: `docs/superpowers/plans/2026-04-23-appsflyer-post-registration-workflow.md`**

두 가지 실행 옵션:

**1. Subagent-Driven (권장)** — 각 task 마다 fresh subagent 디스패치, task 간 리뷰, 빠른 반복

**2. Inline Execution** — 현재 세션에서 `executing-plans` 로 배치 실행, 체크포인트에서 리뷰

**어느 쪽으로 진행할까요?**
