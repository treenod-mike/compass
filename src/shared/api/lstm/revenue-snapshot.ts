import { z } from "zod"
import snapshot from "../data/lstm/revenue-snapshot.json"

const ForecastPointSchema = z
  .object({
    day: z.number().int().positive().max(1095),
    dauP50: z.number().nonnegative(),
    revenueP10: z.number().nonnegative(),
    revenueP50: z.number().nonnegative(),
    revenueP90: z.number().nonnegative(),
  })
  .strict()
  .refine((p) => p.revenueP10 <= p.revenueP50 && p.revenueP50 <= p.revenueP90, {
    message: "revenue band must satisfy P10 <= P50 <= P90",
  })

const GameForecastSchema = z
  .object({
    points: z.array(ForecastPointSchema).min(11).max(365),
  })
  .strict()

export const RevenueSnapshotSchema = z
  .object({
    schema_version: z.literal("1.0"),
    generated_at: z.string().datetime(),
    source_retention_at: z.string().datetime(),
    arpdau: z
      .object({
        perGame: z.record(z.string(), z.number().positive()),
        currency: z.enum(["KRW", "USD"]),
        windowDays: z.number().int().positive(),
      })
      .strict(),
    installsAssumption: z
      .object({
        perGame: z.record(z.string(), z.number().positive()),
        method: z.literal("trailing-14d-mean"),
      })
      .strict(),
    forecast: z.record(z.string(), GameForecastSchema),
  })
  .strict()
  .refine(
    (s) =>
      Object.keys(s.forecast).every(
        (g) => s.arpdau.perGame[g] !== undefined && s.installsAssumption.perGame[g] !== undefined,
      ),
    {
      message: "every forecast game_id must have a matching arpdau.perGame and installsAssumption.perGame entry",
    },
  )

export type RevenueSnapshot = z.infer<typeof RevenueSnapshotSchema>
export type RevenueForecastPoint = z.infer<typeof ForecastPointSchema>

const PARSED: RevenueSnapshot = RevenueSnapshotSchema.parse(snapshot)

const STALE_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000

export function loadRevenueSnapshot(): RevenueSnapshot {
  return PARSED
}

export function getGameForecast(gameId: string): RevenueForecastPoint[] | null {
  return PARSED.forecast[gameId]?.points ?? null
}

export function isRevenueSnapshotStale(now: Date = new Date()): boolean {
  const age = now.getTime() - new Date(PARSED.generated_at).getTime()
  return age > STALE_THRESHOLD_MS
}

export function revenueSnapshotAgeDays(now: Date = new Date()): number {
  const age = now.getTime() - new Date(PARSED.generated_at).getTime()
  return Math.floor(age / (24 * 60 * 60 * 1000))
}

export function getRevenueSnapshotMeta(): {
  schemaVersion: string
  generatedAt: string
  sourceRetentionAt: string
  currency: "KRW" | "USD"
  arpdauWindowDays: number
} {
  return {
    schemaVersion: PARSED.schema_version,
    generatedAt: PARSED.generated_at,
    sourceRetentionAt: PARSED.source_retention_at,
    currency: PARSED.arpdau.currency,
    arpdauWindowDays: PARSED.arpdau.windowDays,
  }
}
