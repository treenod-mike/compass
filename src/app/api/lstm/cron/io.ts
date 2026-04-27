import { list } from "@vercel/blob"
import {
  AppSchema,
  CohortSummarySchema,
  type App,
  type CohortSummary,
} from "../../../../shared/api/appsflyer/types"

const APPS_PREFIX = "appsflyer/apps/"
const COHORT_PATH = (appId: string) => `appsflyer/cohort/${appId}/summary.json`

export async function readAllApps(): Promise<App[]> {
  const { blobs } = await list({ prefix: APPS_PREFIX })
  const out: App[] = []
  for (const b of blobs) {
    if (!b.pathname.endsWith(".json")) continue
    const res = await fetch(b.url)
    if (!res.ok) continue
    const json = await res.json()
    const parsed = AppSchema.safeParse(json)
    if (parsed.success) out.push(parsed.data)
  }
  return out
}

export async function readCohortSummary(appId: string): Promise<CohortSummary | null> {
  const { blobs } = await list({ prefix: COHORT_PATH(appId), limit: 1 })
  if (blobs.length === 0) return null
  const res = await fetch(blobs[0]!.url)
  if (!res.ok) return null
  const json = await res.json()
  const parsed = CohortSummarySchema.safeParse(json)
  return parsed.success ? parsed.data : null
}
