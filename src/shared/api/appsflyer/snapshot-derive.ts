import {
  EMPTY_CARD,
  type AppsFlyerCardData,
  type AppsFlyerSnapshot,
  type CompactInstall,
  type ConnectionStatusLive,
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

function sumCost(rows: CompactInstall[]): number {
  let sum = 0
  for (const r of rows) if (typeof r.costValue === "number") sum += r.costValue
  return sum
}

function sumRevenue(rows: CompactInstall[]): number {
  let sum = 0
  for (const r of rows)
    if (typeof r.eventRevenueUsd === "number") sum += r.eventRevenueUsd
  return sum
}

function formatKrw(v: number): string {
  return `₩${Math.round(v).toLocaleString("ko-KR")}`
}

function formatUsd(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`
  return `$${v.toFixed(2)}`
}

export function deriveCardFromSnapshot(
  snap: AppsFlyerSnapshot,
): AppsFlyerCardData {
  const metrics: AppsFlyerCardData["metrics"] = []

  const nonOrganic = snap.installs?.nonOrganic ?? []
  const organic = snap.installs?.organic ?? []
  const totalInstalls = nonOrganic.length + organic.length

  if (totalInstalls > 0) {
    metrics.push({
      label: "설치",
      value: totalInstalls.toLocaleString("ko-KR"),
    })
  }

  if (nonOrganic.length > 0) {
    const cost = sumCost(nonOrganic)
    if (cost > 0) {
      const cpi = cost / nonOrganic.length
      metrics.push({ label: "CPI", value: formatKrw(cpi) })
    }
  }

  const revenue = sumRevenue([...nonOrganic, ...organic])
  if (revenue > 0) {
    metrics.push({ label: "매출", value: formatUsd(revenue) })
  }

  return {
    status: deriveStatus(snap.fetchedAt),
    lastSync: formatRelative(snap.fetchedAt),
    metrics,
    retentionDepth: null, // 현재 플랜에 retention_report 미포함
  }
}

export { EMPTY_CARD }
