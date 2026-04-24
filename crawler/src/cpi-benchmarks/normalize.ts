import type { CountryCode, Genre, Platform } from "./schema.js"

const COUNTRY_NAME_MAP: Record<string, CountryCode> = {
  "japan": "JP",
  "united states": "US",
  "usa": "US",
  "korea": "KR",
  "south korea": "KR",
  "germany": "DE",
  "united kingdom": "GB",
  "uk": "GB",
  "france": "FR",
  "china": "CN",
  "taiwan": "TW",
  "hong kong": "HK",
  "singapore": "SG",
  "thailand": "TH",
  "indonesia": "ID",
  "vietnam": "VN",
  "brazil": "BR",
  "mexico": "MX",
  "canada": "CA",
  "australia": "AU",
  "india": "IN",
  "russia": "RU",
  "turkey": "TR",
  "spain": "ES",
  "italy": "IT",
  "netherlands": "NL",
  "sweden": "SE",
  "poland": "PL",
}

const VALID_COUNTRY_CODES = new Set<string>([
  "JP", "US", "KR", "DE", "GB", "FR", "CN", "TW", "HK", "SG", "TH", "ID", "VN",
  "BR", "MX", "CA", "AU", "IN", "RU", "TR", "ES", "IT", "NL", "SE", "PL",
])

export function normalizeCountry(raw: string): CountryCode | null {
  const upper = raw.trim().toUpperCase()
  if (VALID_COUNTRY_CODES.has(upper)) return upper as CountryCode
  const lower = raw.trim().toLowerCase()
  return COUNTRY_NAME_MAP[lower] ?? null
}

const GENRE_MAP: Record<string, Genre> = {
  "casual": "casual",
  "merge": "merge",
  "puzzle": "puzzle",
  "match-3": "puzzle",
  "match 3": "puzzle",
  "rpg": "rpg",
  "role playing": "rpg",
  "role-playing": "rpg",
  "strategy": "strategy",
  "idle": "idle",
  "simulation": "simulation",
  "sim": "simulation",
  "arcade": "arcade",
}

export function normalizeGenre(raw: string): Genre | null {
  return GENRE_MAP[raw.trim().toLowerCase()] ?? null
}

export function normalizePlatform(raw: string): Platform | null {
  const lower = raw.trim().toLowerCase()
  if (lower === "ios" || lower === "android") return lower
  return null
}

export interface LevelPlayRow {
  platform: string
  country: string
  genre: string
  cpi: number
  cpm?: number
}

export interface NormalizeResult {
  platforms: {
    ios?: Record<string, Record<string, { cpi: number; cpm?: number }>>
    android?: Record<string, Record<string, { cpi: number; cpm?: number }>>
  }
  warnings: string[]
}

export function normalizeLevelPlayResponse(rows: readonly LevelPlayRow[]): NormalizeResult {
  const out: NormalizeResult = { platforms: {}, warnings: [] }
  for (const row of rows) {
    const plat = normalizePlatform(row.platform)
    const country = normalizeCountry(row.country)
    const genre = normalizeGenre(row.genre)
    if (!plat || !country || !genre) {
      out.warnings.push(`skip: platform=${row.platform} country=${row.country} genre=${row.genre}`)
      continue
    }
    out.platforms[plat] ??= {}
    out.platforms[plat]![country] ??= {}
    out.platforms[plat]![country][genre] = {
      cpi: row.cpi,
      ...(row.cpm !== undefined ? { cpm: row.cpm } : {}),
    }
  }
  return out
}
