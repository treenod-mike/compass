export type RetentionKeypoint = {
  day: number
  p10: number
  p50: number
  p90: number
}

export type RetentionBand = {
  p10: number
  p50: number
  p90: number
}

export type MarketingSimInput = {
  uaBudgetUsdPerDay: number
  cpiUsd: number
  retentionKeypoints: RetentionKeypoint[]
  targetArpdauUsd: number
  horizonDays: number
}

export type MarketingSimDayPoint = {
  day: number
  dauP10: number
  dauP50: number
  dauP90: number
  revenueP10: number
  revenueP50: number
  revenueP90: number
  cumulativeRevenueP10: number
  cumulativeRevenueP50: number
  cumulativeRevenueP90: number
  cumulativeSpend: number
  roasP10: number
  roasP50: number
  roasP90: number
}

export type MarketingSimResult = {
  installsPerDay: number
  spendPerDay: number
  daily: MarketingSimDayPoint[]
  paybackDayP10: number | null
  paybackDayP50: number | null
  paybackDayP90: number | null
  totalRevenueP50: number
  day30RoasP50: number | null
}
