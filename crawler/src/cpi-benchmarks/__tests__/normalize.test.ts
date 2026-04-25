import { describe, it, expect } from "vitest"
import {
  normalizeCountry,
  normalizeGenre,
  normalizePlatform,
  normalizeLevelPlayResponse,
} from "../normalize.js"

describe("normalizeCountry", () => {
  it("handles alpha-2 passthrough", () => {
    expect(normalizeCountry("JP")).toBe("JP")
    expect(normalizeCountry("us")).toBe("US")
  })
  it("maps country names", () => {
    expect(normalizeCountry("Japan")).toBe("JP")
    expect(normalizeCountry("United States")).toBe("US")
    expect(normalizeCountry("South Korea")).toBe("KR")
  })
  it("returns null for unknown", () => {
    expect(normalizeCountry("Atlantis")).toBeNull()
  })
})

describe("normalizeGenre", () => {
  it("maps LevelPlay labels to Compass enum", () => {
    expect(normalizeGenre("Casual")).toBe("casual")
    expect(normalizeGenre("Match-3")).toBe("puzzle")
    expect(normalizeGenre("Role Playing")).toBe("rpg")
  })
  it("returns null for unknown genre", () => {
    expect(normalizeGenre("Metaverse")).toBeNull()
  })
})

describe("normalizePlatform", () => {
  it("lowercases platform", () => {
    expect(normalizePlatform("IOS")).toBe("ios")
    expect(normalizePlatform("Android")).toBe("android")
  })
  it("returns null for unknown", () => {
    expect(normalizePlatform("web")).toBeNull()
  })
})

describe("normalizeLevelPlayResponse", () => {
  it("converts LevelPlay rows into PlatformCountryMap shape", () => {
    const input = [
      { platform: "iOS", country: "Japan", genre: "Casual", cpi: 3.8, cpm: 18.5 },
      { platform: "iOS", country: "Japan", genre: "Role Playing", cpi: 5.8 },
      { platform: "Android", country: "United States", genre: "Casual", cpi: 2.1 },
    ]
    const result = normalizeLevelPlayResponse(input)
    expect(result.platforms.ios?.JP?.casual).toEqual({ cpi: 3.8, cpm: 18.5 })
    expect(result.platforms.ios?.JP?.rpg).toEqual({ cpi: 5.8 })
    expect(result.platforms.android?.US?.casual).toEqual({ cpi: 2.1 })
  })
  it("collects warnings for unknown country/genre/platform", () => {
    const input = [
      { platform: "iOS", country: "Atlantis", genre: "Casual", cpi: 1 },
      { platform: "iOS", country: "Japan", genre: "Metaverse", cpi: 1 },
    ]
    const result = normalizeLevelPlayResponse(input)
    expect(result.warnings.length).toBe(2)
  })
})
