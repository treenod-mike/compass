import { fetchNonOrganicInstalls, fetchOrganicInstalls } from "./fetcher"
import { toCompactInstall } from "./types"
import type {
  AppsFlyerSnapshot,
  CompactInstall,
  RunSyncOptions,
  RunSyncResult,
} from "./types"

export * from "./types"
export * from "./errors"
export { afHttp } from "./client"
export {
  fetchPullReport,
  fetchNonOrganicInstalls,
  fetchOrganicInstalls,
  parseCsv,
} from "./fetcher"
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

  let nonOrganic: CompactInstall[] = []
  let organic: CompactInstall[] = []

  if (opts.installs) {
    try {
      const rows = await fetchNonOrganicInstalls(opts.devToken, opts.installs)
      nonOrganic = rows.map(toCompactInstall)
    } catch (err) {
      warnings.push(`non-organic installs fetch failed: ${(err as Error).message}`)
      throw err
    }

    if (opts.fetchOrganic !== false) {
      try {
        const rows = await fetchOrganicInstalls(opts.devToken, opts.installs)
        organic = rows.map(toCompactInstall)
      } catch (err) {
        // organic 은 선택 — 실패해도 non-organic 결과는 살림
        warnings.push(`organic installs fetch failed: ${(err as Error).message}`)
      }
    }
  }

  const snapshot: AppsFlyerSnapshot = {
    version: 2,
    fetchedAt: new Date().toISOString(),
    request: opts.installs
      ? {
          appId: opts.installs.appId,
          from: opts.installs.from,
          to: opts.installs.to,
        }
      : null,
    installs: opts.installs ? { nonOrganic, organic } : null,
    meta: { warnings, source: "pull-api-v5" },
  }

  return {
    snapshot,
    warnings,
    summary: {
      nonOrganicCount: nonOrganic.length,
      organicCount: organic.length,
      durationMs: Date.now() - started,
    },
  }
}
