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
      {
        ok: false,
        code: "bad_request",
        path: parsed.error.issues[0]?.path.join(".") ?? "body",
      },
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
