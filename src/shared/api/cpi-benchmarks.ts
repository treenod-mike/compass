import { z } from "zod"
import snapshot from "./data/cpi-benchmarks/levelplay-snapshot.json"

const CountryCodeSchema = z.enum([
  "JP",
  "US",
  "KR",
  "DE",
  "GB",
  "FR",
  "CN",
  "TW",
  "HK",
  "SG",
  "TH",
  "ID",
  "VN",
  "BR",
  "MX",
  "CA",
  "AU",
  "IN",
  "RU",
  "TR",
  "ES",
  "IT",
  "NL",
  "SE",
  "PL",
])
export type CountryCode = z.infer<typeof CountryCodeSchema>

const GenreSchema = z.enum([
  "merge",
  "puzzle",
  "rpg",
  "casual",
  "strategy",
  "idle",
  "simulation",
  "arcade",
])
export type Genre = z.infer<typeof GenreSchema>

const PlatformSchema = z.enum(["ios", "android"])
export type Platform = z.infer<typeof PlatformSchema>

const MetricsSchema = z
  .object({
    cpi: z.number().positive().max(100),
    cpm: z.number().positive().max(200).optional(),
  })
  .strict()

const GenreMetricsMapSchema = z.partialRecord(GenreSchema, MetricsSchema)
const CountryGenreMapSchema = z.partialRecord(CountryCodeSchema, GenreMetricsMapSchema)
const PlatformCountryMapSchema = z.partialRecord(PlatformSchema, CountryGenreMapSchema)

const SnapshotSchema = z
  .object({
    version: z.literal(1),
    source: z.literal("unity-levelplay-cpi-index"),
    generatedAt: z.string().datetime(),
    sourceRange: z
      .object({
        start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
      .strict(),
    platforms: PlatformCountryMapSchema,
  })
  .strict()

const PARSED = SnapshotSchema.parse(snapshot)

const GENRE_FALLBACK: Partial<Record<Genre, Genre>> = {
  merge: "casual",
}

const STALE_THRESHOLD_MS = 35 * 24 * 60 * 60 * 1000

export interface LookupResult {
  cpi: number
  usedFallbackGenre: boolean
}

export function lookupCpi(
  country: CountryCode,
  genre: Genre,
  platform: Platform,
): number | null {
  const detailed = lookupCpiDetailed(country, genre, platform)
  return detailed?.cpi ?? null
}

export function lookupCpiDetailed(
  country: CountryCode,
  genre: Genre,
  platform: Platform,
): LookupResult | null {
  const table = PARSED.platforms[platform]?.[country]
  if (!table) return null
  const direct = table[genre]
  if (direct) return { cpi: direct.cpi, usedFallbackGenre: false }
  const fb = GENRE_FALLBACK[genre]
  if (fb && table[fb]) return { cpi: table[fb]!.cpi, usedFallbackGenre: true }
  return null
}

export function isBenchmarkStale(now: Date = new Date()): boolean {
  const age = now.getTime() - new Date(PARSED.generatedAt).getTime()
  return age > STALE_THRESHOLD_MS
}

export function benchmarkAgeDays(now: Date = new Date()): number {
  const age = now.getTime() - new Date(PARSED.generatedAt).getTime()
  return Math.floor(age / (24 * 60 * 60 * 1000))
}

export function getSourceMeta(): {
  source: string
  generatedAt: string
  version: number
} {
  return {
    source: PARSED.source,
    generatedAt: PARSED.generatedAt,
    version: PARSED.version,
  }
}
