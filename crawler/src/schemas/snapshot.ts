import { z } from "zod";

const PercentileSchema = z.object({
  p10: z.number(),
  p50: z.number(),
  p90: z.number(),
});

const MonthlyPointSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  value: z.number(),
});

const TopGameSchema = z.object({
  rank: z.number().int().positive(),
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
});

export const SnapshotSchema = z.object({
  $schemaVersion: z.literal(1),
  metadata: z.object({
    fetchedAt: z.string(),
    fetchedBy: z.string(),
    genre: z.string(),
    region: z.string(),
    topN: z.number().int().positive(),
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
  topGames: z.array(TopGameSchema),
  genrePrior: z.object({
    retention: z.object({ d1: PercentileSchema, d7: PercentileSchema, d30: PercentileSchema }),
    monthlyRevenueUsd: PercentileSchema,
    monthlyDownloads: PercentileSchema,
  }),
});

export type Snapshot = z.infer<typeof SnapshotSchema>;
export type TopGame = z.infer<typeof TopGameSchema>;
