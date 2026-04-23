/**
 * One-shot migration: convert v2 snapshot.json (single-app, monolithic) into
 * v3 Blob layout (account/app/state/installs/cohort).
 *
 * Usage:
 *   npm run migrate:snapshot
 *
 * Requires .env.local with APPSFLYER_DEV_TOKEN, APPSFLYER_MASTER_KEY, BLOB_READ_WRITE_TOKEN.
 */
import { readFileSync, existsSync } from "node:fs"
import { resolve } from "node:path"
import { randomUUID } from "node:crypto"
import { config } from "dotenv"
import {
  putAccount,
  putApp,
  putState,
  putCohortSummary,
  appendInstalls,
  aggregate,
  encryptToken,
  hashToken,
  type ExtendedInstall,
} from "../src/shared/api/appsflyer"

config({ path: ".env.local" })

const SNAPSHOT_PATH = resolve("src/shared/api/data/appsflyer/snapshot.json")

if (!existsSync(SNAPSHOT_PATH)) {
  console.log(`No snapshot at ${SNAPSHOT_PATH} — nothing to migrate.`)
  process.exit(0)
}

const raw = JSON.parse(readFileSync(SNAPSHOT_PATH, "utf-8")) as {
  version?: number
  fetchedAt?: string
  request?: { appId?: string; from?: string; to?: string } | null
  installs?: { nonOrganic?: any[]; organic?: any[] } | null
}

if (raw.version !== 2 || !raw.installs) {
  console.error(
    `Snapshot is not v2 or empty (version=${raw.version}). Aborting.`
  )
  process.exit(1)
}

const devToken = process.env.APPSFLYER_DEV_TOKEN
if (!devToken) {
  console.error(
    "APPSFLYER_DEV_TOKEN missing in .env.local — needed for tokenHash + encryption."
  )
  process.exit(1)
}

const appId = raw.request?.appId
if (!appId) {
  console.error(
    "Snapshot has no request.appId — cannot derive App entry."
  )
  process.exit(1)
}

const accountId = `acc_${randomUUID().replace(/-/g, "").slice(0, 8)}`
const now = new Date().toISOString()

// 1. Account
await putAccount({
  id: accountId,
  tokenHash: hashToken(devToken),
  encryptedToken: encryptToken(devToken),
  currency: "KRW",
  label: "migrated from snapshot.json",
  createdAt: now,
})

// 2. App (gameKey is best-effort — defaults to first non-portfolio enum)
await putApp({
  appId,
  accountId,
  gameKey: "match-league", // adjust manually after migration if needed
  label: "migrated",
  createdAt: now,
})

// 3. Convert v2 CompactInstall → v3 ExtendedInstall (synthesize null appsflyerId
//    since v2 didn't preserve this column — these rows will be skipped by the
//    cohort-aggregator's null filter).
function synthExtend(i: any): ExtendedInstall {
  return {
    installTime: i.installTime ?? null,
    partner: i.partner ?? null,
    mediaSource: i.mediaSource ?? null,
    costValue: i.costValue ?? null,
    eventRevenueUsd: i.eventRevenueUsd ?? null,
    eventName: i.eventName ?? null,
    countryCode: i.countryCode ?? null,
    platform: i.platform ?? null,
    appsflyerId: null, // v2 didn't preserve — caller filter will skip
    eventTime: i.installTime ?? null,
  }
}

const allInstalls: ExtendedInstall[] = [
  ...(raw.installs.nonOrganic ?? []).map(synthExtend),
  ...(raw.installs.organic ?? []).map(synthExtend),
]

// 4. Group by month + append to install shards
const byMonth = new Map<string, ExtendedInstall[]>()
for (const i of allInstalls) {
  if (!i.installTime) continue
  const key = i.installTime.slice(0, 7)
  const list = byMonth.get(key) ?? []
  list.push(i)
  byMonth.set(key, list)
}
for (const [month, list] of byMonth) {
  await appendInstalls(appId, month, list)
}

// 5. Aggregate (no events in v2 → empty events) + write summary
const summary = aggregate(allInstalls, [])
await putCohortSummary(appId, summary)

// 6. Initial state — mark active to skip backfill
await putState({
  appId,
  status: "active",
  progress: { step: 5, total: 5, rowsFetched: allInstalls.length },
  lastSyncAt: raw.fetchedAt ?? now,
  callsUsedToday: 0,
  callsResetAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  syncLock: null,
  failureHistory: [],
})

console.log(
  JSON.stringify(
    {
      accountId,
      appId,
      installsMigrated: allInstalls.length,
      cohortsGenerated: summary.cohorts.length,
      warning:
        "v2 rows lacked appsflyerId — cohort-aggregator skipped them. Future syncs will pull fresh data with the new schema.",
    },
    null,
    2
  )
)
