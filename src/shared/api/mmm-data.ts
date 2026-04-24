import { z } from "zod"
import snapshotJson from "./data/mmm/mock-snapshot.json"

/* ─────────── Zod schemas ─────────── */

const ResponseCurveSchema = z
  .object({
    spendGrid: z.array(z.number().nonnegative()).min(10).max(50),
    p10: z.array(z.number().nonnegative()),
    p50: z.array(z.number().nonnegative()),
    p90: z.array(z.number().nonnegative()),
  })
  .refine(
    (c) =>
      c.spendGrid.length === c.p10.length &&
      c.p10.length === c.p50.length &&
      c.p50.length === c.p90.length,
    { message: "spendGrid / p10 / p50 / p90 must have equal length" },
  )

const SaturationSchema = z.object({
  halfSaturation: z.number().positive(),
  hillCoefficient: z.number().positive(),
})

const ChannelKeySchema = z.enum([
  "meta",
  "google",
  "tiktok",
  "apple-search",
])
export type ChannelKey = z.infer<typeof ChannelKeySchema>

const LocalizedTextSchema = z.object({
  ko: z.string(),
  en: z.string(),
})
export type LocalizedText = z.infer<typeof LocalizedTextSchema>

const RecommendationSchema = z.object({
  action: z.enum(["increase", "decrease", "hold"]),
  deltaSpend: z.number(),
  rationale: LocalizedTextSchema,
})
export type MmmRecommendation = z.infer<typeof RecommendationSchema>

const MmpComparisonSchema = z.object({
  mmpInstalls: z.number().int().nonnegative(),
  mmmInstalls: z.number().int().nonnegative(),
  biasDeltaPct: z.number(),
})
export type MmpComparison = z.infer<typeof MmpComparisonSchema>

const ChannelSchema = z.object({
  key: ChannelKeySchema,
  label: z.string(),
  responseCurve: ResponseCurveSchema,
  currentSpend: z.number().nonnegative(),
  currentInstalls: z.number().int().nonnegative(),
  saturation: SaturationSchema,
  marginal: z.object({
    cpi: z.number().positive(),
    roas: z.number().nonnegative(),
  }),
  benchmark: z.object({
    marketMedianCpi: z.number().positive(),
    marketMedianRoas: z.number().nonnegative(),
    source: z.string(),
  }),
  recommendation: RecommendationSchema,
  mmpComparison: MmpComparisonSchema,
})
export type MmmChannel = z.infer<typeof ChannelSchema>

const VerdictSchema = z.object({
  status: z.enum(["invest", "hold", "reduce"]),
  confidence: z.number().min(0).max(1),
  headline: LocalizedTextSchema,
  metrics: z
    .array(
      z.object({
        label: LocalizedTextSchema,
        value: z.string(),
      }),
    )
    .min(3)
    .max(5),
})
export type MmmVerdict = z.infer<typeof VerdictSchema>

const GameKeySchema = z.enum([
  "portfolio",
  "match-league",
  "weaving-fairy",
  "dig-infinity",
])

const MetadataSchema = z.object({
  generatedAt: z.string().datetime(),
  source: z.enum(["mock-v1", "pymc-marketing-v1"]),
  gameKey: GameKeySchema,
  fiscalWindow: z.object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
  currency: z.enum(["KRW", "USD", "JPY", "EUR"]),
})
export type MmmMetadata = z.infer<typeof MetadataSchema>

const PortfolioSchema = z.object({
  saturationWeighted: z.number().min(0).max(1),
  saturationInterpretation: LocalizedTextSchema,
})
export type MmmPortfolio = z.infer<typeof PortfolioSchema>

const ContributionSchema = z.object({
  totalInstalls: z.number().int().nonnegative(),
  organic: z.number().int().nonnegative(),
  paid: z.record(ChannelKeySchema, z.number().int().nonnegative()),
  interpretation: LocalizedTextSchema,
})
export type MmmContribution = z.infer<typeof ContributionSchema>

const ReallocationMoveSchema = z.object({
  from: ChannelKeySchema,
  to: ChannelKeySchema,
  amount: z.number().positive(),
})

const ReallocationSchema = z.object({
  totalMoved: z.number().nonnegative(),
  expectedRevenueLift: z.number(),
  expectedRevenueLiftPct: z.number(),
  confidence: z.number().min(0).max(1),
  moves: z.array(ReallocationMoveSchema).max(6),
})
export type MmmReallocation = z.infer<typeof ReallocationSchema>

export const SnapshotSchema = z.object({
  $schemaVersion: z.literal(2),
  metadata: MetadataSchema,
  verdict: VerdictSchema,
  portfolio: PortfolioSchema,
  contribution: ContributionSchema,
  channels: z.array(ChannelSchema).length(4),
  reallocation: ReallocationSchema,
})
export type MmmSnapshot = z.infer<typeof SnapshotSchema>

/* ─────────── Parse + exports ─────────── */

const snapshot = SnapshotSchema.parse(snapshotJson)

export const mmmMetadata: MmmMetadata = snapshot.metadata
export const mmmVerdict: MmmVerdict = snapshot.verdict
export const mmmPortfolio: MmmPortfolio = snapshot.portfolio
export const mmmContribution: MmmContribution = snapshot.contribution
export const mmmChannels: readonly MmmChannel[] = snapshot.channels
export const mmmReallocation: MmmReallocation = snapshot.reallocation

const MS_PER_DAY = 86_400_000
const STALE_THRESHOLD_DAYS = 90

export function mmmAgeDays(now: Date = new Date()): number {
  const ageMs = now.getTime() - new Date(mmmMetadata.generatedAt).getTime()
  return Math.floor(ageMs / MS_PER_DAY)
}

export function isMmmStale(now: Date = new Date()): boolean {
  return mmmAgeDays(now) >= STALE_THRESHOLD_DAYS
}

export function getMmmChannel(key: ChannelKey): MmmChannel {
  const channel = mmmChannels.find((c) => c.key === key)
  if (!channel) throw new Error(`MMM channel not found: ${key}`)
  return channel
}
