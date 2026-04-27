import type { RevenueSnapshot, RevenueForecastPoint as LstmPoint } from "./revenue-snapshot"
import type { RevenueForecastPoint as ChartPoint } from "../mock-data"

export const STALE_THRESHOLD_DAYS = 7
const DAYS_PER_BUCKET = 30
const MS_PER_DAY = 86_400_000

export type RevenueForecastVm = {
  points: ChartPoint[]
  source: "lstm" | "mock"
  ageDays: number
  isStale: boolean
}

export function buildRevenueForecastVm(args: {
  gameId: string
  snapshot: RevenueSnapshot
  mockPoints: ChartPoint[]
  now: Date
}): RevenueForecastVm {
  const { gameId, snapshot, mockPoints, now } = args

  const generatedAt = new Date(snapshot.generated_at).getTime()
  const ageDays = Math.floor((now.getTime() - generatedAt) / MS_PER_DAY)
  const isStale = ageDays > STALE_THRESHOLD_DAYS

  const lstmPoints = snapshot.forecast[gameId]?.points ?? []
  const canUseLstm = !isStale && lstmPoints.length > 0

  if (!canUseLstm) {
    return { points: mockPoints, source: "mock", ageDays, isStale }
  }

  const sortedAnchors = [...lstmPoints].sort((a, b) => a.day - b.day)

  const points: ChartPoint[] = mockPoints.map((mock, i) => {
    const startDay = i * DAYS_PER_BUCKET + 1
    const endDay = (i + 1) * DAYS_PER_BUCKET

    let p10Sum = 0
    let p50Sum = 0
    let p90Sum = 0
    for (let d = startDay; d <= endDay; d++) {
      const r = interpolateAt(sortedAnchors, d)
      p10Sum += r.p10
      p50Sum += r.p50
      p90Sum += r.p90
    }

    let p10 = p10Sum
    let p50 = p50Sum
    let p90 = p90Sum
    if (p10 > p50) p10 = p50
    if (p90 < p50) p90 = p50

    return {
      month: mock.month,
      p10,
      p50,
      p90,
      priorP10: mock.priorP10,
      priorP50: mock.priorP50,
      priorP90: mock.priorP90,
    }
  })

  return { points, source: "lstm", ageDays, isStale: false }
}

function interpolateAt(
  anchors: readonly LstmPoint[],
  day: number,
): { p10: number; p50: number; p90: number } {
  const first = anchors[0]!
  const last = anchors[anchors.length - 1]!

  if (day <= first.day) {
    return { p10: first.revenueP10, p50: first.revenueP50, p90: first.revenueP90 }
  }
  if (day >= last.day) {
    return { p10: last.revenueP10, p50: last.revenueP50, p90: last.revenueP90 }
  }

  for (let k = 0; k < anchors.length - 1; k++) {
    const lo = anchors[k]!
    const hi = anchors[k + 1]!
    if (day >= lo.day && day <= hi.day) {
      const span = hi.day - lo.day
      const t = span === 0 ? 0 : (day - lo.day) / span
      return {
        p10: lo.revenueP10 + (hi.revenueP10 - lo.revenueP10) * t,
        p50: lo.revenueP50 + (hi.revenueP50 - lo.revenueP50) * t,
        p90: lo.revenueP90 + (hi.revenueP90 - lo.revenueP90) * t,
      }
    }
  }

  return { p10: last.revenueP10, p50: last.revenueP50, p90: last.revenueP90 }
}
