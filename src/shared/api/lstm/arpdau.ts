import type { CohortObservation } from "../appsflyer/types"

export type ArpdauResult = {
  arpdauUsd: number
  effectiveDays: number
}

/**
 * trailing windowDays 윈도우에서 Σrevenue / Σ DAU(t).
 * DAU(t) = Σ cohort_size(t-a) × observed_retention(a) using D1/D7/D30 anchor flat-step.
 * 데이터 없거나 분모 0이면 silent zero 반환 (throw 안 함).
 */
export function estimateArpdau(args: {
  revenueDaily: { date: string; sumUsd: number }[]
  cohorts: CohortObservation[]
  windowDays?: number
}): ArpdauResult {
  const { revenueDaily, cohorts, windowDays = 14 } = args
  if (revenueDaily.length === 0) return { arpdauUsd: 0, effectiveDays: 0 }

  const sortedRevenue = [...revenueDaily].sort((a, b) => a.date.localeCompare(b.date))
  const window = sortedRevenue.slice(-windowDays)
  const effectiveDays = window.length
  const totalRevenue = window.reduce((s, r) => s + r.sumUsd, 0)

  if (totalRevenue === 0) return { arpdauUsd: 0, effectiveDays }

  const totalDau = window.reduce((sumDau, dayRow) => {
    const t = dayRow.date
    return sumDau + estimateDauOnDate(t, cohorts)
  }, 0)

  if (totalDau === 0) return { arpdauUsd: 0, effectiveDays }
  return { arpdauUsd: totalRevenue / totalDau, effectiveDays }
}

function estimateDauOnDate(targetDate: string, cohorts: CohortObservation[]): number {
  let dau = 0
  const target = new Date(targetDate).getTime()
  for (const c of cohorts) {
    const ageDays = Math.floor((target - new Date(c.cohortDate).getTime()) / 86_400_000)
    if (ageDays < 0) continue
    // 모든 anchor가 null이면 관측된 리텐션 신호가 전혀 없는 cohort —
    // install-day(age=0) 포함 silent zero 처리 (silent-zero policy).
    if (!hasAnyRetention(c)) continue
    if (ageDays === 0) {
      dau += c.installs
      continue
    }
    const r = stepRetention(ageDays, c)
    if (r > 0) dau += c.installs * r
  }
  return dau
}

function hasAnyRetention(c: CohortObservation): boolean {
  return (
    c.retainedByDay.d1 !== null ||
    c.retainedByDay.d7 !== null ||
    c.retainedByDay.d30 !== null
  )
}

function stepRetention(age: number, c: CohortObservation): number {
  const installs = c.installs
  if (installs === 0) return 0
  const d1 = c.retainedByDay.d1 ?? 0
  const d7 = c.retainedByDay.d7 ?? 0
  const d30 = c.retainedByDay.d30 ?? 0
  if (age >= 30) return d30 / installs
  if (age >= 7) return d7 / installs
  if (age >= 1) return d1 / installs
  return 1
}
