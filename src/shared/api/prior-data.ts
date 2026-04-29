import { z } from "zod"
import snapshotJson from "./data/sensor-tower/merge-jp-snapshot.json"
import { computeEffectiveN, type EmpiricalDist } from "../lib/bayesian-stats"

const PercentileSchema = z.object({
  p10: z.number(),
  p50: z.number(),
  p90: z.number(),
})

const SnapshotSchema = z.object({
  $schemaVersion: z.literal(1),
  metadata: z.object({
    fetchedAt: z.string(),
    fetchedBy: z.string(),
    genre: z.string(),
    region: z.string(),
    topN: z.number(),
    tier: z.string(),
    crawlerVersion: z.string(),
    warnings: z.array(z.string()),
    nonNullCount: z
      .object({
        retention_d1: z.number().int().nonnegative(),
        retention_d7: z.number().int().nonnegative(),
        retention_d30: z.number().int().nonnegative(),
        monthlyRevenueUsd: z.number().int().nonnegative(),
        monthlyDownloads: z.number().int().nonnegative(),
      })
      .optional(),
  }),
  topGames: z.array(
    z.object({
      rank: z.number(),
      name: z.string(),
      publisher: z.string(),
      appIds: z.object({ ios: z.string().nullable(), android: z.string().nullable() }),
      downloads: z.object({
        last90dTotal: z.number().nullable(),
        monthly: z.array(z.object({ month: z.string(), value: z.number() })),
      }),
      revenue: z.object({
        last90dTotalUsd: z.number().nullable(),
        monthly: z.array(z.object({ month: z.string(), value: z.number() })),
      }),
      retention: z.object({
        d1: z.number().nullable(),
        d7: z.number().nullable(),
        d30: z.number().nullable(),
        sampleSize: z.string(),
        fetchedAt: z.string(),
      }),
    }),
  ),
  genrePrior: z.object({
    retention: z.object({
      d1: PercentileSchema,
      d7: PercentileSchema,
      d30: PercentileSchema,
    }),
    monthlyRevenueUsd: PercentileSchema,
    monthlyDownloads: PercentileSchema,
  }),
})

export type PriorBundleKey = { genre: string; region: string }

export type PriorBundle = {
  key: PriorBundleKey
  effectiveN: number
  fetchedAt: string
  ageDays: number
  isStale: boolean
  retention: { d1: EmpiricalDist; d7: EmpiricalDist; d30: EmpiricalDist }
  monthlyRevenueUsd: EmpiricalDist
  monthlyDownloads: EmpiricalDist
  nonNullCount: {
    retention_d1: number
    retention_d7: number
    retention_d30: number
    monthlyRevenueUsd: number
    monthlyDownloads: number
  }
  topGamesForAudit: z.infer<typeof SnapshotSchema>["topGames"]
  crawlerVersion: string
}

const STALE_DAYS = 14

function daysBetween(a: Date, b: Date): number {
  return Math.floor(Math.abs(a.getTime() - b.getTime()) / 86_400_000)
}

function buildBundle(raw: unknown): PriorBundle {
  const s = SnapshotSchema.parse(raw)
  const fetchedAtDate = new Date(s.metadata.fetchedAt)
  const ageDays = daysBetween(new Date(), fetchedAtDate)

  const nonNullCount = s.metadata.nonNullCount ?? {
    retention_d1: s.topGames.filter((g) => g.retention.d1 != null).length,
    retention_d7: s.topGames.filter((g) => g.retention.d7 != null).length,
    retention_d30: s.topGames.filter((g) => g.retention.d30 != null).length,
    monthlyRevenueUsd: s.topGames.filter((g) => g.revenue.last90dTotalUsd != null).length,
    monthlyDownloads: s.topGames.filter((g) => g.downloads.last90dTotal != null).length,
  }

  const minNonNull = Math.min(
    nonNullCount.retention_d1,
    nonNullCount.retention_d7,
    nonNullCount.retention_d30,
    nonNullCount.monthlyRevenueUsd,
  )

  return {
    key: { genre: s.metadata.genre, region: s.metadata.region },
    effectiveN: computeEffectiveN(minNonNull),
    fetchedAt: s.metadata.fetchedAt,
    ageDays,
    isStale: ageDays > STALE_DAYS,
    retention: s.genrePrior.retention,
    monthlyRevenueUsd: s.genrePrior.monthlyRevenueUsd,
    monthlyDownloads: s.genrePrior.monthlyDownloads,
    nonNullCount,
    topGamesForAudit: s.topGames,
    crawlerVersion: s.metadata.crawlerVersion,
  }
}

const bundles: Record<string, PriorBundle> = {
  "Merge:JP": buildBundle(snapshotJson),
}

export function getPrior(key: PriorBundleKey): PriorBundle | null {
  return bundles[`${key.genre}:${key.region}`] ?? null
}

export function listAvailablePriors(): PriorBundleKey[] {
  return Object.keys(bundles).map((k) => {
    const [genre, region] = k.split(":")
    return { genre: genre ?? "", region: region ?? "" }
  })
}

// --- Backward-compat deprecated exports (used by prior-posterior-chart.tsx; migrate in Phase 7) ---

/** @deprecated use getPrior({genre:"Merge",region:"JP"}) */
export const priorByGenre = {
  Merge: {
    JP: {
      retention: bundles["Merge:JP"]!.retention,
      monthlyRevenueUsd: bundles["Merge:JP"]!.monthlyRevenueUsd,
      monthlyDownloads: bundles["Merge:JP"]!.monthlyDownloads,
    },
  },
} as const

/** @deprecated */
export const priorMetadata = {
  fetchedAt: bundles["Merge:JP"]!.fetchedAt,
  genre: "Merge",
  region: "JP",
  topN: snapshotJson.metadata.topN,
  warnings: [] as string[],
}

/** @deprecated */
export const priorTopGames = bundles["Merge:JP"]!.topGamesForAudit

/** @deprecated */
export function isPriorStale(maxDays = STALE_DAYS): boolean {
  return bundles["Merge:JP"]!.ageDays > maxDays
}

/** @deprecated */
export function priorAgeDays(): number {
  return bundles["Merge:JP"]!.ageDays
}

/**
 * Convenience accessor — returns market median retention (D1/D7/D30) in
 * percent (0–100 scale) for a given genre/region. Returns null if no
 * snapshot is available. Centralizes the fraction-to-percent conversion
 * so consumers don't drift to inconsistent units.
 */
export function getMarketRetentionPct(key: PriorBundleKey):
  | { d1: number; d7: number; d30: number }
  | null {
  const p = getPrior(key)
  if (!p) return null
  return {
    d1: p.retention.d1.p50 * 100,
    d7: p.retention.d7.p50 * 100,
    d30: p.retention.d30.p50 * 100,
  }
}
