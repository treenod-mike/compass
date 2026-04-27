import { describe, it, expect } from "vitest"
import {
  convertToUsd,
  isCurrencySupported,
  EXCHANGE_RATES_AS_OF,
  type SupportedCurrency,
} from "../currency"

describe("convertToUsd", () => {
  it("USD passes through unchanged", () => {
    expect(convertToUsd(100, "USD")).toBe(100)
    expect(convertToUsd(0, "USD")).toBe(0)
    expect(convertToUsd(99.99, "USD")).toBe(99.99)
  })

  it("KRW divides by static 1300 rate", () => {
    expect(convertToUsd(1300, "KRW")).toBeCloseTo(1.0)
    expect(convertToUsd(13_000_000, "KRW")).toBeCloseTo(10_000)
  })

  it("returns null for unsupported currencies (JPY, EUR, ...)", () => {
    expect(convertToUsd(100, "JPY" as SupportedCurrency)).toBeNull()
    expect(convertToUsd(100, "EUR" as SupportedCurrency)).toBeNull()
    expect(convertToUsd(100, "GBP" as SupportedCurrency)).toBeNull()
  })

  it("null input returns null regardless of currency", () => {
    expect(convertToUsd(null, "USD")).toBeNull()
    expect(convertToUsd(null, "KRW")).toBeNull()
  })

  it("negative amounts pass through (refund / clawback rows allowed)", () => {
    expect(convertToUsd(-50, "USD")).toBe(-50)
    expect(convertToUsd(-1300, "KRW")).toBeCloseTo(-1.0)
  })
})

describe("isCurrencySupported", () => {
  it("returns true for USD and KRW", () => {
    expect(isCurrencySupported("USD")).toBe(true)
    expect(isCurrencySupported("KRW")).toBe(true)
  })
  it("returns false for everything else", () => {
    expect(isCurrencySupported("JPY")).toBe(false)
    expect(isCurrencySupported("EUR")).toBe(false)
    expect(isCurrencySupported("XYZ")).toBe(false)
  })
})

describe("EXCHANGE_RATES_AS_OF", () => {
  it("exposes a quarter tag so stale rates can be detected later", () => {
    expect(EXCHANGE_RATES_AS_OF).toMatch(/^\d{4}-Q[1-4]$/)
  })
})
