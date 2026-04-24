/**
 * CPI benchmark snapshot schema.
 *
 * Design decisions:
 * - `.strict()` on object schemas: unknown keys REJECTED. LevelPlay format
 *   changes must bump the schema version explicitly rather than silently drop fields.
 * - `z.record(…)` partial semantics: missing keys = absent-by-design (not fetch failure).
 *   Fetch failures are logged + excluded upstream before this schema sees them.
 * - `version: z.literal(1)`: hard gate for future v2 migration.
 */
import { z } from "zod"

export const CountryCodeSchema = z.enum([
  "JP", "US", "KR", "DE", "GB", "FR", "CN", "TW", "HK", "SG", "TH", "ID", "VN",
  "BR", "MX", "CA", "AU", "IN", "RU", "TR", "ES", "IT", "NL", "SE", "PL",
])
export type CountryCode = z.infer<typeof CountryCodeSchema>

export const GenreSchema = z.enum([
  "merge", "puzzle", "rpg", "casual", "strategy", "idle", "simulation", "arcade",
])
export type Genre = z.infer<typeof GenreSchema>

export const PlatformSchema = z.enum(["ios", "android"])
export type Platform = z.infer<typeof PlatformSchema>

export const MetricsSchema = z.object({
  cpi: z.number().positive().max(100),
  cpm: z.number().positive().max(200).optional(),
}).strict()
export type Metrics = z.infer<typeof MetricsSchema>

export const GenreMetricsMapSchema = z.record(GenreSchema, MetricsSchema)
export const CountryGenreMapSchema = z.record(CountryCodeSchema, GenreMetricsMapSchema)
export const PlatformCountryMapSchema = z.record(PlatformSchema, CountryGenreMapSchema)

export const SnapshotSchema = z.object({
  version: z.literal(1),
  source: z.literal("unity-levelplay-cpi-index"),
  generatedAt: z.string().datetime(),
  sourceRange: z.object({
    start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }).strict(),
  platforms: PlatformCountryMapSchema,
}).strict()
export type Snapshot = z.infer<typeof SnapshotSchema>
