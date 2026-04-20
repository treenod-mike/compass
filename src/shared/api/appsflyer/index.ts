import { fetchCohortRetention, fetchMasterAggregate } from "./fetcher"
import type {
  AppsFlyerSnapshot,
  CohortRow,
  MasterRow,
  RunSyncOptions,
  RunSyncResult,
} from "./types"

export * from "./types"
export * from "./errors"
export { afHttp } from "./client"
export { fetchMasterAggregate, fetchCohortRetention } from "./fetcher"
export {
  readSnapshot,
  writeSnapshot,
  getAppsFlyerCardData,
  deriveStatus,
} from "./snapshot"

export async function runAppsFlyerSync(
  opts: RunSyncOptions,
): Promise<RunSyncResult> {
  const started = Date.now()
  const warnings: string[] = []

  let masterRows: MasterRow[] = []
  let cohortRows: CohortRow[] = []

  if (opts.master) {
    try {
      masterRows = await fetchMasterAggregate(opts.devToken, opts.master)
    } catch (err) {
      warnings.push(`master fetch failed: ${(err as Error).message}`)
      throw err
    }
  }

  if (opts.cohort) {
    try {
      cohortRows = await fetchCohortRetention(opts.devToken, opts.cohort)
    } catch (err) {
      warnings.push(`cohort fetch failed: ${(err as Error).message}`)
      throw err
    }
  }

  const snapshot: AppsFlyerSnapshot = {
    version: 1,
    fetchedAt: new Date().toISOString(),
    request: { master: opts.master, cohort: opts.cohort },
    master: opts.master ? { rows: masterRows } : null,
    cohort: opts.cohort ? { rows: cohortRows } : null,
    meta: { warnings },
  }

  return {
    snapshot,
    warnings,
    summary: {
      masterRows: masterRows.length,
      cohortRows: cohortRows.length,
      durationMs: Date.now() - started,
    },
  }
}
