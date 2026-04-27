#!/usr/bin/env tsx
import { readAllApps, readCohortSummary } from "../src/app/api/lstm/cron/io"
import { checkSufficiency } from "../src/shared/api/lstm/sufficiency"
import { buildGameForecast } from "../src/shared/api/lstm/forecast-builder"
import { getPrior } from "../src/shared/api/prior-data"

async function main() {
  const args = process.argv.slice(2)
  const gameIdFlag = args.find((a) => a.startsWith("--gameId="))?.split("=")[1]

  const apps = await readAllApps()
  const targets = gameIdFlag ? apps.filter((a) => a.appId === gameIdFlag) : apps
  if (targets.length === 0) {
    console.error(`no apps matched (filter=${gameIdFlag ?? "*"})`)
    process.exit(1)
  }

  const out: unknown[] = []
  for (const app of targets) {
    const summary = await readCohortSummary(app.appId)
    if (!summary) {
      out.push({ gameId: app.appId, status: "no_cohort_summary" })
      continue
    }
    const suff = checkSufficiency(summary, app)
    if (!suff.ok) {
      out.push({ gameId: app.appId, status: "skipped", reason: suff.reason })
      continue
    }
    const bundle = getPrior({ genre: app.genre!, region: app.region! })
    if (!bundle) {
      out.push({ gameId: app.appId, status: "skipped", reason: "unknown_genre_prior" })
      continue
    }
    const result = buildGameForecast({
      cohortSummary: summary,
      appsMeta: { appId: app.appId, genre: app.genre!, region: app.region! },
      prior: bundle.retention,
      priorEffectiveN: bundle.effectiveN,
    })
    out.push({
      gameId: app.appId,
      arpdauUsd: result.arpdauUsd,
      installsAssumption: result.installsAssumption,
      day30RetentionP50: result.retentionCurve[29]?.p50,
      day90RevenueP50: result.revenueForecast[90]?.revenueP50,
      ...(process.env.LSTM_DRY_FULL === "1"
        ? { retentionCurve: result.retentionCurve, revenueForecast: result.revenueForecast }
        : {}),
    })
  }
  console.log(JSON.stringify(out, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
