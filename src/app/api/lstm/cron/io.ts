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
async function readPrivateJson(path: string): Promise<unknown | null> {
  const result = await get(path, { access: "private" })
  if (!result || result.statusCode !== 200) return null
  const text = await new Response(result.stream).text()
  return JSON.parse(text)
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

export async function readCohortSummary(appId: string): Promise<CohortSummary | null> {
  const json = await readPrivateJson(COHORT_PATH(appId))
  if (json === null) return null
  const parsed = CohortSummarySchema.safeParse(json)
  if (parsed.success) return parsed.data
  console.warn(
    `[lstm-cron-io] CohortSummarySchema parse failed for ${appId}:`,
    parsed.error.message,
  )
  return null
}
