import {
  EMPTY_CARD,
  type AppsFlyerCardData,
  type AppsFlyerSnapshot,
  type ConnectionStatusLive,
  type CohortRow,
  type MasterRow,
} from "./types"

export function deriveStatus(fetchedAt: string): ConnectionStatusLive {
  const t = Date.parse(fetchedAt)
  if (!Number.isFinite(t) || t <= 0) return "disconnected"
  const hours = (Date.now() - t) / 3_600_000
  if (hours < 24) return "connected"
  if (hours < 168) return "warn"
  return "error"
}

export function formatRelative(fetchedAt: string): string {
  const t = Date.parse(fetchedAt)
  if (!Number.isFinite(t) || t <= 0) return "아직 sync 없음"
  const diffSec = Math.max(0, Math.floor((Date.now() - t) / 1000))
  if (diffSec < 60) return `${diffSec}초 전`
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}분 전`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}시간 전`
  return `${Math.floor(diffSec / 86400)}일 전`
}

function sumNumber(
  rows: Array<Record<string, string | number>>,
  key: string,
): number {
  let sum = 0
  for (const row of rows) {
    const v = row[key]
    if (typeof v === "number") sum += v
  }
  return sum
}

function hasKey(
  rows: Array<Record<string, string | number>>,
  key: string,
): boolean {
  return rows.some((row) => key in row)
}

function pickRetentionDepth(rows: CohortRow[]): string | null {
  const candidates: Array<[string, string]> = [
    ["retention_day_30", "D30"],
    ["retention_day_14", "D14"],
    ["retention_day_7", "D7"],
    ["retention_day_3", "D3"],
    ["retention_day_1", "D1"],
  ]
  for (const [key, label] of candidates) {
    if (hasKey(rows, key)) return label
  }
  return null
}

export function deriveCardFromSnapshot(
  snap: AppsFlyerSnapshot,
): AppsFlyerCardData {
  const metrics: AppsFlyerCardData["metrics"] = []

  const masterRows: MasterRow[] = snap.master?.rows ?? []
  if (masterRows.length > 0) {
    const installs = sumNumber(masterRows, "installs")
    if (installs > 0) {
      metrics.push({ label: "설치", value: installs.toLocaleString("ko-KR") })
    }
    const cost = sumNumber(masterRows, "cost")
    const nonOrganic = sumNumber(masterRows, "non_organic_installs")
    const hasCostCol = hasKey(masterRows, "cost")
    const hasNonOrganicCol = hasKey(masterRows, "non_organic_installs")
    if (hasCostCol && hasNonOrganicCol && cost > 0 && nonOrganic > 0) {
      const cpi = Math.round(cost / nonOrganic)
      metrics.push({ label: "CPI", value: `₩${cpi.toLocaleString("ko-KR")}` })
    }
  }

  const cohortRows: CohortRow[] = snap.cohort?.rows ?? []
  const retentionDepth = pickRetentionDepth(cohortRows)
  if (retentionDepth) {
    metrics.push({ label: "리텐션", value: retentionDepth })
  }

  return {
    status: deriveStatus(snap.fetchedAt),
    lastSync: formatRelative(snap.fetchedAt),
    metrics,
    retentionDepth,
  }
}

export { EMPTY_CARD }
