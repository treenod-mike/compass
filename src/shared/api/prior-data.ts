import { z } from "zod";
import snapshotJson from "./data/sensor-tower/merge-jp-snapshot.json";

const PercentileSchema = z.object({
  p10: z.number(),
  p50: z.number(),
  p90: z.number(),
});

const MonthlyPointSchema = z.object({
  month: z.string(),
  value: z.number(),
});

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
  }),
  topGames: z.array(z.object({
    rank: z.number(),
    name: z.string(),
    publisher: z.string(),
    appIds: z.object({ ios: z.string().nullable(), android: z.string().nullable() }),
    downloads: z.object({
      last90dTotal: z.number().nullable(),
      monthly: z.array(MonthlyPointSchema),
    }),
    revenue: z.object({
      last90dTotalUsd: z.number().nullable(),
      monthly: z.array(MonthlyPointSchema),
    }),
    retention: z.object({
      d1: z.number().nullable(),
      d7: z.number().nullable(),
      d30: z.number().nullable(),
      sampleSize: z.string(),
      fetchedAt: z.string(),
    }),
  })),
  genrePrior: z.object({
    retention: z.object({
      d1: PercentileSchema, d7: PercentileSchema, d30: PercentileSchema,
    }),
    monthlyRevenueUsd: PercentileSchema,
    monthlyDownloads: PercentileSchema,
  }),
});

const validated = SnapshotSchema.parse(snapshotJson);

// Revenue arrives from the crawler in USD × 100 (cents). Normalize to plain USD here
// so widgets never have to remember the scale.
const CENTS_PER_USD = 100;
const scalePct = (p: { p10: number; p50: number; p90: number }) => ({
  p10: p.p10 / CENTS_PER_USD,
  p50: p.p50 / CENTS_PER_USD,
  p90: p.p90 / CENTS_PER_USD,
});

const normalizedTopGames = validated.topGames.map((g) => ({
  ...g,
  revenue: {
    last90dTotalUsd: g.revenue.last90dTotalUsd == null ? null : g.revenue.last90dTotalUsd / CENTS_PER_USD,
    monthly: g.revenue.monthly.map((m) => ({ month: m.month, value: m.value / CENTS_PER_USD })),
  },
}));

const normalizedPrior = {
  retention: validated.genrePrior.retention,
  monthlyRevenueUsd: scalePct(validated.genrePrior.monthlyRevenueUsd),
  monthlyDownloads: validated.genrePrior.monthlyDownloads,
};

export const priorByGenre = {
  Merge: { JP: normalizedPrior },
} as const;

export const priorMetadata = validated.metadata;
export const priorTopGames = normalizedTopGames;

export function isPriorStale(maxDays = 14): boolean {
  const fetchedAt = new Date(priorMetadata.fetchedAt).getTime();
  const ageMs = Date.now() - fetchedAt;
  return ageMs > maxDays * 24 * 60 * 60 * 1000;
}

export function priorAgeDays(): number {
  const fetchedAt = new Date(priorMetadata.fetchedAt).getTime();
  return Math.floor((Date.now() - fetchedAt) / (24 * 60 * 60 * 1000));
}
