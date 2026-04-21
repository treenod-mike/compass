/**
 * AppsFlyer Pull API 데이터 스냅샷 갱신 CLI.
 * 사용:
 *   npm run fetch:af                         # 최근 14일 installs
 *   npm run fetch:af -- --from 2026-02-01 --to 2026-02-14
 *   npm run fetch:af -- --skip-organic       # non-organic 만
 *   npm run fetch:af -- --dry-run            # fetch만, 저장 없음
 */
import { config as loadDotenv } from "dotenv"
import { resolve } from "node:path"

// Next.js 관례 따름: .env.local 우선, 없으면 .env 폴백
loadDotenv({ path: resolve(process.cwd(), ".env.local") })
loadDotenv({ path: resolve(process.cwd(), ".env") })

import {
  runAppsFlyerSync,
  writeSnapshot,
  type HomeCurrency,
  type InstallsParams,
} from "../src/shared/api/appsflyer"

const DEFAULT_APP_IDS = ["id0000000000"] // 실 app id 또는 bundle id 로 대체
const DEFAULT_HOME_CURRENCY: HomeCurrency = "KRW"
const DEFAULT_WINDOW_DAYS = 14

const argv = process.argv.slice(2)
function flag(name: string): boolean {
  return argv.includes(name)
}
function opt(name: string): string | null {
  const i = argv.indexOf(name)
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] ?? null : null
}

const skipOrganic = flag("--skip-organic")
const dryRun = flag("--dry-run")
const fromArg = opt("--from")
const toArg = opt("--to")

const today = new Date()
const to = toArg ?? today.toISOString().slice(0, 10)
const fromDate = new Date(today)
fromDate.setUTCDate(fromDate.getUTCDate() - DEFAULT_WINDOW_DAYS)
const from = fromArg ?? fromDate.toISOString().slice(0, 10)

const rawToken: string | undefined = process.env.APPSFLYER_DEV_TOKEN
if (!rawToken) {
  console.error("[AF] APPSFLYER_DEV_TOKEN is not set in .env.local")
  process.exit(1)
}
const devToken: string = rawToken

const appId: string = DEFAULT_APP_IDS[0] ?? ""
if (!appId || appId === "id0000000000") {
  console.error(
    "[AF] DEFAULT_APP_IDS is placeholder — edit scripts/fetch-appsflyer.ts with real app id",
  )
  process.exit(1)
}

const installs: InstallsParams = {
  appId,
  from,
  to,
}

async function main(): Promise<void> {
  console.log(`[AF] fetch ${appId} window=${from}→${to}`)
  const result = await runAppsFlyerSync({
    devToken,
    appIds: DEFAULT_APP_IDS,
    homeCurrency: DEFAULT_HOME_CURRENCY,
    installs,
    fetchOrganic: !skipOrganic,
  })

  console.log(
    `[AF] non-organic=${result.summary.nonOrganicCount} organic=${result.summary.organicCount} (${result.summary.durationMs}ms)`,
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
}

main().catch((err) => {
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
})
