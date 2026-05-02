import { list, get } from "@vercel/blob"
import {
  AppSchema,
  CohortSummarySchema,
  type App,
  type CohortSummary,
} from "../../../../shared/api/appsflyer/types"

const APPS_PREFIX = "appsflyer/apps/"
const COHORT_PATH = (appId: string) => `appsflyer/cohort/${appId}/summary.json`

// Private store: SDK 의 get() 이 BLOB_READ_WRITE_TOKEN 으로 자동 인증.
// fetch(meta.url) 는 private store 에서 401 — 반드시 get() 경유.
//
// Three failure modes are kept distinct so callers can react differently:
//   - absent (404 / no result)     → return null   (e.g. cohort not synced yet)
//   - fetch failure (5xx / network) → throw blob_fetch_failed (retry next tick)
//   - body unparsable (bad JSON)   → throw blob_parse_failed (alert worth)
async function readPrivateJson(path: string): Promise<unknown | null> {
  let result: Awaited<ReturnType<typeof get>>
  try {
    result = await get(path, { access: "private" })
  } catch (err) {
    // Vercel Blob throws on missing key — distinguish "not found" from real failures.
    const msg = String(err)
    if (msg.includes("BlobNotFoundError") || msg.includes("not found") || msg.includes("404")) {
      return null
    }
    throw new Error(`blob_fetch_failed: ${path}: ${msg}`)
  }
  if (!result) return null
  // Vercel Blob types narrow to 200/304 only, but mocks/edge cases may surface
  // other status codes — defend with a runtime cast + check before reading.
  const status = (result as { statusCode?: number }).statusCode
  if (status === 404) return null
  if (status != null && status !== 200 && status !== 304) {
    throw new Error(`blob_fetch_failed: ${path}: status=${status}`)
  }
  const text = await new Response(result.stream).text()
  try {
    return JSON.parse(text)
  } catch (err) {
    throw new Error(`blob_parse_failed: ${path}: ${String(err)}`)
  }
}

export async function readAllApps(): Promise<App[]> {
  const { blobs } = await list({ prefix: APPS_PREFIX })
  const out: App[] = []
  for (const b of blobs) {
    if (!b.pathname.endsWith(".json")) continue
    let json: unknown
    try {
      json = await readPrivateJson(b.pathname)
    } catch (err) {
      console.warn(`[lstm-cron-io] readPrivateJson failed for ${b.pathname}:`, err)
      continue
    }
    if (json === null) continue
    const parsed = AppSchema.safeParse(json)
    if (parsed.success) {
      out.push(parsed.data)
    } else {
      console.warn(
        `[lstm-cron-io] AppSchema parse failed for ${b.pathname}:`,
        parsed.error.message,
      )
    }
  }
  return out
}

// null  → cohort blob does not exist yet (legitimate skip).
// throw → fetch / parse / schema problem; caller classifies the cause from
//         the message prefix (blob_fetch_failed | blob_parse_failed | schema_invalid).
export async function readCohortSummary(appId: string): Promise<CohortSummary | null> {
  const json = await readPrivateJson(COHORT_PATH(appId))
  if (json === null) return null
  const parsed = CohortSummarySchema.safeParse(json)
  if (parsed.success) return parsed.data
  throw new Error(`schema_invalid: ${appId}: ${parsed.error.message}`)
}
