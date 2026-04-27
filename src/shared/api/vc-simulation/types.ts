import { z } from "zod"

export const OfferSchema = z.object({
  investmentUsd: z.number().positive().max(1_000_000_000),
  postMoneyUsd: z.number().positive().max(10_000_000_000),
  exitMultiple: z.number().min(0.1).max(100),
  hurdleRate: z.number().min(0).max(2),
  uaSharePct: z.number().min(0).max(100),
  horizonMonths: z.number().int().min(12).max(60),
})
export type Offer = z.infer<typeof OfferSchema>

const LstmPointSchema = z.object({
  day: z.number().int().positive().max(1095),
  p10: z.number().min(0).max(1),
  p50: z.number().min(0).max(1),
  p90: z.number().min(0).max(1),
})

export const LstmSnapshotSchema = z.object({
  schema_version: z.literal("1.0"),
  generated_at: z.string().datetime(),
  model: z.object({
    name: z.string(),
    version: z.string(),
    trained_at: z.string().datetime(),
    hyperparameters: z.object({
      lookback_days: z.number().positive(),
      forecast_horizon_days: z.number().positive(),
      sample_count: z.number().int().positive(),
      confidence_interval: z.number().min(0).max(1),
    }),
  }),
  predictions: z.record(
    z.string(),
    z.object({
      game_id: z.string(),
      genre: z.string(),
      points: z.array(LstmPointSchema).min(11),
    })
  ),
  notes: z.string().optional(),
})
export type LstmSnapshot = z.infer<typeof LstmSnapshotSchema>

export type RunwayPoint = {
  month: number
  p10: number
  p50: number
  p90: number
}

export type BaselineResult = {
  runway: RunwayPoint[]
  /**
   * Cumulative gross revenue (월별 누적 매출, 단조 증가).
   * `runway`는 비용 차감된 net cash라 음수도 될 수 있는 반면, 이 시계열은
   * 결정권자 친화 ROAS 곡선("매출 / 투자금")을 그리기 위한 단조 증가 데이터다.
   */
  cumulativeRevenue: RunwayPoint[]
  irrDistribution: number[]
  p50Irr: number
  p50Moic: number
  paybackMonths: number | null
}

export const VcSimResultSchema = z.object({
  offer: OfferSchema,
  baselineA: z.any(),
  baselineB: z.any(),
  gap: z.array(z.number()),
  jCurveBreakEvenMonth: z.number().nullable(),
  dataSourceBadge: z.enum(["real", "benchmark", "default"]),
})
export type VcSimResult = {
  offer: Offer
  baselineA: BaselineResult
  baselineB: BaselineResult
  gap: number[]
  jCurveBreakEvenMonth: number | null
  dataSourceBadge: "real" | "benchmark" | "default"
}
