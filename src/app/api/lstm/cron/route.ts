import { NextResponse } from "next/server"
import { checkSufficiency, type SufficiencyReason } from "../../../../shared/api/lstm/sufficiency"
import { buildGameForecast } from "../../../../shared/api/lstm/forecast-builder"
import { writeLstmSnapshots } from "../../../../shared/api/lstm/blob-writer"
import { getPrior } from "../../../../shared/api/prior-data"
import type { LstmSnapshot } from "../../../../shared/api/vc-simulation/types"
import type { RevenueSnapshot } from "../../../../shared/api/lstm/revenue-snapshot"
import { readAllApps, readCohortSummary } from "./io"

type Skipped = {
  gameId: string
  reason:
    | SufficiencyReason
    | "zero_arpdau"
    | "forecast_failed"
    | "input_schema_invalid"
    | "cohort_absent"
    | "cohort_fetch_failed"
}

export const dynamic = "force-dynamic"
export const maxDuration = 300

export async function GET(req: Request): Promise<Response> {
  const startedAt = Date.now()
  const expected = process.env.CRON_SECRET
  const auth = req.headers.get("authorization") ?? ""
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  let apps: Awaited<ReturnType<typeof readAllApps>>
  try {
    apps = await readAllApps()
  } catch (err) {
    console.error("[lstm-cron] readAllApps failed:", err)
    return NextResponse.json({ ok: false, error: "blob_fetch_failed" }, { status: 502 })
  }

  if (apps.length === 0) {
    return NextResponse.json({
      ok: true,
      processed: [],
      skipped: [],
      snapshots: null,
      elapsedMs: Date.now() - startedAt,
    })
  }

  const processed: string[] = []
  const skipped: Skipped[] = []
  const retentionPredictions: LstmSnapshot["predictions"] = {}
  const revenueArpdau: Record<string, number> = {}
  const revenueInstalls: Record<string, number> = {}
  const revenueForecasts: RevenueSnapshot["forecast"] = {}

  for (const app of apps) {
    let summary: Awaited<ReturnType<typeof readCohortSummary>>
    try {
      summary = await readCohortSummary(app.appId)
    } catch (err) {
      // io.readCohortSummary throws with a prefixed message we can classify on:
      //   "schema_invalid: …"     → input_schema_invalid (alert worth)
      //   anything else           → cohort_fetch_failed   (transient, retry next tick)
      const msg = String(err)
      const reason: Skipped["reason"] = msg.includes("schema_invalid")
        ? "input_schema_invalid"
        : "cohort_fetch_failed"
      console.error(`[lstm-cron] readCohortSummary ${reason} for ${app.appId}:`, err)
      skipped.push({ gameId: app.appId, reason })
      continue
    }
    if (!summary) {
      // No cohort blob yet — AppsFlyer cron has not synced this app. Legitimate skip.
      skipped.push({ gameId: app.appId, reason: "cohort_absent" })
      continue
    }

    const suff = checkSufficiency(summary, {
      appId: app.appId,
      genre: app.genre,
      region: app.region,
    })
    if (!suff.ok) {
      skipped.push({ gameId: suff.gameId, reason: suff.reason })
      continue
    }

    const bundle = getPrior({ genre: app.genre!, region: app.region! })
    if (!bundle) {
      skipped.push({ gameId: app.appId, reason: "unknown_genre_prior" })
      continue
    }

    let result
    try {
      result = buildGameForecast({
        cohortSummary: summary,
        appsMeta: { appId: app.appId, genre: app.genre!, region: app.region! },
        prior: bundle.retention,
        priorEffectiveN: bundle.effectiveN,
      })
    } catch (err) {
      console.error(`[lstm-cron] buildGameForecast failed for ${app.appId}:`, err)
      skipped.push({ gameId: app.appId, reason: "forecast_failed" })
      continue
    }

    retentionPredictions[app.appId] = {
      game_id: app.appId,
      genre: app.genre!,
      points: result.retentionCurve,
    }

    if (result.arpdauUsd === 0 || result.installsAssumption === 0) {
      skipped.push({ gameId: app.appId, reason: "zero_arpdau" })
    } else {
      revenueArpdau[app.appId] = result.arpdauUsd
      revenueInstalls[app.appId] = result.installsAssumption
      revenueForecasts[app.appId] = { points: result.revenueForecast }
    }

    processed.push(app.appId)
  }

  // Defensive guard: if nothing made it into retentionPredictions, publish nothing.
  if (processed.length === 0 || Object.keys(retentionPredictions).length === 0) {
    return NextResponse.json({
      ok: true,
      processed,
      skipped,
      snapshots: null,
      elapsedMs: Date.now() - startedAt,
    })
  }

  const generatedAt = new Date().toISOString()
  const retentionSnapshot: LstmSnapshot = {
    schema_version: "1.0",
    generated_at: generatedAt,
    model: {
      name: "retention-bayesian-shrinkage",
      version: "phase-2",
      trained_at: generatedAt,
      hyperparameters: {
        lookback_days: 30,
        forecast_horizon_days: 1095,
        sample_count: 1,
        confidence_interval: 0.8,
      },
    },
    predictions: retentionPredictions,
  }

  const revenueSnapshot: RevenueSnapshot | null =
    Object.keys(revenueForecasts).length > 0
      ? {
          schema_version: "1.0",
          generated_at: generatedAt,
          source_retention_at: generatedAt,
          arpdau: { perGame: revenueArpdau, currency: "USD", windowDays: 14 },
          installsAssumption: { perGame: revenueInstalls, method: "trailing-14d-mean" },
          forecast: revenueForecasts,
        }
      : null

  let urls
  try {
    urls = await writeLstmSnapshots({ retentionSnapshot, revenueSnapshot })
  } catch (err) {
    console.error("[lstm-cron] writeLstmSnapshots failed:", err)
    return NextResponse.json(
      { ok: false, error: "blob_put_failed", message: String(err) },
      { status: 502 },
    )
  }

  return NextResponse.json({
    ok: true,
    processed,
    skipped,
    snapshots: urls,
    elapsedMs: Date.now() - startedAt,
  })
}
