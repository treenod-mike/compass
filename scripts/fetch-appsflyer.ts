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

async function main(): Promise<void> {
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
